import { IsString } from 'class-validator';

export class CastVoteDto {
  @IsString()
  siteId: string;

  @IsString()
  candidateId: string;
}
