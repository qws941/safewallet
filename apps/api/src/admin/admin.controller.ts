import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateManualApprovalDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('manual-approval')
  createManualApproval(
    @CurrentUser('userId') adminId: string,
    @Body() dto: CreateManualApprovalDto,
  ) {
    return this.adminService.createManualApproval(adminId, dto);
  }

  @Get('manual-approvals')
  listManualApprovals(
    @Query('siteId') siteId: string,
    @Query('date') date?: string,
  ) {
    return this.adminService.listManualApprovals(siteId, date);
  }

  @Get('sync-status')
  getSyncStatus(@Query('siteId') siteId: string) {
    return this.adminService.getSyncStatus(siteId);
  }
}
