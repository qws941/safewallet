import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, QueryPostsDto } from './dto';
import { Prisma, Category, ReviewStatus, RiskLevel } from '@prisma/client';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreatePostDto) {
    await this.requireMembership(userId, dto.siteId);

    const post = await this.prisma.post.create({
      data: {
        siteId: dto.siteId,
        userId,
        category: dto.category as Category,
        riskLevel: dto.riskLevel as RiskLevel | undefined,
        content: dto.content,
        locationFloor: dto.locationFloor,
        locationZone: dto.locationZone,
        locationDetail: dto.locationDetail,
        isAnonymous: dto.isAnonymous ?? false,
        isUrgent: dto.isUrgent ?? false,
      },
      include: { images: true },
    });

    return post;
  }

  async findAll(userId: string, query: QueryPostsDto) {
    const where: Prisma.PostWhereInput = {};

    if (query.siteId) {
      await this.requireMembership(userId, query.siteId);
      where.siteId = query.siteId;
    }

    if (query.category) where.category = query.category as Category;
    if (query.reviewStatus) where.reviewStatus = query.reviewStatus as ReviewStatus;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          images: { select: { id: true, fileUrl: true, thumbnailUrl: true } },
          user: { select: { id: true, nameMasked: true } },
          site: { select: { id: true, name: true } },
          _count: { select: { reviews: true, actions: true } },
        },
        orderBy: [{ isUrgent: 'desc' }, { createdAt: 'desc' }],
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts.map((p) => ({
        ...p,
        author: p.isAnonymous ? null : p.user,
        reviewCount: p._count.reviews,
        actionCount: p._count.actions,
      })),
      total,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };
  }

  async findOne(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        images: true,
        user: { select: { id: true, phone: true, nameMasked: true } },
        site: { select: { id: true, name: true } },
        reviews: {
          include: { admin: { select: { id: true, nameMasked: true } } },
          orderBy: { createdAt: 'desc' },
        },
        actions: {
          include: { images: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.requireMembership(userId, post.siteId);

    return {
      ...post,
      author: post.isAnonymous && post.userId !== userId ? null : post.user,
    };
  }

  async findMyPosts(userId: string, query: QueryPostsDto) {
    const where: Prisma.PostWhereInput = { userId };

    if (query.siteId) where.siteId = query.siteId;
    if (query.category) where.category = query.category as Category;
    if (query.reviewStatus) where.reviewStatus = query.reviewStatus as ReviewStatus;

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        include: {
          images: { select: { id: true, fileUrl: true, thumbnailUrl: true } },
          site: { select: { id: true, name: true } },
          _count: { select: { reviews: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts.map((p) => ({
        ...p,
        reviewCount: p._count.reviews,
      })),
      total,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };
  }

  async addImage(postId: string, userId: string, imageData: { url: string; thumbnailUrl?: string }) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.userId !== userId) {
      throw new ForbiddenException('Cannot add images to other users posts');
    }

    return this.prisma.postImage.create({
      data: {
        postId,
        fileUrl: imageData.url,
        thumbnailUrl: imageData.thumbnailUrl,
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
}
