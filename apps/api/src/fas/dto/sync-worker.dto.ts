import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class FasWorkerDto {
  @IsString()
  @IsNotEmpty()
  externalWorkerId: string;

  @IsString()
  @IsNotEmpty()
  siteId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  dob: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  tradeType?: string;
}

export class SyncWorkersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FasWorkerDto)
  workers: FasWorkerDto[];
}
