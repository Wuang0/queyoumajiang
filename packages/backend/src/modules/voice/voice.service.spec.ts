import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { RedisService } from '../redis/redis.service';

describe('VoiceService', () => {
  let service: VoiceService;

  const mockRedisStore: Record<string, string> = {};

  const mockRedis = {
    keys: {
      online: { user: (uid: string) => `user:online:${uid}` },
    },
    get: jest.fn(async (key: string) => mockRedisStore[key] ?? null),
  };

  beforeAll(async () => {
    process.env.TRTC_SDK_APPID = '1400000000';
    process.env.TRTC_SECRET_KEY = 'test-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceService,
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<VoiceService>(VoiceService);
  });

  afterAll(() => {
    delete process.env.TRTC_SDK_APPID;
    delete process.env.TRTC_SECRET_KEY;
  });

  beforeEach(() => {
    Object.keys(mockRedisStore).forEach((k) => delete mockRedisStore[k]);
    jest.clearAllMocks();
  });

  describe('generateUserSig', () => {
    it('应该为用户签发有效签名', async () => {
      mockRedisStore['user:online:u1'] = JSON.stringify({ currentRoom: '888888' });

      const result = await service.generateUserSig('u1', '888888');

      expect(result.sdkAppId).toBe(1400000000);
      expect(result.userId).toBe('u1');
      expect(result.trtcRoomId).toBe(888888);
      expect(result.userSig).toBeDefined();
      expect(result.userSig.length).toBeGreaterThan(10);
      expect(result.expireAt).toBeGreaterThan(Date.now());
    });

    it('用户不在任何房间应拒绝', async () => {
      await expect(
        service.generateUserSig('u1', '888888'),
      ).rejects.toThrow(BadRequestException);
    });

    it('用户不在该房间应拒绝', async () => {
      mockRedisStore['user:online:u1'] = JSON.stringify({ currentRoom: '999999' });

      await expect(
        service.generateUserSig('u1', '888888'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
