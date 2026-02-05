import { IsString, IsNotEmpty, IsDateString } from 'class-validator';

export class CreateManualApprovalDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  siteId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsDateString()
  validDate: string;
}
