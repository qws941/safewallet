import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AttendanceGuard } from '../common/guards/attendance.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreatePostDto, QueryPostsDto } from './dto';

@Controller('posts')
@UseGuards(JwtAuthGuard, AttendanceGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreatePostDto) {
    return this.postsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('userId') userId: string, @Query() query: QueryPostsDto) {
    return this.postsService.findAll(userId, query);
  }

  @Get('me')
  findMyPosts(@CurrentUser('userId') userId: string, @Query() query: QueryPostsDto) {
    return this.postsService.findMyPosts(userId, query);
  }

  @Get(':id')
  findOne(@Param('id') postId: string, @CurrentUser('userId') userId: string) {
    return this.postsService.findOne(postId, userId);
  }

  @Post(':id/images')
  addImage(
    @Param('id') postId: string,
    @CurrentUser('userId') userId: string,
    @Body() imageData: { url: string; thumbnailUrl?: string }
  ) {
    return this.postsService.addImage(postId, userId, imageData);
  }
}
