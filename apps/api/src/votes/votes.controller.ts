import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { VotesService } from './votes.service';
import { CastVoteDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AttendanceGuard } from '../common/guards/attendance.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('votes')
@UseGuards(JwtAuthGuard)
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Get('current')
  async getCurrentVoting(
    @CurrentUser('userId') userId: string,
    @Query('siteId') siteId: string,
  ) {
    return this.votesService.getCurrentVoting(userId, siteId);
  }

  @Post()
  @UseGuards(AttendanceGuard)
  async castVote(
    @CurrentUser('userId') userId: string,
    @Body() dto: CastVoteDto,
  ) {
    return this.votesService.castVote(userId, dto);
  }

  @Get('results')
  async getVoteResults(
    @Query('siteId') siteId: string,
    @Query('month') month?: string,
  ) {
    return this.votesService.getVoteResults(siteId, month);
  }
}
