import { IsEnum, IsOptional } from 'class-validator';

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(['PENDING', 'ACTIVE', 'LEFT', 'REMOVED'])
  status?: string;

  @IsOptional()
  @IsEnum(['WORKER', 'SITE_ADMIN'])
  role?: string;
}
