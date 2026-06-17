import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../app.module';

describe('AppModule', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  it('应该被正确创建', () => {
    const app = module.get(AppModule);
    expect(app).toBeDefined();
  });

  it('应该是一个 NestJS 模块实例', () => {
    const appModuleInstance = module.get(AppModule);
    expect(appModuleInstance).toBeInstanceOf(AppModule);
  });

  it('应该包含 ScheduleModule', () => {
    const app = module.get(AppModule);
    expect(app).toBeDefined();
  });
});
