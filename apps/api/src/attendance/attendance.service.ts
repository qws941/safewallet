import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncAttendanceDto } from './dto';
import { AttendanceResult, AttendanceSource } from '@prisma/client';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private getEffectiveDate(siteId: string, now: Date = new Date()): Date {
    const cutoffHour = 5;
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    
    if (koreaTime.getHours() < cutoffHour) {
      koreaTime.setDate(koreaTime.getDate() - 1);
    }
    
    koreaTime.setHours(0, 0, 0, 0);
    return koreaTime;
  }

  private getDayRange(effectiveDate: Date, cutoffHour: number = 5): { start: Date; end: Date } {
    const start = new Date(effectiveDate);
    start.setHours(cutoffHour, 0, 0, 0);
    
    const end = new Date(effectiveDate);
    end.setDate(end.getDate() + 1);
    end.setHours(cutoffHour, 0, 0, 0);
    
    return { start, end };
  }

  async syncAttendance(dto: SyncAttendanceDto) {
    const user = await this.prisma.user.findFirst({
      where: { externalWorkerId: dto.externalWorkerId },
    });

    const attendance = await this.prisma.attendance.create({
      data: {
        siteId: dto.siteId,
        userId: user?.id || null,
        externalWorkerId: dto.externalWorkerId,
        checkinAt: new Date(dto.checkinAt),
        result: dto.result as AttendanceResult,
        deviceId: dto.deviceId,
        source: AttendanceSource.FAS,
      },
    });

    return { success: true, attendanceId: attendance.id, linked: !!user };
  }

  async getTodayAttendance(userId: string, siteId: string) {
    const effectiveDate = this.getEffectiveDate(siteId);
    const { start, end } = this.getDayRange(effectiveDate);

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        userId,
        siteId,
        result: AttendanceResult.SUCCESS,
        checkinAt: { gte: start, lt: end },
      },
      orderBy: { checkinAt: 'desc' },
    });

    return {
      attended: !!attendance,
      checkinAt: attendance?.checkinAt || null,
    };
  }

  async getTodayAttendanceList(siteId: string) {
    const effectiveDate = this.getEffectiveDate(siteId);
    const { start, end } = this.getDayRange(effectiveDate);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        siteId,
        result: AttendanceResult.SUCCESS,
        checkinAt: { gte: start, lt: end },
      },
      include: {
        user: {
          select: { id: true, name: true, nameMasked: true, companyName: true, tradeType: true },
        },
      },
      orderBy: { checkinAt: 'asc' },
    });

    return attendances.map((a) => ({
      id: a.id,
      checkinAt: a.checkinAt,
      user: a.user,
      externalWorkerId: a.externalWorkerId,
    }));
  }

  async checkUserAttendedToday(userId: string, siteId: string): Promise<boolean> {
    const { attended } = await this.getTodayAttendance(userId, siteId);
    return attended;
  }
}
