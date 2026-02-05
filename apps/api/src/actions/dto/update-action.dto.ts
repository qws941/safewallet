import { IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class UpdateActionDto {
  @IsOptional()
  @IsEnum(['OPEN', 'IN_PROGRESS', 'DONE'])
  status?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  completionNote?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
