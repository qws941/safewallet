import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AttendanceService } from '../../attendance/attendance.service';

@Injectable()
export class AttendanceGuard implements CanActivate {
  constructor(private readonly attendanceService: AttendanceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const siteId = request.query?.siteId || request.body?.siteId;

    if (!userId || !siteId) {
      throw new ForbiddenException('사용자 또는 현장 정보가 없습니다.');
    }

    const attended = await this.attendanceService.checkUserAttendedToday(userId, siteId);
    
    if (!attended) {
      throw new ForbiddenException('오늘 출근하지 않았습니다. 안면인식 출근 후 이용해주세요.');
    }

    return true;
  }
}
