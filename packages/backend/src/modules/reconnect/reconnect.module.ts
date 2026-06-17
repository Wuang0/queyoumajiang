import { Module } from '@nestjs/common';
import { ReconnectService } from './reconnect.service';
import { TrusteeService } from './trustee.service';

@Module({
  providers: [ReconnectService, TrusteeService],
  exports: [ReconnectService, TrusteeService],
})
export class ReconnectModule {}
