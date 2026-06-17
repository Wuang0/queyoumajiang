import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { CreateRoomDto } from './dto/create-room.dto';
import type {
  RoomMeta,
  RoomSnapshot,
  RoomStatus,
  SeatInfo,
} from './room-state.interface';

@Injectable()
export class RoomService {
  private readonly logger = new Logger(RoomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ==================== 创建房间 ====================

  async createRoom(
    userId: string,
    nickname: string,
    avatarUrl: string | null,
    dto: CreateRoomDto,
  ) {
    // 幂等检查
    const idempKey = this.redis.keys.idempotency.room(`create_${dto.requestId}`, userId);
    const cached = await this.redis.get(idempKey);
    if (cached) {
      return JSON.parse(cached) as {
        roomCode: string;
        roomId: string;
        hostId: string;
      };
    }

    // 检查用户是否已在其他房间
    const existingRoom = await this.redis.get(
      this.redis.keys.online.user(userId),
    );
    if (existingRoom) {
      const parsed = JSON.parse(existingRoom) as { currentRoom?: string };
      if (parsed.currentRoom) {
        throw new ConflictException('请先离开当前房间');
      }
    }

    // 从 Redis 池取房号
    let roomCode = await this.redis.spop(this.redis.keys.pool.pool());
    if (!roomCode) {
      // 池耗尽，降级到随机生成
      roomCode = this.generateRoomCodeLocally();
      this.logger.warn('Room code pool exhausted, using local generation');
    }

    const nodeId = process.env.HOSTNAME ?? 'node-unknown';

    // 持房间锁
    const lockKey = this.redis.keys.room.owner(roomCode);
    const locked = await this.redis.acquireLock(lockKey, nodeId, 30);
    if (!locked) {
      throw new BadRequestException('房号冲突，请重试');
    }

    try {
      // 写 Redis 状态
      const meta: RoomMeta = {
        hostId: userId,
        rule: dto.rule as RoomMeta['rule'],
        baseScore: dto.baseScore,
        totalRounds: dto.totalRounds,
        status: 'waiting',
        createdAt: Date.now(),
        startedAt: null,
        nodeId,
      };

      await this.redis.set(
        this.redis.keys.room.meta(roomCode),
        JSON.stringify(meta),
      );

      // 座位: seat 0 = 房主
      const seats: Record<string, string> = {
        '0': JSON.stringify({
          seat: 0,
          userId,
          nickname,
          avatarUrl,
          joinedAt: Date.now(),
        } satisfies SeatInfo),
      };
      for (const [k, v] of Object.entries(seats)) {
        await this.redis.hset(this.redis.keys.room.seats(roomCode), k, v);
      }

      // 用户集合
      await this.redis.sadd(this.redis.keys.room.users(roomCode), userId);

      // 活跃房间列表
      await this.redis.sadd(this.redis.keys.room.activeList(), roomCode);

      // 序列号
      await this.redis.set(this.redis.keys.room.seq(roomCode), '0');

      // 更新在线状态
      const onlineKey = this.redis.keys.online.user(userId);
      await this.redis.set(
        onlineKey,
        JSON.stringify({ currentRoom: roomCode }),
        30,
      );

      // 写 MySQL 归档
      const room = await this.prisma.room.create({
        data: {
          roomCode,
          hostId: BigInt(userId),
          rule: dto.rule,
          baseScore: dto.baseScore,
          totalRounds: dto.totalRounds,
          allowSpectator: dto.allowSpectator ?? false,
          status: 'waiting',
        },
      });

      const result = {
        roomCode,
        roomId: room.id.toString(),
        hostId: userId,
        expiresAt: Date.now() + 30 * 60 * 1000,
      };

      // 缓存幂等结果
      await this.redis.set(idempKey, JSON.stringify(result), 300);

      this.logger.log(`Room created: ${roomCode} by user ${userId}`);
      return result;
    } catch (err) {
      // 失败回滚
      await this.redis.releaseLock(lockKey, nodeId);
      throw err;
    }
  }

  // ==================== 加入房间 ====================

  async joinRoom(
    userId: string,
    nickname: string,
    avatarUrl: string | null,
    roomCode: string,
  ) {
    // 检查用户是否已在其他房间
    const onlineKey = this.redis.keys.online.user(userId);
    const existingOnline = await this.redis.get(onlineKey);
    if (existingOnline) {
      const parsed = JSON.parse(existingOnline) as { currentRoom?: string };
      if (parsed.currentRoom && parsed.currentRoom !== roomCode) {
        throw new ConflictException('请先离开当前房间');
      }
    }

    // 检查房间是否存在
    const metaJson = await this.redis.get(this.redis.keys.room.meta(roomCode));
    if (!metaJson) {
      throw new NotFoundException('房间不存在或已解散');
    }

    const meta = JSON.parse(metaJson) as RoomMeta;

    if (meta.status !== 'waiting') {
      if (meta.status === 'playing') throw new BadRequestException('房间已开局');
      if (meta.status === 'finished') throw new BadRequestException('房间已结束');
      throw new BadRequestException('房间已解散');
    }

    // 检查是否已在房间中
    const isInRoom = await this.redis.sismember(
      this.redis.keys.room.users(roomCode),
      userId,
    );
    if (isInRoom) {
      // 已在房间中，返回当前快照
      return this.getRoomSnapshot(roomCode);
    }

    // 分配座位
    const seats = await this.redis.hgetall(this.redis.keys.room.seats(roomCode));
    const occupiedSeats = Object.values(seats).length;

    if (occupiedSeats >= 4) {
      throw new ConflictException('房间已满（4/4）');
    }

    // 找空座位
    const occupiedSet = new Set(Object.keys(seats));
    let assignedSeat = -1;
    for (let s = 0; s < 4; s++) {
      if (!occupiedSet.has(s.toString())) {
        assignedSeat = s;
        break;
      }
    }

    // 写入座位
    const seatInfo: SeatInfo = {
      seat: assignedSeat,
      userId,
      nickname,
      avatarUrl,
      joinedAt: Date.now(),
    };
    await this.redis.hset(
      this.redis.keys.room.seats(roomCode),
      assignedSeat.toString(),
      JSON.stringify(seatInfo),
    );

    // 加入用户集合
    await this.redis.sadd(this.redis.keys.room.users(roomCode), userId);

    // 更新在线状态
    await this.redis.set(
      onlineKey,
      JSON.stringify({ currentRoom: roomCode }),
      30,
    );

    this.logger.log(`User ${userId} joined room ${roomCode} at seat ${assignedSeat}`);

    return { ...this.getRoomSnapshot(roomCode), assignedSeat };
  }

  // ==================== 离开房间 ====================

  async leaveRoom(userId: string) {
    const onlineKey = this.redis.keys.online.user(userId);
    const onlineData = await this.redis.get(onlineKey);
    if (!onlineData) {
      throw new NotFoundException('不在任何房间中');
    }

    const parsed = JSON.parse(onlineData) as { currentRoom?: string };
    const roomCode = parsed.currentRoom;
    if (!roomCode) {
      throw new NotFoundException('不在任何房间中');
    }

    const metaJson = await this.redis.get(this.redis.keys.room.meta(roomCode));
    if (!metaJson) {
      // 清理残留 online 状态
      await this.redis.del(onlineKey);
      return { ok: true };
    }

    const meta = JSON.parse(metaJson) as RoomMeta;

    // 对局中不允许直接离开
    if (meta.status === 'playing') {
      throw new BadRequestException('对局中无法离开，请让房主解散');
    }

    // 房主离开 → 解散
    if (meta.hostId === userId) {
      return this.dissolveRoom(roomCode, userId, 'host_left');
    }

    // 非房主离开
    await this.removePlayerFromRoom(roomCode, userId);
    await this.redis.set(onlineKey, JSON.stringify({}), 30);

    this.logger.log(`User ${userId} left room ${roomCode}`);
    return { ok: true };
  }

  // ==================== 准备 / 取消准备 ====================

  async setReady(userId: string, ready: boolean) {
    const roomCode = await this.getUserRoom(userId);

    const metaJson = await this.redis.get(this.redis.keys.room.meta(roomCode));
    if (!metaJson) throw new NotFoundException('房间不存在');
    const meta = JSON.parse(metaJson) as RoomMeta;
    if (meta.status !== 'waiting') {
      throw new BadRequestException('当前状态不允许准备操作');
    }

    const readyKey = this.redis.keys.room.ready(roomCode);

    if (ready) {
      await this.redis.sadd(readyKey, userId);
    } else {
      await this.redis.srem(readyKey, userId);
    }

    return { ok: true, ready };
  }

  // ==================== 解散房间 ====================

  async dissolveRoom(roomCode: string, actorId: string, reason: string) {
    const metaJson = await this.redis.get(this.redis.keys.room.meta(roomCode));
    if (!metaJson) throw new NotFoundException('房间不存在');

    const meta = JSON.parse(metaJson) as RoomMeta;

    // 仅房主可解散（或系统超时）
    if (meta.hostId !== actorId && reason !== 'timeout' && reason !== 'admin') {
      throw new ForbiddenException('仅房主可解散房间');
    }

    // 更新状态
    meta.status = 'dissolved';
    await this.redis.set(
      this.redis.keys.room.meta(roomCode),
      JSON.stringify(meta),
      300,
    );

    // 清理所有玩家的 online 状态
    const users = await this.redis.smembers(
      this.redis.keys.room.users(roomCode),
    );
    for (const uid of users) {
      const onlineKey = this.redis.keys.online.user(uid);
      await this.redis.set(onlineKey, JSON.stringify({}), 60);
    }

    // 更新 MySQL
    await this.prisma.room.updateMany({
      where: { roomCode, status: 'waiting' },
      data: {
        status: 'dissolved',
        dissolveReason: reason,
        endedAt: new Date(),
      },
    });

    // 房号归还池
    await this.redis.sadd(this.redis.keys.pool.pool(), roomCode);

    this.logger.log(`Room ${roomCode} dissolved by ${actorId}, reason: ${reason}`);
    return { ok: true, reason };
  }

  // ==================== 查询 ====================

  async getRoomInfo(roomCode: string) {
    const metaJson = await this.redis.get(this.redis.keys.room.meta(roomCode));
    if (!metaJson) {
      throw new NotFoundException('房间不存在');
    }

    const meta = JSON.parse(metaJson) as RoomMeta;
    const seats = await this.redis.hgetall(
      this.redis.keys.room.seats(roomCode),
    );

    const seatList: {
      seat: number;
      userId: string | null;
      nickname: string | null;
      avatarUrl: string | null;
    }[] = [];

    for (let s = 0; s < 4; s++) {
      const seatStr = seats[s.toString()];
      if (seatStr) {
        const info = JSON.parse(seatStr) as SeatInfo;
        seatList.push(info);
      } else {
        seatList.push({ seat: s, userId: null, nickname: null, avatarUrl: null });
      }
    }

    return {
      roomCode,
      status: meta.status,
      rule: meta.rule,
      totalRounds: meta.totalRounds,
      baseScore: meta.baseScore,
      hostId: meta.hostId,
      seats: seatList,
      createdAt: meta.createdAt,
    };
  }

  async getRoomSnapshot(roomCode: string): Promise<RoomSnapshot> {
    const metaJson = await this.redis.get(this.redis.keys.room.meta(roomCode));
    if (!metaJson) throw new NotFoundException('房间不存在');

    const meta = JSON.parse(metaJson) as RoomMeta;
    const seatsRaw = await this.redis.hgetall(
      this.redis.keys.room.seats(roomCode),
    );
    const readySeats = await this.redis.smembers(
      this.redis.keys.room.ready(roomCode),
    );
    const seqStr = await this.redis.get(this.redis.keys.room.seq(roomCode));

    const seats: SeatInfo[] = [];
    for (let s = 0; s < 4; s++) {
      const v = seatsRaw[s.toString()];
      if (v) {
        seats.push(JSON.parse(v) as SeatInfo);
      } else {
        seats.push({
          seat: s,
          userId: null,
          nickname: null,
          avatarUrl: null,
          joinedAt: 0,
        });
      }
    }

    return {
      roomCode,
      meta,
      seats,
      readySeats,
      serverSeq: parseInt(seqStr ?? '0', 10),
    };
  }

  // ==================== 私有方法 ====================

  private async getUserRoom(userId: string): Promise<string> {
    const onlineKey = this.redis.keys.online.user(userId);
    const onlineData = await this.redis.get(onlineKey);
    if (!onlineData) throw new NotFoundException('不在任何房间中');

    const parsed = JSON.parse(onlineData) as { currentRoom?: string };
    if (!parsed.currentRoom) throw new NotFoundException('不在任何房间中');

    return parsed.currentRoom;
  }

  private async removePlayerFromRoom(
    roomCode: string,
    userId: string,
  ): Promise<void> {
    // 从 seats 中清除
    const seats = await this.redis.hgetall(
      this.redis.keys.room.seats(roomCode),
    );
    for (const [seat, value] of Object.entries(seats)) {
      const info = JSON.parse(value) as SeatInfo;
      if (info.userId === userId) {
        await this.redis.hdel(this.redis.keys.room.seats(roomCode), seat);
        break;
      }
    }

    // 从 users 中移除
    await this.redis.srem(this.redis.keys.room.users(roomCode), userId);

    // 从 ready 中移除
    await this.redis.srem(this.redis.keys.room.ready(roomCode), userId);
  }

  private generateRoomCodeLocally(): string {
    const min = 100000;
    const max = 999999;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }
}
