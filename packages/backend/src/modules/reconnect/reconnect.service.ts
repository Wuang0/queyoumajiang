import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { buildSnapshot, shouldUseIncremental, type RoomSnapshot } from './snapshot';
import type { GameState } from '../game/types';
import type { RoomMeta } from '../room/room-state.interface';

export interface ResumeRequest {
  userId: string;
  roomCode: string;
  lastSeq: number;
}

export interface ResumeResponse {
  mode: 'incremental' | 'snapshot';
  fromSeq: number;
  toSeq: number;
  events?: string[];
  snapshot?: RoomSnapshot;
  currentRoom?: string;
  error?: string;
}

export interface DisconnectRecord {
  userId: string;
  roomCode: string;
  disconnectedAt: number;
  lastSeq: number;
  isTrustee: boolean;
}

@Injectable()
export class ReconnectService {
  private readonly logger = new Logger(ReconnectService.name);
  private readonly disconnectMap = new Map<string, DisconnectRecord>();

  constructor(private readonly redis: RedisService) {}

  /**
   * 记录玩家断线
   */
  recordDisconnect(userId: string, roomCode: string, lastSeq: number): void {
    const record: DisconnectRecord = {
      userId,
      roomCode,
      disconnectedAt: Date.now(),
      lastSeq,
      isTrustee: false,
    };
    this.disconnectMap.set(userId, record);
    this.logger.log(`Player ${userId} disconnected from room ${roomCode}`);
  }

  /**
   * 清除断线记录（重连成功 / 离开房间）
   */
  clearDisconnect(userId: string): void {
    this.disconnectMap.delete(userId);
  }

  /**
   * 获取断线时长（毫秒）
   */
  getDisconnectedDuration(userId: string): number {
    const record = this.disconnectMap.get(userId);
    if (!record) return -1;
    return Date.now() - record.disconnectedAt;
  }

  /**
   * 检测玩家是否在重连窗口内（30s）
   */
  isInReconnectWindow(userId: string): boolean {
    const duration = this.getDisconnectedDuration(userId);
    return duration >= 0 && duration < 30000;
  }

  /**
   * 获取断线记录
   */
  getDisconnectRecord(userId: string): DisconnectRecord | null {
    return this.disconnectMap.get(userId) ?? null;
  }

  /**
   * 处理重连请求
   */
  async handleResume(req: ResumeRequest): Promise<ResumeResponse> {
    const { userId, roomCode, lastSeq } = req;

    // 检查房间是否存在
    const metaJson = await this.redis.get(this.redis.keys.room.meta(roomCode));
    if (!metaJson) {
      return { mode: 'snapshot', fromSeq: 0, toSeq: 0, error: '房间不存在或已解散' };
    }

    // 检查用户是否在房间内
    const isInRoom = await this.redis.sismember(
      this.redis.keys.room.users(roomCode),
      userId,
    );
    if (!isInRoom) {
      return { mode: 'snapshot', fromSeq: 0, toSeq: 0, error: '不在该房间中' };
    }

    // 获取当前 seq
    const seqStr = await this.redis.get(this.redis.keys.room.seq(roomCode));
    const currentSeq = parseInt(seqStr ?? '0', 10);

    // 获取 oplog 长度
    const oplogLen = await this.redis.llen(
      this.redis.keys.game.oplog(roomCode),
    );

    // 判断增量 or 全量
    if (shouldUseIncremental(lastSeq, currentSeq, oplogLen)) {
      // 增量同步：取最近 ≤50 条事件，客户端按 seq 自行过滤已收到的
      const startIdx = Math.max(0, oplogLen - (currentSeq - lastSeq));
      const events = await this.redis.lrange(
        this.redis.keys.game.oplog(roomCode),
        startIdx,
        -1,
      );

      // 清除断线记录
      this.clearDisconnect(userId);

      return {
        mode: 'incremental',
        fromSeq: lastSeq + 1,
        toSeq: currentSeq,
        events,
        currentRoom: roomCode,
      };
    }

    // 全量快照
    const snapshot = await this.buildRoomSnapshot(roomCode, userId);

    // 清除断线记录
    this.clearDisconnect(userId);

    return {
      mode: 'snapshot',
      fromSeq: 0,
      toSeq: currentSeq,
      snapshot,
      currentRoom: roomCode,
    };
  }

  /**
   * 构建房间全量快照
   */
  async buildRoomSnapshot(
    roomCode: string,
    selfUserId?: string,
  ): Promise<RoomSnapshot> {
    const metaJson = await this.redis.get(this.redis.keys.room.meta(roomCode));
    const meta: RoomMeta = metaJson
      ? JSON.parse(metaJson)
      : { hostId: '', rule: 'xiangyang_redzhong', baseScore: 1, totalRounds: 8, status: 'waiting' as const, createdAt: 0, startedAt: null, nodeId: '' };

    const seqStr = await this.redis.get(this.redis.keys.room.seq(roomCode));
    const seq = parseInt(seqStr ?? '0', 10);

    // 座位
    const seatsRaw = await this.redis.hgetall(
      this.redis.keys.room.seats(roomCode),
    );
    const seats: { seat: number; userId: string; nickname: string }[] = [];
    for (let s = 0; s < 4; s++) {
      const v = seatsRaw[s.toString()];
      if (v) {
        const info = JSON.parse(v) as { seat: number; userId: string; nickname: string };
        seats.push(info);
      } else {
        seats.push({ seat: s, userId: '', nickname: '' });
      }
    }

    // ready / online / trustee
    const readySet = await this.redis.smembers(this.redis.keys.room.ready(roomCode));
    const onlineSet: string[] = []; // online 状态从 disconnect map 反推
    const trusteeSet: string[] = [];

    // 断线超过 30s 的标记为 trustee
    const users = await this.redis.smembers(this.redis.keys.room.users(roomCode));
    for (const uid of users) {
      const duration = this.getDisconnectedDuration(uid);
      if (duration >= 30000) trusteeSet.push(uid);
      if (duration < 0 || duration < 15000) onlineSet.push(uid);
    }

    // GameState 从 Redis 读取（如果有）
    const gameStateJson = await this.redis.get(
      this.redis.keys.game.current(roomCode),
    );
    let gameState: GameState | null = null;
    if (gameStateJson) {
      try {
        gameState = JSON.parse(gameStateJson) as GameState;
      } catch {
        // ignore
      }
    }

    return buildSnapshot(
      roomCode,
      meta,
      seq,
      seats,
      readySet,
      onlineSet,
      trusteeSet,
      gameState ?? null,
      selfUserId,
    );
  }

  /**
   * 标记进入托管
   */
  markTrustee(userId: string): void {
    const record = this.disconnectMap.get(userId);
    if (record) {
      record.isTrustee = true;
    }
  }

  /**
   * 检查是否在托管中
   */
  isTrustee(userId: string): boolean {
    return this.disconnectMap.get(userId)?.isTrustee ?? false;
  }
}
