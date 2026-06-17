/**
 * 协议单元测试
 */

import {
  generateDeck,
  isValidTile,
  isWildTile,
  isValidRoomCode,
  generateRoomCode,
  getRankName,
  getNextLevelScore,
  getRankProgress,
  getClaimPriority,
  calculateScores,
  WILD_TILE,
  SUITS,
  PROTOCOL_VERSION,
} from '../index';

import { ErrorCode, getErrorMessage } from '../types/errorCodes';

describe('Protocol - 牌面工具函数', () => {
  describe('generateDeck', () => {
    it('应该生成完整的136张牌', () => {
      const deck = generateDeck();
      expect(deck).toHaveLength(136);
    });

    it('每张牌应该有4个', () => {
      const deck = generateDeck();
      const counts: Record<string, number> = {};
      deck.forEach((tile) => {
        counts[tile] = (counts[tile] ?? 0) + 1;
      });

      // 每张牌都应该有4个
      Object.values(counts).forEach((count) => {
        expect(count).toBe(4);
      });

      // 应该有34种不同的牌
      expect(Object.keys(counts)).toHaveLength(34);
    });

    it('应该包含所有万筒条', () => {
      const deck = generateDeck();
      for (const suit of ['m', 'p', 's']) {
        for (let v = 1; v <= 9; v++) {
          expect(deck).toContain(`${v}${suit}`);
        }
      }
    });

    it('应该包含所有字牌', () => {
      const deck = generateDeck();
      for (let v = 1; v <= 7; v++) {
        expect(deck).toContain(`${v}z`);
      }
    });
  });

  describe('isValidTile', () => {
    it('应该正确识别有效牌', () => {
      expect(isValidTile('1m')).toBe(true);
      expect(isValidTile('9s')).toBe(true);
      expect(isValidTile('5p')).toBe(true);
      expect(isValidTile('7z')).toBe(true);
    });

    it('应该正确识别无效牌', () => {
      expect(isValidTile('0m')).toBe(false);
      expect(isValidTile('10m')).toBe(false);
      expect(isValidTile('8q')).toBe(false);
      expect(isValidTile('')).toBe(false);
      expect(isValidTile('a')).toBe(false);
    });
  });

  describe('isWildTile', () => {
    it('应该正确识别癞子牌（红中）', () => {
      expect(isWildTile(WILD_TILE)).toBe(true);
      expect(isWildTile('5z')).toBe(true);
      expect(isWildTile('1z')).toBe(false);
      expect(isWildTile('1m')).toBe(false);
    });
  });
});

describe('Protocol - 房间号工具函数', () => {
  describe('isValidRoomCode', () => {
    it('应该正确识别有效房间号', () => {
      expect(isValidRoomCode('123456')).toBe(true);
      expect(isValidRoomCode('000000')).toBe(true);
      expect(isValidRoomCode('999999')).toBe(true);
    });

    it('应该正确识别无效房间号', () => {
      expect(isValidRoomCode('12345')).toBe(false); // 5位
      expect(isValidRoomCode('1234567')).toBe(false); // 7位
      expect(isValidRoomCode('abcdef')).toBe(false); // 字母
      expect(isValidRoomCode('12345a')).toBe(false); // 字母混合
      expect(isValidRoomCode('')).toBe(false);
    });
  });

  describe('generateRoomCode', () => {
    it('应该生成6位数字房间号', () => {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(isValidRoomCode(code)).toBe(true);
    });

    it('多次生成应该不重复（概率上）', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateRoomCode());
      }
      // 100次应该大概率都不一样
      expect(codes.size).toBeGreaterThan(95);
    });
  });
});

describe('Protocol - 段位工具函数', () => {
  describe('getRankName', () => {
    it('应该正确返回段位名称', () => {
      expect(getRankName(1)).toBe('雀友 · 1段');
      expect(getRankName(2)).toBe('雀友 · 2段');
      expect(getRankName(3)).toBe('雀友 · 3段');
      expect(getRankName(4)).toBe('麻雀师 · 1段');
      expect(getRankName(5)).toBe('麻雀师 · 2段');
      expect(getRankName(6)).toBe('麻雀师 · 3段');
      expect(getRankName(7)).toBe('雀圣');
      expect(getRankName(8)).toBe('雀神');
    });

    it('边界值处理', () => {
      expect(getRankName(0)).toBe('未知');
      expect(getRankName(-1)).toBe('未知');
      expect(getRankName(10)).toBe('雀神');
    });
  });

  describe('getNextLevelScore', () => {
    it('应该正确返回下一段位所需分数', () => {
      expect(getNextLevelScore(0)).toBe(0);
      expect(getNextLevelScore(1)).toBe(50);
      expect(getNextLevelScore(2)).toBe(200);
      expect(getNextLevelScore(3)).toBe(500);
      expect(getNextLevelScore(4)).toBe(1000);
      expect(getNextLevelScore(5)).toBe(2000);
      expect(getNextLevelScore(6)).toBe(4000);
      expect(getNextLevelScore(7)).toBe(8000);
    });
  });

  describe('getRankProgress', () => {
    it('应该正确计算段位进度', () => {
      // 1段到2段需要50分
      expect(getRankProgress(0, 1)).toBe(0);
      expect(getRankProgress(25, 1)).toBe(0.5);
      expect(getRankProgress(50, 1)).toBe(1);
      expect(getRankProgress(60, 1)).toBe(1); // 超过也算完成
    });

    it('最高段位应该返回100%', () => {
      expect(getRankProgress(10000, 8)).toBe(1);
    });
  });
});

describe('Protocol - 抢牌优先级', () => {
  it('应该正确返回优先级（胡 > 杠 > 碰 > 过）', () => {
    expect(getClaimPriority('hu')).toBe(3);
    expect(getClaimPriority('kong')).toBe(2);
    expect(getClaimPriority('pong')).toBe(1);
    expect(getClaimPriority('pass')).toBe(0);
  });
});

describe('Protocol - 得分计算', () => {
  const players = [0, 1, 2, 3];

  it('自摸应该三家都输分', () => {
    const result = calculateScores(1, 1, true, null, players);
    // 1番，自摸，每家输2
    expect(result[0]).toBe(-2);
    expect(result[1]).toBe(-2);
    expect(result[2]).toBe(-2);
    expect(result[3]).toBe(-2);
  });

  it('点炮应该点炮者双倍输分', () => {
    const result = calculateScores(1, 1, false, 1, players);
    // 1番，点炮，点炮者输2
    expect(result[0]).toBe(-2); // 非点炮者
    expect(result[1]).toBe(-4); // 点炮者双倍
    expect(result[2]).toBe(-2);
    expect(result[3]).toBe(-2);
  });

  it('高番数应该有正确倍数', () => {
    const result = calculateScores(1, 3, true, null, players);
    // 3番 = 2^3 = 8倍
    Object.values(result).forEach((score) => {
      expect(score).toBe(-8);
    });
  });

  it('应该正确处理不同底分', () => {
    const result = calculateScores(5, 2, true, null, players);
    // 底分5，2番=4倍
    Object.values(result).forEach((score) => {
      expect(score).toBe(-5 * 4);
    });
  });
});

describe('Protocol - 错误码', () => {
  it('应该有正确的错误码定义', () => {
    expect(ErrorCode.OK).toBe(0);
    expect(ErrorCode.UNAUTHORIZED).toBe(10010);
    expect(ErrorCode.ROOM_NOT_FOUND).toBe(30001);
    expect(ErrorCode.INVALID_ACTION).toBe(40003);
    expect(ErrorCode.INTERNAL_ERROR).toBe(90001);
  });

  it('应该能正确获取错误消息', () => {
    expect(getErrorMessage(ErrorCode.OK)).toBe('成功');
    expect(getErrorMessage(ErrorCode.ROOM_NOT_FOUND)).toBe('房间不存在');
    expect(getErrorMessage(ErrorCode.INTERNAL_ERROR)).toBe('服务器内部错误');
  });

  it('未知错误码应该返回默认消息', () => {
    const unknownCode = 99999 as ErrorCode;
    expect(getErrorMessage(unknownCode)).toBe('未知错误');
  });
});

describe('Protocol - 常量定义', () => {
  it('应该有正确的协议版本', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });

  it('应该包含所有花色', () => {
    expect(SUITS).toEqual(['m', 'p', 's', 'z']);
  });

  it('应该正确定义癞子牌', () => {
    expect(WILD_TILE).toBe('5z');
  });
});
