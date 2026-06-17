import { Module } from '@nestjs/common';
import { GameService } from './game.service';
import { RoomModule } from '../room/room.module';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RedisModule, RoomModule, PrismaModule],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
