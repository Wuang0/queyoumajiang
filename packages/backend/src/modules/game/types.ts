/**
 * 麻将引擎核心类型
 * 襄阳红中癞子规则
 */

export const WILD_TILE = '5z'; // 红中作癞

export type Suit = 'm' | 'p' | 's' | 'z';
export type Tile = string;

export type MeldType = 'pong' | 'kong_ming' | 'kong_an' | 'kong_added';

export type ActionType = 'draw' | 'discard' | 'pong' | 'kong' | 'ting' | 'hu' | 'pass';

export type GamePhase =
  | 'idle'
  | 'dealing'
  | 'wait_discard'
  | 'wait_claim'
  | 'wait_draw'
  | 'round_end'
  | 'match_end';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  fromSeat?: number; // 碰/明杠时来源座位
}

export interface PlayerState {
  seat: number;
  userId: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  isTing: boolean;
  listenTiles: Tile[];
  isHu: boolean;
  score: number;
  isDealer: boolean;
  isTrustee: boolean;
}

export interface ClaimAction {
  seat: number;
  type: 'pong' | 'kong' | 'hu' | 'pass';
}

export interface GameState {
  roomCode: string;
  roundNo: number;
  totalRounds: number;
  phase: GamePhase;
  dealerSeat: number;
  currentTurnSeat: number;
  wall: Tile[];
  players: PlayerState[];
  lastDiscarded: { tile: Tile; seat: number } | null;
  claimWindow: { actions: ClaimAction[]; deadlineMs: number } | null;
  eventSeq: number;
}

export interface FanResult {
  type: string;
  name: string;
  fans: number;
}

export interface HuResult {
  winnerSeat: number;
  winnerId: string;
  loserSeat: number | null;
  winType: 'selfmo' | 'jiePao';
  winTile: Tile;
  fans: number;
  fanBreakdown: FanResult[];
  scoreChanges: Record<string, number>;
  isHuangzhuang: boolean;
}

export interface RoundResult {
  roundNo: number;
  huResult: HuResult | null;
  nextDealerSeat: number;
  isHuangzhuang: boolean;
}

// 段位阈值
export const RANK_THRESHOLDS: Record<number, number> = {
  1: 50, 2: 200, 3: 500, 4: 1000, 5: 2000, 6: 4000, 7: 8000,
};

// 出牌倒计时（毫秒）
export const DISCARD_TIMEOUT_MS = 15000;
// 抢牌窗口（毫秒）
export const CLAIM_WINDOW_MS = 5000;

// 排序手牌
export function sortHand(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const suitOrder: Record<string, number> = { m: 0, p: 1, s: 2, z: 3 };
    const sa = suitOrder[a[1]!] ?? 9;
    const sb = suitOrder[b[1]!] ?? 9;
    if (sa !== sb) return sa - sb;
    return (parseInt(a[0]!) || 0) - (parseInt(b[0]!) || 0);
  });
}
