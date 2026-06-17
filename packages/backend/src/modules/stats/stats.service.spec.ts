import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StatsService } from './stats.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StatsService', () => {
  let service: StatsService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    userStats: {
      findUnique: jest.fn(),
      aggregate: jest.fn(),
    },
    matchPlayer: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    rankHistory: {
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyStats', () => {
    it('应该返回完整的战绩总览', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        rankLevel: 3,
        rankScore: 218,
      });
      mockPrisma.userStats.findUnique.mockResolvedValue({
        totalMatches: 156,
        totalWins: 81,
        totalLosses: 75,
        totalScore: 218,
        maxSingleScore: 84,
        longestWinStreak: 5,
        selfMoCount: 42,
        jiePaoCount: 30,
        dianPaoCount: 12,
      });
      mockPrisma.matchPlayer.aggregate.mockResolvedValue({ _count: 32, _sum: { scoreChange: 138 } });
      mockPrisma.matchPlayer.count.mockResolvedValue(17);

      const result = await service.getMyStats('1');

      expect(result.rank.level).toBe(3);
      expect(result.totalMatches).toBe(156);
      expect(result.winRate).toBeCloseTo(0.52, 1);
      expect(result.thisWeek.matches).toBe(32);
      expect(result.thisWeek.wins).toBe(17);
    });

    it('不存在的用户应抛出异常', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getMyStats('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRecent', () => {
    it('应该返回分页的历史对局', async () => {
      mockPrisma.matchPlayer.findMany.mockResolvedValue([
        {
          matchId: BigInt(1),
          scoreChange: 25,
          createdAt: new Date('2026-06-13'),
          match: {
            roundNo: 3,
            winnerId: BigInt(1),
            winType: 'selfmo',
            fans: 8,
            startedAt: new Date('2026-06-13T10:00:00Z'),
            endedAt: new Date('2026-06-13T10:25:00Z'),
            players: [
              { userId: BigInt(1), seat: 0, scoreChange: 25, user: { id: BigInt(1), nickname: '王哥', avatarUrl: null } },
              { userId: BigInt(2), seat: 1, scoreChange: -8, user: { id: BigInt(2), nickname: '小李', avatarUrl: null } },
            ],
          },
        },
      ]);

      const result = await service.getRecent('1', 20);
      expect(result.list).toHaveLength(1);
      expect(result.list[0]!.myScoreChange).toBe(25);
      expect(result.list[0]!.opponents).toHaveLength(2);
    });
  });

  describe('getRankHistory', () => {
    it('应该返回段位变更轨迹', async () => {
      mockPrisma.rankHistory.findMany.mockResolvedValue([
        {
          rankBefore: 2, rankAfter: 3, scoreBefore: 180, scoreAfter: 218,
          scoreDelta: 38, matchId: BigInt(10), reason: 'match',
          createdAt: new Date('2026-06-13'),
        },
      ]);

      const result = await service.getRankHistory('1');
      expect(result.list).toHaveLength(1);
      expect(result.list[0]!.rankBefore).toBe(2);
      expect(result.list[0]!.rankAfter).toBe(3);
    });
  });
});
