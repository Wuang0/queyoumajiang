import { IsString, IsOptional, Length } from 'class-validator';

export class AddFriendDto {
  @IsString()
  @Length(1, 64)
  source: string = 'in_room';
}
