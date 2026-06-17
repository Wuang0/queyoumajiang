import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  CanActivate,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('未登录');
    }

    // 调用 Passport JWT 验证
    const result = (await super.canActivate(context)) as boolean;
    return result;
  }

  override handleRequest<TPayload>(err: Error | null, user: TPayload): TPayload {
    if (err || !user) {
      throw new UnauthorizedException('Token已过期或无效');
    }
    return user;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const auth = request.headers.authorization;
    if (!auth) return undefined;
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return undefined;
    return parts[1];
  }
}
