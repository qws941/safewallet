import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto, UpdateSiteDto, UpdateMemberDto } from './dto';
import { Prisma, MembershipStatus, MembershipRole } from '@prisma/client';

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSiteDto) {
    const joinCode = this.generateJoinCode();
    const site = await this.prisma.site.create({
      data: { name: dto.name, joinCode },
    });

    await this.prisma.siteMembership.create({
      data: {
        userId,
        siteId: site.id,
        status: 'ACTIVE',
        role: 'SITE_ADMIN',
      },
    });

    return site;
  }

  async findOne(siteId: string, userId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: { _count: { select: { memberships: true, posts: true } } },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }

    await this.requireMembership(userId, siteId);

    return {
      ...site,
      memberCount: site._count.memberships,
      postCount: site._count.posts,
    };
  }

  async update(siteId: string, userId: string, dto: UpdateSiteDto) {
    await this.requireSiteAdmin(userId, siteId);

    return this.prisma.site.update({
      where: { id: siteId },
      data: dto,
    });
  }

  async regenerateJoinCode(siteId: string, userId: string) {
    await this.requireSiteAdmin(userId, siteId);

    const joinCode = this.generateJoinCode();
    return this.prisma.site.update({
      where: { id: siteId },
      data: { joinCode },
      select: { id: true, joinCode: true },
    });
  }

  async join(userId: string, joinCode: string) {
    const site = await this.prisma.site.findUnique({
      where: { joinCode: joinCode.toUpperCase() },
    });

    if (!site || !site.joinEnabled) {
      throw new NotFoundException('Invalid or disabled join code');
    }

    const existing = await this.prisma.siteMembership.findUnique({
      where: { userId_siteId: { userId, siteId: site.id } },
    });

    if (existing) {
      if (existing.status === 'ACTIVE') {
        throw new BadRequestException('Already a member');
      }
      if (existing.status === 'REMOVED') {
        throw new ForbiddenException('You have been removed from this site');
      }
      if (existing.status === 'PENDING') {
        throw new BadRequestException('Membership pending approval');
      }
    }

    const status = site.requiresApproval ? 'PENDING' : 'ACTIVE';
    const membership = await this.prisma.siteMembership.create({
      data: { userId, siteId: site.id, status, role: 'WORKER' },
    });

    return {
      siteId: site.id,
      siteName: site.name,
      status: membership.status,
    };
  }

  async getMembers(siteId: string, userId: string, statusFilter?: string) {
    await this.requireMembership(userId, siteId);

    const where: Prisma.SiteMembershipWhereInput = { siteId };
    if (statusFilter) {
      where.status = statusFilter as MembershipStatus;
    }

    const members = await this.prisma.siteMembership.findMany({
      where,
      include: {
        user: { select: { id: true, phone: true, nameMasked: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      phone: m.user.phone,
      nameMasked: m.user.nameMasked,
      role: m.role,
      status: m.status,
      joinedAt: m.joinedAt,
    }));
  }

  async updateMember(
    siteId: string,
    membershipId: string,
    adminUserId: string,
    dto: UpdateMemberDto
  ) {
    await this.requireSiteAdmin(adminUserId, siteId);

    const membership = await this.prisma.siteMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.siteId !== siteId) {
      throw new NotFoundException('Membership not found');
    }

    const updateData: Prisma.SiteMembershipUpdateInput = {};
    if (dto.status) updateData.status = dto.status as MembershipStatus;
    if (dto.role) updateData.role = dto.role as MembershipRole;

    return this.prisma.siteMembership.update({
      where: { id: membershipId },
      data: updateData,
    });
  }

  async removeMember(siteId: string, membershipId: string, adminUserId: string) {
    await this.requireSiteAdmin(adminUserId, siteId);

    const membership = await this.prisma.siteMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.siteId !== siteId) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.userId === adminUserId) {
      throw new BadRequestException('Cannot remove yourself');
    }

    return this.prisma.siteMembership.update({
      where: { id: membershipId },
      data: { status: 'REMOVED' },
    });
  }

  private generateJoinCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
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

  async getDashboardStats(siteId: string, userId: string) {
    await this.requireMembership(userId, siteId);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [pendingReviews, postsThisWeek, activeMembers, totalPointsResult] =
      await Promise.all([
        this.prisma.post.count({
          where: { siteId, reviewStatus: { in: ['RECEIVED', 'IN_REVIEW'] } },
        }),
        this.prisma.post.count({
          where: { siteId, createdAt: { gte: oneWeekAgo } },
        }),
        this.prisma.siteMembership.count({
          where: { siteId, status: 'ACTIVE' },
        }),
        this.prisma.pointsLedger.aggregate({
          where: { siteId, amount: { gt: 0 } },
          _sum: { amount: true },
        }),
      ]);

    return {
      pendingReviews,
      postsThisWeek,
      activeMembers,
      totalPoints: totalPointsResult._sum.amount || 0,
    };
  }
}
