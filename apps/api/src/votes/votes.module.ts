import { Module } from '@nestjs/common';
import { VotesController } from './votes.controller';
import { VotesService } from './votes.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { AttendanceGuard } from '../common/guards/attendance.guard';

@Module({
  imports: [AttendanceModule],
  controllers: [VotesController],
  providers: [VotesService, AttendanceGuard],
})
export class VotesModule {}
