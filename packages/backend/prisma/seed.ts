/**
 * 数据库种子脚本
 * 初始化测试用户 + 段位基准数据
 *
 * 运行: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 开始播种种子数据...');

  // 创建测试用户
  const testUsers = [
    { openid: 'test_openid_001', nickname: '王哥', rankLevel: 3, rankScore: 218 },
    { openid: 'test_openid_002', nickname: '小李', rankLevel: 1, rankScore: 42 },
    { openid: 'test_openid_003', nickname: '张姐', rankLevel: 2, rankScore: 96 },
    { openid: 'test_openid_004', nickname: '李姐', rankLevel: 1, rankScore: 8 },
    { openid: 'test_openid_005', nickname: '陈总', rankLevel: 4, rankScore: 1200 },
    { openid: 'test_openid_006', nickname: '刘哥', rankLevel: 1, rankScore: 0 },
    { openid: 'test_openid_007', nickname: '周姐', rankLevel: 5, rankScore: 1850 },
    { openid: 'test_openid_008', nickname: '黄哥', rankLevel: 2, rankScore: 155 },
  ];

  for (const user of testUsers) {
    const created = await prisma.user.upsert({
      where: { openid: user.openid },
      update: {},
      create: {
        openid: user.openid,
        nickname: user.nickname,
        unionid: `union_${user.openid}`,
        avatarUrl: null,
        rankLevel: user.rankLevel,
        rankScore: user.rankScore,
      },
    });

    // 创建对应的 user_stats
    await prisma.userStats.upsert({
      where: { userId: created.id },
      update: {},
      create: {
        userId: created.id,
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
      },
    });

    console.log(`  用户: ${user.nickname} (ID: ${created.id})`);
  }

  // 创建测试好友关系
  const users = await prisma.user.findMany({ take: 5 });
  for (let i = 0; i < users.length; i++) {
    for (let j = i + 1; j < users.length; j++) {
      const a = users[i]!;
      const b = users[j]!;
      await prisma.friendship.upsert({
        where: { userId_friendId: { userId: a.id, friendId: b.id } },
        update: {},
        create: { userId: a.id, friendId: b.id, source: 'test' },
      });
      await prisma.friendship.upsert({
        where: { userId_friendId: { userId: b.id, friendId: a.id } },
        update: {},
        create: { userId: b.id, friendId: a.id, source: 'test' },
      });
    }
  }

  console.log(`✅ 种子数据播种完成 (${users.length} 用户 + 好友关系)`);
}

main()
  .catch((e) => {
    console.error('❌ 种子数据失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
