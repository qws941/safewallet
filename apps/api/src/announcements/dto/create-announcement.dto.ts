import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAnnouncementDto {
  @IsUUID()
  siteId: string;

  @IsString()
  @Length(1, 200)
  title: string;

  @IsString()
  @Length(1, 5000)
  content: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}
