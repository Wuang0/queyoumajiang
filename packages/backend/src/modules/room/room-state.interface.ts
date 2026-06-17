/**
 * 房间状态在 Redis 中的结构定义
 */
export type RoomStatus = 'waiting' | 'playing' | 'finished' | 'dissolved';
export type RoomRule = 'xiangyang_redzhong';

export interface RoomMeta {
  hostId: string;
  rule: RoomRule;
  baseScore: number;
  totalRounds: number;
  status: RoomStatus;
  createdAt: number;
  startedAt: number | null;
  nodeId: string;
}

export interface SeatInfo {
  seat: number;
  userId: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  joinedAt: number;
}

export interface RoomSnapshot {
  roomCode: string;
  meta: RoomMeta;
  seats: SeatInfo[];
  readySeats: string[];
  serverSeq: number;
}
