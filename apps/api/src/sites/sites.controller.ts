import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SitesService } from './sites.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateSiteDto, JoinSiteDto, UpdateSiteDto, UpdateMemberDto } from './dto';

@Controller('sites')
@UseGuards(JwtAuthGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateSiteDto) {
    return this.sitesService.create(userId, dto);
  }

  @Get(':id')
  findOne(@Param('id') siteId: string, @CurrentUser('userId') userId: string) {
    return this.sitesService.findOne(siteId, userId);
  }

  @Patch(':id')
  update(
    @Param('id') siteId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateSiteDto
  ) {
    return this.sitesService.update(siteId, userId, dto);
  }

  @Post(':id/regenerate-code')
  regenerateJoinCode(
    @Param('id') siteId: string,
    @CurrentUser('userId') userId: string
  ) {
    return this.sitesService.regenerateJoinCode(siteId, userId);
  }

  @Post('join')
  join(@CurrentUser('userId') userId: string, @Body() dto: JoinSiteDto) {
    return this.sitesService.join(userId, dto.joinCode);
  }

  @Get(':id/members')
  getMembers(
    @Param('id') siteId: string,
    @CurrentUser('userId') userId: string,
    @Query('status') status?: string
  ) {
    return this.sitesService.getMembers(siteId, userId, status);
  }

  @Patch(':id/members/:membershipId')
  updateMember(
    @Param('id') siteId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateMemberDto
  ) {
    return this.sitesService.updateMember(siteId, membershipId, userId, dto);
  }

  @Delete(':id/members/:membershipId')
  removeMember(
    @Param('id') siteId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser('userId') userId: string
  ) {
    return this.sitesService.removeMember(siteId, membershipId, userId);
  }

  @Get(':id/stats')
  getDashboardStats(
    @Param('id') siteId: string,
    @CurrentUser('userId') userId: string
  ) {
    return this.sitesService.getDashboardStats(siteId, userId);
  }
}
