# 雀友麻将 · 开发文档

> 支持实时语音的四人联机麻将微信小程序

## 项目概述

雀友麻将是一款基于 **Taro 4 + React 19 + NestJS** 技术栈的微信小程序联机麻将产品。襄阳红中癞子规则，TRTC 实时语音，6 位数字房间号邀请开局，好友战绩 PK。

---

## 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Taro | 4.x | 跨平台框架 |
| React | 19.x | UI 渲染 |
| TypeScript | 5.x | 严格模式 |
| Zustand | 4.x | 状态管理 |
| TanStack Query | 5.x | 数据请求与管理 |
| TRTC SDK | wx | 实时语音 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| NestJS | 10.x | 应用框架 |
| Socket.IO | 4.x | 实时 WebSocket |
| Prisma | 5.8 | ORM |
| MySQL | 8.x | 持久化数据库 |
| Redis | 7.x | 热数据缓存 |
| Passport + JWT | - | 认证鉴权 |
| TRTC | 腾讯云 | 实时语音信令 |

---

## 项目结构

```
queyoumajiang/
│
├── package.json              # Monorepo 根配置
├── pnpm-workspace.yaml       # pnpm workspace
├── tsconfig.base.json        # 基础 TS 严格配置
├── .eslintrc.base.js         # ESLint 基础规则
├── .prettierrc               # 代码格式化
├── .gitignore
├── README.md                 # 本文件
│
├── 设计文档/
│   ├── PRD.md                # 产品需求文档
│   ├── ARCHITECTURE.md       # 系统架构设计（v0.1）
│   ├── DATABASE_SCHEMA.md    # 数据库设计
│   └── WEBSOCKET_PROTOCOL.md # 通信协议文档
│
├── packages/
│   ├── protocol/             # 共享协议定义
│   │   └── src/
│   │       ├── index.ts                  # 统一导出 + 工具函数
│   │       ├── types/
│   │       │   ├── common.ts             # 通用类型
│   │       │   ├── errorCodes.ts         # 错误码体系（40+ 个）
│   │       │   ├── api.ts                # HTTP API 类型
│   │       │   ├── websocket.ts          # WebSocket 协议类型
│   │       │   └── game.ts               # 游戏规则类型
│   │       └── __tests__/
│   │           └── protocol.spec.ts      # 27 个单元测试
│   │
│   ├── backend/              # NestJS 后端服务
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # 完整 8 表 Schema
│   │   │   └── seed.ts                   # 测试种子数据
│   │   ├── .env.example                  # 环境变量模板
│   │   └── src/
│   │       ├── main.ts                   # 应用入口
│   │       ├── app.module.ts             # 根模块（10 个业务模块）
│   │       ├── config/
│   │       │   ├── database.config.ts    # MySQL 配置
│   │       │   └── redis.config.ts       # Redis 配置
│   │       ├── common/
│   │       │   ├── filters/              # 全局异常过滤器
│   │       │   ├── interceptors/         # 日志 / 响应格式化
│   │       │   ├── pipes/                # ID 解析管道
│   │       │   ├── guards/               # JWT 认证守卫
│   │       │   └── decorators/           # @CurrentUser 装饰器
│   │       └── modules/
│   │           ├── prisma/               # Prisma 服务（全局）
│   │           ├── redis/                # Redis 服务 + Key 命名空间
│   │           ├── auth/                 # 微信登录 / JWT 签发
│   │           ├── user/                 # 用户资料 / 好友管理
│   │           ├── room/                 # 房间 CRUD + Redis 房号池
│   │           ├── ws/                   # Socket.IO Gateway
│   │           ├── game/                 # 麻将引擎（襄阳红中癞子）
│   │           ├── reconnect/            # 断线重连 + AI 托管
│   │           ├── voice/                # TRTC UserSig 签发
│   │           └── stats/                # 战绩统计 + 段位
│   │
│   └── frontend/             # Taro 小程序
│       ├── project.config.ts
│       ├── babel.config.js
│       ├── global.d.ts
│       └── src/
│           ├── app.tsx                   # 应用入口（QueryClientProvider）
│           ├── app.config.ts             # 6 页面路由 / TabBar
│           ├── app.css                   # 设计 Token CSS
│           ├── pages/
│           │   ├── login/                # 微信一键登录
│           │   ├── hall/                 # 创建/加入房间
│           │   ├── room/                 # 房间等待页
│           │   ├── game/                 # 对局页
│           │   ├── stats/                # 战绩页（完整实现）
│           │   └── me/                   # 个人中心
│           ├── components/
│           │   └── MahjongTile/          # 牌面组件
│           ├── store/
│           │   ├── auth.store.ts         # Zustand 认证状态
│           │   └── room.store.ts         # Zustand 房间状态
│           ├── services/
│           │   ├── api.ts                # 5 组 HTTP API
│           │   └── trtc.ts               # TRTC 服务封装
│           └── hooks/
│               ├── useWebSocket.ts       # WS 连接/心跳/消息路由
│               └── useVoice.ts           # 麦克风三态管理
│
└── mockups/                  # UI 高保真设计稿
    ├── index.html            # 9 屏聚合预览
    ├── 01-hall.html          # 大厅
    ├── 02-room.html          # 房间
    ├── 03-game.html          # 对局
    ├── 04-result.html        # 结算
    ├── 05-stats.html         # 战绩
    ├── 06-friends.html       # 好友
    ├── 07-me.html            # 我的
    ├── 08-login.html         # 登录
    ├── 09-errors.html        # 异常态
    └── _tokens.css           # 设计 Token
```

---

## 开发环境要求

| 工具 | 最低版本 |
|------|---------|
| Node.js | ≥ 20.0.0 |
| pnpm | ≥ 8.0.0 |
| MySQL | 8.x |
| Redis | 7.x |
| 微信开发者工具 | 最新稳定版 |

---

## 快速开始

### 1. 安装依赖

```bash
cd queyoumajiang
pnpm install
```

### 2. 环境配置

```bash
cp packages/backend/.env.example packages/backend/.env
```

编辑 `packages/backend/.env`，填入数据库和 Redis 连接信息：

```env
DATABASE_URL="mysql://用户名:密码@localhost:3306/queyou_mahjong"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
WECHAT_APPID=你的小程序AppID
WECHAT_SECRET=你的小程序Secret
TRTC_SDK_APPID=你的TRTC AppID
TRTC_SECRET_KEY=你的TRTC密钥
```

### 3. 数据库初始化

```bash
cd packages/backend
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed    # 写入 8 个测试用户
```

### 4. 启动开发服务

```bash
# 启动后端（端口 3000）
pnpm dev:backend

# 启动小程序前端（另一个终端）
pnpm dev:frontend
```

### 5. 微信开发者工具

1. 打开微信开发者工具
2. 导入项目 → 选择 `packages/frontend/dist` 目录
3. 填写 AppID（测试可用"测试号"）
4. 开发环境登录使用 `test_openid_001` 等测试账号

---

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装所有依赖 |
| `pnpm dev:backend` | 启动后端开发服务（热重载） |
| `pnpm dev:frontend` | 启动小程序开发编译（watch） |
| `pnpm build:protocol` | 编译共享协议包 |
| `pnpm build` | 编译全部 |
| `pnpm test` | 运行全部测试（93 个） |
| `pnpm test:backend` | 仅运行后端测试 |
| `pnpm test:protocol` | 仅运行协议测试 |
| `pnpm lint` | 代码检查 |
| `pnpm format` | 代码格式化 |

---

## 测试覆盖

| 模块 | 测试文件 | 用例数 | 覆盖范围 |
|------|---------|--------|---------|
| Protocol | `protocol.spec.ts` | 27 | 牌组/牌面/段位/错误码/得分 |
| Redis | `redis.service.spec.ts` | 6 | Key 命名/连接/基础操作 |
| Auth | `auth.service.spec.ts` | 6 | 登录/注册/Token/刷新/Session |
| User | `user.service.spec.ts` | 6 | 资料/好友/更新 |
| Room | `room.service.spec.ts` | 15 | 创建/加入/离开/准备/解散 |
| WS Gateway | `ws.gateway.spec.ts` | 7 | 连接/鉴权/心跳/房间事件 |
| Deck | `deck.spec.ts` | 6 | 牌墙/洗牌/摸牌/发牌 |
| Fan | `fan-calculator.spec.ts` | 6 | 番型/得分/听张 |
| Engine | `game.engine.spec.ts` | 16 | 开局/摸牌/出牌/碰/胡/听 |
| Trustee | `trustee.service.spec.ts` | 5 | 托管判定/踢出/动作 |
| Reconnect | `reconnect.service.spec.ts` | 10 | 断线记录/增量/快照/恢复 |
| Voice | `voice.service.spec.ts` | 3 | UserSig/权限校验 |
| Stats | `stats.service.spec.ts` | 7 | 总览/分页/趋势/段位 |
| **总计** | **13 个文件** | **93** | **全部通过** |

---

## 架构概览

```
微信小程序 (Taro)  ←→  HTTPS / WSS  ←→  Nginx / SLB
                                              ↓
                                   ┌──────────────────┐
                                   │   NestJS 集群      │
                                   │   Auth Room Game   │
                                   │   User WS Voice    │
                                   │   Stats Reconnect  │
                                   └─────┬──────┬─────┘
                                         ↓      ↓
                                    Redis    MySQL
                                    (状态)   (持久)
```

### 核心流程

```
用户打开小程序
  → wx.login → POST /auth/login → JWT
  → "创建房间" → SPOP 房号池 → Redis 房间状态
  → "邀请好友" → 微信卡片分享
  → 4 人聚齐准备 → WS 广播 → Game Engine 开局
  → 摸打碰杠胡 → WS 增量事件流 → 番型计算 → 结算
  → 断线 → 30s Resume → 增量补帧 / 全量快照
  → 终局 → 事务写库 → 战绩更新 → 段位变更
```

### 重连流程

```
心跳超时(15s) → 记录断线
  ├─ 0–30s: 客户端重连 → Resume{lastSeq} → 增量/全量恢复
  ├─ 30–60s: AI 托管自动出牌
  └─ 60s+: 从房间踢出
```

### 麦克风三态

```
自由麦 ──长按→ 点击麦(PTT) ──长按→ 闭麦 ──长按→ 自由麦
默认进房 = 自由麦
TRTC 失败 → toast 提示，不影响游戏
```

---

## 业务模块

### 用户系统
- 微信 code → openid 登录 / 静默注册
- JWT 双 Token（7d access + 30d refresh）
- Redis Session 缓存
- 好友双向写入 / 软删除

### 房间系统
- Redis 房号池（10 万个 6 位数字）
- 4 座位分配 / 准备状态 / 房主权限
- 30 分钟无人开局自动销毁
- 房间状态双轨（Redis 实时 + MySQL 归档）

### 麻将引擎
- 襄阳红中癞子规则（红中 5z 作百搭）
- 牌墙 Fisher-Yates 洗牌 / 136 张
- 碰杠胡优先级（胡 > 杠 > 碰）
- 番型计算（碰碰胡 / 七对 / 清一色 / 门清 / 杠开）
- 得分变化（自摸 / 点炮）

### WebSocket 协议
- 消息信封：`{v, type, clientSeq/serverSeq, ts, payload}`
- 双向 ACK 机制（3s 超时 × 3 次重发）
- 幂等：`(roomCode, userId, clientSeq)` 三元组
- 25+ 种事件类型
- 快照模式 + 增量模式
- Socket.IO namespace `/game`

### 战绩系统
- 段位 8 级（仅升不降）
- 14 天得分趋势
- 历史对局分页列表
- 段位变更轨迹

---

## API 接口

### HTTP REST

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 微信登录 |
| POST | `/api/auth/refresh` | 刷新 Token |
| GET | `/api/user/me` | 获取当前用户 |
| PATCH | `/api/user/me` | 更新资料 |
| GET | `/api/user/me/friends` | 好友列表 |
| POST | `/api/room/create` | 创建房间 |
| GET | `/api/room/:roomCode` | 查询房间 |
| GET | `/api/stats/me` | 战绩总览 |
| GET | `/api/stats/me/recent` | 历史对局 |
| GET | `/api/stats/me/trend` | 趋势数据 |
| POST | `/api/voice/sig` | 签发 UserSig |

### WebSocket 事件

| 方向 | 事件 | 说明 |
|------|------|------|
| C2S | `room.join` | 加入房间 |
| C2S | `room.leave` | 离开房间 |
| C2S | `room.ready` | 准备 / 取消 |
| C2S | `room.dissolve` | 房主解散 |
| C2S | `game.discard` | 出牌 |
| C2S | `game.pong` | 碰 |
| C2S | `game.kong` | 杠 |
| C2S | `game.hu` | 胡 |
| C2S | `game.ting` | 听 |
| C2S | `game.pass` | 过 |
| C2S | `voice.mute` | 切换麦克风 |
| C2S | `resume` | 重连 |
| C2S | `heartbeat` | 心跳 |
| S2C | `game.started` | 开局 |
| S2C | `tile.drawn` | 自家摸牌 |
| S2C | `tile.discarded` | 出牌广播 |
| S2C | `pong / kong / hu` | 操作广播 |
| S2C | `round_settled` | 单局结算 |
| S2C | `match_settled` | 终局结算 |
| S2C | `player.offline/resumed` | 断线/恢复 |

---

## 数据库

### ER 图

```
users ──< rooms        (host)
users ──< match_players (player)
users ──< friendships   (owner)
users ──< rank_history  (tracks)
users ──  user_stats    (1:1)
rooms ──< matches       (room)
matches ──< match_players (match)
```

### 表清单

| 表 | 说明 |
|----|------|
| `users` | 用户主表（openid/段位/统计） |
| `user_stats` | 用户战绩聚合（胜率/连败/番型统计） |
| `rooms` | 房间归档（仅开过局的保留） |
| `matches` | 单局记录（番型/胜负/得分） |
| `match_players` | 单局-玩家关系（每局 4 条） |
| `friendships` | 双向好友关系 |
| `rank_history` | 段位变更流水 |
| `audit_log` | 操作审计日志 |

### Redis Key 命名空间

| 命名空间 | 示例 | 用途 |
|---------|------|------|
| `auth:sess:*` | `auth:sess:10086` | 用户会话 |
| `user:online:*` | `user:online:10086` | 在线状态 |
| `room:meta:*` | `room:meta:123456` | 房间元信息 |
| `room:seats:*` | `room:seats:123456` | 座位映射 |
| `game:cur:*` | `game:cur:123456` | 当前局快照 |
| `game:oplog:*` | `game:oplog:123456` | 操作日志 |
| `sys:roomcode:pool` | - | 房号池 |

---

## 设计规范速查

| Token | 值 | 用途 |
|-------|---|------|
| `--brand-jade` | `#2B7A3D` | 主色 / CTA |
| `--ink-deep` | `#1F2933` | 一级文字 |
| `--cream` | `#F4EFE6` | 背景 |
| `--cinnabar` | `#C4382E` | 强调 / 红中 / 警告 |
| `--warning` | `#D9883B` | 警示 / 待处理 |

---

## 模块开发进度

- ✅ Step 1: 项目初始化
- ✅ Step 2: 数据库与 Prisma
- ✅ Step 3: 用户系统
- ✅ Step 4: 房间系统
- ✅ Step 5: WebSocket 系统
- ✅ Step 6: 麻将引擎
- ✅ Step 7: 断线重连
- ✅ Step 8: 微信小程序
- ✅ Step 9: TRTC 语音
- ✅ Step 10: 战绩系统

---

## 开发规范

- TypeScript 严格模式（17 条 strict 规则全开）
- ESLint + Prettier 统一代码风格
- 所有业务模块必须包含单元测试
- 所有表 `BIGINT UNSIGNED` 主键，字符串 ID 用 `toString()` 传递
- Redis 全场景 Key 使用工厂函数，禁止硬编码
- 软删除（`deleted_at`）+ 审计日志（`audit_log`）
- 错误码 5 位分层（1xxxx 系统 / 2xxxx 用户 / 3xxxx 房间 / 4xxxx 对局 / 5xxxx 语音 / 9xxxx 内部）

---

## 许可证

本项目仅供学习交流使用。
