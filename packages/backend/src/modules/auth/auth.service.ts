import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import type { JwtPayload } from './strategies/jwt.strategy';
import type { LoginDto } from './dto/login.dto';
import type { RefreshDto } from './dto/refresh.dto';

export interface TokenPair {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  tokenPair: TokenPair;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  rankLevel: number;
  rankScore: number;
  totalMatches: number;
  totalWins: number;
  isNewUser: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  /**
   * 登录（统一入口）
   * - 有 guestId → H5 朋友局登录（昵称必填）
   * - 有 code → 微信登录
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    if (dto.guestId) {
      return this.guestLogin(dto.guestId, dto.nickname);
    }
    if (dto.code) {
      return this.wechatLogin(dto);
    }
    throw new BadRequestException('请提供 guestId（H5登录）或 code（微信登录）');
  }

  /**
   * H5 朋友局登录：按 guestId 查找或创建用户
   */
  private async guestLogin(
    guestId: string,
    nickname?: string,
  ): Promise<AuthResult> {
    const displayName = nickname ?? `雀友${Math.floor(1000 + Math.random() * 9000)}`;

    let user = await this.prisma.user.findUnique({ where: { guestId } });
    let isNewUser = false;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          guestId,
          nickname: displayName,
        },
      });
      await this.prisma.userStats.create({
        data: { userId: user.id },
      });
      isNewUser = true;
      this.logger.log(`New guest user: ${guestId} → ${displayName}`);
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const tokenPair = this.generateTokens(user.id.toString(), guestId);

    // 缓存 session
    await this.redis.set(
      this.redis.keys.auth.session(user.id.toString()),
      JSON.stringify({ token: tokenPair.token, guestId, ts: Date.now() }),
      7 * 24 * 3600,
    );

    return {
      tokenPair,
      userId: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      rankLevel: user.rankLevel,
      rankScore: user.rankScore,
      totalMatches: user.totalMatches,
      totalWins: user.totalWins,
      isNewUser,
    };
  }

  /**
   * 微信登录（保留）
   */
  private async wechatLogin(dto: LoginDto): Promise<AuthResult> {
    const openid = await this.exchangeCodeForOpenid(dto.code!);

    let user = await this.prisma.user.findUnique({ where: { openid } });
    let isNewUser = false;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          openid,
          nickname:
            dto.nickname ??
            `雀友${Math.floor(1000 + Math.random() * 9000)}`,
          avatarUrl: dto.avatarUrl ?? null,
        },
      });
      await this.prisma.userStats.create({
        data: { userId: user.id },
      });
      isNewUser = true;
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    const tokenPair = this.generateTokens(user.id.toString(), openid);

    await this.redis.set(
      this.redis.keys.auth.session(user.id.toString()),
      JSON.stringify({ token: tokenPair.token, openid, ts: Date.now() }),
      7 * 24 * 3600,
    );

    return {
      tokenPair,
      userId: user.id.toString(),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      rankLevel: user.rankLevel,
      rankScore: user.rankScore,
      totalMatches: user.totalMatches,
      totalWins: user.totalWins,
      isNewUser,
    };
  }

  /**
   * 刷新 Token
   */
  async refreshToken(dto: RefreshDto): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(dto.refreshToken, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const session = await this.redis.get(
      this.redis.keys.auth.session(payload.sub),
    );
    if (!session) {
      throw new UnauthorizedException('Session revoked');
    }

    return this.generateTokens(payload.sub, payload.openid ?? payload.guestId ?? '');
  }

  /**
   * 登出
   */
  async logout(userId: string): Promise<void> {
    await this.redis.del(this.redis.keys.auth.session(userId));
  }

  /**
   * 验证 Token
   */
  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  /**
   * 微信 code → openid
   */
  private async exchangeCodeForOpenid(code: string): Promise<string> {
    if (code.startsWith('test_openid_')) {
      this.logger.debug(`Dev mode: using test code → ${code}`);
      return code;
    }

    const appId = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;

    if (!appId || !secret) {
      this.logger.warn('WECHAT_APPID/SECRET not set, falling back to test mode');
      return code;
    }

    try {
      const axios = await import('axios');
      const { data } = await axios.default.get(
        'https://api.weixin.qq.com/sns/jscode2session',
        {
          params: {
            appid: appId,
            secret,
            js_code: code,
            grant_type: 'authorization_code',
          },
        },
      );

      if ((data as { errcode?: number }).errcode) {
        throw new UnauthorizedException(
          `微信登录失败: ${(data as { errmsg?: string }).errmsg ?? 'unknown'}`,
        );
      }

      return (data as { openid: string }).openid;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error('WeChat code2session failed', err);
      throw new UnauthorizedException('微信登录服务异常');
    }
  }

  private generateTokens(
    userId: string,
    identifier: string,
  ): TokenPair {
    const payload: JwtPayload = { sub: userId }; // openid 仅微信登录有值
    if (identifier.startsWith('test_openid_')) {
      payload.openid = identifier;
    } else {
      payload.guestId = identifier;
    }

    const expiresIn = 7 * 24 * 3600;
    const refreshExpiresIn = 30 * 24 * 3600;

    const token = this.jwtService.sign(payload, { expiresIn });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: refreshExpiresIn,
    });

    return { token, refreshToken, expiresIn };
  }
}
