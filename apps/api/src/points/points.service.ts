import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AwardPointsDto, QueryPointsDto } from './dto';

interface PointsWhereInput {
  siteId?: string;
  userId?: string;
}

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  async award(adminId: string, dto: AwardPointsDto) {
    await this.requireSiteAdmin(adminId, dto.siteId);

    const now = new Date();
    const settleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const entry = await this.prisma.pointsLedger.create({
      data: {
        userId: dto.userId,
        siteId: dto.siteId,
        amount: dto.amount,
        reasonCode: 'MANUAL_AWARD',
        reasonText: dto.reason ?? null,
        settleMonth,
        adminId,
      },
      include: { user: { select: { id: true, nameMasked: true } } },
    });

    return entry;
  }

  async getBalance(userId: string, siteId: string) {
    await this.requireMembership(userId, siteId);

    const aggregate = await this.prisma.pointsLedger.aggregate({
      where: { userId, siteId },
      _sum: { amount: true },
    });

    return {
      userId,
      siteId,
      balance: aggregate._sum.amount ?? 0,
    };
  }

  async getHistory(userId: string, query: QueryPointsDto) {
    const where: PointsWhereInput = {};

    if (query.siteId) {
      await this.requireMembership(userId, query.siteId);
      where.siteId = query.siteId;
    }

    if (query.userId) {
      where.userId = query.userId;
    } else {
      where.userId = userId;
    }

    const [entries, total] = await Promise.all([
      this.prisma.pointsLedger.findMany({
        where,
        include: {
          site: { select: { id: true, name: true } },
          admin: { select: { id: true, nameMasked: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 20,
        skip: query.offset ?? 0,
      }),
      this.prisma.pointsLedger.count({ where }),
    ]);

    return {
      data: entries,
      total,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    };
  }

  async getSiteLeaderboard(siteId: string, userId: string, limit: number = 10) {
    await this.requireMembership(userId, siteId);

    const results = await this.prisma.pointsLedger.groupBy({
      by: ['userId'],
      where: { siteId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    const userIds = results.map((r: typeof results[number]) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nameMasked: true },
    });

    type UserResult = { id: string; nameMasked: string | null };
    const userMap = new Map<string, UserResult>(
      users.map((u: UserResult) => [u.id, u])
    );

    return results.map((r: typeof results[number], index: number) => {
      const user = userMap.get(r.userId);
      return {
        rank: index + 1,
        userId: r.userId,
        nameMasked: user?.nameMasked ?? null,
        balance: r._sum.amount ?? 0,
      };
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
