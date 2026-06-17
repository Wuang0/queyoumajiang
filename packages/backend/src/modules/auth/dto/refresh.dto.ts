import { IsString, Length } from 'class-validator';

export class RefreshDto {
  @IsString()
  @Length(1, 2048)
  refreshToken!: string;
}
