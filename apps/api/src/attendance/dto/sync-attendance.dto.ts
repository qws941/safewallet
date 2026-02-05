import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';

export class SyncAttendanceDto {
  @IsString()
  siteId: string;

  @IsString()
  externalWorkerId: string;

  @IsDateString()
  checkinAt: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsEnum(['SUCCESS', 'FAIL'])
  result: 'SUCCESS' | 'FAIL';
}
