import { create } from 'zustand';

/**
 * 麻将牌
 */
export type Tile = string;

/**
 * 副露（碰/杠）
 */
export interface Meld {
  type: 'pong' | 'kong_ming' | 'kong_an' | 'kong_added';
  tiles: Tile[];
  fromSeat?: number;
}

/**
 * 玩家视图（对手信息）
 */
export interface PlayerView {
  seat: number;
  userId: string;
  nickname: string;
  handCount: number;
  melds: Meld[];
  discards: Tile[];
  isTing: boolean;
  isHu: boolean;
  score: number;
  isTrustee: boolean;
}

/**
 * 番型明细
 */
export interface FanBreakdown {
  type: string;
  name: string;
  fans: number;
}

/**
 * 胡牌结果
 */
export interface HuResultData {
  winnerSeat: number;
  loserSeat: number | null;
  winType: 'selfmo' | 'jiePao';
  winTile: Tile;
  fans: number;
  fanBreakdown: FanBreakdown[];
  scoreChanges: Record<string, number>;
  isHuangzhuang: boolean;
}

/**
 * 排名
 */
export interface Ranking {
  rank: number;
  seat: number;
  userId: string;
  score: number;
}

interface GameStore {
  // Context
  roomCode: string;
  roundNo: number;
  totalRounds: number;
  phase: string;
  currentTurnSeat: number;
  dealerSeat: number;

  // Self
  mySeat: number;
  myHand: Tile[];
  myMelds: Meld[];
  myDiscards: Tile[];
  myScore: number;
  selectedTile: string | null;
  isTing: boolean;
  listenTiles: Tile[];

  // Others
  players: Record<number, PlayerView>;
  getOppositeSeat: () => number;
  getLeftSeat: () => number;
  getRightSeat: () => number;

  // Table
  lastDiscarded: { tile: string; seat: number } | null;
  remainingWall: number;
  discardPile: Tile[];

  // Claim
  canPong: boolean;
  canKong: boolean;
  canHu: boolean;
  claimDeadline: number | null;

  // Countdown
  countdown: { seat: number; deadline: number } | null;

  // Results
  roundResult: HuResultData | null;
  matchResult: { rankings: Ranking[] } | null;

  // Actions
  initGame: (data: {
    roomCode: string;
    mySeat: number;
    players: { seat: number; userId: string; nickname: string }[];
    totalRounds: number;
  }) => void;
  applyEvent: (eventType: string, data: Record<string, unknown>) => void;
  selectTile: (tile: string) => void;
  clearSelection: () => void;
  reset: () => void;
}

function sortHand(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const suitOrder: Record<string, number> = { m: 0, p: 1, s: 2, z: 3 };
    const sa = suitOrder[a[1]!] ?? 9;
    const sb = suitOrder[b[1]!] ?? 9;
    if (sa !== sb) return sa - sb;
    return (parseInt(a[0]!) || 0) - (parseInt(b[0]!) || 0);
  });
}

const EMPTY_PLAYER: PlayerView = {
  seat: -1,
  userId: '',
  nickname: '',
  handCount: 0,
  melds: [],
  discards: [],
  isTing: false,
  isHu: false,
  score: 0,
  isTrustee: false,
};

export const useGameStore = create<GameStore>((set, get) => ({
  roomCode: '',
  roundNo: 0,
  totalRounds: 8,
  phase: 'idle',
  currentTurnSeat: -1,
  dealerSeat: -1,

  mySeat: -1,
  myHand: [],
  myMelds: [],
  myDiscards: [],
  myScore: 0,
  selectedTile: null,
  isTing: false,
  listenTiles: [],

  players: {},

  lastDiscarded: null,
  remainingWall: 84,
  discardPile: [],

  canPong: false,
  canKong: false,
  canHu: false,
  claimDeadline: null,

  countdown: null,

  roundResult: null,
  matchResult: null,

  getOppositeSeat: () => (get().mySeat + 2) % 4,
  getLeftSeat: () => (get().mySeat + 3) % 4,
  getRightSeat: () => (get().mySeat + 1) % 4,

  initGame: (data) => {
    const players: Record<number, PlayerView> = {};
    data.players.forEach((p) => {
      players[p.seat] = { ...EMPTY_PLAYER, seat: p.seat, userId: p.userId, nickname: p.nickname, handCount: 13 };
    });
    // 庄家 14 张手牌
    const { mySeat } = data;
    // 简化：初始化 13 张
    set({
      roomCode: data.roomCode,
      mySeat: data.mySeat,
      totalRounds: data.totalRounds,
      players,
      phase: 'dealing',
      roundNo: 1,
    });
  },

  applyEvent: (eventType, data) => {
    const state = get();
    switch (eventType) {
      case 'game.started': {
        const d = data as {
          roundNo: number; dealerSeat: number; totalRounds: number;
          players: { seat: number; userId: string; nickname: string; handCount: number }[];
        };
        const playerMap: Record<number, PlayerView> = {};
        (d.players ?? []).forEach((p) => {
          playerMap[p.seat] = { ...EMPTY_PLAYER, seat: p.seat, userId: p.userId, nickname: p.nickname, handCount: p.handCount };
        });
        set({
          roundNo: d.roundNo ?? 1,
          dealerSeat: d.dealerSeat ?? 0,
          totalRounds: d.totalRounds ?? 8,
          players: playerMap,
          phase: 'playing',
          selectedTile: null,
          myHand: [],
          myMelds: [],
          myDiscards: [],
          myScore: 0,
          discardPile: [],
          lastDiscarded: null,
          roundResult: null, // 清除上一局结算
        });
        break;
      }

      case 'hand.dealt': {
        const d = data as { seat: number; hand: string[] };
        if (d.seat === state.mySeat && d.hand) {
          set({ myHand: sortHand(d.hand) });
        }
        break;
      }

      case 'tile.drawn': {
        const d = data as { tile: string; remainingWall: number };
        if (d.tile) {
          const newHand = sortHand([...state.myHand, d.tile]);
          set({
            myHand: newHand,
            remainingWall: d.remainingWall ?? state.remainingWall,
            phase: 'wait_discard',
            canPong: false,
            canKong: false,
            canHu: false,
            selectedTile: null,
          });
        }
        break;
      }

      case 'tile.drawn_visible': {
        const d = data as { seat: number; remainingWall: number };
        const p = state.players[d.seat];
        if (p) {
          set({
            players: { ...state.players, [d.seat]: { ...p, handCount: p.handCount + 1 } },
            remainingWall: d.remainingWall ?? state.remainingWall,
          });
        }
        break;
      }

      case 'tile.discarded': {
        const d = data as { tile: string; seat: number; claimWindow?: number; claimActions?: Record<number, string[]> };
        const discarder = state.players[d.seat];
        // 计算自己可做的动作
        const myActions = d.claimActions?.[state.mySeat] ?? [];
        const canPong = myActions.includes('pong');
        const canKong = myActions.includes('kong');
        const canHuFlag = myActions.includes('hu');
        const hasActions = canPong || canKong || canHuFlag;

        if (discarder) {
          if (d.seat === state.mySeat) {
            const idx = state.myHand.indexOf(d.tile);
            const hand = [...state.myHand];
            if (idx >= 0) hand.splice(idx, 1);
            set({
              myDiscards: [...state.myDiscards, d.tile],
              myHand: hand,
              lastDiscarded: { tile: d.tile, seat: d.seat },
              discardPile: [...state.discardPile, d.tile],
              phase: 'wait_claim',
              selectedTile: null,
              canPong: false, canKong: false, canHu: false,
            });
          } else {
            set({
              players: {
                ...state.players,
                [d.seat]: {
                  ...discarder,
                  handCount: Math.max(0, discarder.handCount - 1),
                  discards: [...discarder.discards, d.tile],
                },
              },
              lastDiscarded: { tile: d.tile, seat: d.seat },
              discardPile: [...state.discardPile, d.tile],
              phase: 'wait_claim',
              canPong,
              canKong,
            });
          }
        }
        break;
      }

      case 'pong': {
        const d = data as { tile: string; fromSeat: number; toSeat: number; meld: string[] };
        const meld: Meld = { type: 'pong', tiles: d.meld ?? [d.tile, d.tile, d.tile], fromSeat: d.fromSeat };
        if (d.toSeat === state.mySeat) {
          // 自己碰了
          const hand = [...state.myHand];
          const tile = d.tile;
          let removed = 0;
          const newHand = hand.filter((t) => {
            if (removed < 2 && t === tile) { removed++; return false; }
            return true;
          });
          set({
            myHand: sortHand(newHand),
            myMelds: [...state.myMelds, meld],
            currentTurnSeat: d.toSeat,
            phase: 'wait_discard',
            lastDiscarded: null,
            canPong: false,
            canKong: false,
            canHu: false,
            claimDeadline: null,
          });
        } else {
          const p = state.players[d.toSeat];
          if (p) {
            set({
              players: {
                ...state.players,
                [d.toSeat]: {
                  ...p,
                  handCount: Math.max(0, p.handCount - 2),
                  melds: [...p.melds, meld],
                },
              },
              currentTurnSeat: d.toSeat,
              phase: 'wait_discard',
              lastDiscarded: null,
              canPong: false,
              canKong: false,
              canHu: false,
              claimDeadline: null,
            });
          }
        }
        break;
      }

      case 'kong': {
        const kd = data as { kongType: string; tile: string; fromSeat?: number; toSeat: number; meld: string[]; scoreChanges?: Record<string, number> };
        const kMeld: Meld = { type: (kd.kongType as Meld['type']) ?? 'kong_ming', tiles: kd.meld ?? [kd.tile, kd.tile, kd.tile, kd.tile], fromSeat: kd.fromSeat };

        // 应用杠分
        if (kd.scoreChanges) {
          Object.entries(kd.scoreChanges).forEach(([uid, delta]) => {
            if (uid === useGameStore.getState().players[kd.toSeat]?.userId && kd.toSeat === state.mySeat) {
              // 自己杠了
            }
          });
          const players = { ...state.players };
          Object.entries(kd.scoreChanges).forEach(([uid, delta]) => {
            for (const [s, p] of Object.entries(players)) {
              if (p.userId === uid) {
                players[parseInt(s)] = { ...p, score: p.score + delta };
              }
            }
          });
          set({ players, myScore: (players[state.mySeat]?.score ?? state.myScore) });
        }

        if (kd.toSeat === state.mySeat) {
          const hand = [...state.myHand];
          const removed: string[] = [];
          const newHand = hand.filter((t) => {
            if (removed.length < (kd.kongType === 'kong_added' ? 1 : kd.kongType === 'kong_ming' ? 3 : 4) && t === kd.tile && !removed.includes(t + '_done')) {
              removed.push(t);
              return false;
            }
            return true;
          });
          set({
            myHand: sortHand(newHand),
            myMelds: [...state.myMelds, kMeld],
            currentTurnSeat: kd.toSeat,
            phase: 'wait_discard',
            lastDiscarded: null,
            canPong: false, canKong: false, canHu: false, claimDeadline: null,
          });
        } else {
          const kp = state.players[kd.toSeat];
          if (kp) {
            const removedCount = kd.kongType === 'kong_added' ? 1 : kd.kongType === 'kong_ming' ? 3 : 4;
            const updatedPlayers = { ...state.players };
            // 重新计算（因为上面可能已更新过分数）
            updatedPlayers[kd.toSeat] = { ...updatedPlayers[kd.toSeat]!, handCount: Math.max(0, kp.handCount - removedCount), melds: [...kp.melds, kMeld] };
            set({
              players: updatedPlayers,
              currentTurnSeat: kd.toSeat,
              phase: 'wait_discard',
              lastDiscarded: null,
              canPong: false, canKong: false, canHu: false, claimDeadline: null,
            });
          }
        }
        break;
      }

      case 'ting': {
        const d = data as { seat: number; listenTiles?: string[] };
        if (d.seat === state.mySeat && d.listenTiles) {
          set({ isTing: true, listenTiles: d.listenTiles });
        }
        if (d.seat !== state.mySeat && state.players[d.seat]) {
          set({
            players: { ...state.players, [d.seat]: { ...state.players[d.seat]!, isTing: true } },
          });
        }
        break;
      }

      case 'hu': {
        const d = data as {
          winnerSeat: number; loserSeat: number | null; winType: string;
          winTile: string; fans: number; fanBreakdown: FanBreakdown[];
          scoreChanges: Record<string, number>;
        };
        if (d.winnerSeat === state.mySeat) {
          set({
            myScore: state.myScore + (d.scoreChanges[state.mySeat.toString()] ?? 0),
          });
        }
        // 更新所有玩家分数
        const players = { ...state.players };
        Object.entries(d.scoreChanges).forEach(([seatStr, delta]) => {
          const seat = parseInt(seatStr);
          if (!isNaN(seat) && players[seat]) {
            players[seat] = { ...players[seat]!, score: players[seat]!.score + delta };
          }
        });
        set({
          players,
          phase: 'round_end',
          canPong: false,
          canKong: false,
          canHu: false,
          roundResult: {
            winnerSeat: d.winnerSeat,
            loserSeat: d.loserSeat,
            winType: d.winType as 'selfmo' | 'jiePao',
            winTile: d.winTile,
            fans: d.fans,
            fanBreakdown: d.fanBreakdown ?? [],
            scoreChanges: d.scoreChanges,
            isHuangzhuang: false,
          },
        });
        break;
      }

      case 'round_settled': {
        const d = data as { roundNo: number; scoreboard?: { seat: number; score: number }[] };
        if (d.scoreboard) {
          const players = { ...state.players };
          d.scoreboard.forEach((s) => {
            if (players[s.seat]) {
              players[s.seat] = { ...players[s.seat]!, score: s.score };
            }
          });
          set({ players });
        }
        break;
      }

      case 'match_settled': {
        const d = data as { rankings: Ranking[] };
        set({ matchResult: { rankings: d.rankings }, phase: 'match_end' });
        break;
      }

      case 'countdown.warning': {
        const d = data as { seat: number; deadline: number };
        set({ countdown: { seat: d.seat, deadline: d.deadline } });
        break;
      }

      default:
        break;
    }
  },

  selectTile: (tile) => {
    const { selectedTile, phase } = get();
    if (phase !== 'wait_discard') return;
    if (selectedTile === tile) {
      set({ selectedTile: null });
    } else {
      set({ selectedTile: tile });
    }
  },

  clearSelection: () => set({ selectedTile: null }),

  reset: () => set({
    roomCode: '', roundNo: 0, phase: 'idle', currentTurnSeat: -1, dealerSeat: -1,
    mySeat: -1, myHand: [], myMelds: [], myDiscards: [], myScore: 0,
    selectedTile: null, isTing: false, listenTiles: [],
    players: {}, lastDiscarded: null, remainingWall: 84, discardPile: [],
    canPong: false, canKong: false, canHu: false, claimDeadline: null,
    countdown: null, roundResult: null, matchResult: null,
  }),
}));
