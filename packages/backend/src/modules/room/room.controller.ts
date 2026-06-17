import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { RoomService } from './room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('room')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(private readonly roomService: RoomService) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  async createRoom(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateRoomDto,
  ) {
    const nickname = `雀友${user.sub.slice(-4)}`;
    return this.roomService.createRoom(user.sub, nickname, null, dto);
  }

  @Get(':roomCode')
  async getRoom(@Param('roomCode') roomCode: string) {
    return this.roomService.getRoomInfo(roomCode);
  }
}
