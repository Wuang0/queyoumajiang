import { generateWall, shuffleWall, drawTile, dealHands, isWild, sortHand } from './deck';

describe('Deck', () => {
  describe('generateWall', () => {
    it('应该生成 136 张牌', () => {
      const wall = generateWall();
      expect(wall).toHaveLength(136);
    });

    it('应该包含所有花色', () => {
      const wall = generateWall();
      expect(wall.filter((t) => t.endsWith('m'))).toHaveLength(36);
      expect(wall.filter((t) => t.endsWith('p'))).toHaveLength(36);
      expect(wall.filter((t) => t.endsWith('s'))).toHaveLength(36);
      expect(wall.filter((t) => t.endsWith('z'))).toHaveLength(28);
    });

    it('每种牌应该正好 4 张', () => {
      const wall = generateWall();
      const counts: Record<string, number> = {};
      wall.forEach((t) => { counts[t] = (counts[t] ?? 0) + 1; });
      Object.values(counts).forEach((c) => expect(c).toBe(4));
    });
  });

  describe('shuffleWall', () => {
    it('洗牌后长度不变', () => {
      const wall = generateWall();
      const shuffled = shuffleWall(wall);
      expect(shuffled).toHaveLength(136);
    });

    it('洗牌不应修改原数组', () => {
      const wall = generateWall();
      const copy = [...wall];
      shuffleWall(wall);
      expect(wall).toEqual(copy);
    });
  });

  describe('drawTile', () => {
    it('应该返回第一张牌并减少牌墙', () => {
      const wall = generateWall();
      const result = drawTile(wall);
      expect(result).not.toBeNull();
      expect(result!.remaining).toHaveLength(135);
    });

    it('空牌墙返回 null', () => {
      const result = drawTile([]);
      expect(result).toBeNull();
    });
  });

  describe('dealHands', () => {
    it('庄家 14 张, 闲家各 13 张', () => {
      const wall = generateWall();
      const { hands, remaining } = dealHands(wall, 4);
      expect(hands[0]).toHaveLength(14);
      expect(hands[1]).toHaveLength(13);
      expect(hands[2]).toHaveLength(13);
      expect(hands[3]).toHaveLength(13);
      expect(remaining).toHaveLength(136 - 14 - 13 * 3);
    });
  });

  describe('isWild', () => {
    it('红中 5z 为癞子', () => {
      expect(isWild('5z')).toBe(true);
      expect(isWild('1z')).toBe(false);
      expect(isWild('1m')).toBe(false);
    });
  });

  describe('sortHand', () => {
    it('应该按花色和数字排序', () => {
      const hand = ['9m', '1m', '5p', '3z', '1z'];
      const sorted = sortHand(hand);
      expect(sorted).toEqual(['1m', '9m', '5p', '1z', '3z']);
    });
  });
});
