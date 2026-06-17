import { useQuery } from '@tanstack/react-query';
import { View, Text, ScrollView } from '@tarojs/components';
import { statsApi } from '../../services/api';
import { useAuthStore } from '../../store/auth.store';
import './index.css';

export default function StatsPage() {
  const user = useAuthStore((s) => s.user);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['myStats'],
    queryFn: () => statsApi.getMyStats(),
    enabled: !!user,
  });

  const { data: recent } = useQuery({
    queryKey: ['recentMatches'],
    queryFn: () => statsApi.getRecent(20),
    enabled: !!user,
  });

  if (isLoading) {
    return <View className="stats-loading"><Text>加载中...</Text></View>;
  }

  return (
    <ScrollView className="stats-page" scrollY>
      {/* 段位卡 */}
      <View className="stats-rank-card">
        <View className="stats-rank-badge">
          {stats?.rank.level ?? user?.rankLevel ?? 1}
        </View>
        <View className="stats-rank-info">
          <Text className="stats-rank-name">{stats?.rank.name ?? `雀友·${user?.rankLevel ?? 1}段`}</Text>
          <Text className="stats-rank-score">累计 +{user?.rankScore ?? 0} 分</Text>
          <View className="stats-rank-bar">
            <View className="stats-rank-bar-fill" style={{ width: '44%' }} />
          </View>
          <Text className="stats-rank-bar-label">
            距离下一段位还差 {stats ? stats.rank.nextLevelScore - stats.rank.score : '--'} 分
          </Text>
        </View>
      </View>

      {/* 本周数据 */}
      <View className="stats-row">
        <View className="stats-cell">
          <Text className="stats-cell-val">{stats?.thisWeek.matches ?? 0}</Text>
          <Text className="stats-cell-label">本周局数</Text>
        </View>
        <View className="stats-cell">
          <Text className="stats-cell-val win">{stats ? Math.round(stats.thisWeek.winRate * 100) : 0}%</Text>
          <Text className="stats-cell-label">本周胜率</Text>
        </View>
        <View className="stats-cell">
          <Text className="stats-cell-val">
            {stats?.thisWeek.scoreSum >= 0 ? '+' : ''}{stats?.thisWeek.scoreSum ?? 0}
          </Text>
          <Text className="stats-cell-label">本周净胜</Text>
        </View>
      </View>

      {/* 历史数据 */}
      <View className="stats-row">
        <View className="stats-cell">
          <Text className="stats-cell-val">{stats?.totalMatches ?? 0}</Text>
          <Text className="stats-cell-label">总局数</Text>
        </View>
        <View className="stats-cell">
          <Text className="stats-cell-val">{stats?.maxSingleScore ?? 0}</Text>
          <Text className="stats-cell-label">最大单局</Text>
        </View>
        <View className="stats-cell">
          <Text className="stats-cell-val">{stats?.longestWinStreak ?? 0}</Text>
          <Text className="stats-cell-label">最长连胜</Text>
        </View>
      </View>

      {/* 最近对局 */}
      <View className="stats-recent">
        <Text className="stats-section-title">最近对局</Text>
        {recent?.list.map((m: Record<string, unknown>) => (
          <View className="stats-match-row" key={m.matchId as string}>
            <Text className="stats-match-score" style={{ color: (m.myScoreChange as number) > 0 ? '#2B7A3D' : '#C4382E' }}>
              {(m.myScoreChange as number) > 0 ? '+' : ''}{m.myScoreChange as number}
            </Text>
            <View className="stats-match-info">
              <Text className="stats-match-rule">{m.rule as string} · {m.roundNo as number}局</Text>
              <Text className="stats-match-time">{m.durationSec as number}分钟</Text>
            </View>
          </View>
        ))}
        {(!recent?.list || recent.list.length === 0) && (
          <Text className="stats-empty">暂无对局记录</Text>
        )}
      </View>
    </ScrollView>
  );
}
