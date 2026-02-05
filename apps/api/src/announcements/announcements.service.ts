import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto, UpdateAnnouncementDto, QueryAnnouncementsDto } from './dto';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateAnnouncementDto) {
    await this.requireSiteAdmin(authorId, dto.siteId);

    return this.prisma.announcement.create({
      data: {
        siteId: dto.siteId,
        authorId,
        title: dto.title,
        content: dto.content,
        isPinned: dto.isPinned ?? false,
      },
      include: {
        author: { select: { id: true, nameMasked: true } },
      },
    });
  }

  async findAll(userId: string, query: QueryAnnouncementsDto) {
    await this.requireMembership(userId, query.siteId);

    const where: { siteId: string; isPinned?: boolean } = {
      siteId: query.siteId,
    };

    if (query.pinnedOnly) {
      where.isPinned = true;
    }

    const [announcements, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: {
          author: { select: { id: true, nameMasked: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return {
      data: announcements,
      total,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };
  }

  async findOne(announcementId: string, userId: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        author: { select: { id: true, nameMasked: true } },
        site: { select: { id: true, name: true } },
      },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    await this.requireMembership(userId, announcement.siteId);

    return announcement;
  }

  async update(announcementId: string, userId: string, dto: UpdateAnnouncementDto) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    await this.requireSiteAdmin(userId, announcement.siteId);

    return this.prisma.announcement.update({
      where: { id: announcementId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      },
      include: {
        author: { select: { id: true, nameMasked: true } },
      },
    });
  }

  async remove(announcementId: string, userId: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    await this.requireSiteAdmin(userId, announcement.siteId);

    await this.prisma.announcement.delete({
      where: { id: announcementId },
    });

    return { success: true };
  }

  async togglePin(announcementId: string, userId: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    await this.requireSiteAdmin(userId, announcement.siteId);

    return this.prisma.announcement.update({
      where: { id: announcementId },
      data: { isPinned: !announcement.isPinned },
      include: {
        author: { select: { id: true, nameMasked: true } },
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
      throw new ForbiddenException('Only site admins can manage announcements');
    }

    return membership;
  }
}
