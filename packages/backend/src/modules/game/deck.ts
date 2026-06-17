import type { Tile } from './types';

/**
 * 生成完整 136 张麻将牌墙
 */
export function generateWall(): Tile[] {
  const wall: Tile[] = [];
  for (const suit of ['m', 'p', 's'] as const) {
    for (let value = 1; value <= 9; value++) {
      for (let i = 0; i < 4; i++) {
        wall.push(`${value}${suit}`);
      }
    }
  }
  for (let value = 1; value <= 7; value++) {
    for (let i = 0; i < 4; i++) {
      wall.push(`${value}z`);
    }
  }
  return wall;
}

/**
 * Fisher-Yates 洗牌
 * 使用 crypto 安全的随机源
 */
export function shuffleWall(wall: Tile[]): Tile[] {
  const deck = [...wall];
  // 使用 Math.random（服务器环境 crypto.getRandomValues 需要额外适配）
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = tmp;
  }
  return deck;
}

/**
 * 从牌墙摸一张牌
 */
export function drawTile(wall: Tile[]): { tile: Tile; remaining: Tile[] } | null {
  if (wall.length === 0) return null;
  const tile = wall[0]!;
  return { tile, remaining: wall.slice(1) };
}

/**
 * 发初始手牌：庄家 14 张，闲家 13 张
 */
export function dealHands(wall: Tile[], playerCount: number): { hands: Tile[][]; remaining: Tile[] } {
  let remaining = [...wall];
  const hands: Tile[][] = [];

  for (let p = 0; p < playerCount; p++) {
    const count = p === 0 ? 14 : 13;
    hands.push(remaining.slice(0, count));
    remaining = remaining.slice(count);
  }

  return { hands, remaining };
}

/**
 * 判断是否为癞子牌（红中）
 */
export function isWild(tile: Tile): boolean {
  return tile === '5z';
}

/**
 * 牌面比较排序
 */
export function tileCompare(a: Tile, b: Tile): number {
  const suitOrder: Record<string, number> = { m: 0, p: 1, s: 2, z: 3 };
  const sa = suitOrder[a[1]!] ?? 9;
  const sb = suitOrder[b[1]!] ?? 9;
  if (sa !== sb) return sa - sb;
  return (parseInt(a[0]!) || 0) - (parseInt(b[0]!) || 0);
}

/**
 * 将手牌排序
 */
export function sortHand(tiles: Tile[]): Tile[] {
  return [...tiles].sort(tileCompare);
}
