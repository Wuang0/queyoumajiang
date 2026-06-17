import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('UserService', () => {
  let service: UserService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    friendship: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => {
      if (Array.isArray(ops)) ops.forEach((op) => typeof op === 'function' && op());
    }),
  };

  const mockRedis = {
    keys: {
      cache: {
        userProfile: (id: string) => `user:profile:${id}`,
      },
      online: {
        user: (id: string) => `user:online:${id}`,
      },
    },
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(false),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMe', () => {
    it('应该返回当前用户完整信息', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        nickname: '王哥',
        avatarUrl: 'https://img.example.com/1.png',
        gender: 1,
        city: '北京',
        rankLevel: 3,
        rankScore: 218,
        totalMatches: 156,
        totalWins: 81,
        createdAt: new Date('2026-01-01'),
      });

      const result = await service.getMe('1');

      expect(result.id).toBe('1');
      expect(result.nickname).toBe('王哥');
      expect(result.rankLevel).toBe(3);
      expect(result.rankName).toBe('雀友 · 3段');
    });

    it('不存在的用户应该抛出异常', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('99999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('应该更新昵称并清除缓存', async () => {
      mockPrisma.user.update.mockResolvedValue({
        id: BigInt(1),
        nickname: '新王哥',
        avatarUrl: null,
        gender: 1,
        city: '上海',
        rankLevel: 3,
        rankScore: 218,
        totalMatches: 156,
        totalWins: 81,
        createdAt: new Date('2026-01-01'),
      });

      const result = await service.updateMe('1', { nickname: '新王哥', city: '上海' });

      expect(result.nickname).toBe('新王哥');
      expect(result.city).toBe('上海');
      expect(mockRedis.del).toHaveBeenCalledWith('user:profile:1');
    });
  });

  describe('getFriends', () => {
    it('应该返回好友列表', async () => {
      mockPrisma.friendship.findMany.mockResolvedValue([
        {
          friend: { id: BigInt(2), nickname: '小李', avatarUrl: null, rankLevel: 1 },
        },
        {
          friend: { id: BigInt(3), nickname: '张姐', avatarUrl: null, rankLevel: 2 },
        },
      ]);
      mockRedis.exists.mockResolvedValue(false);

      const result = await service.getFriends('1');

      expect(result.total).toBe(2);
      expect(result.online).toBe(0);
      expect(result.list).toHaveLength(2);
      expect(result.list[0]!.nickname).toBe('小李');
    });
  });

  describe('addFriend', () => {
    it('双向写入好友关系', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: BigInt(2), nickname: '小李' });

      const result = await service.addFriend('1', '2', 'in_room');

      expect(result.ok).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('不能添加自己', async () => {
      await expect(service.addFriend('1', '1', 'in_room')).rejects.toThrow(ConflictException);
    });
  });
});
