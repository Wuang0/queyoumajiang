/**
 * WebSocket 消息传输格式（简化版，完整定义见 @queyou/protocol）
 */

export interface C2SMessage {
  v: number;
  type: string;
  clientSeq: number;
  ts: number;
  payload: Record<string, unknown>;
}

export interface S2CMessage {
  v: number;
  type: 'ack' | 'event' | 'snapshot' | 'error' | 'kicked' | 'heartbeat';
  serverSeq?: number;
  clientSeq?: number;
  ts: number;
  payload: Record<string, unknown>;
}

/** 客户端可以加入房间时发送的 body */
export interface WsJoinRoomPayload {
  roomCode: string;
}

export interface WsReadyPayload {
  ready: boolean;
}

export interface WsDissolvePayload {
  confirm: boolean;
}

export interface WsResumePayload {
  roomCode: string;
  lastSeq: number;
}
