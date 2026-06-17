/**
 * 错误码体系
 * 5位分层编码
 * 1xxxx: 系统级错误 (System)
 * 2xxxx: 用户域错误 (User)
 * 3xxxx: 房间域错误 (Room)
 * 4xxxx: 对局域错误 (Game)
 * 5xxxx: 语音域错误 (Voice)
 * 9xxxx: 内部服务错误 (Internal)
 */

export enum ErrorCode {
  // ==================== 0: 成功 ====================
  OK = 0,

  // ==================== 1xxxx: 系统级错误 ====================
  INVALID_PROTOCOL_VERSION = 10001,
  INVALID_MESSAGE_FORMAT = 10002,
  CLIENT_VERSION_TOO_LOW = 10003,
  UNAUTHORIZED = 10010,
  TOKEN_EXPIRED = 10011,
  TOKEN_REVOKED = 10012,
  RATE_LIMITED = 10020,
  TOO_MANY_CONNECTIONS = 10021,
  DUPLICATE_REQUEST = 10030,
  CLIENT_SEQ_OUT_OF_ORDER = 10031,
  MAINTENANCE = 10040,

  // ==================== 2xxxx: 用户域错误 ====================
  USER_NOT_FOUND = 20001,
  NICKNAME_INVALID = 20002,
  AVATAR_UPLOAD_FAILED = 20003,
  WECHAT_LOGIN_FAILED = 20010,
  WECHAT_CODE_USED = 20011,
  FRIEND_NOT_EXIST = 20020,
  ALREADY_FRIENDS = 20021,

  // ==================== 3xxxx: 房间域错误 ====================
  ROOM_NOT_FOUND = 30001,
  ROOM_FULL = 30002,
  ROOM_ALREADY_STARTED = 30003,
  ROOM_DISSOLVED = 30004,
  ROOM_CODE_INVALID = 30005,
  NOT_IN_ROOM = 30010,
  NOT_HOST = 30011,
  ALREADY_IN_ROOM = 30012,
  ALREADY_READY = 30013,
  NOT_ALL_READY = 30014,
  ROOM_CODE_POOL_EXHAUSTED = 30020,

  // ==================== 4xxxx: 对局域错误 ====================
  NOT_YOUR_TURN = 40001,
  INVALID_TILE = 40002,
  INVALID_ACTION = 40003,
  CLAIM_LOST = 40004,
  TIMEOUT_AUTO_DISCARD = 40005,
  ALREADY_HU = 40006,
  RULE_VIOLATION = 40007,
  TRUSTEE_MODE = 40008,

  // ==================== 5xxxx: 语音域错误 ====================
  VOICE_SIG_FAILED = 50001,
  MICROPHONE_NOT_AUTHORIZED = 50002,
  TRTC_ENTER_FAILED = 50003,

  // ==================== 9xxxx: 内部服务错误 ====================
  INTERNAL_ERROR = 90001,
  DEPENDENCY_TIMEOUT = 90002,
  UNKNOWN_ERROR = 90099,
}

export const ErrorMessage: Record<ErrorCode, string> = {
  [ErrorCode.OK]: '成功',
  [ErrorCode.INVALID_PROTOCOL_VERSION]: '协议版本不兼容',
  [ErrorCode.INVALID_MESSAGE_FORMAT]: '消息格式错误',
  [ErrorCode.CLIENT_VERSION_TOO_LOW]: '客户端版本过低，请升级',
  [ErrorCode.UNAUTHORIZED]: '未授权',
  [ErrorCode.TOKEN_EXPIRED]: 'Token已过期',
  [ErrorCode.TOKEN_REVOKED]: 'Token已吊销',
  [ErrorCode.RATE_LIMITED]: '请求过于频繁',
  [ErrorCode.TOO_MANY_CONNECTIONS]: '连接数超限',
  [ErrorCode.DUPLICATE_REQUEST]: '重复请求',
  [ErrorCode.CLIENT_SEQ_OUT_OF_ORDER]: '客户端序列号乱序',
  [ErrorCode.MAINTENANCE]: '系统维护中',
  [ErrorCode.USER_NOT_FOUND]: '用户不存在',
  [ErrorCode.NICKNAME_INVALID]: '昵称不合法',
  [ErrorCode.AVATAR_UPLOAD_FAILED]: '头像上传失败',
  [ErrorCode.WECHAT_LOGIN_FAILED]: '微信登录失败',
  [ErrorCode.WECHAT_CODE_USED]: 'Code已被使用',
  [ErrorCode.FRIEND_NOT_EXIST]: '好友不存在',
  [ErrorCode.ALREADY_FRIENDS]: '已经是好友',
  [ErrorCode.ROOM_NOT_FOUND]: '房间不存在',
  [ErrorCode.ROOM_FULL]: '房间已满',
  [ErrorCode.ROOM_ALREADY_STARTED]: '房间已开局',
  [ErrorCode.ROOM_DISSOLVED]: '房间已解散',
  [ErrorCode.ROOM_CODE_INVALID]: '房间号格式错误',
  [ErrorCode.NOT_IN_ROOM]: '不在房间中',
  [ErrorCode.NOT_HOST]: '非房主操作',
  [ErrorCode.ALREADY_IN_ROOM]: '已在其他房间',
  [ErrorCode.ALREADY_READY]: '已准备',
  [ErrorCode.NOT_ALL_READY]: '未全员准备',
  [ErrorCode.ROOM_CODE_POOL_EXHAUSTED]: '房间号池耗尽',
  [ErrorCode.NOT_YOUR_TURN]: '还没轮到你',
  [ErrorCode.INVALID_TILE]: '你手中没有这张牌',
  [ErrorCode.INVALID_ACTION]: '当前状态不允许此操作',
  [ErrorCode.CLAIM_LOST]: '抢牌失败',
  [ErrorCode.TIMEOUT_AUTO_DISCARD]: '超时自动出牌',
  [ErrorCode.ALREADY_HU]: '已胡牌',
  [ErrorCode.RULE_VIOLATION]: '违反规则',
  [ErrorCode.TRUSTEE_MODE]: '托管中无法手动操作',
  [ErrorCode.VOICE_SIG_FAILED]: '语音签名失败',
  [ErrorCode.MICROPHONE_NOT_AUTHORIZED]: '麦克风未授权',
  [ErrorCode.TRTC_ENTER_FAILED]: '语音房间进入失败',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
  [ErrorCode.DEPENDENCY_TIMEOUT]: '依赖服务超时',
  [ErrorCode.UNKNOWN_ERROR]: '未知错误',
};

export function getErrorMessage(code: ErrorCode): string {
  return ErrorMessage[code] ?? ErrorMessage[ErrorCode.UNKNOWN_ERROR];
}
