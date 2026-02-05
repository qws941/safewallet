import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(1, 50)
  name: string;

  @IsString()
  @Length(10, 15)
  phone: string;

  @IsString()
  @Length(6, 6)
  dob: string; // YYMMDD format
}
