import { IsString, IsInt, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  rule: string = 'xiangyang_redzhong';

  @IsInt()
  @Min(4)
  @Max(16)
  totalRounds: number = 8;

  @IsInt()
  @Min(1)
  @Max(5)
  baseScore: number = 1;

  @IsOptional()
  @IsBoolean()
  allowSpectator?: boolean;

  @IsString()
  requestId!: string;
}
