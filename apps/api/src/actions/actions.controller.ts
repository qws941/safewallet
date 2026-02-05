import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateActionDto, UpdateActionDto } from './dto';

@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateActionDto) {
    return this.actionsService.create(userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('userId') userId: string,
    @Query('postId') postId?: string,
    @Query('status') status?: string,
    @Query('siteId') siteId?: string
  ) {
    return this.actionsService.findAll(userId, { postId, status, siteId });
  }

  @Get(':id')
  findOne(@Param('id') actionId: string, @CurrentUser('userId') userId: string) {
    return this.actionsService.findOne(actionId, userId);
  }

  @Patch(':id')
  update(
    @Param('id') actionId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateActionDto
  ) {
    return this.actionsService.update(actionId, userId, dto);
  }
}
