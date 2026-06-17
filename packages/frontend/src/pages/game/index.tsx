import { useEffect, useCallback, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useAuthStore } from '../../store/auth.store';
import { useGameStore } from '../../store/game.store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { MahjongTile } from '../../components/MahjongTile';
import './index.css';

/** 相对座位标签 */
const SEAT_LABELS = ['东', '南', '西', '北'];
const RULE_NAME: Record<string, string> = {
  xiangyang_redzhong: '襄阳红中癞子',
};

export default function GamePage() {
  const router = useRouter();
  const roomCode = (router.params.roomCode as string) ?? '';
  const mySeatParam = parseInt((router.params.mySeat as string) ?? '0', 10);
  const { user, token } = useAuthStore();

  const {
    roundNo,
    totalRounds,
    phase,
    currentTurnSeat,
    mySeat: mySeatStore,
    myHand,
    myMelds,
    myDiscards,
    myScore,
    selectedTile,
    isTing,
    players,
    lastDiscarded,
    remainingWall,
    discardPile,
    canPong,
    canKong,
    countdown,
    matchResult,
    roundResult,
    getOppositeSeat,
    getLeftSeat,
    getRightSeat,
    initGame,
    applyEvent,
    selectTile,
    clearSelection,
    reset,
  } = useGameStore();

  // 设置 mySeat
  useEffect(() => {
    if (mySeatParam >= 0) {
      useGameStore.setState({ mySeat: mySeatParam });
    }
  }, [mySeatParam]);

  // WS 事件处理
  const handlers = {
    'game.started': (data: Record<string, unknown>) => applyEvent('game.started', data),
    'hand.dealt': (data: Record<string, unknown>) => applyEvent('hand.dealt', data),
    'tile.drawn': (data: Record<string, unknown>) => applyEvent('tile.drawn', data),
    'tile.drawn_visible': (data: Record<string, unknown>) => applyEvent('tile.drawn_visible', data),
    'tile.discarded': (data: Record<string, unknown>) => applyEvent('tile.discarded', data),
    'pong': (data: Record<string, unknown>) => applyEvent('pong', data),
    'kong': (data: Record<string, unknown>) => applyEvent('kong', data),
    'ting': (data: Record<string, unknown>) => applyEvent('ting', data),
    'hu': (data: Record<string, unknown>) => applyEvent('hu', data),
    'round_settled': (data: Record<string, unknown>) => applyEvent('round_settled', data),
    'match_settled': (data: Record<string, unknown>) => applyEvent('match_settled', data),
    'countdown.warning': (data: Record<string, unknown>) => applyEvent('countdown.warning', data),
    'stop.requested': (data: Record<string, unknown>) => {
      Taro.showToast({ title: (data.message as string) ?? '有人请求结束对局', icon: 'none', duration: 3000 });
    },
  };

  const { connect, send } = useWebSocket(handlers);

  // 连接 + 加入房间
  useEffect(() => {
    if (!token || !roomCode) return;

    // 尝试从 sessionStorage 恢复初始状态（房间页已捕获）
    try {
      const saved = sessionStorage.getItem('queyou_game_init');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, unknown>;
        if (Date.now() - (parsed.ts as number) < 10000) {
          // 10秒内有效
          if (parsed.data) {
            applyEvent('game.started', parsed.data as Record<string, unknown>);
          }
          if (parsed.handData) {
            applyEvent('hand.dealt', parsed.handData as Record<string, unknown>);
          }
        }
        sessionStorage.removeItem('queyou_game_init');
      }
    } catch { /* ignore */ }

    connect();
    send({ type: 'room.join', payload: { roomCode, nickname: user?.nickname } });

    return () => {
      reset();
    };
  }, [roomCode, token]);

  // ==================== 操作 ====================

  const handleTileTap = (tile: string) => {
    if (phase !== 'wait_discard') return;
    if (currentTurnSeat !== mySeatStore) return;

    if (selectedTile === tile) {
      // 再次点击 → 出牌
      send({ type: 'game.discard', payload: { tile } });
      clearSelection();
    } else {
      selectTile(tile);
    }
  };

  const handlePong = () => {
    send({ type: 'game.pong', payload: {} });
  };

  const handleKong = (kongType: string = 'kong_an') => {
    send({ type: 'game.kong', payload: { kongType } });
  };

  const handleSelfmo = () => {
    send({ type: 'game.hu', payload: {} });
  };

  const handlePass = () => {
    send({ type: 'game.pass', payload: {} });
  };

  const handleStop = () => {
    send({ type: 'room.stop', payload: {} });
    Taro.showToast({ title: '已请求结束，当前局打完后停止', icon: 'none' });
  };

  const handleTing = () => {
    send({ type: 'game.ting', payload: {} });
  };

  // ==================== 倒计时 ====================

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!countdown) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((countdown.deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) setTimeLeft(null);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [countdown]);

  // ==================== 渲染 ====================

  const mySeatVal = mySeatStore;
  const oppSeat = getOppositeSeat();
  const leftSeat = getLeftSeat();
  const rightSeat = getRightSeat();

  const isMyTurn = phase === 'wait_discard' && currentTurnSeat === mySeatVal;
  const isClaimPhase = phase === 'wait_claim' && lastDiscarded?.seat !== mySeatVal;

  // 对手面朝下的手牌渲染
  const renderFaceDownHand = (count: number) => {
    const tiles = [];
    for (let i = 0; i < Math.min(count, 14); i++) {
      tiles.push(<MahjongTile key={i} tile='?' size='small' faceDown />);
    }
    return tiles;
  };

  // 弃牌堆渲染
  const recentDiscards = discardPile.slice(-8);

  return (
    <View className='game-page'>
      {/* Top bar */}
      <View className='game-topbar'>
        <Text className='game-round-info'>
          第{roundNo}/{totalRounds}局
        </Text>
        <Text className='game-rule-name'>
          {RULE_NAME['xiangyang_redzhong'] ?? '红中癞子'}
        </Text>
        <View className='game-topbar-right'>
          <Text className='game-wall-count'>牌墙:{remainingWall}</Text>
          <View className='game-stop-btn' onClick={handleStop}>
            <Text>结束</Text>
          </View>
        </View>
      </View>

      {/* Opposite player (top) */}
      <View className='game-opp-top'>
        <View className='game-opp-info'>
          <Text className='game-opp-name'>
            {players[oppSeat]?.nickname ?? `玩家${oppSeat}`}
            {players[oppSeat]?.isTing && <Text className='game-ting-tag'>听</Text>}
          </Text>
        </View>
        <View className='game-opp-hand-row'>
          {renderFaceDownHand(players[oppSeat]?.handCount ?? 13)}
        </View>
        {/* 碰/杠 */}
        {(players[oppSeat]?.melds?.length ?? 0) > 0 && (
          <View className='game-opp-melds'>
            {players[oppSeat]?.melds?.map((m, i) => (
              <View key={i} className='game-meld-row'>
                {m.tiles.map((t, j) => (
                  <MahjongTile key={j} tile={t} size='small' />
                ))}
              </View>
            ))}
          </View>
        )}
        {/* 弃牌 */}
        {(players[oppSeat]?.discards?.length ?? 0) > 0 && (
          <View className='game-opp-discards'>
            {players[oppSeat]?.discards?.slice(-5).map((t, i) => (
              <MahjongTile key={i} tile={t} size='small' />
            ))}
          </View>
        )}
      </View>

      {/* Middle: Left + Center + Right */}
      <View className='game-middle'>
        {/* Left */}
        <View className='game-side-left'>
          <Text className='game-side-name'>
            {players[leftSeat]?.nickname ?? `玩家${leftSeat}`}
          </Text>
          <View className='game-side-hand-col'>
            {renderFaceDownHand(players[leftSeat]?.handCount ?? 13)}
          </View>
          {players[leftSeat]?.isTing && <Text className='game-ting-tag'>听</Text>}
        </View>

        {/* Center */}
        <View className='game-center'>
          <View className='game-center-header'>
            <Text className='game-turn-text'>
              {isMyTurn ? '← 你的回合' : isClaimPhase ? '等待反应...' : `轮到: 玩家${currentTurnSeat}`}
            </Text>
          </View>
          <View className='game-center-discards'>
            {recentDiscards.map((t, i) => (
              <MahjongTile key={i} tile={t} size='small' />
            ))}
          </View>
          {lastDiscarded && (
            <View className='game-last-discard'>
              <MahjongTile tile={lastDiscarded.tile} size='normal' isWild={lastDiscarded.tile === '5z'} />
              <Text className='game-last-discard-label'>
                {SEAT_LABELS[lastDiscarded.seat]}家打出
              </Text>
            </View>
          )}
        </View>

        {/* Right */}
        <View className='game-side-right'>
          <Text className='game-side-name'>
            {players[rightSeat]?.nickname ?? `玩家${rightSeat}`}
          </Text>
          <View className='game-side-hand-col'>
            {renderFaceDownHand(players[rightSeat]?.handCount ?? 13)}
          </View>
          {players[rightSeat]?.isTing && <Text className='game-ting-tag'>听</Text>}
        </View>
      </View>

      {/* Own melds + discards */}
      <View className='game-own-melds'>
        {myMelds.map((m, i) => (
          <View key={i} className='game-meld-row'>
            {m.tiles.map((t, j) => (
              <MahjongTile key={j} tile={t} size='small' />
            ))}
          </View>
        ))}
      </View>

      {/* Countdown */}
      {timeLeft !== null && timeLeft > 0 && (
        <View className={`game-countdown ${timeLeft <= 5 ? 'urgent' : ''}`}>
          <Text>倒计时: {timeLeft}s</Text>
        </View>
      )}

      {/* Round result banner */}
      {roundResult && (
        <View className='game-round-result'>
          <Text className='game-round-result-title'>
            {roundResult.isHuangzhuang
              ? '黄庄（流局）'
              : roundResult.winnerSeat === mySeatVal
                ? `🎉 你和了！(${roundResult.winType === 'selfmo' ? '自摸' : '接炮'})`
                : `${players[roundResult.winnerSeat]?.nickname ?? '?'} 和了 (${roundResult.winType === 'selfmo' ? '自摸' : '接炮'})`}
          </Text>
          {roundResult.fanBreakdown.length > 0 && (
            <Text className='game-round-result-fans'>
              {roundResult.fanBreakdown.map((f) => `${f.name}+${f.fans}番`).join(' · ')}
              {' = '}{roundResult.fans}番
            </Text>
          )}
          <Text className='game-round-result-scores'>
            {Object.entries(roundResult.scoreChanges).map(([uid, delta]) => {
              const pSeat = Object.values(players).find((p) => p.userId === uid);
              return `${pSeat?.nickname ?? uid}: ${delta > 0 ? '+' : ''}${delta}`;
            }).join('  ')}
          </Text>
        </View>
      )}

      {/* Own hand */}
      <ScrollView className='game-hand-area' scrollX>
        <View className='game-hand-row'>
          {myHand.map((tile, i) => (
            <MahjongTile
              key={`${i}-${tile}`}
              tile={tile}
              size='large'
              isWild={tile === '5z'}
              selected={selectedTile === tile}
              onClick={() => handleTileTap(tile)}
            />
          ))}
        </View>
      </ScrollView>

      {/* Action bar */}
      <View className='game-actions'>
        {isClaimPhase && (
          <>
            {canPong && (
              <View className='game-act-btn pong' onClick={handlePong}>
                <Text>碰</Text>
              </View>
            )}
            {canKong && (
              <View className='game-act-btn kong' onClick={() => handleKong('kong_ming')}>
                <Text>杠</Text>
              </View>
            )}
            <View className='game-act-btn pass' onClick={handlePass}>
              <Text>过</Text>
            </View>
          </>
        )}

        {isMyTurn && !isTing && (
          <>
            <View className='game-act-btn kong' onClick={() => handleKong('kong_an')}>
              <Text>暗杠</Text>
            </View>
            <View className='game-act-btn kong' onClick={() => handleKong('kong_added')}>
              <Text>加杠</Text>
            </View>
            <View className='game-act-btn ting' onClick={handleTing}>
              <Text>听</Text>
            </View>
          </>
        )}

        {isMyTurn && isTing && (
          <View className='game-act-btn selfmo' onClick={handleSelfmo}>
            <Text>自摸</Text>
          </View>
        )}

        {!isMyTurn && !isClaimPhase && (
          <View className='game-act-hint'>
            <Text>等待其他玩家操作...</Text>
          </View>
        )}
      </View>

      {/* Match settlement overlay */}
      {matchResult && (
        <View className='game-overlay' onClick={() => {}}>
          <View className='game-settlement'>
            <Text className='game-settlement-title'>对局结束</Text>
            {matchResult.rankings.map((r, i) => (
              <View key={r.userId} className='game-rank-row'>
                <Text className='game-rank-num'>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '4'}
                </Text>
                <Text className='game-rank-name'>
                  {players[r.seat]?.nickname ?? '?'}
                </Text>
                <Text className={`game-rank-score ${r.score >= 0 ? 'win' : 'lose'}`}>
                  {r.score >= 0 ? '+' : ''}{r.score}
                </Text>
              </View>
            ))}
            <View
              className='game-settlement-btn'
              onClick={() => {
                reset();
                Taro.switchTab({ url: '/pages/hall/index' });
              }}
            >
              <Text>返回大厅</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
