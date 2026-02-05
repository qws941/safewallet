import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { SyncAttendanceDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('sync')
  async syncAttendance(@Body() dto: SyncAttendanceDto) {
    return this.attendanceService.syncAttendance(dto);
  }

  @Get('today')
  @UseGuards(JwtAuthGuard)
  async getTodayStatus(
    @CurrentUser('userId') userId: string,
    @Query('siteId') siteId: string,
  ) {
    return this.attendanceService.getTodayAttendance(userId, siteId);
  }

  @Get('today/list')
  @UseGuards(JwtAuthGuard)
  async getTodayList(@Query('siteId') siteId: string) {
    return this.attendanceService.getTodayAttendanceList(siteId);
  }
}
