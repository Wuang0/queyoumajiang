/**
 * HTTP API 类型定义
 */

import type {
  UserBrief,
  UserPublic,
  FriendBrief,
  RoomStatus,
  MatchPlayerResult,
  WinType,
  VoiceMode,
  RuleType,
} from './common';

// ==================== 通用响应 ====================

export interface HttpResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
  traceId: string;
  ts: number;
}

// ==================== 认证相关 ====================

export interface LoginRequest {
  code: string;
  encryptedData?: string;
  iv?: string;
  signature?: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: UserBrief;
  isNewUser: boolean;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  expiresIn: number;
}

// ==================== 用户相关 ====================

export interface UserMeResponse extends UserBrief {
  gender: number;
  city?: string;
  rankName: string;
  nextLevelScore: number;
  createdAt: number;
}

export interface UpdateUserRequest {
  nickname?: string;
  avatarUrl?: string;
  gender?: number;
  city?: string;
}

export type UpdateUserResponse = UserMeResponse;

export interface FriendsListResponse {
  total: number;
  online: number;
  list: FriendBrief[];
}

// ==================== 战绩相关 ====================

export interface MyStatsResponse {
  rank: {
    level: number;
    name: string;
    score: number;
    nextLevelScore: number;
  };
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalScore: number;
  maxSingleScore: number;
  longestWinStreak: number;
  selfMoCount: number;
  jiePaoCount: number;
  dianPaoCount: number;
  thisWeek: PeriodStats;
  thisMonth: PeriodStats;
}

export interface PeriodStats {
  matches: number;
  wins: number;
  scoreSum: number;
  winRate: number;
  largestWin: number;
}

export interface RecentMatchesResponse {
  list: MatchBrief[];
  hasMore: boolean;
  nextCursor: number | null;
}

export interface MatchBrief {
  matchId: string;
  roomCode: string;
  roundNo: number;
  rule: RuleType;
  totalRounds: number;
  myScoreChange: number;
  winnerId: string | null;
  winType: WinType;
  fans: number;
  opponents: MatchPlayerResult[];
  startedAt: number;
  endedAt: number;
  durationSec: number;
}

export interface TrendResponse {
  days: number;
  points: TrendPoint[];
}

export interface TrendPoint {
  date: string;
  matches: number;
  scoreSum: number;
  cumulativeScore: number;
}

export interface RankHistoryResponse {
  list: RankChange[];
}

export interface RankChange {
  rankBefore: number;
  rankAfter: number;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  matchId?: string;
  reason: 'match' | 'season_reset' | 'admin_adjust';
  createdAt: number;
}

// ==================== 房间相关 ====================

export interface CreateRoomRequest {
  rule: RuleType;
  totalRounds: 4 | 8 | 16;
  baseScore: 1 | 2 | 5;
  allowSpectator?: boolean;
  requestId: string;
}

export interface CreateRoomResponse {
  roomCode: string;
  roomId: string;
  hostId: string;
  expiresAt: number;
  wsUrl: string;
}

export interface RoomQueryResponse {
  roomCode: string;
  status: RoomStatus;
  rule: RuleType;
  totalRounds: number;
  baseScore: number;
  hostId: string;
  seats: {
    seat: number;
    userId: string | null;
    nickname?: string;
    avatarUrl?: string;
  }[];
  currentRound?: number;
  createdAt: number;
}

// ==================== 语音相关 ====================

export interface VoiceSigRequest {
  roomCode: string;
}

export interface VoiceSigResponse {
  sdkAppId: number;
  userId: string;
  userSig: string;
  trtcRoomId: number;
  expireAt: number;
}

// ==================== 对局相关 ====================

export interface MatchDetailResponse {
  matchId: string;
  roomCode: string;
  roundNo: number;
  startedAt: number;
  endedAt: number;
  dealerId: string;
  winnerId: string | null;
  loserId: string | null;
  winType: WinType;
  fans: number;
  fanBreakdown: FanBreakdown[];
  players: MatchDetailPlayer[];
}

export interface FanBreakdown {
  type: string;
  fans: number;
}

export interface MatchDetailPlayer {
  userId: string;
  nickname: string;
  avatarUrl: string;
  seat: number;
  role: 'dealer' | 'normal';
  scoreChange: number;
  scoreAfter: number;
  handHistory?: HandHistorySummary | null;
  trusteeSeconds: number;
}

export interface HandHistorySummary {
  initialHand: string[];
  draws: { seq: number; tile: string }[];
  discards: { seq: number; tile: string }[];
  melds: Meld[];
  winInfo?: {
    winType: WinType;
    winTile: string;
    fans: number;
    fanBreakdown: FanBreakdown[];
  } | null;
}

export interface Meld {
  type: 'pong' | 'kong_ming' | 'kong_an' | 'kong_added';
  tiles: string[];
  fromSeat?: number;
}

// ==================== 语音状态 ====================

export interface VoiceState {
  userId: string;
  mode: VoiceMode;
  isSpeaking: boolean;
}
