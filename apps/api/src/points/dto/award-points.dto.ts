import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Length } from 'class-validator';

export class AwardPointsDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  siteId: string;

  @IsInt()
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  reason?: string;
}
