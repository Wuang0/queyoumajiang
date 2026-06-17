import { Test, TestingModule } from '@nestjs/testing';
import { ReconnectService } from './reconnect.service';
import { RedisService } from '../redis/redis.service';

describe('ReconnectService', () => {
  let service: ReconnectService;

  const mockRedisStore: Record<string, string> = {};
  const mockRedisSets: Record<string, Set<string>> = {};
  const mockRedisLists: Record<string, string[]> = {};
  const mockRedisHashes: Record<string, Record<string, string>> = {};

  const mockRedis = {
    keys: {
      room: {
        meta: (code: string) => `room:meta:${code}`,
        seats: (code: string) => `room:seats:${code}`,
        users: (code: string) => `room:users:${code}`,
        ready: (code: string) => `room:ready:${code}`,
        seq: (code: string) => `room:seq:${code}`,
      },
      game: {
        current: (code: string) => `game:cur:${code}`,
        oplog: (code: string) => `game:oplog:${code}`,
      },
    },
    get: jest.fn(async (key: string) => mockRedisStore[key] ?? null),
    set: jest.fn(async (key: string, value: string) => {
      mockRedisStore[key] = value;
      return 'OK';
    }),
    del: jest.fn(async (key: string) => { delete mockRedisStore[key]; return 1; }),
    exists: jest.fn(async (key: string) => key in mockRedisStore),
    sismember: jest.fn(async (key: string, member: string) => {
      return mockRedisSets[key]?.has(member) ?? false;
    }),
    smembers: jest.fn(async (key: string) => {
      return [...(mockRedisSets[key] ?? [])];
    }),
    sadd: jest.fn(async (key: string, ...members: string[]) => {
      mockRedisSets[key] ??= new Set();
      for (const m of members) mockRedisSets[key]!.add(m);
      return members.length;
    }),
    hgetall: jest.fn(async (key: string) => {
      return mockRedisHashes[key] ?? {};
    }),
    llen: jest.fn(async (key: string) => {
      return mockRedisLists[key]?.length ?? 0;
    }),
    lrange: jest.fn(async (key: string, start: number, stop: number) => {
      const list = mockRedisLists[key] ?? [];
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconnectService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<ReconnectService>(ReconnectService);
  });

  beforeEach(() => {
    Object.keys(mockRedisStore).forEach((k) => delete mockRedisStore[k]);
    Object.keys(mockRedisSets).forEach((k) => delete mockRedisSets[k]);
    Object.keys(mockRedisLists).forEach((k) => delete mockRedisLists[k]);
    Object.keys(mockRedisHashes).forEach((k) => delete mockRedisHashes[k]);
    jest.clearAllMocks();
  });

  describe('recordDisconnect / clearDisconnect', () => {
    it('应该记录断线', () => {
      service.recordDisconnect('u1', '888888', 10);
      const duration = service.getDisconnectedDuration('u1');
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('清除后不应有记录', () => {
      service.recordDisconnect('u1', '888888', 10);
      service.clearDisconnect('u1');
      expect(service.getDisconnectedDuration('u1')).toBe(-1);
    });
  });

  describe('isInReconnectWindow', () => {
    it('刚断线应在重连窗口内', () => {
      service.recordDisconnect('u1', '888888', 10);
      expect(service.isInReconnectWindow('u1')).toBe(true);
    });
  });

  describe('handleResume', () => {
    it('房间不存在应返回错误', async () => {
      const result = await service.handleResume({
        userId: 'u1',
        roomCode: '000000',
        lastSeq: 0,
      });
      expect(result.error).toBeDefined();
    });

    it('用户不在房间应返回错误', async () => {
      mockRedisStore['room:meta:888888'] = JSON.stringify({ hostId: '1' });
      mockRedisSets['room:users:888888'] = new Set(['u2']);

      const result = await service.handleResume({
        userId: 'u1',
        roomCode: '888888',
        lastSeq: 0,
      });
      expect(result.error).toContain('不在该房间');
    });

    it('增量同步路径', async () => {
      mockRedisStore['room:meta:888888'] = JSON.stringify({
        hostId: '1', rule: 'xiangyang_redzhong', status: 'waiting',
        baseScore: 1, totalRounds: 8, createdAt: 0, startedAt: null, nodeId: 'test',
      });
      mockRedisSets['room:users:888888'] = new Set(['u1']);
      mockRedisStore['room:seq:888888'] = '15';
      mockRedisLists['game:oplog:888888'] = [
        '{"seq":11,"type":"tile_drawn"}',
        '{"seq":12,"type":"tile_discarded"}',
        '{"seq":13,"type":"pong"}',
      ];

      const result = await service.handleResume({
        userId: 'u1',
        roomCode: '888888',
        lastSeq: 10,
      });

      expect(result.mode).toBe('incremental');
      expect(result.fromSeq).toBe(11);
      expect(result.toSeq).toBe(15);
      expect(result.events).toHaveLength(3);
    });

    it('全量快照路径（gap 过大）', async () => {
      mockRedisStore['room:meta:888888'] = JSON.stringify({
        hostId: '1', rule: 'xiangyang_redzhong', status: 'playing',
        baseScore: 1, totalRounds: 8, createdAt: 0, startedAt: null, nodeId: 'test',
      });
      mockRedisSets['room:users:888888'] = new Set(['u1']);
      mockRedisStore['room:seq:888888'] = '200';

      // lastSeq 差距 > 50，走全量快照
      const result = await service.handleResume({
        userId: 'u1',
        roomCode: '888888',
        lastSeq: 1,
      });

      expect(result.mode).toBe('snapshot');
      expect(result.snapshot).toBeDefined();
    });
  });

  describe('markTrustee / isTrustee', () => {
    it('应正确标记和查询托管状态', () => {
      service.recordDisconnect('u1', '888888', 10);
      expect(service.isTrustee('u1')).toBe(false);

      service.markTrustee('u1');
      expect(service.isTrustee('u1')).toBe(true);
    });
  });
});
