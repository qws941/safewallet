import { IsString, Length } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  @Length(1, 100)
  name: string;
}
