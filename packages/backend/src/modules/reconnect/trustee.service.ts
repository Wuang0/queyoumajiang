import { Injectable, Logger } from '@nestjs/common';
import type { GameState, PlayerState, Tile } from '../game/types';

/**
 * AI 托管服务 —— 断线/超时时自动出牌
 */

export interface TrusteeAction {
  type: 'discard';
  seat: number;
  tile: Tile;
}

@Injectable()
export class TrusteeService {
  private readonly logger = new Logger(TrusteeService.name);

  /**
   * 计算托管动作
   * 策略：安全出牌（出最右侧的牌）
   */
  computeAction(state: GameState, seat: number): TrusteeAction | null {
    const player = state.players[seat];
    if (!player || state.currentTurnSeat !== seat) return null;
    if (state.phase !== 'wait_discard') return null;

    // 如果已听牌，执行最保守策略
    if (player.isTing) {
      // 听牌后不主动出牌，等摸牌后出
      return this.safeDiscard(player);
    }

    return this.safeDiscard(player);
  }

  /**
   * 安全出牌策略：出最右边的牌（AI 偷懒版）
   */
  private safeDiscard(player: PlayerState): TrusteeAction | null {
    if (player.hand.length === 0) return null;
    return {
      type: 'discard',
      seat: player.seat,
      tile: player.hand[player.hand.length - 1]!,
    };
  }

  /**
   * 检测是否需要进入托管
   */
  shouldEnterTrustee(
    disconnectedMs: number,
    maxWaitMs: number = 30000,
  ): boolean {
    return disconnectedMs >= maxWaitMs;
  }

  /**
   * 是否应该踢出房间
   */
  shouldKick(disconnectedMs: number, maxWaitMs: number = 60000): boolean {
    return disconnectedMs >= maxWaitMs;
  }
}
