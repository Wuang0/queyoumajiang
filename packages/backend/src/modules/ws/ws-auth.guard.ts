import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

export interface WsAuthenticatedSocket extends Socket {
  userId: string;
  openid: string;
  token: string;
}

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();

    // 从 handshake query 提取 token
    const token = this.extractToken(client);

    if (!token) {
      throw new WsException({ code: 10010, message: '未登录' });
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; openid: string }>(
        token,
      );

      // 注入用户信息到 socket 对象
      const authSocket = client as WsAuthenticatedSocket;
      authSocket.userId = payload.sub;
      authSocket.openid = payload.openid;
      authSocket.token = token;

      return true;
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      throw new WsException({ code: 10010, message: 'Token无效或已过期' });
    }
  }

  private extractToken(client: Socket): string | undefined {
    // 从 query string 提取
    const token = client.handshake.query.token as string | undefined;
    if (token) return token;

    // 从 auth header 提取
    const auth = client.handshake.auth?.token as string | undefined;
    if (auth) return auth;

    return undefined;
  }
}
