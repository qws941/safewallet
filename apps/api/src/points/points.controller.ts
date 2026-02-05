import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { PointsService } from './points.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AwardPointsDto, QueryPointsDto } from './dto';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Post('award')
  award(@CurrentUser('userId') userId: string, @Body() dto: AwardPointsDto) {
    return this.pointsService.award(userId, dto);
  }

  @Get('balance')
  getBalance(
    @CurrentUser('userId') userId: string,
    @Query('siteId') siteId: string
  ) {
    return this.pointsService.getBalance(userId, siteId);
  }

  @Get('history')
  getHistory(@CurrentUser('userId') userId: string, @Query() query: QueryPointsDto) {
    return this.pointsService.getHistory(userId, query);
  }

  @Get('leaderboard/:siteId')
  getLeaderboard(
    @Param('siteId') siteId: string,
    @CurrentUser('userId') userId: string,
    @Query('limit') limit?: string
  ) {
    return this.pointsService.getSiteLeaderboard(siteId, userId, limit ? parseInt(limit, 10) : 10);
  }
}
