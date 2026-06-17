import { useEffect, useState, useCallback } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import { useAuthStore } from '../../store/auth.store';
import { useRoomStore } from '../../store/room.store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { roomApi } from '../../services/api';
import './index.css';

export default function RoomPage() {
  const router = useRouter();
  const roomCode = (router.params.roomCode as string) ?? '';
  const { user, token } = useAuthStore();
  const {
    currentRoom,
    mySeat,
    isHost,
    isAllReady,
    readyPlayerIds,
    setRoom,
    setMySeat,
    clearRoom,
    updateSeat,
    setPlayerReady,
  } = useRoomStore();

  const [amReady, setAmReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // WS 事件处理
  const handlers = {
    'player.joined': (data: Record<string, unknown>) => {
      updateSeat(data.seat as number, { userId: data.userId as string, nickname: data.nickname as string });
    },
    'player.left': (data: Record<string, unknown>) => {
      const room = useRoomStore.getState().currentRoom;
      if (!room) return;
      const seat = room.seats.find((s) => s.userId === (data.userId as string));
      if (seat) {
        updateSeat(seat.seat, { userId: null, nickname: null });
        setPlayerReady(data.userId as string, false);
      }
    },
    'player.ready': (data: Record<string, unknown>) => {
      setPlayerReady(data.userId as string, true);
    },
    'player.unready': (data: Record<string, unknown>) => {
      setPlayerReady(data.userId as string, false);
    },
    'game.started': (data: Record<string, unknown>) => {
      // 保存初始游戏状态供游戏页使用
      try {
        sessionStorage.setItem('queyou_game_init', JSON.stringify({
          roomCode,
          mySeat,
          data,
          ts: Date.now(),
        }));
      } catch { /* ignore */ }
      Taro.redirectTo({ url: `/pages/game/index?roomCode=${roomCode}&mySeat=${mySeat}` });
    },
    'hand.dealt': (data: Record<string, unknown>) => {
      // 也捕获手牌数据
      try {
        const existing = sessionStorage.getItem('queyou_game_init');
        if (existing) {
          const parsed = JSON.parse(existing) as Record<string, unknown>;
          parsed.handData = data;
          sessionStorage.setItem('queyou_game_init', JSON.stringify(parsed));
        }
      } catch { /* ignore */ }
    },
  };

  const { connect, send } = useWebSocket(handlers);

  // 初始化
  useEffect(() => {
    if (!token || !roomCode) return;

    // 连接 WS 并加入房间
    connect();
    send({ type: 'room.join', payload: { roomCode, nickname: user?.nickname } });

    // 获取房间信息
    roomApi
      .getInfo(roomCode)
      .then((info) => {
        setRoom({
          roomCode: info.roomCode,
          status: info.status,
          rule: info.rule,
          totalRounds: info.totalRounds,
          baseScore: info.baseScore,
          hostId: info.hostId,
          seats: info.seats.map((s) => ({
            ...s,
            isReady: false,
            isOnline: true,
          })),
        });
        // 修正 isHost
        useRoomStore.setState({ isHost: info.hostId === user?.id });

        // 找到自己的座位
        const mySeatIdx = info.seats.find((s) => s.userId === user?.id)?.seat;
        if (mySeatIdx !== undefined) {
          setMySeat(mySeatIdx);
        }
      })
      .catch((e) => {
        console.error('获取房间信息失败', e);
        Taro.showToast({ title: '房间不存在', icon: 'none' });
        setTimeout(() => Taro.switchTab({ url: '/pages/hall/index' }), 1000);
      });

    return () => {
      clearRoom();
    };
  }, [roomCode, token]);

  const handleReady = () => {
    const next = !amReady;
    setAmReady(next);
    send({
      type: next ? 'room.ready' : 'room.unready',
      payload: {},
    });

    if (user) {
      setPlayerReady(user.id, next);
    }
  };

  const handleStart = () => {
    send({ type: 'room.start', payload: {} });
  };

  const handleLeave = () => {
    send({ type: 'room.leave', payload: {} });
    clearRoom();
    Taro.switchTab({ url: '/pages/hall/index' });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {
      Taro.setClipboardData({ data: roomCode });
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const seatLabels = ['东', '南', '西', '北'];

  return (
    <View className='room-page'>
      {/* Header */}
      <View className='room-header'>
        <View className='room-back' onClick={handleLeave}>
          <Text className='room-back-arrow'>←</Text>
        </View>
        <View className='room-code-area' onClick={handleCopy}>
          <Text className='room-code-label'>房间号</Text>
          <Text className='room-code-value'>{roomCode}</Text>
          <Text className='room-copy-btn'>{copied ? '✓ 已复制' : '复制'}</Text>
        </View>
        <View style={{ width: '60px' }} />
      </View>

      {/* Rule info */}
      <View className='room-rule'>
        <Text className='room-rule-text'>
          {currentRoom?.rule === 'xiangyang_redzhong' ? '襄阳红中癞子' : '推倒胡'}
          {' · '}{currentRoom?.totalRounds ?? 8}局 · 底分{currentRoom?.baseScore ?? 1}
        </Text>
      </View>

      {/* Seat grid */}
      <View className='room-grid'>
        {[0, 1, 2, 3].map((seat) => {
          const s = currentRoom?.seats[seat];
          const isEmpty = !s?.userId;
          const isMe = s?.userId === user?.id;
          const isReady = s?.userId && readyPlayerIds.includes(s.userId);
          const isHostSeat = s?.userId === currentRoom?.hostId;

          return (
            <View
              key={seat}
              className={`room-seat ${isEmpty ? 'empty' : ''} ${isMe ? 'me' : ''} ${isReady ? 'ready' : ''}`}
            >
              {isEmpty ? (
                <View className='room-seat-empty'>
                  <View className='room-seat-empty-icon'>+</View>
                  <Text className='room-seat-empty-text'>等待加入</Text>
                </View>
              ) : (
                <View className='room-seat-player'>
                  <View className='room-seat-avatar'>
                    {s.nickname?.charAt(0) ?? '?'}
                  </View>
                  <Text className='room-seat-nickname'>
                    {isMe ? '我' : (s.nickname ?? '?')}
                  </Text>
                  <Text className='room-seat-label'>{seatLabels[seat]}</Text>
                  {isHostSeat && <Text className='room-seat-host'>房主</Text>}
                  <Text className={`room-seat-status ${isReady ? 'green' : 'muted'}`}>
                    {isReady ? '已准备' : '未准备'}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Waiting tip */}
      {!isAllReady && (
        <View className='room-tip'>
          <Text className='room-tip-text'>
            {currentRoom
              ? `等待玩家加入... (${currentRoom.seats.filter((s) => s.userId).length}/4)`
              : '加载中...'}
          </Text>
        </View>
      )}

      {isAllReady && (
        <View className='room-tip ready'>
          <Text className='room-tip-text'>全部就绪，等待房主开始游戏！</Text>
        </View>
      )}

      {/* Action bar */}
      <View className='room-actions'>
        <View
          className={`room-btn ${amReady ? 'active' : ''}`}
          onClick={handleReady}
        >
          <Text>{amReady ? '取消准备' : '准备'}</Text>
        </View>

        {isHost && (
          <View
            className={`room-btn start ${isAllReady ? '' : 'disabled'}`}
            onClick={isAllReady ? handleStart : undefined}
          >
            <Text>开始游戏</Text>
          </View>
        )}

        <View className='room-btn leave' onClick={handleLeave}>
          <Text>离开房间</Text>
        </View>
      </View>
    </View>
  );
}
