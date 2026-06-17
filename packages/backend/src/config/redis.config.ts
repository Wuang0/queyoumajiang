import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB ?? '0', 10),
  tls: process.env.REDIS_TLS === 'true',
  keyPrefix: 'queyou:',
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES ?? '3', 10),
  connectTimeout: parseInt(
    process.env.REDIS_CONNECT_TIMEOUT_MS ?? '10000',
    10,
  ),
  roomCodePoolSize: parseInt(
    process.env.ROOM_CODE_POOL_SIZE ?? '100000',
    10,
  ),
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL ?? '5000', 10),
  heartbeatTimeout: parseInt(
    process.env.HEARTBEAT_TIMEOUT ?? '15000',
    10,
  ),
}));
