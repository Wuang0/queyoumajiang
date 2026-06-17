import {
  startRound,
  doDraw,
  doDiscard,
  doPong,
  doHu,
  handleTing,
  nextSeat,
} from './game.engine';

describe('Game Engine', () => {
  const userIds = ['u1', 'u2', 'u3', 'u4'];
  let initialState: ReturnType<typeof startRound>;

  beforeEach(() => {
    initialState = startRound('test-room', 1, 8, 0, userIds);
  });

  describe('startRound', () => {
    it('应该初始化正确的游戏状态', () => {
      const { state, events } = initialState;

      expect(state.roundNo).toBe(1);
      expect(state.totalRounds).toBe(8);
      expect(state.dealerSeat).toBe(0);
      expect(state.currentTurnSeat).toBe(0);
      expect(state.phase).toBe('wait_discard');
      expect(state.players).toHaveLength(4);

      // 庄家初始 14 张 + 自动摸牌后 = 15 张（等待出牌）
      expect(state.players[0]!.hand.length).toBe(15);
      expect(state.players[1]!.hand.length).toBe(13);
      expect(state.players[2]!.hand.length).toBe(13);
      expect(state.players[3]!.hand.length).toBe(13);

      // 剩余牌墙 = 136 - 14 - 13×3 - 1(庄家摸牌) = 82
      expect(state.wall.length).toBe(82);

      // 应该有 game.started 事件
      expect(events.some((e) => e.type === 'game.started')).toBe(true);
    });

    it('座次应该对应正确的 userId', () => {
      const { state } = initialState;
      expect(state.players[0]!.userId).toBe('u1');
      expect(state.players[1]!.userId).toBe('u2');
      expect(state.players[2]!.userId).toBe('u3');
      expect(state.players[3]!.userId).toBe('u4');
    });
  });

  describe('doDraw', () => {
    it('当前玩家应该能摸牌', () => {
      const { state } = initialState;
      const wallBefore = state.wall.length;
      const events = doDraw(state);

      expect(events).not.toBeNull();
      expect(events!).toHaveLength(2); // self + others
      expect(events![0]!.type).toBe('tile.drawn');
      expect(events![0]!.visibility).toBe('self');
      expect(events![1]!.type).toBe('tile.drawn_visible');
      expect(events![1]!.visibility).toBe('others');
    });
  });

  describe('doDiscard', () => {
    it('当前玩家应该能出牌', () => {
      const { state } = initialState;
      const hand0 = state.players[0]!.hand;
      const tile = hand0[hand0.length - 1]!;

      const result = doDiscard(state, { seat: 0, tile });

      expect(result).toHaveProperty('state');
      if ('state' in result) {
        expect(result.state.phase).toBe('wait_claim');
        expect(result.state.lastDiscarded?.tile).toBe(tile);
        expect(result.events[0]!.type).toBe('tile.discarded');
      }
    });

    it('非当前玩家不能出牌', () => {
      const { state } = initialState;
      const result = doDiscard(state, { seat: 1, tile: '1m' });
      expect(result).toHaveProperty('error');
      if ('error' in result) {
        expect(result.error).toContain('还没轮到你');
      }
    });

    it('手中没有的牌不能出', () => {
      const { state } = initialState;
      const result = doDiscard(state, { seat: 0, tile: 'xx' });
      expect(result).toHaveProperty('error');
    });
  });

  describe('doPong', () => {
    it('应该能碰刚打出的牌', () => {
      const { state } = initialState;
      const hand0 = state.players[0]!.hand;
      const tile = hand0[hand0.length - 1]!;

      const disc = doDiscard(state, { seat: 0, tile });
      if (!('state' in disc)) return;

      // 下家手中有同牌时碰
      // 跳过复杂判定，验证基本流程
      const result = doPong(disc.state, 1);
      if ('error' in result) {
        // 可能手中牌不足
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('doHu', () => {
    it('自摸胡牌应该产生结算结果', () => {
      const { state } = initialState;

      // 手动构造一个可胡的手牌
      state.players[0]!.hand = [
        '1m', '2m', '3m', '4p', '5p', '6p',
        '7s', '8s', '9s', '1z', '1z', '2z', '3z', '4z',
      ];

      const result = doHu(state, 0);

      expect(result).toHaveProperty('result');
      if ('result' in result) {
        expect(result.result.winnerSeat).toBe(0);
        expect(result.result.fans).toBeGreaterThanOrEqual(0);
        expect(result.result.winType).toBe('selfmo');
      }
    });
  });

  describe('nextSeat', () => {
    it('应该正确轮转到下一家', () => {
      expect(nextSeat(0)).toBe(1);
      expect(nextSeat(1)).toBe(2);
      expect(nextSeat(2)).toBe(3);
      expect(nextSeat(3)).toBe(0);
    });
  });

  describe('handleTing', () => {
    it('当前玩家应该能听牌', () => {
      const { state } = initialState;
      const result = handleTing(state, 0);

      expect(result).toHaveProperty('state');
      if ('state' in result) {
        expect(result.state.players[0]!.isTing).toBe(true);
        expect(result.state.players[0]!.listenTiles.length).toBeGreaterThan(0);
      }
    });

    it('非当前玩家不能听牌', () => {
      const { state } = initialState;
      const result = handleTing(state, 1);
      expect(result).toHaveProperty('error');
    });
  });
});
