import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface VoiceSigResult {
  sdkAppId: number;
  userId: string;
  userSig: string;
  trtcRoomId: number;
  expireAt: number;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * 签发 TRTC UserSig
   * 开发环境：使用 HMAC-SHA256 生成简易签名
   * 生产环境：使用 trtc-sdk 的 TLSSigAPIv2
   */
  async generateUserSig(
    userId: string,
    roomCode: string,
  ): Promise<VoiceSigResult> {
    // 检查用户是否在房间中
    const onlineData = await this.redis.get(
      this.redis.keys.online.user(userId),
    );
    if (!onlineData) {
      throw new BadRequestException('用户不在任何房间');
    }

    const parsed = JSON.parse(onlineData) as { currentRoom?: string };
    if (parsed.currentRoom !== roomCode) {
      throw new BadRequestException('用户不在该房间');
    }

    const sdkAppId = parseInt(process.env.TRTC_SDK_APPID ?? '1400000000', 10);
    const secretKey = process.env.TRTC_SECRET_KEY ?? 'dev-secret';

    // 简化签名（开发环境）
    const expireTime = Math.floor(Date.now() / 1000) + 86400;
    const sig = this.devGenerateSig(sdkAppId, userId, expireTime, secretKey);

    return {
      sdkAppId,
      userId,
      userSig: sig,
      trtcRoomId: parseInt(roomCode, 10),
      expireAt: expireTime * 1000,
    };
  }

  /**
   * 开发环境签名（HMAC-SHA256 简化版）
   * 生产环境需替换为 TLSSigAPIv2
   */
  private devGenerateSig(
    sdkAppId: number,
    userId: string,
    expire: number,
    secret: string,
  ): string {
    // 使用 Node.js crypto 生成 HMAC-SHA256
    const crypto = require('crypto') as typeof import('crypto');
    const content = `${sdkAppId}:${userId}:${expire}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(content);
    const signature = hmac.digest('base64');
    // 简化格式
    return Buffer.from(JSON.stringify({
      sdkAppId,
      userId,
      expire,
      signature,
    })).toString('base64');
  }
}
