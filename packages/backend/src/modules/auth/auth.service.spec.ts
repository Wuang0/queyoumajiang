import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    userStats: {
      create: jest.fn(),
    },
    room: {
      findMany: jest.fn(),
    },
  };

  const mockRedis = {
    keys: {
      auth: { session: (id: string) => `auth:sess:${id}` },
    },
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(false),
  };

  const mockJwtSecret = 'test-jwt-secret';

  beforeAll(async () => {
    process.env.JWT_SECRET = mockJwtSecret;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token-xxx'),
            verify: jest.fn().mockReturnValue({ sub: '1', openid: 'test_openid_001' }),
          },
        },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('新用户应该自动注册', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: BigInt(1),
        openid: 'test_openid_new',
        nickname: '雀友1234',
        avatarUrl: null,
        rankLevel: 1,
        rankScore: 0,
        totalMatches: 0,
        totalWins: 0,
      });
      mockPrisma.userStats.create.mockResolvedValue({ userId: BigInt(1) });

      const result = await service.login({ code: 'test_openid_new' });

      expect(result.isNewUser).toBe(true);
      expect(result.nickname).toMatch(/^雀友/);
      expect(result.rankLevel).toBe(1);
      expect(result.tokenPair.token).toBe('mock-token-xxx');
    });

    it('已有用户应该返回已有信息', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        openid: 'test_openid_001',
        nickname: '王哥',
        avatarUrl: null,
        rankLevel: 3,
        rankScore: 218,
        totalMatches: 156,
        totalWins: 81,
      });

      const result = await service.login({ code: 'test_openid_001' });

      expect(result.isNewUser).toBe(false);
      expect(result.nickname).toBe('王哥');
      expect(result.rankLevel).toBe(3);
    });

    it('应该生成有效的 Token 对', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        openid: 'test_openid_001',
        nickname: '王哥',
        avatarUrl: null,
        rankLevel: 3,
        rankScore: 218,
        totalMatches: 156,
        totalWins: 81,
      });

      const result = await service.login({ code: 'test_openid_001' });

      expect(result.tokenPair.token).toBeDefined();
      expect(result.tokenPair.refreshToken).toBeDefined();
      expect(result.tokenPair.expiresIn).toBe(7 * 24 * 3600);
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('应该缓存 session 到 Redis', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: BigInt(1),
        openid: 'test_openid_001',
        nickname: '王哥',
        avatarUrl: null,
        rankLevel: 3,
        rankScore: 218,
        totalMatches: 156,
        totalWins: 81,
      });

      await service.login({ code: 'test_openid_001' });

      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'auth:sess:1',
        expect.any(String),
        7 * 24 * 3600,
      );
    });
  });

  describe('refreshToken', () => {
    it('有效 refreshToken 应该返回新 Token', async () => {
      mockRedis.get.mockResolvedValue('{"token":"old-token"}');

      const result = await service.refreshToken({
        refreshToken: 'valid-refresh-token',
      });

      expect(result.token).toBe('mock-token-xxx');
      expect(result.refreshToken).toBe('mock-token-xxx');
    });

    it('session 不存在应该拒绝刷新', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        service.refreshToken({ refreshToken: 'valid-but-revoked' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
