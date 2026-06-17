import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsGateway } from './ws.gateway';
import { WsAuthGuard } from './ws-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { RoomModule } from '../room/room.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [
    AuthModule,
    RoomModule,
    GameModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [WsGateway, WsAuthGuard],
  exports: [WsGateway],
})
export class WsModule {}
