import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Post('sig')
  @HttpCode(HttpStatus.OK)
  async getSig(
    @CurrentUser() user: JwtPayload,
    @Body('roomCode') roomCode: string,
  ) {
    return this.voiceService.generateUserSig(user.sub, roomCode);
  }
}
