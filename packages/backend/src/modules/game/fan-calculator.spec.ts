import { calculateFans, calculateScoreChanges, calculateListenTiles } from './fan-calculator';

describe('Fan Calculator (朋友局规则: 只自摸, 底1分+特殊番各+1)', () => {
  describe('calculateFans', () => {
    it('非自摸返回0番（不允许接炮）', () => {
      const { fans, breakdown } = calculateFans(
        ['1m','2m','3m','4p','5p','6p','7s','8s','9s','1z','1z','2z','3z'],
        '4z', false, [],
      );
      expect(fans).toBe(0);
      expect(breakdown).toHaveLength(0);
    });

    it('普通自摸无特殊番 → 0特殊番', () => {
      const { fans, breakdown } = calculateFans(
        ['1m','2m','3m','4p','5p','6p','7s','8s','9s','1z','1z','2z','3z'],
        '4z', true, [],
      );
      // 不是七对/清一色/杠开 → 0 special fans
      expect(fans).toBe(0);
    });

    it('七对应该被检测', () => {
      const hand = ['1m','1m','2m','2m','3m','3m','4p','4p','5p','5p','6p','6p','7s'];
      const { fans, breakdown } = calculateFans(hand, '7s', true, []);
      expect(breakdown.some((b) => b.type === 'qidui')).toBe(true);
      expect(fans).toBeGreaterThanOrEqual(1);
    });

    it('清一色应该被检测', () => {
      const hand = ['1m','1m','2m','3m','4m','5m','6m','7m','8m','9m','1m','2m','3m'];
      const { fans, breakdown } = calculateFans(hand, '4m', true, []);
      expect(breakdown.some((b) => b.type === 'qingyise')).toBe(true);
      expect(fans).toBeGreaterThanOrEqual(1);
    });

    it('杠上开花应该被检测', () => {
      const { fans, breakdown } = calculateFans(
        ['1m','2m','3m','4p','5p','6p','7s','8s','9s','1z','1z','2z','3z'],
        '4z', true,
        [{ type: 'kong_ming', tiles: ['3m','3m','3m','3m'] }],
      );
      expect(breakdown.some((b) => b.type === 'gangkai')).toBe(true);
    });

    it('七对+清一色可以叠加', () => {
      // 全万七对
      const hand = ['1m','1m','2m','2m','3m','3m','4m','4m','5m','5m','6m','6m','7m'];
      const { fans, breakdown } = calculateFans(hand, '7m', true, []);
      const hasQidui = breakdown.some((b) => b.type === 'qidui');
      const hasQing = breakdown.some((b) => b.type === 'qingyise');
      expect(hasQidui).toBe(true);
      expect(hasQing).toBe(true);
      expect(fans).toBe(2); // 1+1
    });
  });

  describe('calculateScoreChanges', () => {
    it('底分1 → 三家各出1分（赢家+3在外部计算）', () => {
      const changes = calculateScoreChanges(1, 0, true, null, [0,1,2,3]);
      // 三家各 -1
      expect(changes[0]).toBe(-1);
      expect(changes[1]).toBe(-1);
      expect(changes[2]).toBe(-1);
    });

    it('1个特殊番 → 三家各出2分', () => {
      const changes = calculateScoreChanges(1, 1, true, null, [0,1,2,3]);
      expect(changes[0]).toBe(-2);
      expect(changes[1]).toBe(-2);
      expect(changes[2]).toBe(-2);
    });

    it('2个特殊番叠加 → 三家各出3分', () => {
      const changes = calculateScoreChanges(1, 2, true, null, [0,1,2,3]);
      expect(changes[0]).toBe(-3);
      expect(changes[1]).toBe(-3);
    });
  });

  describe('calculateListenTiles', () => {
    it('应该返回数组', () => {
      const tiles = calculateListenTiles(
        ['1m','2m','3m','4p','5p','6p','7s','8s','9s','1z','1z','2z','3z'],
        [],
      );
      expect(Array.isArray(tiles)).toBe(true);
    });
  });
});
