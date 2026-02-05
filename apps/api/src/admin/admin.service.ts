import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateManualApprovalDto } from './dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createManualApproval(adminId: string, dto: CreateManualApprovalDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    return this.prisma.manualApproval.create({
      data: {
        userId: dto.userId,
        siteId: dto.siteId,
        approvedById: adminId,
        reason: dto.reason,
        validDate: new Date(dto.validDate),
      },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });
  }

  async listManualApprovals(siteId: string, date?: string) {
    const where: { siteId: string; validDate?: { gte: Date; lt: Date } } = { siteId };

    if (date) {
      const targetDate = new Date(date);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      where.validDate = { gte: targetDate, lt: nextDate };
    }

    return this.prisma.manualApproval.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, companyName: true, tradeType: true } },
        approvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSyncStatus(siteId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalUsers, todayAttendance, lastSync] = await Promise.all([
      this.prisma.user.count({
        where: { externalSystem: 'FAS' },
      }),
      this.prisma.attendance.count({
        where: {
          siteId,
          checkinAt: { gte: todayStart },
          result: 'SUCCESS',
        },
      }),
      this.prisma.attendance.findFirst({
        where: { siteId, source: 'FAS' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return {
      fasRegisteredUsers: totalUsers,
      todayCheckins: todayAttendance,
      lastSyncAt: lastSync?.createdAt || null,
      status: lastSync ? 'connected' : 'no_data',
    };
  }
}
