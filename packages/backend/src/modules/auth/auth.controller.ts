import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto);
    return {
      token: result.tokenPair.token,
      refreshToken: result.tokenPair.refreshToken,
      expiresIn: result.tokenPair.expiresIn,
      user: {
        id: result.userId,
        nickname: result.nickname,
        avatarUrl: result.avatarUrl ?? '',
        rankLevel: result.rankLevel,
        rankScore: result.rankScore,
        totalMatches: result.totalMatches,
        totalWins: result.totalWins,
      },
      isNewUser: result.isNewUser,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return await this.authService.refreshToken(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    // TODO: 从 JWT guard 提取 userId 完成登出
    return { ok: true };
  }
}
