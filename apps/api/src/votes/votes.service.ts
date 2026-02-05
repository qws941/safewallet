import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CastVoteDto } from './dto';
import { AttendanceService } from '../attendance/attendance.service';

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  async getCurrentVoting(userId: string, siteId: string) {
    const month = this.getCurrentMonth();

    const candidates = await this.prisma.voteCandidate.findMany({
      where: { siteId, month },
      include: {
        user: {
          select: { id: true, name: true, nameMasked: true, companyName: true, tradeType: true },
        },
      },
    });

    const existingVote = await this.prisma.vote.findFirst({
      where: { siteId, month, voterId: userId },
    });

    const voteCounts = await this.prisma.vote.groupBy({
      by: ['candidateId'],
      where: { siteId, month },
      _count: { candidateId: true },
    });

    const voteCountMap = new Map(voteCounts.map((v) => [v.candidateId, v._count.candidateId]));

    return {
      month,
      hasVoted: !!existingVote,
      votedCandidateId: existingVote?.candidateId || null,
      candidates: candidates.map((c) => ({
        id: c.id,
        user: c.user,
        voteCount: voteCountMap.get(c.userId) || 0,
      })),
    };
  }

  async castVote(userId: string, dto: CastVoteDto) {
    const month = this.getCurrentMonth();

    const attended = await this.attendanceService.checkUserAttendedToday(userId, dto.siteId);
    if (!attended) {
      throw new ForbiddenException('오늘 출근하지 않았습니다. 출근 후 투표해주세요.');
    }

    const existingVote = await this.prisma.vote.findFirst({
      where: { siteId: dto.siteId, month, voterId: userId },
    });

    if (existingVote) {
      throw new BadRequestException('이미 이번 달에 투표하셨습니다.');
    }

    const candidate = await this.prisma.voteCandidate.findFirst({
      where: { siteId: dto.siteId, month, userId: dto.candidateId },
    });

    if (!candidate) {
      throw new BadRequestException('유효하지 않은 후보입니다.');
    }

    await this.prisma.vote.create({
      data: {
        siteId: dto.siteId,
        month,
        voterId: userId,
        candidateId: dto.candidateId,
      },
    });

    return { success: true };
  }

  async getVoteResults(siteId: string, month?: string) {
    const targetMonth = month || this.getCurrentMonth();

    const votes = await this.prisma.vote.groupBy({
      by: ['candidateId'],
      where: { siteId, month: targetMonth },
      _count: { candidateId: true },
      orderBy: { _count: { candidateId: 'desc' } },
    });

    const candidateIds = votes.map((v) => v.candidateId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true, name: true, nameMasked: true, companyName: true, tradeType: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      month: targetMonth,
      results: votes.map((v) => ({
        user: userMap.get(v.candidateId),
        voteCount: v._count.candidateId,
      })),
    };
  }
}
