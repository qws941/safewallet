import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateActionDto, UpdateActionDto } from './dto';
import { Prisma, TaskStatus } from '@prisma/client';

@Injectable()
export class ActionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(adminId: string, dto: CreateActionDto) {
    const post = await this.prisma.post.findUnique({
      where: { id: dto.postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.requireSiteAdmin(adminId, post.siteId);

    const action = await this.prisma.action.create({
      data: {
        postId: dto.postId,
        assigneeType: dto.assigneeType ?? 'SITE_ADMIN',
        assigneeId: dto.assigneeId ?? adminId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        actionStatus: 'OPEN',
      },
      include: {
        assignee: { select: { id: true, nameMasked: true } },
      },
    });

    await this.prisma.post.update({
      where: { id: dto.postId },
      data: { actionStatus: 'ASSIGNED' },
    });

    return action;
  }

  async findAll(userId: string, query: { postId?: string; status?: string; siteId?: string }) {
    const where: Prisma.ActionWhereInput = {};

    if (query.postId) {
      where.postId = query.postId;
    }

    if (query.status) {
      where.actionStatus = query.status as TaskStatus;
    }

    const actions = await this.prisma.action.findMany({
      where,
      include: {
        post: { select: { id: true, content: true, siteId: true } },
        assignee: { select: { id: true, nameMasked: true } },
        images: true,
      },
      orderBy: [{ actionStatus: 'asc' }, { dueDate: 'asc' }],
    });

    return actions;
  }

  async findOne(actionId: string, userId: string) {
    const action = await this.prisma.action.findUnique({
      where: { id: actionId },
      include: {
        post: { select: { id: true, content: true, siteId: true, category: true } },
        assignee: { select: { id: true, nameMasked: true } },
        images: true,
      },
    });

    if (!action) {
      throw new NotFoundException('Action not found');
    }

    await this.requireMembership(userId, action.post.siteId);

    return action;
  }

  async update(actionId: string, adminId: string, dto: UpdateActionDto) {
    const action = await this.prisma.action.findUnique({
      where: { id: actionId },
      include: { post: true },
    });

    if (!action) {
      throw new NotFoundException('Action not found');
    }

    await this.requireSiteAdmin(adminId, action.post.siteId);

    const updateData: {
      actionStatus?: TaskStatus;
      completionNote?: string;
      completedAt?: Date | null;
      dueDate?: Date | null;
    } = {};

    if (dto.status) {
      updateData.actionStatus = dto.status as TaskStatus;
      if (dto.status === 'DONE') {
        updateData.completedAt = new Date();
      }
    }

    if (dto.completionNote !== undefined) {
      updateData.completionNote = dto.completionNote;
    }

    if (dto.dueDate !== undefined) {
      updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }

    const updated = await this.prisma.action.update({
      where: { id: actionId },
      data: updateData,
      include: {
        assignee: { select: { id: true, nameMasked: true } },
      },
    });

    if (dto.status === 'DONE') {
      const openActions = await this.prisma.action.count({
        where: {
          postId: action.postId,
          actionStatus: { not: 'DONE' },
        },
      });

      if (openActions === 0) {
        await this.prisma.post.update({
          where: { id: action.postId },
          data: { actionStatus: 'DONE' },
        });
      }
    } else if (dto.status === 'IN_PROGRESS') {
      await this.prisma.post.update({
        where: { id: action.postId },
        data: { actionStatus: 'IN_PROGRESS' },
      });
    }

    return updated;
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
