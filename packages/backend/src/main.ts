import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 全局前缀
  app.setGlobalPrefix('api');

  // CORS 配置（H5 网页需要跨域访问，始终开启）
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`🚀 雀友麻将后端服务启动: http://${host}:${port}/api`);
}

void bootstrap();
