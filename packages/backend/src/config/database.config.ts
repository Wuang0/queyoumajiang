import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url:
    process.env.DATABASE_URL ??
    'postgresql://postgres:password@localhost:5432/queyou_mahjong',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS ?? '20', 10),
  minConnections: parseInt(process.env.DB_MIN_CONNECTIONS ?? '2', 10),
  connectionTimeout: parseInt(
    process.env.DB_CONNECTION_TIMEOUT_MS ?? '10000',
    10,
  ),
  slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_MS ?? '100', 10),
}));
