import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('me')
  async getMyStats(@CurrentUser() user: JwtPayload) {
    return this.statsService.getMyStats(user.sub);
  }

  @Get('me/recent')
  async getRecent(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.statsService.getRecent(
      user.sub,
      limit ? parseInt(limit, 10) : 20,
      before ? parseInt(before, 10) : undefined,
    );
  }

  @Get('me/trend')
  async getTrend(
    @CurrentUser() user: JwtPayload,
    @Query('days') days?: string,
  ) {
    return this.statsService.getTrend(
      user.sub,
      days ? parseInt(days, 10) : 14,
    );
  }

  @Get('me/rank-history')
  async getRankHistory(@CurrentUser() user: JwtPayload) {
    return this.statsService.getRankHistory(user.sub);
  }
}
