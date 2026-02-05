import { IsString, Length } from 'class-validator';

export class JoinSiteDto {
  @IsString()
  @Length(6, 6)
  joinCode: string;
}
