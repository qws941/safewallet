import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryPostsDto {
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsEnum(['HAZARD', 'UNSAFE_BEHAVIOR', 'INCONVENIENCE', 'SUGGESTION', 'BEST_PRACTICE'])
  category?: string;

  @IsOptional()
  @IsEnum(['RECEIVED', 'IN_REVIEW', 'NEED_INFO', 'APPROVED', 'REJECTED'])
  reviewStatus?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
