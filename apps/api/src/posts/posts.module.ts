import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { AttendanceModule } from '../attendance/attendance.module';
import { AttendanceGuard } from '../common/guards/attendance.guard';

@Module({
  imports: [AttendanceModule],
  controllers: [PostsController],
  providers: [PostsService, AttendanceGuard],
  exports: [PostsService],
})
export class PostsModule {}
