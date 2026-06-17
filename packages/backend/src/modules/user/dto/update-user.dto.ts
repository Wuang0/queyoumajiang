import { IsString, IsOptional, Length, IsUrl, IsInt, Min, Max } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 32)
  nickname?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  gender?: number;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  city?: string;
}
