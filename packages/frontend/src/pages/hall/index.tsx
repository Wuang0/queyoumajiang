import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { useQuery } from '@tanstack/react-query';
import Taro from '@tarojs/taro';
import { roomApi, statsApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import { useRoomStore } from '../../store/room.store';
import './index.css';

export default function HallPage() {
  const user = useAuthStore((s) => s.user);
  const [showJoin, setShowJoin] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  const { data: recent } = useQuery({
    queryKey: ['recentMatches'],
    queryFn: () => statsApi.getRecent(5),
    enabled: !!user,
  });

  const handleCreate = async () => {
    try {
      const data = await roomApi.create({
        rule: 'xiangyang_redzhong',
        totalRounds: 8,
        baseScore: 1,
        requestId: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      });

      Taro.navigateTo({ url: `/pages/room/index?roomCode=${data.roomCode}` });
    } catch (e) {
      Taro.showToast({ title: '创建失败', icon: 'none' });
    }
  };

  const handleJoin = async () => {
    if (!/^\d{6}$/.test(roomCode)) {
      Taro.showToast({ title: '请输入 6 位房间号', icon: 'none' });
      return;
    }

    try {
      await roomApi.getInfo(roomCode);
      Taro.navigateTo({ url: `/pages/room/index?roomCode=${roomCode}` });
    } catch (e) {
      Taro.showToast({ title: '房间不存在', icon: 'none' });
    }
  };

  return (
    <View className="hall-page">
      {/* Header */}
      <View className="hall-header">
        <View className="hall-brand">雀友麻将</View>
        <View className="hall-user">
          <Text>{user?.nickname ?? '雀友'}</Text>
          <Text className="hall-rank">雀友·{user?.rankLevel ?? 1}段</Text>
        </View>
      </View>

      {/* CTA */}
      <View className="hall-cta">
        <View className="hall-card create" onClick={handleCreate}>
          <Text className="hall-card-title">创建房间</Text>
          <Text className="hall-card-sub">红中癞子 · 8 局</Text>
        </View>

        <View className="hall-card join" onClick={() => setShowJoin(true)}>
          <Text className="hall-card-title">加入房间</Text>
          <Text className="hall-card-sub">输入 6 位房号</Text>
        </View>
      </View>

      {/* Join dialog (inline) */}
      {showJoin && (
        <View className="hall-join-mask" onClick={() => setShowJoin(false)}>
          <View className="hall-join-dialog" onClick={(e) => e.stopPropagation()}>
            <Text className="hall-join-title">输入房间号</Text>
            <Input
              className="hall-join-input"
              value={roomCode}
              onInput={(e) => setRoomCode(e.detail.value)}
              maxlength={6}
              type="number"
              placeholder="6 位数字"
            />
            <View className="hall-join-btn" onClick={handleJoin}>加入</View>
          </View>
        </View>
      )}

      {/* Recent games */}
      <View className="hall-recent">
        <Text className="hall-recent-title">最近对局</Text>
        {recent?.list && recent.list.length > 0 ? (
          (recent.list as Array<Record<string, unknown>>).slice(0, 5).map((m, i) => (
            <View className="hall-recent-row" key={i}>
              <Text className="hall-recent-score" style={{ color: (m.myScoreChange as number) > 0 ? '#2B7A3D' : '#C4382E' }}>
                {(m.myScoreChange as number) > 0 ? '+' : ''}{m.myScoreChange as number}
              </Text>
              <Text className="hall-recent-rule">{(m.rule as string) ?? '?'} · {(m.roundNo as number) ?? '?'}局</Text>
            </View>
          ))
        ) : (
          <Text className="hall-recent-empty">暂无对局记录</Text>
        )}
      </View>
    </View>
  );
}
