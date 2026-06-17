import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** 个人战绩总览 */
  async getMyStats(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const stats = await this.prisma.userStats.findUnique({
      where: { userId: BigInt(userId) },
    });

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 86400000);
    const monthStart = new Date(now.getTime() - 30 * 86400000);

    const [weekStats, monthStats] = await Promise.all([
      this.getPeriodStats(userId, weekStart),
      this.getPeriodStats(userId, monthStart),
    ]);

    return {
      rank: {
        level: user.rankLevel,
        name: this.rankName(user.rankLevel),
        score: user.rankScore,
        nextLevelScore: this.nextLevelScore(user.rankLevel),
      },
      totalMatches: stats?.totalMatches ?? 0,
      totalWins: stats?.totalWins ?? 0,
      totalLosses: stats?.totalLosses ?? 0,
      winRate: stats ? (stats.totalWins / Math.max(1, stats.totalMatches)) : 0,
      totalScore: stats?.totalScore ?? 0,
      maxSingleScore: stats?.maxSingleScore ?? 0,
      longestWinStreak: stats?.longestWinStreak ?? 0,
      selfMoCount: stats?.selfMoCount ?? 0,
      jiePaoCount: stats?.jiePaoCount ?? 0,
      dianPaoCount: stats?.dianPaoCount ?? 0,
      thisWeek: weekStats,
      thisMonth: monthStats,
    };
  }

  /** 历史对局列表 */
  async getRecent(userId: string, limit: number = 20, before?: number) {
    const whereBefore = before ? { lt: new Date(before) } : undefined;

    const records = await this.prisma.matchPlayer.findMany({
      where: {
        userId: BigInt(userId),
        ...(whereBefore && { createdAt: whereBefore }),
      },
      include: {
        match: {
          include: {
            players: { include: { user: { select: { id: true, nickname: true, avatarUrl: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = records.length > limit;
    const list = records.slice(0, limit);
    const nextCursor = hasMore
      ? records[limit - 1]?.createdAt.getTime() ?? null
      : null;

    return {
      list: list.map((mp) => ({
        matchId: mp.matchId.toString(),
        roomCode: 'roomCode_placeholder',
        roundNo: mp.match.roundNo,
        rule: 'xiangyang_redzhong',
        totalRounds: 8,
        myScoreChange: mp.scoreChange,
        winnerId: mp.match.winnerId?.toString() ?? null,
        winType: mp.match.winType ?? null,
        fans: mp.match.fans,
        opponents: mp.match.players.map((p) => ({
          userId: p.userId.toString(),
          nickname: p.user.nickname,
          avatarUrl: p.user.avatarUrl ?? '',
          seat: p.seat,
          scoreChange: p.scoreChange,
          isWinner: p.userId === mp.match.winnerId,
        })),
        startedAt: mp.match.startedAt?.getTime() ?? 0,
        endedAt: mp.match.endedAt?.getTime() ?? 0,
        durationSec: Math.round(
          ((mp.match.endedAt?.getTime() ?? 0) - (mp.match.startedAt?.getTime() ?? 0)) / 1000,
        ),
      })),
      hasMore,
      nextCursor,
    };
  }

  /** 趋势数据 */
  async getTrend(userId: string, days: number = 14) {
    const cutoff = new Date(Date.now() - days * 86400000);

    const records = await this.prisma.matchPlayer.findMany({
      where: { userId: BigInt(userId), createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'asc' },
    });

    const byDate: Record<string, { matches: number; scoreSum: number }> = {};
    for (const r of records) {
      const date = r.createdAt.toISOString().slice(0, 10);
      byDate[date] ??= { matches: 0, scoreSum: 0 };
      byDate[date]!.matches++;
      byDate[date]!.scoreSum += r.scoreChange;
    }

    let cumulative = 0;
    const points = Object.entries(byDate).map(([date, d]) => {
      cumulative += d.scoreSum;
      return { date, matches: d.matches, scoreSum: d.scoreSum, cumulativeScore: cumulative };
    });

    return { days, points };
  }

  /** 段位变更轨迹 */
  async getRankHistory(userId: string) {
    const history = await this.prisma.rankHistory.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      list: history.map((h) => ({
        rankBefore: h.rankBefore,
        rankAfter: h.rankAfter,
        scoreBefore: h.scoreBefore,
        scoreAfter: h.scoreAfter,
        scoreDelta: h.scoreDelta,
        matchId: h.matchId?.toString(),
        reason: h.reason,
        createdAt: h.createdAt.getTime(),
      })),
    };
  }

  // ==================== Private ====================

  private async getPeriodStats(userId: string, since: Date) {
    const agg = await this.prisma.matchPlayer.aggregate({
      where: { userId: BigInt(userId), createdAt: { gte: since } },
      _count: true,
      _sum: { scoreChange: true },
    });

    const wins = await this.prisma.matchPlayer.count({
      where: { userId: BigInt(userId), scoreChange: { gt: 0 }, createdAt: { gte: since } },
    });

    const total = agg._count ?? 0;

    return {
      matches: total,
      wins,
      scoreSum: agg._sum.scoreChange ?? 0,
      winRate: total > 0 ? wins / total : 0,
      largestWin: 0,
    };
  }

  private rankName(level: number): string {
    if (level <= 3) return `雀友 · ${level}段`;
    if (level <= 6) return `麻雀师 · ${level - 3}段`;
    if (level === 7) return '雀圣';
    return '雀神';
  }

  private nextLevelScore(level: number): number {
    const t: Record<number, number> = { 1: 50, 2: 200, 3: 500, 4: 1000, 5: 2000, 6: 4000, 7: 8000 };
    return t[level] ?? Infinity;
  }
}
