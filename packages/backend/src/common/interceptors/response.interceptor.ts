import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

interface WrappedResponse<T> {
  code: number;
  message: string;
  data: T;
  traceId: string;
  ts: number;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, WrappedResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<WrappedResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const traceId =
      (request.headers['x-trace-id'] as string) ?? uuidv4();

    // 设置 traceId 到响应头
    const response = ctx.getResponse<Response>();
    response.setHeader('X-Trace-Id', traceId);

    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'OK',
        data,
        traceId,
        ts: Date.now(),
      })),
    );
  }
}
