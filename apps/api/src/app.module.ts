import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SitesModule } from './sites/sites.module';
import { PostsModule } from './posts/posts.module';
import { ReviewsModule } from './reviews/reviews.module';
import { PointsModule } from './points/points.module';
import { ActionsModule } from './actions/actions.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { HealthModule } from './health/health.module';
import { AttendanceModule } from './attendance/attendance.module';
import { VotesModule } from './votes/votes.module';
import { AdminModule } from './admin/admin.module';
import { FasModule } from './fas/fas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SitesModule,
    PostsModule,
    ReviewsModule,
    PointsModule,
    ActionsModule,
    AnnouncementsModule,
    AttendanceModule,
    VotesModule,
    AdminModule,
    FasModule,
  ],
})
export class AppModule {}
