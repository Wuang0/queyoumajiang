import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  openid?: string; // 微信 openid（小程序登录）
  guestId?: string; // 设备 ID（H5 朋友局登录）
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret =
      process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    return {
      sub: payload.sub,
      openid: payload.openid,
      guestId: payload.guestId,
    };
  }
}
