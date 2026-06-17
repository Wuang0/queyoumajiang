/**
 * 雀友麻将共享协议定义
 * 前后端共用的类型定义
 */

// Common types（无冲突）
export * from './types/common';
// Error codes（无冲突）
export * from './types/errorCodes';

// API types — Meld 与 game.ts 冲突，用别名
export {
  type LoginRequest,
  type LoginResponse,
  type RefreshTokenRequest,
  type RefreshTokenResponse,
  type UserMeResponse,
  type UpdateUserRequest,
  type FriendsListResponse,
  type MyStatsResponse,
  type PeriodStats,
  type RecentMatchesResponse,
  type MatchBrief,
  type TrendResponse,
  type TrendPoint,
  type RankHistoryResponse,
  type RankChange,
  type CreateRoomRequest,
  type CreateRoomResponse,
  type RoomQueryResponse,
  type VoiceSigRequest,
  type VoiceSigResponse,
  type MatchDetailResponse,
  type MatchDetailPlayer,
  type HandHistorySummary,
  type VoiceState,
  type FanBreakdown as ApiFanBreakdown,
  type Meld as ApiMeld,
} from './types/api';

// WebSocket types — 避免与 game.ts 冲突的 KongType, Meld
export {
  type C2SMessage,
  type S2CMessage,
  type AckPayload,
  type EventPayload,
  type C2SType,
  type AuthRequest,
  type RoomJoinRequest,
  type RoomDissolveRequest,
  type RoomKickRequest,
  type GameDiscardRequest,
  type GamePongRequest,
  type GameKongRequest,
  type GameHuRequest,
  type VoiceMuteRequest,
  type ResumeRequest,
  type AckEventRequest,
  type RoomJoinAckResult,
  type GameDiscardAckResult,
  type ResumeAckResult,
  type RoomSnapshot,
  type GameStateSnapshot,
  type TileGroup,
  type OtherPlayerSnapshot,
  type MeldSnapshot,
  type S2CEventType,
  type HelloEvent,
  type PlayerJoinedEvent,
  type PlayerLeftEvent,
  type PlayerReadyEvent,
  type PlayerOfflineEvent,
  type PlayerTrusteeEvent,
  type PlayerResumedEvent,
  type GameStartedEvent,
  type TileDrawnEvent,
  type TileDrawnVisibleEvent,
  type TileDiscardedEvent,
  type PongEvent,
  type KongEvent,
  type TingEvent,
  type HuEvent,
  type RoundSettledEvent,
  type MatchSettledEvent,
  type RoomDissolvedEvent,
  type VoiceModeChangedEvent,
  type VoiceSpeakingEvent,
  type CountdownWarningEvent,
  type SystemNoticeEvent,
  type KickedEvent,
  type AuthAckResult,
} from './types/websocket';

// Game types — import first then re-export (value exports need local binding)
import {
  WILD_TILE,
  XIANGYANG_RULE_CONFIG,
  FAN_VALUES,
  FAN_NAMES,
  CLAIM_PRIORITIES,
  DEFAULT_TRUSTEE_CONFIG,
} from './types/game';
export {
  WILD_TILE,
  XIANGYANG_RULE_CONFIG,
  FAN_VALUES,
  FAN_NAMES,
  CLAIM_PRIORITIES,
  DEFAULT_TRUSTEE_CONFIG,
};
export type {
  Suit,
  Tile,
  Wind,
  MeldType,
  HandState,
  ActionType,
  PlayerAction,
  KongType,
  FanBreakdown,
  FanType,
  Meld,
  GamePhase,
  GameState,
  SeatState,
  ClaimWindow,
  Claim,
  HuResult,
  RoundResult,
  MatchResult,
  MatchStatistics,
  TrusteeConfig,
  RuleConfig,
} from './types/game';

// ==================== 协议版本 ====================
export const PROTOCOL_VERSION = 1;

// ==================== 牌面常量与工具函数 ====================

export const SUITS = ['m', 'p', 's', 'z'] as const;
export const VALUES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
export const WIND_TILES = ['1z', '2z', '3z', '4z'] as const;
export const DRAGON_TILES = ['5z', '6z', '7z'] as const;

/**
 * 生成完整麻将牌组（136张）
 */
export function generateDeck(): string[] {
  const deck: string[] = [];

  for (const suit of ['m', 'p', 's']) {
    for (const value of ['1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      for (let i = 0; i < 4; i++) {
        deck.push(`${value}${suit}`);
      }
    }
  }

  for (const value of ['1', '2', '3', '4', '5', '6', '7']) {
    for (let i = 0; i < 4; i++) {
      deck.push(`${value}z`);
    }
  }

  return deck;
}

/**
 * 验证一张牌是否有效
 */
export function isValidTile(tile: string): boolean {
  if (tile.length !== 2) return false;
  const value = tile[0]!;
  const suit = tile[1]!;
  const validSuits = ['m', 'p', 's', 'z'] as readonly string[];
  if (!validSuits.includes(suit)) return false;
  if (suit === 'z') {
    return value >= '1' && value <= '7';
  }
  return value >= '1' && value <= '9';
}

/**
 * 判断是否为癞子牌（襄阳红中癞子）
 */
export function isWildTile(tile: string): boolean {
  return tile === WILD_TILE;
}

/**
 * 验证房间号格式（6位数字）
 */
export function isValidRoomCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * 生成6位数字房间号
 */
export function generateRoomCode(): string {
  const min = 100000;
  const max = 999999;
  // 防止 Math.random 碰撞，应当用 crypto.randomInt
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * 获取段位名称
 */
export function getRankName(level: number): string {
  if (level <= 0) return '未知';
  if (level <= 3) return `雀友 · ${level}段`;
  if (level <= 6) return `麻雀师 · ${level - 3}段`;
  if (level === 7) return '雀圣';
  return '雀神';
}

/**
 * 获取下一段位所需分数
 */
export function getNextLevelScore(level: number): number {
  const thresholds: Record<number, number> = {
    0: 0,
    1: 50,
    2: 200,
    3: 500,
    4: 1000,
    5: 2000,
    6: 4000,
    7: 8000,
  };
  return thresholds[level] ?? Infinity;
}

/**
 * 计算段位进度（0-1）
 */
export function getRankProgress(currentScore: number, currentLevel: number): number {
  const current = getNextLevelScore(currentLevel - 1);
  const next = getNextLevelScore(currentLevel);
  if (next === Infinity) return 1;
  const delta = next - current;
  if (delta <= 0) return 1;
  const progress = (currentScore - current) / delta;
  return Math.min(1, Math.max(0, progress));
}

/**
 * 结算时计算得分（基础逻辑，不可用于生产计算）
 */
export function calculateScores(
  baseScore: number,
  fans: number,
  isSelfMo: boolean,
  loserSeat: number | null,
  players: number[],
): Record<number, number> {
  const result: Record<number, number> = {};
  const fanFactor = Math.pow(2, Math.min(fans, 6));
  const baseAmount = baseScore * fanFactor;

  players.forEach((seat) => {
    if (isSelfMo) {
      result[seat] = -baseAmount;
    } else if (loserSeat === seat) {
      result[seat] = -baseAmount * 2;
    } else {
      result[seat] = -baseAmount;
    }
  });

  return result;
}

/**
 * 抢牌优先级
 */
export function getClaimPriority(type: 'pong' | 'kong' | 'hu' | 'pass'): number {
  const priorities: Record<string, number> = {
    hu: 3,
    kong: 2,
    pong: 1,
    pass: 0,
  };
  return priorities[type] ?? 0;
}
