/**
 * 通用类型定义
 */

export interface UserBrief {
  id: string;
  nickname: string;
  avatarUrl: string;
  rankLevel: number;
  rankScore: number;
  totalMatches: number;
  totalWins: number;
}

export interface UserPublic {
  id: string;
  nickname: string;
  avatarUrl: string;
  rankLevel: number;
  totalMatches: number;
  totalWins: number;
}

export interface FriendBrief {
  userId: string;
  nickname: string;
  avatarUrl: string;
  rankLevel: number;
  isOnline: boolean;
  lastPlayedAt?: number;
  inRoom?: { roomCode: string };
}

export interface SeatInfo {
  seat: number;
  userId: string | null;
  nickname?: string;
  avatarUrl?: string;
  isReady: boolean;
  isOnline: boolean;
  isTrustee: boolean;
}

export interface MatchPlayerResult {
  userId: string;
  nickname: string;
  avatarUrl: string;
  seat: number;
  scoreChange: number;
  isWinner: boolean;
}

export type RuleType = 'xiangyang_redzhong';

export type RoomStatus = 'waiting' | 'playing' | 'finished' | 'dissolved';

export type VoiceMode = 'free' | 'ptt' | 'mute';

export type WinType = 'selfmo' | 'jiePao' | 'huangzhuang' | null;
