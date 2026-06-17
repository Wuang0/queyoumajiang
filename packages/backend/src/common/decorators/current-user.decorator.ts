import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * 从请求中提取当前用户信息
 * Step 3 实现完整用户注入
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return (request as unknown as Record<string, unknown>).user ?? null;
  },
);
