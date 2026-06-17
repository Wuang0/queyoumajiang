/**
 * WebSocket 协议类型定义
 */

import type {
  SeatInfo,
  WinType,
  VoiceMode,
  RuleType,
  FanBreakdown,
} from './common';

// ==================== 消息信封 ====================

export interface C2SMessage<P = unknown> {
  v: number;
  type: string;
  clientSeq: number;
  ts: number;
  payload: P;
  sig?: string;
}

export interface S2CMessage<P = unknown> {
  v: number;
  type: 'ack' | 'event' | 'snapshot' | 'error' | 'kicked' | 'heartbeat';
  serverSeq?: number;
  clientSeq?: number;
  ts: number;
  payload: P;
}

export interface AckPayload<R = unknown> {
  ok: boolean;
  code: number;
  message?: string;
  result?: R;
}

export interface EventPayload<P = unknown> {
  eventType: string;
  actor: string;
  visibility: 'all' | 'self' | 'others';
  data: P;
}

// ==================== C2S 消息类型 ====================

export type C2SType =
  | 'auth'
  | 'heartbeat'
  | 'room.join'
  | 'room.leave'
  | 'room.ready'
  | 'room.unready'
  | 'room.dissolve'
  | 'room.kick'
  | 'game.discard'
  | 'game.pong'
  | 'game.kong'
  | 'game.ting'
  | 'game.hu'
  | 'game.pass'
  | 'voice.mute'
  | 'resume'
  | 'ack-event';

// ==================== C2S Payload 定义 ====================

export interface AuthRequest {
  token: string;
  resumeRoomCode?: string;
  lastSeq?: number;
}

export interface RoomJoinRequest {
  roomCode: string;
}

export interface RoomLeaveRequest {
  reason?: string;
}

export interface RoomReadyRequest {
  // empty
}

export interface RoomUnreadyRequest {
  // empty
}

export interface RoomDissolveRequest {
  confirm: boolean;
}

export interface RoomKickRequest {
  targetUserId: string;
}

export interface GameDiscardRequest {
  tile: string;
}

export interface GamePongRequest {
  tile: string;
  fromSeat: number;
}

export type KongType = 'ming' | 'an' | 'added_to_pong';

export interface GameKongRequest {
  type: KongType;
  tile: string;
  fromSeat?: number;
}

export interface GameTingRequest {
  // empty
}

export interface GameHuRequest {
  type: 'selfmo' | 'jiePao';
}

export interface GamePassRequest {
  // empty
}

export interface VoiceMuteRequest {
  mode: VoiceMode;
}

export interface ResumeRequest {
  roomCode: string;
  lastSeq: number;
  clientHash?: string;
}

export interface AckEventRequest {
  ackedSeqs: number[];
}

// ==================== S2C ACK Payload 定义 ====================

export interface AuthAckResult {
  userId: string;
  currentRoom?: string;
}

export interface RoomJoinAckResult {
  roomCode: string;
  seat: number;
  snapshot: RoomSnapshot;
}

export interface GameDiscardAckResult {
  serverSeq: number;
}

export interface ResumeAckResult {
  mode: 'incremental' | 'snapshot';
  fromSeq: number;
  toSeq: number;
  events?: S2CMessage<EventPayload<unknown>>[];
  snapshot?: RoomSnapshot;
}

// ==================== 房间快照 ====================

export interface RoomSnapshot {
  roomCode: string;
  status: 'waiting' | 'playing';
  rule: RuleType;
  totalRounds: number;
  baseScore: number;
  hostId: string;
  serverSeq: number;
  seats: SeatInfo[];
  scoreboard: { userId: string; score: number }[];
  gameState?: GameStateSnapshot;
  voice: { userId: string; mode: VoiceMode }[];
  serverTime: number;
}

export interface GameStateSnapshot {
  roundNo: number;
  dealerSeat: number;
  currentTurnSeat: number;
  remainingWall: number;
  myHand?: TileGroup;
  myMelds?: MeldSnapshot[];
  myDiscards: string[];
  others: OtherPlayerSnapshot[];
  lastDiscarded?: { tile: string; seat: number };
  claimWindow?: { tile: string; deadline: number };
  myListenTiles?: string[];
  countdown?: { seat: number; deadline: number };
}

export interface TileGroup {
  tiles: string[];
  isListening: boolean;
}

export interface OtherPlayerSnapshot {
  seat: number;
  handCount: number;
  melds: MeldSnapshot[];
  discards: string[];
}

export interface MeldSnapshot {
  type: 'pong' | 'kong_ming' | 'kong_an' | 'kong_added';
  tiles: string[];
  fromSeat?: number;
}

// ==================== S2C 事件类型 ====================

export type S2CEventType =
  | 'hello'
  | 'room.created'
  | 'player.joined'
  | 'player.left'
  | 'player.ready'
  | 'player.unready'
  | 'game.started'
  | 'tile.drawn'
  | 'tile.drawn_visible'
  | 'tile.discarded'
  | 'pong'
  | 'kong'
  | 'ting'
  | 'hu'
  | 'round_settled'
  | 'match_settled'
  | 'room.dissolved'
  | 'player.offline'
  | 'player.trustee'
  | 'player.resumed'
  | 'voice.mode_changed'
  | 'voice.speaking'
  | 'countdown.warning'
  | 'system.notice'
  | 'kicked';

// ==================== S2C 事件 Payload 定义 ====================

export interface HelloEvent {
  userId: string;
  nodeId: string;
  serverTime: number;
  minClientVer: string;
  latestClientVer: string;
  features: string[];
}

export interface PlayerJoinedEvent {
  userId: string;
  seat: number;
  nickname: string;
  avatarUrl: string;
  rankLevel: number;
}

export interface PlayerLeftEvent {
  userId: string;
  seat: number;
  reason: 'user_quit' | 'kicked' | 'offline';
}

export interface PlayerReadyEvent {
  userId: string;
  seat: number;
}

export interface PlayerOfflineEvent {
  userId: string;
  seat: number;
}

export interface PlayerTrusteeEvent {
  userId: string;
  seat: number;
  isTrustee: boolean;
}

export interface PlayerResumedEvent {
  userId: string;
  seat: number;
}

export interface GameStartedEvent {
  roundNo: number;
  dealerSeat: number;
}

export interface TileDrawnEvent {
  tile: string;
  remainingWall: number;
  isWild: boolean;
}

export interface TileDrawnVisibleEvent {
  seat: number;
  userId: string;
  remainingWall: number;
}

export interface TileDiscardedEvent {
  tile: string;
  seat: number;
  userId: string;
  claimWindow: number;
}

export interface PongEvent {
  tile: string;
  fromSeat: number;
  toSeat: number;
  meld: string[];
}

export interface KongEvent {
  kongType: 'ming' | 'an' | 'added';
  tile: string;
  fromSeat: number;
  toSeat: number;
  meld: string[];
  willDrawTile: boolean;
}

export interface TingEvent {
  seat: number;
  userId: string;
  listenTiles?: string[]; // 仅自家可见
}

export interface HuEvent {
  winnerSeat: number;
  winnerId: string;
  loserSeat: number | null;
  loserId: string | null;
  winType: WinType;
  winTile: string;
  fans: number;
  fanBreakdown: FanBreakdown[];
  scoreChanges: Record<string, number>;
}

export interface RoundSettledEvent {
  roundNo: number;
  totalRounds: number;
  winnerId: string;
  winType: WinType;
  fans: number;
  scoreChanges: Record<string, number>;
  nextDealerId: string;
  nextStartAt: number;
}

export interface MatchSettledEvent {
  rankings: {
    userId: string;
    seat: number;
    score: number;
    rank: number;
  }[];
  rankChanges: {
    userId: string;
    rankBefore: number;
    rankAfter: number;
    scoreDelta: number;
  }[];
  highlights: {
    biggestWin: {
      matchId: string;
      fans: number;
      type: string;
    };
    selfMoCount: number;
  };
}

export interface RoomDissolvedEvent {
  reason: 'host_dissolved' | 'timeout' | 'empty' | 'admin';
  by?: string;
}

export interface VoiceModeChangedEvent {
  userId: string;
  mode: VoiceMode;
}

export interface VoiceSpeakingEvent {
  userId: string;
  isSpeaking: boolean;
}

export interface CountdownWarningEvent {
  seat: number;
  userId: string;
  deadline: number;
  remainingMs: number;
}

export interface SystemNoticeEvent {
  level: 'info' | 'warning' | 'error';
  message: string;
  buttonText?: string;
  link?: string;
}

export interface KickedEvent {
  reason: 'kicked_by_host' | 'duplicate_login' | 'maintenance' | 'timeout';
  message: string;
}
