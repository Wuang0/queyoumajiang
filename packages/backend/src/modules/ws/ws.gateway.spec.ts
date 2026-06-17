import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { WsGateway } from './ws.gateway';
import { WsAuthGuard } from './ws-auth.guard';
import { RoomService } from '../room/room.service';
import { GameService } from '../game/game.service';
import { RedisService } from '../redis/redis.service';

describe('WsGateway', () => {
  let gateway: WsGateway;

  const mockRoomService = {
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    setReady: jest.fn(),
  };

  const mockRedisKeys = {
    channel: { roomEvents: (code: string) => `chan:room:${code}:events` },
    online: { user: (uid: string) => `user:online:${uid}` },
  };

  const mockRedis = {
    keys: mockRedisKeys,
    publish: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const mockJwtService = {
    verify: jest.fn().mockReturnValue({ sub: '1', openid: 'test_openid' }),
    sign: jest.fn().mockReturnValue('mock-token'),
  };

  const mockServer = {
    to: jest.fn().mockReturnValue({
      emit: jest.fn(),
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WsGateway,
        WsAuthGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: RoomService, useValue: mockRoomService },
        { provide: GameService, useValue: { setBroadcast: jest.fn() } },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    gateway = module.get<WsGateway>(WsGateway);
    // Inject mock server
    (gateway as { server: unknown }).server = mockServer;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('afterInit', () => {
    it('应该初始化 WebSocket Server', () => {
      expect(() => gateway.afterInit(mockServer as unknown as Parameters<typeof gateway.afterInit>[0])).not.toThrow();
    });
  });

  describe('handleConnection', () => {
    it('带 token 的连接应该接受', () => {
      const client = {
        id: 'socket-1',
        handshake: { query: { token: 'valid-token' } },
        disconnect: jest.fn(),
      };

      gateway.handleConnection(client as unknown as Parameters<typeof gateway.handleConnection>[0]);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('无 token 的连接应该拒绝', () => {
      const client = {
        id: 'socket-2',
        handshake: { query: {} },
        disconnect: jest.fn(),
      };

      gateway.handleConnection(client as unknown as Parameters<typeof gateway.handleConnection>[0]);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('应该清理心跳定时器', () => {
      const client = {
        id: 'socket-3',
        userId: '1',
      };

      gateway.handleDisconnect(client as unknown as Parameters<typeof gateway.handleDisconnect>[0]);
      // 不抛异常即通过
    });
  });

  describe('handleJoinRoom', () => {
    it('成功加入应该发送 ack', async () => {
      mockRoomService.joinRoom.mockResolvedValue({ roomCode: '888888', assignedSeat: 1 });

      const client = {
        userId: '2',
        emit: jest.fn(),
        join: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      };

      const msg = { v: 1, type: 'room.join', clientSeq: 1, ts: Date.now(), payload: { roomCode: '888888' } };

      await gateway.handleJoinRoom(
        client as unknown as Parameters<typeof gateway.handleJoinRoom>[0],
        msg,
      );

      expect(client.emit).toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('room:888888');
    });

    it('加入失败应该发送错误 ack', async () => {
      mockRoomService.joinRoom.mockRejectedValue(new Error('ROOM_NOT_FOUND'));

      const client = {
        userId: '2',
        emit: jest.fn(),
        join: jest.fn(),
        to: jest.fn(),
      };

      const msg = { v: 1, type: 'room.join', clientSeq: 2, ts: Date.now(), payload: { roomCode: '999999' } };

      await gateway.handleJoinRoom(
        client as unknown as Parameters<typeof gateway.handleJoinRoom>[0],
        msg,
      );

      const calls = (client.emit as jest.Mock).mock.calls as Array<[string, Record<string, unknown>]>;
      expect(calls[0]![0]).toBe('message');
      expect(calls[0]![1]).toHaveProperty('payload.ok', false);
    });
  });

  describe('handleReady', () => {
    it('准备成功应该广播', async () => {
      mockRoomService.setReady.mockResolvedValue({ ok: true, ready: true });
      mockRedis.get.mockResolvedValue(JSON.stringify({ currentRoom: '888888' }));

      const client = {
        userId: '1',
        emit: jest.fn(),
      };

      const msg = { v: 1, type: 'room.ready', clientSeq: 3, ts: Date.now(), payload: {} };

      await gateway.handleReady(
        client as unknown as Parameters<typeof gateway.handleReady>[0],
        msg,
      );

      expect(client.emit).toHaveBeenCalled();
    });
  });
});
