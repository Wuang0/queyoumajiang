/**
 * 游戏规则类型定义
 * 襄阳红中癞子规则
 */

// ==================== 牌型编码 ====================

// 万: m (1m - 9m)
// 筒: p (1p - 9p)
// 条: s (1s - 9s)
// 风: z (1z=东, 2z=南, 3z=西, 4z=北, 5z=中, 6z=发, 7z=白)

export type Suit = 'm' | 'p' | 's' | 'z';
export type Tile = string;

// 癞子牌
export const WILD_TILE = '5z'; // 红中

// ==================== 麻将通用类型 ====================

export type Wind = 'east' | 'south' | 'west' | 'north';
export type MeldType = 'pong' | 'kong_ming' | 'kong_an' | 'kong_added' | 'chow';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  fromSeat?: number;
}

export interface HandState {
  concealed: Tile[];      // 手牌
  melds: Meld[];          // 已碰/杠
  discards: Tile[];       // 打出的牌
  isTing: boolean;
  listenTiles: Tile[];    // 听的牌
  score: number;
}

// ==================== 番型 ====================

export interface FanBreakdown {
  type: FanType;
  fans: number;
  name: string;
}

export type FanType =
  | 'ping_hu'
  | 'pengpeng_hu'
  | 'qi_dui'
  | 'haohua_qidui'
  | 'qingyise'
  | 'ziyise'
  | 'dasanyuan'
  | 'dasixi'
  | 'shisanyao'
  | 'gangkai'
  | 'haidilao'
  | 'qianggang'
  | 'jiepao'
  | 'selfmo'
  | 'menqing';

export const FAN_VALUES: Record<FanType, number> = {
  ping_hu: 1,
  pengpeng_hu: 2,
  qi_dui: 4,
  haohua_qidui: 8,
  qingyise: 8,
  ziyise: 16,
  dasanyuan: 16,
  dasixi: 32,
  shisanyao: 16,
  gangkai: 1,
  haidilao: 1,
  qianggang: 4,
  jiepao: 1,
  selfmo: 1,
  menqing: 2,
};

export const FAN_NAMES: Record<FanType, string> = {
  ping_hu: '平胡',
  pengpeng_hu: '碰碰胡',
  qi_dui: '七对',
  haohua_qidui: '豪华七对',
  qingyise: '清一色',
  ziyise: '字一色',
  dasanyuan: '大三元',
  dasixi: '大四喜',
  shisanyao: '十三幺',
  gangkai: '杠开',
  haidilao: '海底捞',
  qianggang: '抢杠胡',
  jiepao: '接炮',
  selfmo: '自摸',
  menqing: '门清',
};

// ==================== 玩家动作 ====================

export type ActionType =
  | 'discard'
  | 'pong'
  | 'kong'
  | 'ting'
  | 'hu'
  | 'pass'
  | 'draw';

export interface PlayerAction {
  type: ActionType;
  tile?: Tile;
  fromSeat?: number;
  kongType?: KongType;
}

export type KongType = 'ming' | 'an' | 'added_to_pong';

// ==================== 游戏状态 ====================

export type GamePhase =
  | 'waiting'
  | 'dealing'
  | 'playing'
  | 'claim_window'
  | 'round_end'
  | 'match_end';

export interface GameState {
  roomCode: string;
  roundNo: number;
  totalRounds: number;
  phase: GamePhase;
  dealerSeat: number;
  currentTurnSeat: number;
  wall: Tile[];
  discardPile: Tile[];
  seats: SeatState[];
  claimWindow?: ClaimWindow | null;
  lastAction?: PlayerAction | null;
  kongStack: number; // 累计杠数（影响番型）
}

export interface SeatState {
  seat: number;
  userId: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  isTing: boolean;
  listenTiles: Tile[];
  score: number;
  isDealer: boolean;
  isTrustee: boolean;
  isReady: boolean;
}

export interface ClaimWindow {
  tile: Tile;
  discardBy: number;
  deadline: number;
  claims: Claim[];
  resolved: boolean;
}

export interface Claim {
  seat: number;
  type: 'pong' | 'kong' | 'hu' | 'pass';
  priority: number;
}

// 优先级：胡 > 杠 > 碰
export const CLAIM_PRIORITIES: Record<Claim['type'], number> = {
  hu: 3,
  kong: 2,
  pong: 1,
  pass: 0,
};

// ==================== 结算结果 ====================

export interface HuResult {
  winnerSeat: number;
  winnerId: string;
  loserSeat: number | null; // 点炮者，自摸则null
  winTile: Tile;
  winType: 'selfmo' | 'jiePao';
  fans: number;
  fanBreakdown: FanBreakdown[];
  scoreChanges: Record<string, number>; // userId -> delta
  isHuangzhuang: boolean;
}

export interface RoundResult {
  roundNo: number;
  huResult: HuResult | null; // null = 黄庄
  nextDealerSeat: number;
  isHuangzhuang: boolean;
  huCount: number; // 累计胡牌次数（影响连庄）
}

export interface MatchResult {
  roomCode: string;
  totalRounds: number;
  roundsPlayed: number;
  rankings: {
    seat: number;
    userId: string;
    score: number;
    rank: number;
  }[];
  statistics: MatchStatistics;
}

export interface MatchStatistics {
  totalHands: number;
  selfMoCount: number;
  jiePaoCount: number;
  dianPaoCount: number;
  kongCount: number;
  maxFans: number;
  winRates: Record<string, number>; // userId -> rate
}

// ==================== 托管策略 ====================

export type TrusteeStrategy = 'random' | 'safe' | 'offensive';

export interface TrusteeConfig {
  strategy: TrusteeStrategy;
  autoTing: boolean; // 听自动胡
  autoHu: boolean; // 自摸胡
  discardDelayMs: number; // 出牌延迟（模拟真人）
}

export const DEFAULT_TRUSTEE_CONFIG: TrusteeConfig = {
  strategy: 'safe',
  autoTing: true,
  autoHu: true,
  discardDelayMs: 1500,
};

// ==================== 规则配置 ====================

export interface RuleConfig {
  type: 'xiangyang_redzhong';
  name: string;
  totalRounds: number;
  baseScore: number;
  wildTile: Tile;
  hasChow: boolean; // 是否允许吃（襄阳规则不允许吃）
  huWithoutTing: boolean; // 是否允许不胡听牌
  huMultiple: number; // 胡牌倍数
  selfMoMultiplier: number; // 自摸倍数
  gangMultiplier: number; // 杠分倍数
  lianzhuang: boolean; // 是否连庄
  trusteeConfig: TrusteeConfig;
}

export const XIANGYANG_RULE_CONFIG: RuleConfig = {
  type: 'xiangyang_redzhong',
  name: '襄阳红中癞子',
  totalRounds: 8,
  baseScore: 1,
  wildTile: '5z', // 红中
  hasChow: false, // 不允许吃
  huWithoutTing: false, // 必须听牌
  huMultiple: 1,
  selfMoMultiplier: 2,
  gangMultiplier: 1,
  lianzhuang: true,
  trusteeConfig: DEFAULT_TRUSTEE_CONFIG,
};
