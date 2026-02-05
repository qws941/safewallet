import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        nameMasked: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        phone: true,
        nameMasked: true,
        role: true,
      },
    });
  }

  async getMemberships(userId: string) {
    const memberships = await this.prisma.siteMembership.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            joinCode: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      id: m.id,
      siteId: m.siteId,
      siteName: m.site.name,
      status: m.status,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async getPointsSummary(userId: string) {
    const memberships = await this.prisma.siteMembership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { site: { select: { id: true, name: true } } },
    });

    const pointsBySite = await Promise.all(
      memberships.map(async (m) => {
        const aggregate = await this.prisma.pointsLedger.aggregate({
          where: { userId, siteId: m.siteId },
          _sum: { amount: true },
        });

        return {
          siteId: m.siteId,
          siteName: m.site.name,
          balance: aggregate._sum.amount ?? 0,
        };
      })
    );

    const totalBalance = pointsBySite.reduce((sum, s) => sum + s.balance, 0);

    return {
      totalBalance,
      bySite: pointsBySite,
    };
  }
}
