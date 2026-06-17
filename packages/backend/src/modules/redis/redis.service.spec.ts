import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeAll(async () => {
    // Mock Redis，避免测试依赖真实 Redis
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('应该被正确创建', () => {
    expect(service).toBeDefined();
  });

  it('应该暴露完整的 Keys 命名空间', () => {
    expect(service.keys).toBeDefined();
    expect(service.keys.auth).toBeDefined();
    expect(service.keys.online).toBeDefined();
    expect(service.keys.room).toBeDefined();
    expect(service.keys.game).toBeDefined();
    expect(service.keys.idempotency).toBeDefined();
    expect(service.keys.pool).toBeDefined();
    expect(service.keys.rateLimit).toBeDefined();
    expect(service.keys.channel).toBeDefined();
    expect(service.keys.cache).toBeDefined();
    expect(service.keys.system).toBeDefined();
  });

  it('getClient 应该返回 null（无真实 Redis）', () => {
    expect(service.getClient()).toBeNull();
  });

  it('getSubscriber 应该返回 null（无真实 Redis）', () => {
    expect(service.getSubscriber()).toBeNull();
  });

  it('get 应该返回 null（无真实 Redis）', async () => {
    const result = await service.get('test');
    expect(result).toBeNull();
  });

  it('Keys 工厂函数应该产生正确的格式', () => {
    expect(service.keys.auth.session('123')).toBe('auth:sess:123');
    expect(service.keys.room.meta('654321')).toBe('room:meta:654321');
    expect(service.keys.game.oplog('999999')).toBe('game:oplog:999999');
    expect(service.keys.idempotency.room('abc', '1')).toBe(
      'room:idemp:abc:1',
    );
    expect(service.keys.online.friendsOnline('42')).toBe(
      'user:online:friends:42',
    );
    expect(service.keys.pool.pool()).toBe('sys:roomcode:pool');
    expect(service.keys.system.maintenance()).toBe('sys:flag:maintenance');
  });
});
