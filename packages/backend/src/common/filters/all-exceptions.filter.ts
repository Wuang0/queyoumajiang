import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let code: number;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      message = typeof resp === 'string' ? resp : (resp as Record<string, unknown>).message as string ?? 'Error';
      code = status;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '服务器内部错误';
      code = 90001;
    }

    const traceId = (request.headers['x-trace-id'] as string) ?? uuidv4();

    // 打印异常堆栈到服务器日志
    if (exception instanceof Error) {
      this.logger.error(
        `[${traceId}] ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`[${traceId}] Unknown error: ${String(exception)}`);
    }

    response.status(status).json({
      code,
      message,
      data: null,
      traceId,
      ts: Date.now(),
    });
  }
}
