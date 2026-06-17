# 雀友麻将后端服务

## 技术栈

- **框架**: NestJS 10
- **语言**: TypeScript 5.3
- **数据库**: MySQL 8 + Prisma ORM
- **缓存**: Redis 7
- **WebSocket**: Socket.IO 4
- **认证**: JWT
- **语音**: 腾讯云 TRTC

## 目录结构

```
src/
├── main.ts                    # 应用入口
├── app.module.ts              # 根模块
├── config/                    # 配置中心
├── common/                    # 通用模块
│   ├── filters/               # 全局异常过滤器
│   ├── interceptors/          # 拦截器（日志/格式化）
│   ├── pipes/                 # 管道（验证）
│   ├── guards/                # 守卫（鉴权）
│   └── decorators/            # 自定义装饰器
└── modules/                   # 业务模块
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 配置环境
cp .env.example .env

# 初始化数据库
pnpm prisma generate
pnpm prisma migrate dev

# 启动开发服务
pnpm start:dev
```

## 测试

```bash
# 单元测试
pnpm test

# 测试覆盖率
pnpm test:cov

# E2E 测试
pnpm test:e2e
```
