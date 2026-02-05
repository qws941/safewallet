import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/services/crypto.service';
import { AttendanceResult } from '@prisma/client';
import type { LoginDto } from './dto/login.dto';

const ACCESS_TOKEN_EXPIRY_SECONDS = 86400;
const DAY_CUTOFF_HOUR = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}

  private getTodayRange(): { start: Date; end: Date } {
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

    if (koreaTime.getHours() < DAY_CUTOFF_HOUR) {
      koreaTime.setDate(koreaTime.getDate() - 1);
    }

    const start = new Date(koreaTime);
    start.setHours(DAY_CUTOFF_HOUR, 0, 0, 0);

    const end = new Date(koreaTime);
    end.setDate(end.getDate() + 1);
    end.setHours(DAY_CUTOFF_HOUR, 0, 0, 0);

    return { start, end };
  }

  private async checkTodayAttendance(userId: string): Promise<boolean> {
    const { start, end } = this.getTodayRange();

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        userId,
        result: AttendanceResult.SUCCESS,
        checkinAt: { gte: start, lt: end },
      },
    });

    return !!attendance;
  }

  async login(dto: LoginDto) {
    const normalizedPhone = dto.phone.replace(/[^0-9]/g, '');
    const phoneHash = this.cryptoService.hmac(normalizedPhone);
    const dobHash = this.cryptoService.hmac(dto.dob);

    const user = await this.prisma.user.findFirst({
      where: {
        phoneHash,
        dobHash,
      },
    });

    if (!user) {
      throw new UnauthorizedException('등록되지 않은 사용자입니다. 현장 관리자에게 문의하세요.');
    }

    const normalizedInputName = dto.name.trim().toLowerCase();
    const normalizedUserName = (user.name || '').trim().toLowerCase();
    if (normalizedUserName !== normalizedInputName) {
      throw new UnauthorizedException('이름이 일치하지 않습니다.');
    }

    const requireAttendance = this.configService.get<string>('REQUIRE_ATTENDANCE_FOR_LOGIN') !== 'false';
    if (requireAttendance) {
      const attended = await this.checkTodayAttendance(user.id);
      if (!attended) {
        throw new ForbiddenException('오늘 출근 인증이 확인되지 않습니다. 게이트 안면인식 출근 후 이용 가능합니다.');
      }
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });
    const refreshToken = crypto.randomUUID();

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: user.id,
        phone: user.phone,
        role: user.role,
        name: user.name,
        nameMasked: user.nameMasked,
      },
    };
  }

  async refresh(refreshToken: string) {
    const user = await this.prisma.user.findFirst({
      where: { refreshToken },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const newRefreshToken = crypto.randomUUID();
    const accessToken = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  async logout(refreshToken: string) {
    const result = await this.prisma.user.updateMany({
      where: { refreshToken },
      data: { refreshToken: null },
    });

    if (result.count === 0) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return { message: 'Logged out successfully' };
  }
}
