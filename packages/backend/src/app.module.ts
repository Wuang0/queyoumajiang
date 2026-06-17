import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './modules/redis/redis.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { RoomModule } from './modules/room/room.module';
import { WsModule } from './modules/ws/ws.module';
import { GameModule } from './modules/game/game.module';
import { ReconnectModule } from './modules/reconnect/reconnect.module';
import { StatsModule } from './modules/stats/stats.module';

// VoiceModule 已移除：H5 朋友局使用微信群语音替代

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    RedisModule,
    PrismaModule,
    AuthModule,
    UserModule,
    RoomModule,
    WsModule,
    GameModule,
    ReconnectModule,
    StatsModule,
  ],
})
export class AppModule {}
