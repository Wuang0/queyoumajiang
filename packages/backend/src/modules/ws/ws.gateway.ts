import { Logger, UseGuards } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayDisconnect,
  OnGatewayConnection,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { WsAuthGuard } from './ws-auth.guard';
import { RoomService } from '../room/room.service';
import { GameService, type EngineEvent } from '../game/game.service';
import { RedisService } from '../redis/redis.service';
import type { WsAuthenticatedSocket } from './ws-auth.guard';
import type { C2SMessage, S2CMessage } from './dto/ws-message.dto';

@WebSocketGateway({
  namespace: '/game',
  cors: { origin: '*', credentials: false },
  pingInterval: 5000,
  pingTimeout: 15000,
})
export class WsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WsGateway.name);
  private heartbeatTimers = new Map<string, NodeJS.Timeout>();
  private readonly HEARTBEAT_INTERVAL = 5000;
  private readonly HEARTBEAT_TIMEOUT = 15000;

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
    private readonly redis: RedisService,
  ) {}

  afterInit(_server: Server): void {
    this.logger.log('WebSocket Gateway 初始化完成');

    // 注入广播回调到 GameService
    this.gameService.setBroadcast((roomCode: string, events: EngineEvent[]) => {
      this.dispatchEvents(roomCode, undefined, events);
    });
  }

  handleConnection(client: Socket): void {
    const token = client.handshake.query.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      this.logger.warn(`WS connection rejected: no token`);
      return;
    }
    this.logger.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    const timer = this.heartbeatTimers.get(client.id);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(client.id);
    }

    const authClient = client as WsAuthenticatedSocket;
    if (authClient.userId) {
      this.logger.log(
        `WS disconnected: user=${authClient.userId} socket=${client.id}`,
      );
    }
  }

  // ==================== Auth ====================

  @SubscribeMessage('auth')
  @UseGuards(WsAuthGuard)
  handleAuth(@ConnectedSocket() client: WsAuthenticatedSocket): void {
    const event: S2CMessage = {
      v: 1,
      type: 'event',
      serverSeq: 0,
      ts: Date.now(),
      payload: {
        eventType: 'hello',
        actor: 'system',
        visibility: 'self',
        data: {
          userId: client.userId,
          serverTime: Date.now(),
          minClientVer: '1.0.0',
          features: ['xiangyang_redzhong'],
        },
      },
    };
    client.emit('message', event);
    this.startHeartbeat(client);
  }

  // ==================== Heartbeat ====================

  private startHeartbeat(client: WsAuthenticatedSocket): void {
    let missedBeats = 0;
    const maxMissed = this.HEARTBEAT_TIMEOUT / this.HEARTBEAT_INTERVAL;

    const timer = setInterval(() => {
      missedBeats++;
      if (missedBeats > maxMissed) {
        this.logger.warn(`Heartbeat timeout: user=${client.userId}`);
        clearInterval(timer);
        this.heartbeatTimers.delete(client.id);
        client.disconnect(true);
      }
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatTimers.set(client.id, timer);

    // 收到 heartbeat 重置计数
    client.on('heartbeat', () => {
      missedBeats = 0;
      client.emit('message', {
        v: 1,
        type: 'heartbeat',
        ts: Date.now(),
        payload: { serverTime: Date.now() },
      } satisfies S2CMessage);
    });
  }

  // ==================== Room Events ====================

  @SubscribeMessage('room.join')
  @UseGuards(WsAuthGuard)
  async handleJoinRoom(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    const payload = msg.payload as { roomCode: string; nickname?: string };
    const { roomCode } = payload;
    const nickname = payload.nickname ?? `雀友`;

    try {
      const result = await this.roomService.joinRoom(
        client.userId,
        nickname,
        null,
        roomCode,
      );

      client.emit('message', this.ack(msg, 0, result));

      await client.join(`room:${roomCode}`);

      client.to(`room:${roomCode}`).emit(
        'message',
        this.event(
          'player.joined',
          client.userId,
          {
            userId: client.userId,
            nickname,
            seat: (result as { assignedSeat?: number }).assignedSeat ?? -1,
          },
        ),
      );

      await this.redis.publish(
        this.redis.keys.channel.roomEvents(roomCode),
        JSON.stringify({
          type: 'player.joined',
          userId: client.userId,
          roomCode,
        }),
      );

      this.logger.log(`User ${client.userId} joined WS room ${roomCode}`);
    } catch (err) {
      client.emit(
        'message',
        this.ack(msg, 30001, null, (err as Error).message),
      );
    }
  }

  @SubscribeMessage('room.leave')
  @UseGuards(WsAuthGuard)
  async handleLeaveRoom(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    try {
      const result = await this.roomService.leaveRoom(client.userId);
      client.emit('message', this.ack(msg, 0, result));

      const onlineData = await this.redis.get(
        this.redis.keys.online.user(client.userId),
      );
      if (onlineData) {
        const parsed = JSON.parse(onlineData) as { currentRoom?: string };
        if (parsed.currentRoom) {
          client.to(`room:${parsed.currentRoom}`).emit(
            'message',
            this.event('player.left', client.userId, {
              userId: client.userId,
            }),
          );
          await client.leave(`room:${parsed.currentRoom}`);
        }
      }
    } catch (err) {
      client.emit(
        'message',
        this.ack(msg, 30010, null, (err as Error).message),
      );
    }
  }

  @SubscribeMessage('room.ready')
  @UseGuards(WsAuthGuard)
  async handleReady(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    try {
      const result = await this.roomService.setReady(client.userId, true);
      client.emit('message', this.ack(msg, 0, result));

      const roomCode = await this.getClientRoom(client.userId);
      if (roomCode) {
        this.server.to(`room:${roomCode}`).emit(
          'message',
          this.event('player.ready', client.userId, {
            userId: client.userId,
          }),
        );
      }
    } catch (err) {
      client.emit(
        'message',
        this.ack(msg, 40003, null, (err as Error).message),
      );
    }
  }

  @SubscribeMessage('room.unready')
  @UseGuards(WsAuthGuard)
  async handleUnready(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    try {
      const result = await this.roomService.setReady(client.userId, false);
      client.emit('message', this.ack(msg, 0, result));

      const roomCode = await this.getClientRoom(client.userId);
      if (roomCode) {
        this.server.to(`room:${roomCode}`).emit(
          'message',
          this.event('player.unready', client.userId, {
            userId: client.userId,
          }),
        );
      }
    } catch (err) {
      client.emit(
        'message',
        this.ack(msg, 40003, null, (err as Error).message),
      );
    }
  }

  // ==================== Start Game ====================

  @SubscribeMessage('room.start')
  @UseGuards(WsAuthGuard)
  async handleStartGame(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    try {
      const roomCode = await this.getClientRoom(client.userId);
      if (!roomCode) {
        client.emit(
          'message',
          this.ack(msg, 30001, null, '不在任何房间中'),
        );
        return;
      }

      // 获取房间快照，验证房主身份和准备状态
      const snapshot = await this.roomService.getRoomSnapshot(roomCode);
      if (!snapshot) {
        client.emit(
          'message',
          this.ack(msg, 30001, null, '房间不存在'),
        );
        return;
      }

      if (snapshot.meta.hostId !== client.userId) {
        client.emit(
          'message',
          this.ack(msg, 30011, null, '只有房主可以开始游戏'),
        );
        return;
      }

      // 检查所有座位有人且都准备
      const filledSeats = snapshot.seats.filter((s) => s.userId).length;
      if (filledSeats < 4) {
        client.emit(
          'message',
          this.ack(msg, 40003, null, '需要 4 名玩家'),
        );
        return;
      }

      const readyCount = snapshot.readySeats.length;
      if (readyCount < 4) {
        client.emit(
          'message',
          this.ack(msg, 40003, null, '所有玩家需要准备'),
        );
        return;
      }

      // 按座位顺序排列
      const seats = snapshot.seats.sort((a, b) => a.seat - b.seat);
      const userIds = seats.map((s) => s.userId!);
      const nicknames = seats.map((s) => s.nickname ?? `雀友`);

      // ack 成功
      client.emit('message', this.ack(msg, 0, { started: true }));

      // 开始游戏
      await this.gameService.handleStartRound(
        roomCode,
        userIds,
        snapshot.meta.totalRounds,
        0,
        nicknames,
      );

      this.logger.log(`Game started in room ${roomCode}`);
    } catch (err) {
      client.emit(
        'message',
        this.ack(msg, 40003, null, (err as Error).message),
      );
    }
  }

  // ==================== Game Actions ====================

  @SubscribeMessage('game.discard')
  @UseGuards(WsAuthGuard)
  async handleGameDiscard(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    const { tile } = msg.payload as { tile: string };
    const roomCode = await this.getClientRoom(client.userId);

    if (!roomCode) {
      client.emit('message', this.ack(msg, 30001, null, '不在房间'));
      return;
    }

    const ok = await this.gameService.handleDiscard(
      client.userId,
      roomCode,
      tile,
    );

    if (ok) {
      client.emit('message', this.ack(msg, 0, { tile }));
    } else {
      client.emit('message', this.ack(msg, 40002, null, '出牌失败'));
    }
  }

  @SubscribeMessage('game.pong')
  @UseGuards(WsAuthGuard)
  async handleGamePong(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    const roomCode = await this.getClientRoom(client.userId);
    if (!roomCode) {
      client.emit('message', this.ack(msg, 30001, null, '不在房间'));
      return;
    }

    const ok = await this.gameService.handlePong(client.userId, roomCode);
    if (ok) {
      client.emit('message', this.ack(msg, 0, {}));
    } else {
      client.emit('message', this.ack(msg, 40004, null, '碰牌失败'));
    }
  }

  @SubscribeMessage('game.ting')
  @UseGuards(WsAuthGuard)
  async handleGameTing(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    const roomCode = await this.getClientRoom(client.userId);
    if (!roomCode) {
      client.emit('message', this.ack(msg, 30001, null, '不在房间'));
      return;
    }

    const ok = await this.gameService.handleTing(client.userId, roomCode);
    if (ok) {
      client.emit('message', this.ack(msg, 0, {}));
    } else {
      client.emit('message', this.ack(msg, 40004, null, '听牌失败'));
    }
  }

  @SubscribeMessage('room.stop')
  @UseGuards(WsAuthGuard)
  async handleStopGame(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    const roomCode = await this.getClientRoom(client.userId);
    if (!roomCode) {
      client.emit('message', this.ack(msg, 30001, null, '不在房间'));
      return;
    }
    await this.gameService.handleStopRequest(roomCode);
    client.emit('message', this.ack(msg, 0, { stopped: true }));
  }

  @SubscribeMessage('game.kong')
  @UseGuards(WsAuthGuard)
  async handleGameKong(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    const payload = msg.payload as { kongType?: string };
    const kongType = (payload.kongType as 'kong_ming' | 'kong_an' | 'kong_added') ?? 'kong_an';
    const roomCode = await this.getClientRoom(client.userId);
    if (!roomCode) {
      client.emit('message', this.ack(msg, 30001, null, '不在房间'));
      return;
    }
    const ok = await this.gameService.handleKong(client.userId, roomCode, kongType);
    if (ok) {
      client.emit('message', this.ack(msg, 0, {}));
    } else {
      client.emit('message', this.ack(msg, 40004, null, '杠牌失败'));
    }
  }

  @SubscribeMessage('game.hu')
  @UseGuards(WsAuthGuard)
  async handleGameHu(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    const roomCode = await this.getClientRoom(client.userId);
    if (!roomCode) {
      client.emit('message', this.ack(msg, 30001, null, '不在房间'));
      return;
    }

    const result = await this.gameService.handleHu(client.userId, roomCode);

    if (result) {
      client.emit('message', this.ack(msg, 0, result));
    } else {
      client.emit('message', this.ack(msg, 40004, null, '胡牌失败'));
    }
  }

  @SubscribeMessage('game.pass')
  @UseGuards(WsAuthGuard)
  async handleGamePass(
    @ConnectedSocket() client: WsAuthenticatedSocket,
    @MessageBody() msg: C2SMessage,
  ): Promise<void> {
    const roomCode = await this.getClientRoom(client.userId);
    if (!roomCode) {
      client.emit('message', this.ack(msg, 30001, null, '不在房间'));
      return;
    }

    await this.gameService.handlePass(client.userId, roomCode);
    client.emit('message', this.ack(msg, 0, {}));
  }

  // ==================== Event Dispatch ====================

  /**
   * 按 visibility 分发事件到对应 socket
   */
  private dispatchEvents(
    roomCode: string,
    _actorSocket: WsAuthenticatedSocket | undefined,
    events: EngineEvent[],
  ): void {
    for (const evt of events) {
      const msg = this.event(
        evt.type,
        evt.actor,
        evt.data,
        evt.visibility,
      );

      const room = `room:${roomCode}`;

      if (evt.visibility === 'all') {
        this.server.to(room).emit('message', msg);
      } else if (evt.visibility === 'self') {
        // 需要找到 actor socket 单独发送
        const gameNs = this.server.of('/game');
        for (const [, sock] of gameNs.sockets) {
          const wsSock = sock as unknown as WsAuthenticatedSocket;
          if (wsSock.userId === evt.actor) {
            sock.emit('message', msg);
          }
        }
      } else if (evt.visibility === 'others') {
        // 发给房间内除 actor 外的所有人
        const gameNs = this.server.of('/game');
        for (const [, sock] of gameNs.sockets) {
          const wsSock = sock as unknown as WsAuthenticatedSocket;
          if (wsSock.userId !== evt.actor) {
            if (sock.rooms.has(room)) {
              sock.emit('message', msg);
            }
          }
        }
      }
    }
  }

  // ==================== Helpers ====================

  private ack(
    msg: C2SMessage,
    code: number,
    result: unknown,
    message?: string,
  ): S2CMessage {
    return {
      v: 1,
      type: 'ack',
      clientSeq: msg.clientSeq,
      ts: Date.now(),
      payload: { ok: code === 0, code, message, result },
    };
  }

  private event(
    eventType: string,
    actor: string,
    data: Record<string, unknown>,
    visibility: 'all' | 'self' | 'others' = 'all',
  ): S2CMessage {
    return {
      v: 1,
      type: 'event',
      serverSeq: 0,
      ts: Date.now(),
      payload: { eventType, actor, visibility, data },
    };
  }

  private async getClientRoom(userId: string): Promise<string | null> {
    const onlineData = await this.redis.get(
      this.redis.keys.online.user(userId),
    );
    if (!onlineData) return null;
    const parsed = JSON.parse(onlineData) as { currentRoom?: string };
    return parsed.currentRoom ?? null;
  }
}
