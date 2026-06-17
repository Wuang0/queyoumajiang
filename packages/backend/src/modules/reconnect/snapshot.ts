/**
 * 房间状态快照 —— 断线重连用
 */
import type { GameState } from '../game/types';

export interface RoomSnapshot {
  roomCode: string;
  status: string;
  rule: string;
  baseScore: number;
  totalRounds: number;
  hostId: string;
  serverSeq: number;
  seats: SeatBrief[];
  scoreboard: ScoreBrief[];
  gameState: GameStateSnapshot | null;
  serverTime: number;
}

export interface SeatBrief {
  seat: number;
  userId: string;
  nickname: string;
  isOnline: boolean;
  isReady: boolean;
  isTrustee: boolean;
}

export interface ScoreBrief {
  userId: string;
  score: number;
}

export interface GameStateSnapshot {
  roundNo: number;
  dealerSeat: number;
  currentTurnSeat: number;
  remainingWall: number;
  phase: string;
  players: PlayerView[];
  lastDiscarded: { tile: string; seat: number } | null;
}

export interface PlayerView {
  seat: number;
  userId: string;
  handCount: number;
  melds: { type: string; tiles: string[] }[];
  discards: string[];
  isTing: boolean;
  isHu: boolean;
  score: number;
  /** 仅自家可见 */
  hand?: string[];
  listenTiles?: string[];
}

/**
 * 从 GameState 生成快照
 */
export function buildSnapshot(
  roomCode: string,
  meta: { hostId: string; status: string; rule: string; baseScore: number; totalRounds: number },
  seq: number,
  seats: { seat: number; userId: string; nickname: string }[],
  readySet: string[],
  onlineSet: string[],
  trusteeSet: string[],
  gameState: GameState | null,
  selfUserId?: string,
): RoomSnapshot {
  const scoreboard: ScoreBrief[] = (gameState?.players ?? []).map((p) => ({
    userId: p.userId,
    score: p.score,
  }));

  let gameSnapshot: GameStateSnapshot | null = null;
  if (gameState) {
    gameSnapshot = {
      roundNo: gameState.roundNo,
      dealerSeat: gameState.dealerSeat,
      currentTurnSeat: gameState.currentTurnSeat,
      remainingWall: gameState.wall.length,
      phase: gameState.phase,
      players: gameState.players.map((p) => ({
        seat: p.seat,
        userId: p.userId,
        handCount: p.hand.length,
        melds: p.melds.map((m) => ({ type: m.type, tiles: m.tiles })),
        discards: [...p.discards],
        isTing: p.isTing,
        isHu: p.isHu,
        score: p.score,
        // 仅自家可见
        ...(p.userId === selfUserId && {
          hand: [...p.hand],
          listenTiles: p.listenTiles,
        }),
      })),
      lastDiscarded: gameState.lastDiscarded,
    };
  }

  return {
    roomCode,
    status: meta.status,
    rule: meta.rule,
    baseScore: meta.baseScore,
    totalRounds: meta.totalRounds,
    hostId: meta.hostId,
    serverSeq: seq,
    seats: seats.map((s) => ({
      ...s,
      isOnline: onlineSet.includes(s.userId),
      isReady: readySet.includes(s.userId),
      isTrustee: trusteeSet.includes(s.userId),
    })),
    scoreboard,
    gameState: gameSnapshot,
    serverTime: Date.now(),
  };
}

/**
 * 判断是增量同步还是全量快照
 */
export function shouldUseIncremental(
  lastSeq: number,
  currentSeq: number,
  oplogLength: number,
): boolean {
  const gap = currentSeq - lastSeq;
  return gap > 0 && gap <= 50 && oplogLength > 0;
}
