import type {
  GameState,
  PlayerState,
  Tile,
  ClaimAction,
  HuResult,
  RoundResult,
  Meld,
  FanResult,
} from './types';
import { WILD_TILE, DISCARD_TIMEOUT_MS, CLAIM_WINDOW_MS, sortHand } from './types';
import { generateWall, shuffleWall, dealHands, drawTile, isWild } from './deck';
import { calculateFans, calculateScoreChanges, calculateListenTiles } from './fan-calculator';

/**
 * 游戏引擎事件
 */
export interface EngineEvent {
  type: string;
  actor: string;
  visibility: 'all' | 'self' | 'others';
  data: Record<string, unknown>;
}

// ==================== Reducer 风格状态操作 ====================

function getPlayer(state: GameState, seat: number): PlayerState {
  const p = state.players[seat];
  if (!p) throw new Error(`No player at seat ${seat}`);
  return p;
}

function setPlayerTurn(state: GameState, seat: number): GameState {
  return { ...state, currentTurnSeat: seat, phase: 'wait_discard' };
}

// ==================== 开局 ====================

export function startRound(
  roomCode: string,
  roundNo: number,
  totalRounds: number,
  dealerSeat: number,
  userIds: string[],
  nicknames?: string[],
): { state: GameState; events: EngineEvent[] } {
  const wall = shuffleWall(generateWall());
  const { hands, remaining } = dealHands(wall, 4);

  const players: PlayerState[] = [];
  for (let seat = 0; seat < 4; seat++) {
    players.push({
      seat,
      userId: userIds[seat]!,
      hand: sortHand(hands[seat]!),
      melds: [],
      discards: [],
      isTing: false,
      listenTiles: [],
      isHu: false,
      score: 0,
      isDealer: seat === dealerSeat,
      isTrustee: false,
    });
  }

  const state: GameState = {
    roomCode,
    roundNo,
    totalRounds,
    phase: 'wait_discard',
    dealerSeat,
    currentTurnSeat: dealerSeat,
    wall: remaining,
    players,
    lastDiscarded: null,
    claimWindow: null,
    eventSeq: 1,
  };

  const events: EngineEvent[] = [];

  // 玩家列表（所有人可见，含昵称）
  const playerList = players.map((p) => ({
    seat: p.seat,
    userId: p.userId,
    nickname: nicknames?.[p.seat] ?? p.userId,
    handCount: p.hand.length,
  }));

  events.push({
    type: 'game.started',
    actor: 'system',
    visibility: 'all',
    data: { roundNo, dealerSeat, totalRounds, players: playerList },
  });

  // 每人发送自己的手牌（self 可见）
  for (const p of players) {
    events.push({
      type: 'hand.dealt',
      actor: 'system',
      visibility: 'self',
      data: { seat: p.seat, hand: p.hand, userId: p.userId },
    });
  }

  // 庄家自动摸牌
  const drawEvent = doDraw(state);
  if (drawEvent) {
    events.push(...drawEvent);
    const newState = applyDraw(state);
    return { state: newState, events };
  }

  return { state, events };
}

// ==================== 摸牌 ====================

export function doDraw(state: GameState): EngineEvent[] | null {
  const seat = state.currentTurnSeat;
  const player = getPlayer(state, seat);
  if (player.isHu) return null;

  const result = drawTile(state.wall);
  if (!result) return null;

  const events: EngineEvent[] = [];

  // 自家可见
  events.push({
    type: 'tile.drawn',
    actor: player.userId,
    visibility: 'self',
    data: { tile: result.tile, remainingWall: result.remaining.length, isWild: isWild(result.tile) },
  });

  // 其他三家
  events.push({
    type: 'tile.drawn_visible',
    actor: 'system',
    visibility: 'others',
    data: { seat, remainingWall: result.remaining.length },
  });

  return events;
}

export function applyDraw(state: GameState): GameState {
  const seat = state.currentTurnSeat;
  const result = drawTile(state.wall);
  if (!result) return { ...state, phase: 'round_end' };

  const players = state.players.map((p, i) => {
    if (i !== seat) return p;
    return { ...p, hand: sortHand([...p.hand, result.tile]) };
  });

  return {
    ...state,
    wall: result.remaining,
    players,
    phase: 'wait_discard',
    eventSeq: state.eventSeq + 1,
  };
}

// ==================== 出牌 ====================

export interface DiscardInput {
  seat: number;
  tile: Tile;
}

export function doDiscard(
  state: GameState,
  input: DiscardInput,
): { state: GameState; events: EngineEvent[] } | { error: string } {
  if (state.currentTurnSeat !== input.seat) return { error: '还没轮到你' };
  if (state.phase !== 'wait_discard') return { error: '当前状态不允许出牌' };

  const player = getPlayer(state, input.seat);
  const idx = player.hand.indexOf(input.tile);
  if (idx === -1) return { error: '你手中没有这张牌' };

  const newHand = [...player.hand];
  newHand.splice(idx, 1);

  const players = state.players.map((p, i) => {
    if (i !== input.seat) return p;
    return { ...p, hand: sortHand(newHand), discards: [...p.discards, input.tile] };
  });

  const newState: GameState = {
    ...state,
    players,
    lastDiscarded: { tile: input.tile, seat: input.seat },
    claimWindow: {
      actions: [],
      deadlineMs: Date.now() + CLAIM_WINDOW_MS,
    },
    phase: 'wait_claim',
    eventSeq: state.eventSeq + 1,
  };

  // 计算每个座位可以做的 claim 动作（不能胡，只碰/杠）
  const claimActions: Record<number, string[]> = {};
  for (let s = 0; s < 4; s++) {
    if (s === input.seat) continue;
    const p = players[s];
    if (!p) continue;
    const can: string[] = [];
    const count = p.hand.filter((t) => t === input.tile).length;
    if (count >= 2) { can.push('pong'); }
    if (count >= 3) { can.push('kong'); }
    claimActions[s] = can;
  }

  const events: EngineEvent[] = [
    {
      type: 'tile.discarded',
      actor: player.userId,
      visibility: 'all',
      data: { tile: input.tile, seat: input.seat, claimWindow: CLAIM_WINDOW_MS, claimActions },
    },
  ];

  return { state: newState, events };
}

// ==================== 碰 / 杠 / 过 ====================

export function doPong(state: GameState, seat: number): { state: GameState; events: EngineEvent[] } | { error: string } {
  if (!state.lastDiscarded || !state.claimWindow) return { error: '无牌可碰' };
  if (state.phase !== 'wait_claim') return { error: '当前状态不允许碰' };

  const tile = state.lastDiscarded.tile;
  const player = getPlayer(state, seat);
  const matching = player.hand.filter((t) => t === tile || isWild(t));

  // 需要至少 2 张同牌（或癞子）
  if (matching.length < 2) return { error: '手中该牌不足' };

  // 从手牌移除 2 张
  let hand = [...player.hand];
  let removed = 0;
  hand = hand.filter((t) => {
    if (removed < 2 && (t === tile || isWild(t))) { removed++; return false; }
    return true;
  });

  const meld: Meld = { type: 'pong', tiles: [tile, tile, tile], fromSeat: state.lastDiscarded.seat };

  const players = state.players.map((p, i) => {
    if (i !== seat) return p;
    return { ...p, hand: sortHand(hand), melds: [...p.melds, meld] };
  });

  const newState: GameState = {
    ...state,
    players,
    lastDiscarded: null,
    claimWindow: null,
    phase: 'wait_discard',
    currentTurnSeat: seat,
    eventSeq: state.eventSeq + 1,
  };

  const events: EngineEvent[] = [
    {
      type: 'pong',
      actor: player.userId,
      visibility: 'all',
      data: { tile, fromSeat: state.lastDiscarded.seat, toSeat: seat, meld: meld.tiles },
    },
  ];

  return { state: newState, events };
}

// ==================== 杠 ====================

export type KongType = 'kong_ming' | 'kong_an' | 'kong_added';

export function doKong(
  state: GameState,
  seat: number,
  kongType: KongType,
): { state: GameState; events: EngineEvent[] } | { error: string } {
  if (state.phase !== 'wait_discard' && state.phase !== 'wait_claim') {
    return { error: '当前状态不允许杠' };
  }

  const player = getPlayer(state, seat);

  if (kongType === 'kong_ming') {
    // 明杠：抢牌窗口中有人打出了玩家手中有3张的牌 → 被杠者出1分
    if (!state.lastDiscarded || !state.claimWindow) return { error: '无牌可杠' };
    const tile = state.lastDiscarded.tile;
    const count = player.hand.filter((t) => t === tile).length;
    if (count < 3) return { error: '手牌不足3张，无法明杠' };

    let hand = [...player.hand];
    let removed = 0;
    hand = hand.filter((t) => {
      if (removed < 3 && t === tile) { removed++; return false; }
      return true;
    });

    const fromSeat = state.lastDiscarded.seat;
    const meld: Meld = { type: 'kong_ming', tiles: [tile, tile, tile, tile], fromSeat };

    // 杠分：被杠者出 1 分给杠牌者
    const players = state.players.map((p, i) => {
      if (i === seat) return { ...p, score: p.score + 1 };
      if (i === fromSeat) return { ...p, score: p.score - 1 };
      return p;
    });

    const scoreChanges: Record<string, number> = {};
    scoreChanges[player.userId] = 1;
    scoreChanges[players[fromSeat]!.userId] = -1;

    const newState: GameState = {
      ...state,
      players: players.map((p, i) =>
        i !== seat ? p : { ...p, hand: sortHand(hand), melds: [...p.melds, meld] }
      ),
      lastDiscarded: null,
      claimWindow: null,
      phase: 'wait_discard',
      currentTurnSeat: seat,
      eventSeq: state.eventSeq + 1,
    };

    // 摸补牌
    const drawResult = drawTile(newState.wall);
    const finalState = drawResult
      ? { ...newState, wall: drawResult.remaining, players: newState.players.map((p, i) => i !== seat ? p : { ...p, hand: sortHand([...hand, drawResult.tile]) }) }
      : newState;

    const events: EngineEvent[] = [{
      type: 'kong',
      actor: player.userId,
      visibility: 'all',
      data: { kongType: 'kong_ming', tile, fromSeat, toSeat: seat, meld: meld.tiles, scoreChanges },
    }];
    if (drawResult) {
      events.push({
        type: 'tile.drawn', actor: player.userId, visibility: 'self',
        data: { tile: drawResult.tile, remainingWall: drawResult.remaining.length, isWild: isWild(drawResult.tile) },
      });
      events.push({
        type: 'tile.drawn_visible', actor: 'system', visibility: 'others',
        data: { seat, remainingWall: drawResult.remaining.length },
      });
    }
    return { state: finalState, events };
  }

  if (kongType === 'kong_an') {
    // 暗杠：手中有4张相同的牌 → 三家各出 1 分
    const groups = groupTiles(player.hand);
    const fourGroup = Object.entries(groups).find(([, c]) => c >= 4);
    if (!fourGroup) return { error: '手中没有4张相同的牌，无法暗杠' };
    const tile = fourGroup[0]!;

    let hand = [...player.hand];
    let removed = 0;
    hand = hand.filter((t) => {
      if (removed < 4 && t === tile) { removed++; return false; }
      return true;
    });

    const meld: Meld = { type: 'kong_an', tiles: [tile, tile, tile, tile] };

    // 三家各出 1 分
    const scoreChanges: Record<string, number> = {};
    scoreChanges[player.userId] = 3;
    const players = state.players.map((p, i) => {
      if (i === seat) return { ...p, score: p.score + 3 };
      scoreChanges[p.userId] = -1;
      return { ...p, score: p.score - 1 };
    });

    const newState = makeKongState(state, seat, hand, meld);
    const finalState = { ...newState, players: newState.players.map((p, i) => i !== seat ? { ...p, score: players[i]!.score } : { ...p, score: players[i]!.score }) };

    const events: EngineEvent[] = [{
      type: 'kong',
      actor: player.userId,
      visibility: 'all',
      data: { kongType: 'kong_an', tile, toSeat: seat, meld: meld.tiles, scoreChanges },
    }];
    // 暗杠也摸补牌
    const dr = drawTile(finalState.wall);
    if (dr) {
      const withDraw = { ...finalState, wall: dr.remaining, players: finalState.players.map((p, i) => i !== seat ? p : { ...p, hand: sortHand([...p.hand, dr.tile]) }) };
      events.push({ type: 'tile.drawn', actor: player.userId, visibility: 'self', data: { tile: dr.tile, remainingWall: dr.remaining.length, isWild: isWild(dr.tile) } });
      events.push({ type: 'tile.drawn_visible', actor: 'system', visibility: 'others', data: { seat, remainingWall: dr.remaining.length } });
      return { state: withDraw, events };
    }
    return { state: finalState, events };
  }

  if (kongType === 'kong_added') {
    // 加杠：已有 pong，摸到第4张 → 之前碰牌来源的人出 1 分
    const pongMelds = player.melds.filter((m) => m.type === 'pong');
    let found: { meldIndex: number; tile: string; fromSeat?: number } | null = null;
    for (let i = 0; i < pongMelds.length; i++) {
      const tile = pongMelds[i]!.tiles[0]!;
      if (player.hand.includes(tile)) {
        found = { meldIndex: player.melds.indexOf(pongMelds[i]!), tile, fromSeat: pongMelds[i]!.fromSeat };
        break;
      }
    }
    if (!found) return { error: '无法加杠：没有摸到对应牌' };

    let hand = [...player.hand];
    const idx = hand.indexOf(found.tile);
    hand.splice(idx, 1);

    const melds = player.melds.map((m, i) =>
      i === found!.meldIndex ? { ...m, type: 'kong_added' as const, tiles: [...m.tiles, found!.tile] } : m
    );

    // 被杠者（碰牌来源）出 1 分
    const payerSeat = found.fromSeat;
    const scoreChanges: Record<string, number> = {};
    scoreChanges[player.userId] = 1;
    const players = state.players.map((p, i) => {
      if (i === seat) return { ...p, score: p.score + 1, hand: sortHand(hand), melds };
      if (payerSeat !== undefined && i === payerSeat) {
        scoreChanges[p.userId] = -1;
        return { ...p, score: p.score - 1 };
      }
      return p;
    });

    // 摸补牌
    const drawResult = drawTile(state.wall);
    if (!drawResult) return { error: '牌墙已空' };

    const finalHand = sortHand([...hand, drawResult.tile]);
    const finalPlayers = players.map((p, i) =>
      i !== seat ? p : { ...p, hand: finalHand }
    );

    const newState: GameState = {
      ...state,
      players: finalPlayers,
      wall: drawResult.remaining,
      phase: 'wait_discard',
      lastDiscarded: null,
      claimWindow: null,
      eventSeq: state.eventSeq + 1,
    };

    const events: EngineEvent[] = [
      {
        type: 'kong',
        actor: player.userId,
        visibility: 'all',
        data: { kongType: 'kong_added', tile: found.tile, toSeat: seat, meld: [...(melds[found.meldIndex]?.tiles ?? [])], scoreChanges },
      },
      { type: 'tile.drawn', actor: player.userId, visibility: 'self', data: { tile: drawResult.tile, remainingWall: drawResult.remaining.length, isWild: isWild(drawResult.tile) } },
      { type: 'tile.drawn_visible', actor: 'system', visibility: 'others', data: { seat, remainingWall: drawResult.remaining.length } },
    ];
    return { state: newState, events };
  }

  return { error: '未知杠类型' };
}

/** 创建杠后的状态（明杠/暗杠后要摸牌） */
function makeKongState(state: GameState, seat: number, hand: Tile[], meld: Meld): GameState {
  const drawResult = drawTile(state.wall);
  const finalHand = drawResult ? sortHand([...hand, drawResult.tile]) : sortHand(hand);

  const players = state.players.map((p, i) => {
    if (i !== seat) return p;
    return { ...p, hand: finalHand, melds: [...p.melds, meld] };
  });

  return {
    ...state,
    players,
    wall: drawResult?.remaining ?? state.wall,
    lastDiscarded: null,
    claimWindow: null,
    phase: 'wait_discard',
    currentTurnSeat: seat,
    eventSeq: state.eventSeq + 1,
  };
}

function groupTiles(tiles: Tile[]): Record<string, number> {
  const g: Record<string, number> = {};
  for (const t of tiles) {
    g[t] = (g[t] ?? 0) + 1;
  }
  return g;
}

// ==================== 胡牌判定 ====================

/**
 * 按花色排序键
 */
function tileSortKey(t: Tile): string {
  const suit = t[1] ?? 'z';
  return suit + (t[0] ?? '0').padStart(2, '0');
}

/**
 * 真正的胡牌判定（支持红中癞子）
 * 使用递归回溯：将手牌拆分为 4 个面子 + 1 个雀头
 */
export function canHu(hand: Tile[], melds: Meld[], winTile: Tile): boolean {
  const meldTileCount = melds.reduce((sum, m) => sum + m.tiles.length, 0);
  const fullTiles = [...hand, winTile].filter((t) => t.length > 0);

  // 总牌数必须是 14 + 副露（杠=4张）
  const total = fullTiles.length + meldTileCount;
  if (total % 3 !== 2) return false;

  // 分离癞子和普通牌
  const wilds = fullTiles.filter((t) => isWild(t));
  const normals = fullTiles.filter((t) => !isWild(t)).sort((a, b) => tileSortKey(a).localeCompare(tileSortKey(b)));

  return canFormMeldsAndPair(normals, wilds.length, (4 - meldTileCount / 3));
}

/**
 * 递归判定：能否用 givenWilds 个癞子补齐 remainingMelds 个面子 + 1 个雀头
 */
function canFormMeldsAndPair(
  tiles: Tile[],
  wilds: number,
  remainingMelds: number,
): boolean {
  // 如果没有剩余的牌且不需要更多面子 → 成功
  if (tiles.length === 0 && remainingMelds === 0) return true;

  // 牌不够
  if (tiles.length + wilds * 3 < remainingMelds * 3 + 2) return false;

  // Case 1: 尝试取一个雀头（对子）
  if (remainingMelds > 0 && tiles.length >= 2) {
    const pair = tryPair(tiles, wilds);
    if (pair !== null) {
      if (canFormMeldsAndPair(pair.remaining, pair.usedWilds, remainingMelds)) return true;
    }
  }

  // Case 2: 尝试取一个面子（刻子）
  if (tiles.length >= 3 || (tiles.length >= 1 && wilds >= 2) || (tiles.length >= 2 && wilds >= 1)) {
    const triplet = tryTriplet(tiles, wilds);
    if (triplet !== null && remainingMelds > 0) {
      if (canFormMeldsAndPair(triplet.remaining, triplet.usedWilds, remainingMelds - 1)) return true;
    }
  }

  // Case 3: 尝试取一个面子（顺子）
  if (tiles.length >= 3 || (tiles.length >= 2 && wilds >= 1)) {
    const seq = trySequence(tiles, wilds);
    if (seq !== null && remainingMelds > 0) {
      if (canFormMeldsAndPair(seq.remaining, seq.usedWilds, remainingMelds - 1)) return true;
    }
  }

  return false;
}

function tryPair(tiles: Tile[], wilds: number): { remaining: Tile[]; usedWilds: number } | null {
  if (tiles.length < 2) {
    if (wilds >= 2) return { remaining: [...tiles], usedWilds: wilds - 2 };
    if (wilds >= 1 && tiles.length >= 1) return { remaining: tiles.slice(1), usedWilds: wilds - 1 };
    return null;
  }
  // 尝试前两张相同
  if (tiles[0] === tiles[1]) {
    return { remaining: tiles.slice(2), usedWilds: wilds };
  }
  // 使用一张癞子
  if (wilds >= 1) {
    return { remaining: tiles.slice(1), usedWilds: wilds - 1 };
  }
  return null;
}

function tryTriplet(tiles: Tile[], wilds: number): { remaining: Tile[]; usedWilds: number } | null {
  if (tiles.length >= 3 && tiles[0] === tiles[1] && tiles[1] === tiles[2]) {
    return { remaining: tiles.slice(3), usedWilds: wilds };
  }
  // 两张相同 + 1 癞子
  if (tiles.length >= 2 && tiles[0] === tiles[1] && wilds >= 1) {
    return { remaining: tiles.slice(2), usedWilds: wilds - 1 };
  }
  // 一张 + 2 癞子
  if (tiles.length >= 1 && wilds >= 2) {
    return { remaining: tiles.slice(1), usedWilds: wilds - 2 };
  }
  return null;
}

function trySequence(tiles: Tile[], wilds: number): { remaining: Tile[]; usedWilds: number } | null {
  const first = tiles[0]!;
  const suit = first[1]!;
  if (suit === 'z') return null; // 字牌不能组成顺子

  const num = parseInt(first[0]!);
  const need = [`${num + 1}${suit}`, `${num + 2}${suit}`];

  let remaining = [...tiles.slice(1)];
  let w = wilds;

  for (const n of need) {
    const idx = remaining.findIndex((t) => t === n);
    if (idx >= 0) {
      remaining = [...remaining.slice(0, idx), ...remaining.slice(idx + 1)];
    } else if (w > 0) {
      w--;
    } else {
      return null;
    }
  }

  return { remaining, usedWilds: w };
}

export function doHu(
  state: GameState,
  seat: number,
): { state: GameState; events: EngineEvent[]; result: HuResult } | { error: string } {
  const player = getPlayer(state, seat);
  if (player.isHu) return { error: '已胡牌' };

  const winTile = player.hand[player.hand.length - 1]!; // 自摸的牌

  const { fans, breakdown } = calculateFans(
    player.hand,
    winTile,
    true, // 只能自摸
    player.melds,
  );

  const perPersonPay = 1 + fans; // 底分1 + 特殊番
  const rawChanges = calculateScoreChanges(
    1,
    fans,
    true,
    null,
    [0, 1, 2, 3],
  );

  // 赢家得三家总和
  const winnerGain = 3 * perPersonPay;
  const scoreChanges: Record<number, number> = { ...rawChanges };
  scoreChanges[seat] = winnerGain;

  const players = state.players.map((p, i) => ({
    ...p,
    score: p.score + (scoreChanges[i] ?? 0),
    isHu: i === seat ? true : p.isHu,
  }));

  const scoreByUserId: Record<string, number> = {};
  Object.entries(scoreChanges).forEach(([s, v]) => {
    const p = players[parseInt(s)];
    if (p) scoreByUserId[p.userId] = v;
  });

  const result: HuResult = {
    winnerSeat: seat,
    winnerId: player.userId,
    loserSeat: null,
    winType: 'selfmo',
    winTile,
    fans,
    fanBreakdown: breakdown,
    scoreChanges: scoreByUserId,
    isHuangzhuang: false,
  };

  const newState: GameState = {
    ...state,
    players,
    phase: 'round_end',
    lastDiscarded: null,
    claimWindow: null,
    eventSeq: state.eventSeq + 1,
  };

  const events: EngineEvent[] = [
    {
      type: 'hu',
      actor: player.userId,
      visibility: 'all',
      data: {
        winnerSeat: seat,
        winType: 'selfmo',
        winTile,
        fans,
        fanBreakdown: breakdown,
        scoreChanges: scoreByUserId,
      },
    },
  ];

  return { state: newState, events, result };
}

// ==================== 辅助 ====================

export function nextSeat(current: number): number {
  return (current + 1) % 4;
}

export function handleTimeout(state: GameState): { state: GameState; events: EngineEvent[] } | { error: string } {
  if (state.phase !== 'wait_discard') return { error: 'not in discard phase' };

  const seat = state.currentTurnSeat;
  const player = getPlayer(state, seat);
  // 自动出最右侧的牌
  const discardTile = player.hand[player.hand.length - 1]!;
  return doDiscard(state, { seat, tile: discardTile }) as {
    state: GameState;
    events: EngineEvent[];
  };
}

export function claimRound(
  state: GameState,
  seat: number,
  action: 'pong' | 'kong' | 'hu' | 'pass',
): { state: GameState; events: EngineEvent[] } | { error: string } {
  if (!state.claimWindow) return { error: '没有抢牌窗口' };
  if (state.phase !== 'wait_claim') return { error: '不在抢牌阶段' };

  // 不接炮：claim 阶段只能碰/杠/过，不能胡
  if (action === 'pong') {
    return doPong(state, seat);
  }
  if (action === 'kong') {
    return doKong(state, seat, 'kong_ming');
  }
  // pass: 不做任何事，等所有玩家 pass 后推进
  return { state, events: [] };
}

export function getActiveTiles(player: PlayerState): { hand: Tile[]; melds: Meld[]; discards: Tile[] } {
  return {
    hand: player.hand,
    melds: player.melds,
    discards: player.discards,
  };
}

export function handleTing(
  state: GameState,
  seat: number,
): { state: GameState; events: EngineEvent[] } | { error: string } {
  if (state.currentTurnSeat !== seat) return { error: '还没轮到你' };
  const player = getPlayer(state, seat);
  const listenTiles = calculateListenTiles(player.hand, player.melds);

  const players = state.players.map((p, i) => {
    if (i !== seat) return p;
    return { ...p, isTing: true, listenTiles };
  });

  const newState: GameState = { ...state, players, eventSeq: state.eventSeq + 1 };

  const events: EngineEvent[] = [
    { type: 'ting', actor: player.userId, visibility: 'all', data: { seat } },
    { type: 'ting', actor: player.userId, visibility: 'self', data: { listenTiles } },
  ];

  return { state: newState, events };
}
