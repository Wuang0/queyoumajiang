import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_KEYS } from './redis-key.const';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private subscriber: Redis | null = null;
  private connected = false;

  // ========== 内存降级（Redis 不可用时）==========
  private mem = new Map<string, string>();
  private memSets = new Map<string, Set<string>>();
  private memHashes = new Map<string, Record<string, string>>();
  private memLists = new Map<string, string[]>();

  async onModuleInit(): Promise<void> {
    const host = process.env.REDIS_HOST ?? 'localhost';
    const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;
    const db = parseInt(process.env.REDIS_DB ?? '0', 10);
    const tls = process.env.REDIS_TLS === 'true';

    // 没有配置 Redis host 则直接走内存
    if (!host || host === 'localhost') {
      this.logger.warn('No remote Redis configured — using in-memory store (state lost on restart)');
      this.connected = false;
      return;
    }

    const baseOpts = {
      host,
      port,
      password,
      db,
      lazyConnect: true,
      connectTimeout: 8000,
      retryStrategy: (times: number) => {
        if (times > 3) {
          this.logger.warn(`Redis retry exhausted after ${times} attempts — falling back to memory`);
          return null; // 停止重连
        }
        return Math.min(times * 500, 3000);
      },
      ...(tls ? { tls: {} } : {}),
    };

    this.client = new Redis(baseOpts);
    this.subscriber = new Redis(baseOpts);

    try {
      await this.client.connect();
      await this.subscriber.connect();
      this.connected = true;
      this.logger.log(`Redis connected: ${host}:${port}/${db}${tls ? ' (TLS)' : ''}`);
    } catch (err) {
      this.logger.warn('Redis unavailable — using in-memory store (state lost on restart)');
      this.connected = false;
      this.client = null;
      this.subscriber = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) await this.client.quit();
    if (this.subscriber) await this.subscriber.quit();
  }

  getClient(): Redis | null {
    return this.client;
  }

  getSubscriber(): Redis | null {
    return this.subscriber;
  }

  keys = REDIS_KEYS;

  // ==================== String ====================

  async get(key: string): Promise<string | null> {
    if (this.connected && this.client) return this.client.get(key);
    return this.mem.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK' | null> {
    if (this.connected && this.client) {
      if (ttlSeconds) return this.client.set(key, value, 'EX', ttlSeconds);
      return this.client.set(key, value);
    }
    this.mem.set(key, value);
    if (ttlSeconds) {
      setTimeout(() => this.mem.delete(key), ttlSeconds * 1000);
    }
    return 'OK';
  }

  // ==================== Hash ====================

  async hget(key: string, field: string): Promise<string | null> {
    if (this.connected && this.client) return this.client.hget(key, field);
    return this.memHashes.get(key)?.[field] ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    if (this.connected && this.client) return this.client.hset(key, field, value);
    if (!this.memHashes.has(key)) this.memHashes.set(key, {});
    this.memHashes.get(key)![field] = value;
    return 1;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (this.connected && this.client) return this.client.hgetall(key);
    return { ...(this.memHashes.get(key) ?? {}) };
  }

  async hexists(key: string, field: string): Promise<boolean> {
    if (this.connected && this.client) return (await this.client.hexists(key, field)) === 1;
    return field in (this.memHashes.get(key) ?? {});
  }

  async hdel(key: string, field: string): Promise<number> {
    if (this.connected && this.client) return this.client.hdel(key, field);
    delete this.memHashes.get(key)?.[field];
    return 1;
  }

  // ==================== Set ====================

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (this.connected && this.client) return this.client.sadd(key, ...members);
    if (!this.memSets.has(key)) this.memSets.set(key, new Set());
    const s = this.memSets.get(key)!;
    let added = 0;
    for (const m of members) { if (!s.has(m)) { s.add(m); added++; } }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (this.connected && this.client) return this.client.srem(key, ...members);
    const s = this.memSets.get(key);
    if (!s) return 0;
    let removed = 0;
    for (const m of members) { if (s.has(m)) { s.delete(m); removed++; } }
    return removed;
  }

  async sismember(key: string, member: string): Promise<boolean> {
    if (this.connected && this.client) return (await this.client.sismember(key, member)) === 1;
    return this.memSets.get(key)?.has(member) ?? false;
  }

  async smembers(key: string): Promise<string[]> {
    if (this.connected && this.client) return this.client.smembers(key);
    return [...(this.memSets.get(key) ?? new Set())];
  }

  async scard(key: string): Promise<number> {
    if (this.connected && this.client) return this.client.scard(key);
    return this.memSets.get(key)?.size ?? 0;
  }

  async spop(key: string): Promise<string | null> {
    if (this.connected && this.client) return this.client.spop(key);
    const s = this.memSets.get(key);
    if (!s || s.size === 0) return null;
    const first = s.values().next().value as string;
    s.delete(first);
    return first;
  }

  // ==================== List ====================

  async lpush(key: string, ...values: string[]): Promise<number> {
    if (this.connected && this.client) return this.client.lpush(key, ...values);
    if (!this.memLists.has(key)) this.memLists.set(key, []);
    this.memLists.get(key)!.unshift(...values);
    return this.memLists.get(key)!.length;
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    if (this.connected && this.client) return this.client.rpush(key, ...values);
    if (!this.memLists.has(key)) this.memLists.set(key, []);
    this.memLists.get(key)!.push(...values);
    return this.memLists.get(key)!.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    if (this.connected && this.client) return this.client.lrange(key, start, stop);
    const list = this.memLists.get(key) ?? [];
    const s = start < 0 ? Math.max(0, list.length + start) : start;
    const e = stop < 0 ? list.length + stop : stop;
    return list.slice(s, e + 1);
  }

  async lpop(key: string): Promise<string | null> {
    if (this.connected && this.client) return this.client.lpop(key);
    return this.memLists.get(key)?.shift() ?? null;
  }

  async llen(key: string): Promise<number> {
    if (this.connected && this.client) return this.client.llen(key);
    return this.memLists.get(key)?.length ?? 0;
  }

  async ltrim(key: string, start: number, stop: number): Promise<'OK' | null> {
    if (this.connected && this.client) return this.client.ltrim(key, start, stop);
    const list = this.memLists.get(key) ?? [];
    this.memLists.set(key, list.slice(start, stop + 1));
    return 'OK';
  }

  // ==================== Generic ====================

  async del(key: string): Promise<number> {
    if (this.connected && this.client) return this.client.del(key);
    const existed = this.mem.has(key);
    this.mem.delete(key);
    this.memSets.delete(key);
    this.memHashes.delete(key);
    this.memLists.delete(key);
    return existed ? 1 : 0;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    if (this.connected && this.client) return this.client.expire(_key, _seconds);
    return 1; // 内存模式忽略过期（用 setTimeout 在 set 里处理了）
  }

  async incr(key: string): Promise<number> {
    if (this.connected && this.client) return this.client.incr(key);
    const val = parseInt(this.mem.get(key) ?? '0') + 1;
    this.mem.set(key, String(val));
    return val;
  }

  async exists(key: string): Promise<boolean> {
    if (this.connected && this.client) return (await this.client.exists(key)) === 1;
    return this.mem.has(key) || this.memSets.has(key) || this.memHashes.has(key) || this.memLists.has(key);
  }

  // ==================== Pub/Sub (内存模式不工作) ====================

  async publish(_channel: string, _message: string): Promise<number> {
    if (this.connected && this.client) return this.client.publish(_channel, _message);
    return 0; // 单实例内存模式不需要 pub/sub
  }

  subscribe(_channel: string, _handler: (message: string) => void): void {
    if (this.connected && this.subscriber) {
      this.subscriber.subscribe(_channel);
      this.subscriber.on('message', (ch, msg) => {
        if (ch === _channel) _handler(msg);
      });
    }
    // 内存模式无跨节点通信需求
  }

  // ==================== Lock (内存模式简化) ====================

  async acquireLock(key: string, owner: string, ttlSeconds: number): Promise<boolean> {
    if (this.connected && this.client) {
      const result = await this.client.set(key, owner, 'PX', ttlSeconds * 1000, 'NX');
      return result === 'OK';
    }
    if (this.mem.has(key)) return false;
    this.mem.set(key, owner);
    setTimeout(() => { if (this.mem.get(key) === owner) this.mem.delete(key); }, ttlSeconds * 1000);
    return true;
  }

  async releaseLock(key: string, owner: string): Promise<boolean> {
    if (this.connected && this.client) {
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
      const result = await this.client.eval(script, 1, key, owner);
      return result === 1;
    }
    if (this.mem.get(key) === owner) { this.mem.delete(key); return true; }
    return false;
  }
}
