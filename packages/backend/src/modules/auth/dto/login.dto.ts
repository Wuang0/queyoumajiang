import { IsString, IsOptional, Length } from 'class-validator';

export class LoginDto {
  /**
   * 微信登录 code（可选，H5 版不使用）
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  code?: string;

  /**
   * 设备 ID（H5 朋友局登录，UUID）
   */
  @IsOptional()
  @IsString()
  @Length(1, 128)
  guestId?: string;

  /**
   * 昵称（H5 朋友局登录必填，微信登录可选）
   */
  @IsOptional()
  @IsString()
  @Length(1, 32)
  nickname?: string;

  // ========== 以下为微信登录保留字段 ==========

  @IsOptional()
  @IsString()
  encryptedData?: string;

  @IsOptional()
  @IsString()
  iv?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
