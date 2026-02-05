import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsBoolean()
  joinEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}
