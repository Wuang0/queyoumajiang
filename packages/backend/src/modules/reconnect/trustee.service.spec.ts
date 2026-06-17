import { Test, TestingModule } from '@nestjs/testing';
import { TrusteeService } from './trustee.service';
import type { GameState } from '../game/types';
import { startRound } from '../game/game.engine';

describe('TrusteeService', () => {
  let service: TrusteeService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrusteeService],
    }).compile();
    service = module.get<TrusteeService>(TrusteeService);
  });

  describe('computeAction', () => {
    it('应该返回当前玩家的安全出牌动作', () => {
      const { state } = startRound('test', 1, 8, 0, ['u1', 'u2', 'u3', 'u4']);
      const action = service.computeAction(state, 0);

      expect(action).not.toBeNull();
      expect(action!.type).toBe('discard');
      expect(action!.seat).toBe(0);
    });

    it('非当前玩家不应出牌', () => {
      const { state } = startRound('test', 1, 8, 0, ['u1', 'u2', 'u3', 'u4']);
      const action = service.computeAction(state, 1);
      expect(action).toBeNull();
    });
  });

  describe('shouldEnterTrustee', () => {
    it('超过 30s 应进入托管', () => {
      expect(service.shouldEnterTrustee(31000)).toBe(true);
    });

    it('30s 内不应进入托管', () => {
      expect(service.shouldEnterTrustee(20000)).toBe(false);
    });

    it('刚好 30s 应进入托管', () => {
      expect(service.shouldEnterTrustee(30000)).toBe(true);
    });
  });

  describe('shouldKick', () => {
    it('超过 60s 应踢出', () => {
      expect(service.shouldKick(61000)).toBe(true);
    });

    it('60s 内不应踢出', () => {
      expect(service.shouldKick(30000)).toBe(false);
    });
  });
});
