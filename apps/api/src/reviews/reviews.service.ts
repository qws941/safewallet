import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto';

type ReviewAction = 'APPROVE' | 'REJECT' | 'REQUEST_MORE' | 'MARK_URGENT' | 'ASSIGN' | 'CLOSE';
type ReviewStatus = 'RECEIVED' | 'IN_REVIEW' | 'NEED_INFO' | 'APPROVED' | 'REJECTED';
type ActionStatus = 'NONE' | 'REQUIRED' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'REOPENED';

const DEFAULT_APPROVAL_POINTS = 100;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string, dto: CreateReviewDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: dto.postId },
      include: { site: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.requireSiteAdmin(adminId, post.siteId);

    const actionType = dto.action as ReviewAction;
    const { newReviewStatus, newActionStatus } = this.determineNewStatuses(actionType, post.actionStatus as ActionStatus);

    const review = await this.prisma.review.create({
      data: {
        postId: dto.postId,
        adminId,
        action: actionType,
        comment: dto.comment,
      },
    });

    const postUpdateData: {
      reviewStatus: ReviewStatus;
      actionStatus?: ActionStatus;
      isUrgent?: boolean;
    } = { reviewStatus: newReviewStatus };

    if (newActionStatus) {
      postUpdateData.actionStatus = newActionStatus;
    }

    if (actionType === 'MARK_URGENT') {
      postUpdateData.isUrgent = true;
    }

    await this.prisma.post.update({
      where: { id: dto.postId },
      data: postUpdateData,
    });

    if (actionType === 'APPROVE') {
      await this.awardPoints(post.userId, post.siteId, dto.postId, adminId);
    }

    return {
      review,
      postStatus: newReviewStatus,
      pointsAwarded: actionType === 'APPROVE' ? DEFAULT_APPROVAL_POINTS : 0,
    };
  }

  async findByPost(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.requireMembership(userId, post.siteId);

    return this.prisma.review.findMany({
      where: { postId },
      include: { admin: { select: { id: true, nameMasked: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private determineNewStatuses(action: ReviewAction, currentActionStatus: ActionStatus): {
    newReviewStatus: ReviewStatus;
    newActionStatus?: ActionStatus;
  } {
    switch (action) {
      case 'APPROVE':
        return {
          newReviewStatus: 'APPROVED',
          newActionStatus: currentActionStatus === 'NONE' ? 'DONE' : undefined,
        };
      case 'REJECT':
        return { newReviewStatus: 'REJECTED' };
      case 'REQUEST_MORE':
        return { newReviewStatus: 'NEED_INFO' };
      case 'MARK_URGENT':
        return { newReviewStatus: 'IN_REVIEW' };
      case 'ASSIGN':
        return {
          newReviewStatus: 'IN_REVIEW',
          newActionStatus: 'ASSIGNED',
        };
      case 'CLOSE':
        return {
          newReviewStatus: 'APPROVED',
          newActionStatus: 'DONE',
        };
      default:
        throw new BadRequestException('Invalid action');
    }
  }

  private async awardPoints(authorId: string, siteId: string, postId: string, adminId: string) {
    const now = new Date();
    const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    await this.prisma.pointsLedger.create({
      data: {
        userId: authorId,
        siteId,
        amount: DEFAULT_APPROVAL_POINTS,
        reasonCode: 'POST_APPROVED',
        postId,
        settleMonth,
        adminId,
      },
    });
  }

  private async requireMembership(userId: string, siteId: string) {
    const membership = await this.prisma.siteMembership.findUnique({
      where: { userId_siteId: { userId, siteId } },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Not a member of this site');
    }

    return membership;
  }

  private async requireSiteAdmin(userId: string, siteId: string) {
    const membership = await this.requireMembership(userId, siteId);

    if (membership.role !== 'SITE_ADMIN') {
      throw new ForbiddenException('Site admin access required');
    }

    return membership;
  }
}
