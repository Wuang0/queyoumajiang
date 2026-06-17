import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ParseBigIntPipe implements PipeTransform<string, bigint | undefined> {
  transform(value?: string): bigint | undefined {
    if (!value) return undefined;

    // 验证只包含数字
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('ID必须为数字字符串');
    }

    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException('ID格式无效');
    }
  }
}
