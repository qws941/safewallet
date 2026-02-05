import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  postId: string;

  @IsEnum(['APPROVE', 'REJECT', 'REQUEST_MORE', 'MARK_URGENT', 'ASSIGN', 'CLOSE'])
  action: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  comment?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
