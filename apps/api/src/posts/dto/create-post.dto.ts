import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreatePostDto {
  @IsUUID()
  siteId: string;

  @IsEnum(['HAZARD', 'UNSAFE_BEHAVIOR', 'INCONVENIENCE', 'SUGGESTION', 'BEST_PRACTICE'])
  category: string;

  @IsOptional()
  @IsEnum(['HIGH', 'MEDIUM', 'LOW'])
  riskLevel?: string;

  @IsString()
  @Length(1, 5000)
  content: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  locationFloor?: string;

  @IsOptional()
  @IsString()
  @Length(0, 50)
  locationZone?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  locationDetail?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;
}
