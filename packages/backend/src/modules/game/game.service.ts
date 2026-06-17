import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomService } from '../room/room.service';
import type { GameState, GamePhase, HuResult } from './types';
import { DISCARD_TIMEOUT_MS, CLAIM_WINDOW_MS } from './types';
import {
  startRound,
  doDiscard,
  doPong,
  doKong,
  doHu,
  handleTing,
  handleTimeout,
  nextSeat,
  doDraw,
  applyDraw,
  type EngineEvent,
} from './game.engine';

export type { EngineEvent };

/**
 * GameService — 桥接 WebSocket 网关与纯函数游戏引擎
 *
 * 职责：
 * - 加载/持久化 GameState 到 Redis
 * - 调用引擎函数处理动作
 * - 管理超时计时器（出牌 15s / 抢牌 5s）
 * - 跟踪抢牌阶段各玩家的 pass 情况
 * - 返回结构化事件供网关广播
 */

type BroadcastFn = (roomCode: string, events: EngineEvent[]) => void;

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);
  private broadcastFn: BroadcastFn | null = null;

  // 超时计时器
  private discardTimers = new Map<string, NodeJS.Timeout>();
  private claimTimers = new Map<string, NodeJS.Timeout>();
  // 抢牌阶段 pass 跟踪: roomCode -> Set<seat>
  private passTracker = new Map<string, Set<number>>();
  // 玩家昵称缓存: roomCode -> nicknames[]
  private nicknameCache = new Map<string, string[]>();
  // 提前结束请求: roomCode -> boolean
  private stopRequests = new Map<string, boolean>();

  constructor(
    private readonly redis: RedisService,
    private readonly roomService: RoomService,
    private readonly prisma: PrismaService,
  ) {}

  /** 由 WsGateway 注入广播回调 */
  setBroadcast(fn: BroadcastFn): void {
    this.broadcastFn = fn;
  }

  // ==================== State Persistence ====================

  private stateKey(roomCode: string): string {
    return this.redis.keys.game.current(roomCode);
  }

  private async saveState(roomCode: string, state: GameState): Promise<void> {
    await this.redis.set(this.stateKey(roomCode), JSON.stringify(state));
  }

  /** 追加事件到 oplog（重连增量同步用） */
  private async appendOplog(roomCode: string, events: EngineEvent[]): Promise<void> {
    for (const evt of events) {
      await this.redis.rpush(
        this.redis.keys.game.oplog(roomCode),
        JSON.stringify(evt),
      );
    }
    // 限制 oplog 长度为 200 条
    await this.redis.ltrim(this.redis.keys.game.oplog(roomCode), -200, -1);
  }

  private async loadState(roomCode: string): Promise<GameState | null> {
    const raw = await this.redis.get(this.stateKey(roomCode));
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  }

  private broadcast(roomCode: string, events: EngineEvent[]): void {
    if (events.length === 0) return;
    void this.appendOplog(roomCode, events);
    if (this.broadcastFn) {
      this.broadcastFn(roomCode, events);
    }
  }

  // ==================== Game Actions ====================

  /**
   * 开始新的一局
   */
  async handleStartRound(
    roomCode: string,
    userIds: string[],
    totalRounds: number,
    dealerSeat: number = 0,
    nicknames?: string[],
  ): Promise<void> {
    // 缓存昵称供后续局使用
    if (nicknames) {
      this.nicknameCache.set(roomCode, nicknames);
    }
    const { state, events } = startRound(roomCode, 1, totalRounds, dealerSeat, userIds, nicknames);
    await this.saveState(roomCode, state);
    // 更新房间状态（只改 status 和 startedAt，不覆盖其他字段）
    const metaKey = this.redis.keys.room.meta(roomCode);
    const oldMeta = await this.redis.get(metaKey);
    if (oldMeta) {
      const parsed = JSON.parse(oldMeta) as Record<string, unknown>;
      parsed.status = 'playing';
      parsed.startedAt = Date.now();
      await this.redis.set(metaKey, JSON.stringify(parsed));
    }
    this.broadcast(roomCode, events);

    // 启动出牌倒计时
    this.startDiscardTimer(roomCode, state.currentTurnSeat);
  }

  /**
   * 开始下一局
   */
  async handleNextRound(roomCode: string, dealerSeat?: number): Promise<void> {
    const prev = await this.loadState(roomCode);
    if (!prev) {
      this.logger.error(`Cannot start next round: no state for ${roomCode}`);
      return;
    }

    const nextRoundNo = prev.roundNo + 1;
    const nextDealer = dealerSeat ?? (prev.dealerSeat + 1) % 4;
    const userIds = prev.players.map((p) => p.userId);
    const nicknames = this.nicknameCache.get(roomCode);

    const { state, events } = startRound(
      roomCode,
      nextRoundNo,
      prev.totalRounds,
      nextDealer,
      userIds,
      nicknames,
    );

    // 保留上局分数
    state.players.forEach((p, i) => {
      p.score = prev.players[i]?.score ?? 0;
    });

    await this.saveState(roomCode, state);
    this.broadcast(roomCode, events);
    this.startDiscardTimer(roomCode, state.currentTurnSeat);
  }

  // ==================== 出牌 ====================

  async handleDiscard(
    userId: string,
    roomCode: string,
    tile: string,
  ): Promise<boolean> {
    const state = await this.loadState(roomCode);
    if (!state) return false;

    const seat = this.findSeat(state, userId);
    if (seat === -1) return false;

    const result = doDiscard(state, { seat, tile });
    if ('error' in result) {
      this.logger.warn(`Discard error: ${result.error}`);
      return false;
    }

    await this.saveState(roomCode, result.state);
    this.clearDiscardTimer(roomCode);
    this.broadcast(roomCode, result.events);

    // 启动抢牌窗口
    this.initPassTracker(roomCode, seat);
    this.startClaimTimer(roomCode);

    return true;
  }

  // ==================== 碰 ====================

  async handlePong(userId: string, roomCode: string): Promise<boolean> {
    const state = await this.loadState(roomCode);
    if (!state) return false;

    const seat = this.findSeat(state, userId);
    if (seat === -1) return false;

    const result = doPong(state, seat);
    if ('error' in result) {
      this.logger.warn(`Pong error: ${result.error}`);
      return false;
    }

    await this.saveState(roomCode, result.state);
    this.clearClaimTimer(roomCode);
    this.clearPassTracker(roomCode);
    this.broadcast(roomCode, result.events);

    // 碰后轮到碰牌者出牌
    this.startDiscardTimer(roomCode, seat);
    return true;
  }

  // ==================== 杠 ====================

  async handleKong(
    userId: string,
    roomCode: string,
    kongType: 'kong_ming' | 'kong_an' | 'kong_added' = 'kong_an',
  ): Promise<boolean> {
    const state = await this.loadState(roomCode);
    if (!state) return false;

    const seat = this.findSeat(state, userId);
    if (seat === -1) return false;

    const result = doKong(state, seat, kongType);
    if ('error' in result) {
      this.logger.warn(`Kong error: ${result.error}`);
      return false;
    }

    await this.saveState(roomCode, result.state);
    this.clearClaimTimer(roomCode);
    this.clearPassTracker(roomCode);
    this.clearDiscardTimer(roomCode);
    this.broadcast(roomCode, result.events);

    // 杠后轮到杠牌者出牌
    this.startDiscardTimer(roomCode, seat);
    return true;
  }

  // ==================== 听 ====================

  async handleTing(userId: string, roomCode: string): Promise<boolean> {
    const state = await this.loadState(roomCode);
    if (!state) return false;

    const seat = this.findSeat(state, userId);
    if (seat === -1) return false;

    const result = handleTing(state, seat);
    if ('error' in result) {
      this.logger.warn(`Ting error: ${result.error}`);
      return false;
    }

    await this.saveState(roomCode, result.state);
    this.broadcast(roomCode, result.events);
    return true;
  }

  // ==================== 胡 ====================

  async handleHu(
    userId: string,
    roomCode: string,
  ): Promise<HuResult | null> {
    const state = await this.loadState(roomCode);
    if (!state) return null;

    const seat = this.findSeat(state, userId);
    if (seat === -1) return null;

    const result = doHu(state, seat);
    if ('error' in result) {
      this.logger.warn(`Hu error: ${result.error}`);
      return null;
    }

    await this.saveState(roomCode, result.state);
    this.clearDiscardTimer(roomCode);
    this.clearClaimTimer(roomCode);
    this.clearPassTracker(roomCode);
    this.broadcast(roomCode, result.events);

    // 延迟结算
    setTimeout(() => {
      void this.settleRound(roomCode);
    }, 2500);

    return result.result;
  }

  // ==================== 过 ====================

  async handlePass(userId: string, roomCode: string): Promise<void> {
    const state = await this.loadState(roomCode);
    if (!state) return;
    if (state.phase !== 'wait_claim') return;

    const seat = this.findSeat(state, userId);
    if (seat === -1) return;
    if (seat === state.lastDiscarded?.seat) return; // 出牌者不能 pass 自己

    // 记录 pass
    const passSet = this.passTracker.get(roomCode);
    if (!passSet) return;
    passSet.add(seat);

    this.logger.log(
      `Pass: room=${roomCode} seat=${seat} passed=${passSet.size}/3`,
    );

    // 发送 pass 事件（仅自己可见）
    this.broadcast(roomCode, [
      {
        type: 'pass',
        actor: userId,
        visibility: 'self',
        data: { seat },
      },
    ]);

    // 检查是否所有人都 pass 了（3 个非出牌者）
    const nonDiscarderCount = 3; // 4 players - 1 discarder
    if (passSet.size >= nonDiscarderCount) {
      this.clearClaimTimer(roomCode);
      this.clearPassTracker(roomCode);

      // 推进到下家摸牌
      const next = nextSeat(state.lastDiscarded!.seat);
      await this.advanceToDraw(roomCode, next);
    }
  }

  // ==================== 超时处理 ====================

  private async onDiscardTimeout(roomCode: string, seat: number): Promise<void> {
    const state = await this.loadState(roomCode);
    if (!state) return;
    if (state.currentTurnSeat !== seat) return; // 已经不是这个玩家的回合
    if (state.phase !== 'wait_discard') return;

    const result = handleTimeout(state);
    if ('error' in result) {
      this.logger.warn(`Timeout error: ${result.error}`);
      return;
    }

    await this.saveState(roomCode, result.state);
    this.broadcast(roomCode, result.events);

    // 超时自动出牌后启动抢牌窗口
    this.initPassTracker(roomCode, seat);
    this.startClaimTimer(roomCode);
    this.logger.log(`Auto-discard for ${roomCode} seat=${seat}`);
  }

  private async onClaimTimeout(roomCode: string): Promise<void> {
    const state = await this.loadState(roomCode);
    if (!state) return;
    if (state.phase !== 'wait_claim') return;

    // 所有未 pass 的玩家自动 pass
    const passSet = this.passTracker.get(roomCode) ?? new Set();
    const nonDiscarderSeats = [0, 1, 2, 3].filter(
      (s) => s !== state.lastDiscarded?.seat,
    );

    for (const seat of nonDiscarderSeats) {
      if (!passSet.has(seat)) {
        passSet.add(seat);
      }
    }

    this.clearPassTracker(roomCode);

    // 推进到下家摸牌
    const next = nextSeat(state.lastDiscarded!.seat);
    await this.advanceToDraw(roomCode, next);
  }

  /**
   * 推进到下家摸牌
   */
  private async advanceToDraw(
    roomCode: string,
    nextSeatNum: number,
  ): Promise<void> {
    const state = await this.loadState(roomCode);
    if (!state) return;

    // 检查牌墙是否为空
    if (state.wall.length === 0) {
      await this.handleHuangzhuang(roomCode);
      return;
    }

    // 设置轮到下家
    const updated: GameState = {
      ...state,
      currentTurnSeat: nextSeatNum,
      lastDiscarded: null,
      claimWindow: null,
      phase: 'wait_discard',
      eventSeq: state.eventSeq + 1,
    };

    // 摸牌
    const drawEvents = doDraw(updated);
    if (!drawEvents) {
      await this.handleHuangzhuang(roomCode);
      return;
    }

    const finalState = applyDraw(updated);
    await this.saveState(roomCode, finalState);
    this.broadcast(roomCode, drawEvents);

    // 启动出牌倒计时
    this.startDiscardTimer(roomCode, nextSeatNum);

    // 检查听牌自动胡
    const player = finalState.players[nextSeatNum];
    if (player?.isTing && player.listenTiles.length > 0) {
      const drawnTile = player.hand[player.hand.length - 1];
      if (drawnTile && player.listenTiles.includes(drawnTile)) {
        this.logger.log(
          `Auto-hu triggered: room=${roomCode} seat=${nextSeatNum}`,
        );
        // 自动胡牌
        setTimeout(() => {
          void this.handleHu(player.userId, roomCode);
        }, 500);
      }
    }
  }

  /**
   * 黄庄（流局）处理
   */
  private async handleHuangzhuang(roomCode: string): Promise<void> {
    const state = await this.loadState(roomCode);
    if (!state) return;

    const result: HuResult = {
      winnerSeat: -1,
      winnerId: '',
      loserSeat: null,
      winType: 'selfmo',
      winTile: '',
      fans: 0,
      fanBreakdown: [],
      scoreChanges: {},
      isHuangzhuang: true,
    };

    const huangState: GameState = {
      ...state,
      phase: 'round_end',
      eventSeq: state.eventSeq + 1,
    };

    await this.saveState(roomCode, huangState);
    this.clearAllTimers(roomCode);

    this.broadcast(roomCode, [
      {
        type: 'round_settled',
        actor: 'system',
        visibility: 'all',
        data: {
          roundNo: state.roundNo,
          huResult: result,
          isHuangzhuang: true,
        },
      },
    ]);

    // 延迟进入下一局
    setTimeout(() => {
      void this.afterRoundEnd(roomCode, (state.dealerSeat + 1) % 4);
    }, 3000);
  }

  // ==================== 结算 ====================

  private async settleRound(roomCode: string): Promise<void> {
    const state = await this.loadState(roomCode);
    if (!state) return;

    this.clearAllTimers(roomCode);

    const huPlayer = state.players.find((p) => p.isHu);
    const scoreboard = state.players.map((p) => ({
      seat: p.seat,
      userId: p.userId,
      score: p.score,
    }));

    this.broadcast(roomCode, [
      {
        type: 'round_settled',
        actor: 'system',
        visibility: 'all',
        data: {
          roundNo: state.roundNo,
          scoreboard,
          isFinished: state.roundNo >= state.totalRounds,
        },
      },
    ]);

    // 确定下一局庄家
    const nextDealer = huPlayer ? huPlayer.seat : (state.dealerSeat + 1) % 4;

    setTimeout(() => {
      void this.afterRoundEnd(roomCode, nextDealer);
    }, 4000);
  }

  private async afterRoundEnd(
    roomCode: string,
    nextDealerSeat: number,
  ): Promise<void> {
    // 检查是否有人请求提前结束
    if (this.isStopRequested(roomCode)) {
      this.stopRequests.delete(roomCode);
      this.broadcast(roomCode, [
        {
          type: 'stop.applied',
          actor: 'system',
          visibility: 'all',
          data: { message: '对局提前结束' },
        },
      ]);
      await this.settleMatch(roomCode);
      return;
    }

    const state = await this.loadState(roomCode);
    if (!state) return;

    if (state.roundNo >= state.totalRounds) {
      await this.settleMatch(roomCode);
      return;
    }

    // 下一局
    await this.handleNextRound(roomCode, nextDealerSeat);
  }

  private async settleMatch(roomCode: string): Promise<void> {
    const state = await this.loadState(roomCode);
    if (!state) return;

    const rankings = [...state.players]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({
        rank: i + 1,
        seat: p.seat,
        userId: p.userId,
        score: p.score,
      }));

    const finalState: GameState = { ...state, phase: 'match_end' };
    await this.saveState(roomCode, finalState);

    // 写入数据库
    try {
      const room = await this.prisma.room.findFirst({ where: { roomCode } });
      if (room) {
        // 只记录实际玩到的局数
        const actualRounds = state.roundNo;
        for (let r = 1; r <= actualRounds; r++) {
          await this.prisma.match.create({
            data: {
              roomId: room.id,
              roundNo: r,
              dealerId: BigInt(state.players[0]!.userId),
              players: {
                create: state.players.map((p) => ({
                  userId: BigInt(p.userId),
                  seat: p.seat,
                  scoreAfter: p.score,
                })),
              },
            },
          });
        }

        // 更新房间状态
        await this.prisma.room.update({
          where: { id: room.id },
          data: { status: 'finished', endedAt: new Date() },
        });
        this.logger.log(`Match data saved for room ${roomCode} (${actualRounds} rounds)`);
      }
    } catch (err) {
      this.logger.error(`Failed to save match data for ${roomCode}`, err);
    }

    // 清理所有缓存
    this.clearAllTimers(roomCode);
    this.clearPassTracker(roomCode);
    this.discardTimers.delete(roomCode);
    this.claimTimers.delete(roomCode);
    this.nicknameCache.delete(roomCode);
    this.stopRequests.delete(roomCode);

    this.broadcast(roomCode, [
      {
        type: 'match_settled',
        actor: 'system',
        visibility: 'all',
        data: { rankings },
      },
    ]);
  }

  // ==================== Timer Management ====================

  private startDiscardTimer(roomCode: string, seat: number): void {
    this.clearDiscardTimer(roomCode);
    const key = roomCode;
    const timer = setTimeout(() => {
      this.discardTimers.delete(key);
      void this.onDiscardTimeout(roomCode, seat);
    }, DISCARD_TIMEOUT_MS);
    this.discardTimers.set(key, timer);

    // 发送倒计时事件
    const countdownEvent: EngineEvent = {
      type: 'countdown.warning',
      actor: 'system',
      visibility: 'all',
      data: { seat, deadline: Date.now() + DISCARD_TIMEOUT_MS },
    };
    this.broadcast(roomCode, [countdownEvent]);
  }

  private startClaimTimer(roomCode: string): void {
    this.clearClaimTimer(roomCode);
    const timer = setTimeout(() => {
      this.claimTimers.delete(roomCode);
      void this.onClaimTimeout(roomCode);
    }, CLAIM_WINDOW_MS);
    this.claimTimers.set(roomCode, timer);
  }

  private clearDiscardTimer(roomCode: string): void {
    const t = this.discardTimers.get(roomCode);
    if (t) {
      clearTimeout(t);
      this.discardTimers.delete(roomCode);
    }
  }

  private clearClaimTimer(roomCode: string): void {
    const t = this.claimTimers.get(roomCode);
    if (t) {
      clearTimeout(t);
      this.claimTimers.delete(roomCode);
    }
  }

  private clearAllTimers(roomCode: string): void {
    this.clearDiscardTimer(roomCode);
    this.clearClaimTimer(roomCode);
  }

  // ==================== Pass Tracker ====================

  private initPassTracker(roomCode: string, discarderSeat: number): void {
    this.passTracker.set(roomCode, new Set());
  }

  private clearPassTracker(roomCode: string): void {
    this.passTracker.delete(roomCode);
  }

  // ==================== Helpers ====================

  private findSeat(state: GameState, userId: string): number {
    const p = state.players.find((pl) => pl.userId === userId);
    return p?.seat ?? -1;
  }

  async getState(roomCode: string): Promise<GameState | null> {
    return this.loadState(roomCode);
  }

  async getSeatForUser(
    roomCode: string,
    userId: string,
  ): Promise<number> {
    const state = await this.loadState(roomCode);
    if (!state) return -1;
    return this.findSeat(state, userId);
  }

  /** 请求提前结束（当前局打完即停） */
  async handleStopRequest(roomCode: string): Promise<boolean> {
    this.stopRequests.set(roomCode, true);
    this.broadcast(roomCode, [
      {
        type: 'stop.requested',
        actor: 'system',
        visibility: 'all',
        data: { message: '有玩家请求结束，当前局打完后停止' },
      },
    ]);
    return true;
  }

  /** 检查是否有人请求结束 */
  private isStopRequested(roomCode: string): boolean {
    return this.stopRequests.get(roomCode) === true;
  }
}
