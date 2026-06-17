import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoomService } from './room.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('RoomService', () => {
  let service: RoomService;

  const mockPrisma = {
    room: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockRedisStore: Record<string, string> = {};
  const mockRedisSets: Record<string, Set<string>> = {};
  const mockRedisHashes: Record<string, Record<string, string>> = {};

  const mockRedis = {
    keys: {
      idempotency: { room: (prefix: string, uid: string) => `room:idemp:${prefix}:${uid}` },
      pool: { pool: () => 'sys:roomcode:pool' },
      room: {
        owner: (code: string) => `room:owner:${code}`,
        meta: (code: string) => `room:meta:${code}`,
        seats: (code: string) => `room:seats:${code}`,
        users: (code: string) => `room:users:${code}`,
        ready: (code: string) => `room:ready:${code}`,
        seq: (code: string) => `room:seq:${code}`,
        activeList: () => 'room:active',
      },
      online: {
        user: (uid: string) => `user:online:${uid}`,
      },
    },
    get: jest.fn(async (key: string) => mockRedisStore[key] ?? null),
    set: jest.fn(async (key: string, value: string, _ttl?: number) => {
      mockRedisStore[key] = value;
      return 'OK';
    }),
    del: jest.fn(async (key: string) => {
      delete mockRedisStore[key];
      return 1;
    }),
    hset: jest.fn(async (key: string, field: string, value: string) => {
      mockRedisHashes[key] ??= {};
      mockRedisHashes[key]![field] = value;
      return 1;
    }),
    hgetall: jest.fn(async (key: string) => mockRedisHashes[key] ?? {}),
    hdel: jest.fn(async (key: string, field: string) => {
      if (mockRedisHashes[key]) delete mockRedisHashes[key]![field];
      return 1;
    }),
    sadd: jest.fn(async (key: string, ...members: string[]) => {
      mockRedisSets[key] ??= new Set();
      for (const m of members) mockRedisSets[key]!.add(m);
      return members.length;
    }),
    srem: jest.fn(async (key: string, ...members: string[]) => {
      if (mockRedisSets[key]) {
        for (const m of members) mockRedisSets[key]!.delete(m);
      }
      return members.length;
    }),
    sismember: jest.fn(async (key: string, member: string) => {
      return mockRedisSets[key]?.has(member) ?? false;
    }),
    smembers: jest.fn(async (key: string) => {
      return [...(mockRedisSets[key] ?? [])];
    }),
    spop: jest.fn(async (key: string) => {
      if (key === 'sys:roomcode:pool') return '888888';
      return null;
    }),
    acquireLock: jest.fn(async () => true),
    releaseLock: jest.fn(async () => true),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RoomService>(RoomService);
  });

  beforeEach(() => {
    Object.keys(mockRedisStore).forEach((k) => delete mockRedisStore[k]);
    Object.keys(mockRedisSets).forEach((k) => delete mockRedisSets[k]);
    Object.keys(mockRedisHashes).forEach((k) => delete mockRedisHashes[k]);
    jest.clearAllMocks();
    mockPrisma.room.create.mockResolvedValue({ id: BigInt(1), roomCode: '888888' });
    mockPrisma.room.updateMany.mockResolvedValue({ count: 1 });
  });

  describe('createRoom', () => {
    const dto = { rule: 'xiangyang_redzhong', totalRounds: 8, baseScore: 1, requestId: 'abc-123' };

    it('应该成功创建房间', async () => {
      const result = await service.createRoom('1', '王哥', null, dto);

      expect(result.roomCode).toBe('888888');
      expect(result.hostId).toBe('1');
      expect(result.roomId).toBe('1');
      expect(mockPrisma.room.create).toHaveBeenCalled();

      // 验证 Redis 状态
      const metaKey = mockRedis.keys.room.meta('888888');
      expect(mockRedisStore[metaKey]).toBeDefined();
    });

    it('应该为房主分配座位 0', async () => {
      await service.createRoom('1', '王哥', null, dto);

      const seatsKey = mockRedis.keys.room.seats('888888');
      const seats = mockRedisHashes[seatsKey];
      expect(seats).toBeDefined();
      expect(seats!['0']).toContain('王哥');
    });

    it('应该幂等：重复 requestId 返回相同结果', async () => {
      const r1 = await service.createRoom('1', '王哥', null, dto);
      const r2 = await service.createRoom('1', '王哥', null, dto);

      expect(r2.roomCode).toBe(r1.roomCode);
      expect(mockPrisma.room.create).toHaveBeenCalledTimes(1);
    });

    it('已在其他房间应拒绝', async () => {
      mockRedisStore['user:online:1'] = JSON.stringify({ currentRoom: '123456' });

      await expect(
        service.createRoom('1', '王哥', null, { ...dto, requestId: 'xyz' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('joinRoom', () => {
    beforeEach(async () => {
      const metaKey = mockRedis.keys.room.meta('888888');
      mockRedisStore[metaKey] = JSON.stringify({
        hostId: '1',
        rule: 'xiangyang_redzhong',
        baseScore: 1,
        totalRounds: 8,
        status: 'waiting',
        createdAt: Date.now(),
        startedAt: null,
        nodeId: 'test',
      });
    });

    it('应该成功加入房间', async () => {
      const result = await service.joinRoom('2', '小李', null, '888888');
      const assigned = await result as { assignedSeat?: number };
      expect(assigned.assignedSeat).toBeDefined();
      expect(assigned.assignedSeat).toBeGreaterThanOrEqual(0);
    });

    it('不存在的房间应拒绝', async () => {
      await expect(
        service.joinRoom('2', '小李', null, '999999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('已在对局中的房间应拒绝', async () => {
      const metaKey = mockRedis.keys.room.meta('888888');
      const meta = JSON.parse(mockRedisStore[metaKey]!);
      meta.status = 'playing';
      mockRedisStore[metaKey] = JSON.stringify(meta);

      await expect(
        service.joinRoom('2', '小李', null, '888888'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('leaveRoom', () => {
    beforeEach(async () => {
      mockRedisStore['user:online:2'] = JSON.stringify({ currentRoom: '888888' });
      const metaKey = mockRedis.keys.room.meta('888888');
      mockRedisStore[metaKey] = JSON.stringify({
        hostId: '1',
        rule: 'xiangyang_redzhong',
        status: 'waiting',
        baseScore: 1,
        totalRounds: 8,
        createdAt: Date.now(),
        startedAt: null,
        nodeId: 'test',
      });
    });

    it('应该成功离开房间', async () => {
      const result = await service.leaveRoom('2');
      expect(result.ok).toBe(true);
    });

    it('不在任何房间应报错', async () => {
      await expect(service.leaveRoom('99')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setReady', () => {
    beforeEach(async () => {
      mockRedisStore['user:online:1'] = JSON.stringify({ currentRoom: '888888' });
      const metaKey = mockRedis.keys.room.meta('888888');
      mockRedisStore[metaKey] = JSON.stringify({
        hostId: '1', rule: 'xiangyang_redzhong', status: 'waiting',
        baseScore: 1, totalRounds: 8, createdAt: Date.now(), startedAt: null, nodeId: 'test',
      });
    });

    it('应该成功设置准备状态', async () => {
      const result = await service.setReady('1', true);
      expect(result.ok).toBe(true);
      expect(result.ready).toBe(true);
    });

    it('应该成功取消准备', async () => {
      await service.setReady('1', true);
      const result = await service.setReady('1', false);
      expect(result.ok).toBe(true);
      expect(result.ready).toBe(false);
    });
  });

  describe('dissolveRoom', () => {
    beforeEach(async () => {
      const metaKey = mockRedis.keys.room.meta('888888');
      mockRedisStore[metaKey] = JSON.stringify({
        hostId: '1', rule: 'xiangyang_redzhong', status: 'waiting',
        baseScore: 1, totalRounds: 8, createdAt: Date.now(), startedAt: null, nodeId: 'test',
      });
    });

    it('房主应该成功解散房间', async () => {
      const result = await service.dissolveRoom('888888', '1', 'host_left');
      expect(result.ok).toBe(true);
    });

    it('非房主不能解散', async () => {
      await expect(
        service.dissolveRoom('888888', '2', 'host_left'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getRoomInfo', () => {
    it('应该返回房间信息', async () => {
      const metaKey = mockRedis.keys.room.meta('888888');
      mockRedisStore[metaKey] = JSON.stringify({
        hostId: '1', rule: 'xiangyang_redzhong', status: 'waiting',
        baseScore: 1, totalRounds: 8, createdAt: Date.now(), startedAt: null, nodeId: 'test',
      });

      const info = await service.getRoomInfo('888888');
      expect(info.roomCode).toBe('888888');
      expect(info.status).toBe('waiting');
      expect(info.seats).toHaveLength(4);
    });

    it('不存在的房间应报错', async () => {
      await expect(service.getRoomInfo('000000')).rejects.toThrow(NotFoundException);
    });
  });
});
