/**
 * Redis Key 命名常量
 * 所有 Key 通过工厂函数生成，确保命名一致性
 */

/**
 * 认证/会话
 */
export const AuthKeys = {
  session: (userId: string): string => `auth:sess:${userId}`,
  tokenBlacklist: (tokenId: string): string => `auth:tok:black:${tokenId}`,
  wechatSession: (openid: string): string => `auth:wxsess:${openid}`,
} as const;

/**
 * 在线状态
 */
export const OnlineKeys = {
  user: (userId: string): string => `user:online:${userId}`,
  nodes: (): string => 'user:online:nodes',
  friendsOnline: (userId: string): string => `user:online:friends:${userId}`,
} as const;

/**
 * 房间状态
 */
export const RoomKeys = {
  meta: (roomCode: string): string => `room:meta:${roomCode}`,
  seats: (roomCode: string): string => `room:seats:${roomCode}`,
  users: (roomCode: string): string => `room:users:${roomCode}`,
  ready: (roomCode: string): string => `room:ready:${roomCode}`,
  owner: (roomCode: string): string => `room:owner:${roomCode}`,
  seq: (roomCode: string): string => `room:seq:${roomCode}`,
  activeList: (): string => 'room:active',
} as const;

/**
 * 对局状态
 */
export const GameKeys = {
  current: (roomCode: string): string => `game:cur:${roomCode}`,
  hand: (roomCode: string, userId: string): string =>
    `game:hand:${roomCode}:${userId}`,
  meld: (roomCode: string, userId: string): string =>
    `game:meld:${roomCode}:${userId}`,
  discard: (roomCode: string, userId: string): string =>
    `game:discard:${roomCode}:${userId}`,
  wall: (roomCode: string): string => `game:wall:${roomCode}`,
  oplog: (roomCode: string): string => `game:oplog:${roomCode}`,
  claim: (roomCode: string): string => `game:claim:${roomCode}`,
  turn: (roomCode: string): string => `game:turn:${roomCode}`,
} as const;

/**
 * 幂等表
 */
export const IdempotencyKeys = {
  room: (roomCode: string, userId: string): string =>
    `room:idemp:${roomCode}:${userId}`,
} as const;

/**
 * 房号池
 */
export const RoomCodePoolKeys = {
  pool: (): string => 'sys:roomcode:pool',
  size: (): string => 'sys:roomcode:pool:size',
} as const;

/**
 * 限流
 */
export const RateLimitKeys = {
  loginByIp: (ip: string): string => `rl:login:ip:${ip}`,
  loginByUser: (userId: string): string => `rl:login:user:${userId}`,
  createRoom: (userId: string): string => `rl:room:create:${userId}`,
  joinRoom: (userId: string): string => `rl:room:join:${userId}`,
  message: (userId: string): string => `rl:msg:${userId}`,
} as const;

/**
 * Pub/Sub 频道
 */
export const ChannelKeys = {
  roomEvents: (roomCode: string): string => `chan:room:${roomCode}:events`,
  roomCommand: (roomCode: string): string => `chan:room:${roomCode}:cmd`,
  userNotify: (userId: string): string => `chan:user:${userId}:notify`,
  nodes: (): string => 'chan:sys:nodes',
} as const;

/**
 * 缓存
 */
export const CacheKeys = {
  userProfile: (userId: string): string => `user:profile:${userId}`,
  userStats: (userId: string): string => `user:stats:${userId}`,
  userRank: (userId: string): string => `user:rank:${userId}`,
  recentRooms: (userId: string): string => `room:recent:${userId}`,
} as const;

/**
 * 监控/运维
 */
export const SystemKeys = {
  activeRooms: (): string => 'sys:metrics:rooms:active',
  onlineTotal: (): string => 'sys:metrics:online:total',
  matchesToday: (): string => 'sys:metrics:matches:today',
  maintenance: (): string => 'sys:flag:maintenance',
} as const;

export const REDIS_KEYS = {
  auth: AuthKeys,
  online: OnlineKeys,
  room: RoomKeys,
  game: GameKeys,
  idempotency: IdempotencyKeys,
  pool: RoomCodePoolKeys,
  rateLimit: RateLimitKeys,
  channel: ChannelKeys,
  cache: CacheKeys,
  system: SystemKeys,
} as const;

export type RedisKeyNamespace = keyof typeof REDIS_KEYS;
