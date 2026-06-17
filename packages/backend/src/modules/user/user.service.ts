import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { UpdateUserDto } from './dto/update-user.dto';

// Rank helpers (mirrored from @queyou/protocol)
function getRankName(level: number): string {
  if (level <= 0) return '未知';
  if (level <= 3) return `雀友 · ${level}段`;
  if (level <= 6) return `麻雀师 · ${level - 3}段`;
  if (level === 7) return '雀圣';
  return '雀神';
}

function getNextLevelScore(level: number): number {
  const thresholds: Record<number, number> = {
    0: 0, 1: 50, 2: 200, 3: 500, 4: 1000, 5: 2000, 6: 4000, 7: 8000,
  };
  return thresholds[level] ?? Infinity;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 获取当前用户完整信息
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });
    if (!user) throw new NotFoundException('用户不存在');

    return {
      id: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? '',
      gender: user.gender,
      city: user.city,
      rankLevel: user.rankLevel,
      rankScore: user.rankScore,
      rankName: getRankName(user.rankLevel),
      nextLevelScore: getNextLevelScore(user.rankLevel),
      totalMatches: user.totalMatches,
      totalWins: user.totalWins,
      createdAt: user.createdAt.getTime(),
    };
  }

  /**
   * 更新用户资料
   */
  async updateMe(userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: {
        ...(dto.nickname !== undefined && { nickname: dto.nickname }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.city !== undefined && { city: dto.city }),
      },
    });

    // 清除缓存
    await this.redis.del(this.redis.keys.cache.userProfile(userId));

    return {
      id: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? '',
      gender: user.gender,
      city: user.city,
      rankLevel: user.rankLevel,
      rankScore: user.rankScore,
      rankName: getRankName(user.rankLevel),
      nextLevelScore: getNextLevelScore(user.rankLevel),
      totalMatches: user.totalMatches,
      totalWins: user.totalWins,
      createdAt: user.createdAt.getTime(),
    };
  }

  /**
   * 查询他人公开资料
   */
  async getUserPublic(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });
    if (!user) throw new NotFoundException('用户不存在');

    return {
      id: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl ?? '',
      rankLevel: user.rankLevel,
      totalMatches: user.totalMatches,
      totalWins: user.totalWins,
    };
  }

  /**
   * 获取好友列表
   */
  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        userId: BigInt(userId),
        deletedAt: null,
      },
      include: {
        friend: {
          select: {
            id: true,
            nickname: true,
            avatarUrl: true,
            rankLevel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const list = await Promise.all(
      friendships.map(async (f) => {
        const isOnline = await this.redis.exists(
          this.redis.keys.online.user(f.friend.id.toString()),
        );
        return {
          userId: f.friend.id.toString(),
          nickname: f.friend.nickname,
          avatarUrl: f.friend.avatarUrl ?? '',
          rankLevel: f.friend.rankLevel,
          isOnline,
        };
      }),
    );

    const online = list.filter((f) => f.isOnline).length;

    return { total: list.length, online, list };
  }

  /**
   * 添加好友（双向）
   */
  async addFriend(userId: string, friendId: string, source: string) {
    try {
      const uid = BigInt(userId);
      const fid = BigInt(friendId);

      if (uid === fid) {
        throw new ConflictException('不能添加自己为好友');
      }

      // 检查好友是否存在
      const friend = await this.prisma.user.findUnique({ where: { id: fid } });
      if (!friend) throw new NotFoundException('用户不存在');

      // 双向写入
      await this.prisma.$transaction([
        this.prisma.friendship.upsert({
          where: { userId_friendId: { userId: uid, friendId: fid } },
          update: { deletedAt: null, source },
          create: { userId: uid, friendId: fid, source },
        }),
        this.prisma.friendship.upsert({
          where: { userId_friendId: { userId: fid, friendId: uid } },
          update: { deletedAt: null, source },
          create: { userId: fid, friendId: uid, source },
        }),
      ]);

      return { ok: true };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof ConflictException)
        throw err;
      this.logger.error('addFriend failed', err);
      throw err;
    }
  }

  /**
   * 删除好友（双向软删除）
   */
  async removeFriend(userId: string, friendId: string) {
    const uid = BigInt(userId);
    const fid = BigInt(friendId);

    await this.prisma.$transaction([
      this.prisma.friendship.updateMany({
        where: { userId: uid, friendId: fid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.friendship.updateMany({
        where: { userId: fid, friendId: uid, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }
}
