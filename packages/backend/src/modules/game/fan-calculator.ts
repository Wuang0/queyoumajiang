import type { Tile } from './types';
import { isWild } from './deck';

/**
 * 番型明细
 */
export interface FanResult {
  type: string;
  name: string;
  fans: number; // 每人额外加的分
}

/**
 * 计算番型（朋友局规则：只自摸赢三家）
 * 底分：每家出 1 分
 * 特殊番（每家额外 +1 分）：七对、清一色、杠上开花
 * 多个特殊番叠加
 */
export function calculateFans(
  hand: Tile[],
  winTile: Tile,
  isSelfMo: boolean,
  melds: { type: string; tiles: Tile[] }[],
): { fans: number; breakdown: FanResult[] } {
  const breakdown: FanResult[] = [];

  if (!isSelfMo) {
    // 不允许接炮，但保留函数签名兼容
    return { fans: 0, breakdown };
  }

  const fullHand = [...hand, winTile];

  // 1. 七对：7 个对子（无碰杠）
  if (isQiDui(fullHand, melds)) {
    breakdown.push({ type: 'qidui', name: '七对', fans: 1 });
  }

  // 2. 清一色：只有一种花色（字牌除外，癞子不计花色）
  if (isQingYiSe(fullHand, melds)) {
    breakdown.push({ type: 'qingyise', name: '清一色', fans: 1 });
  }

  // 3. 杠上开花：有杠且自摸
  const hasKong = melds.some((m) => m.type.startsWith('kong'));
  if (hasKong && isSelfMo) {
    breakdown.push({ type: 'gangkai', name: '杠上开花', fans: 1 });
  }

  const totalFans = breakdown.reduce((sum, f) => sum + f.fans, 0);
  return { fans: totalFans, breakdown };
}

/**
 * 计算得分变化（朋友局简化规则）
 * 底分 1 + 特殊番加分 = 每人出的分
 * 赢家获得三家总和
 */
export function calculateScoreChanges(
  baseScore: number,
  fans: number,
  isSelfMo: boolean,
  loserSeat: number | null,
  playerSeats: number[],
): Record<number, number> {
  const perPersonPay = 1 + fans; // 底分1 + 特殊番加分
  const changes: Record<number, number> = {};

  // 三家各输 perPersonPay
  playerSeats.forEach((seat) => {
    changes[seat] = -perPersonPay;
  });

  return changes;
}

/**
 * 计算听的牌（简化版）
 */
export function calculateListenTiles(
  hand: Tile[],
  melds: { tiles: Tile[] }[],
): Tile[] {
  const wildCount = hand.filter(isWild).length;
  const nonWild = hand.filter((t) => !isWild(t));
  const meldTiles = melds.flatMap((m) => m.tiles);

  if (wildCount > 0) {
    return nonWild;
  }

  // 列出所有可能进张
  const possible: Set<string> = new Set();
  const suits = ['m', 'p', 's', 'z'];
  for (const suit of suits) {
    const max = suit === 'z' ? 7 : 9;
    for (let v = 1; v <= max; v++) {
      const tile = `${v}${suit}`;
      if (!isWild(tile) && !meldTiles.includes(tile)) {
        possible.add(tile);
      }
    }
  }

  return [...possible].slice(0, 14);
}

// ============ 内部判定 ============

function isQiDui(
  hand: Tile[],
  melds: { type: string; tiles: Tile[] }[],
): boolean {
  if (melds.length > 0) return false;
  if (hand.length !== 14) return false;

  const wildCount = hand.filter(isWild).length;
  const nonWild = hand.filter((t) => !isWild(t));
  const groups = groupByTile(nonWild);

  let oddCount = 0;
  for (const count of Object.values(groups)) {
    if (count % 2 !== 0) oddCount++;
  }

  return oddCount <= wildCount;
}

function isQingYiSe(
  hand: Tile[],
  melds: { tiles: Tile[] }[],
): boolean {
  const allTiles = [...hand, ...melds.flatMap((m) => m.tiles)].filter(
    (t) => !isWild(t),
  );

  if (allTiles.length === 0) return true;

  const suits = new Set(allTiles.map((t) => t[1]));
  return suits.size === 1 && !suits.has('z');
}

function groupByTile(tiles: Tile[]): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const t of tiles) {
    groups[t] = (groups[t] ?? 0) + 1;
  }
  return groups;
}
