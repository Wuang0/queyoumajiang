import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth.store';

const WS_URL =
  (typeof window !== 'undefined'
    ? (window as unknown as { __WS_URL__?: string }).__WS_URL__
    : undefined) ??
  process.env.TARO_APP_WS_URL ??
  'http://localhost:3000';

let clientSeq = 0;
const HEARTBEAT_INTERVAL = 5000;

/**
 * C2S 消息信封
 */
interface C2SMessage {
  v: number;
  type: string;
  clientSeq: number;
  ts: number;
  payload: Record<string, unknown>;
}

/**
 * S2C 消息（从后端推送）
 */
interface S2CMessage {
  v: number;
  type: string;
  serverSeq?: number;
  ts: number;
  payload: { eventType?: string; actor?: string; visibility?: string; data?: Record<string, unknown>; ok?: boolean; code?: number; message?: string; result?: unknown };
}

export function useWebSocket(
  eventHandlers?: Record<string, (data: Record<string, unknown>) => void>,
) {
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRef = useRef(0);
  const handlersRef = useRef(eventHandlers);
  const sendQueueRef = useRef<C2SMessage[]>([]);

  useEffect(() => {
    handlersRef.current = eventHandlers;
  });

  const connect = useCallback(() => {
    const { token } = useAuthStore.getState();
    if (!token) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(WS_URL, {
      transports: ['websocket'],
      auth: { token },
      query: { v: '1' },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    // ========== 通用消息接收（所有 S2C 消息通过此通道） ==========
    socket.on('message', (raw: S2CMessage) => {
      try {
        const msg = typeof raw === 'string' ? JSON.parse(raw) as S2CMessage : raw;
        seqRef.current = msg.serverSeq ?? seqRef.current;

        const payload = msg.payload;

        if (msg.type === 'event' && payload?.eventType) {
          const handler = handlersRef.current?.[payload.eventType];
          if (handler) handler(payload.data ?? {});
          const any = handlersRef.current?.['*'];
          if (any) any(payload.data ?? {});
        }

        if (msg.type === 'ack') {
          const ackH = handlersRef.current?.['__ack__'];
          if (ackH) ackH(payload ?? {});
        }

        if (msg.type === 'heartbeat') {
          // pong received, nothing to do
        }
      } catch (e) {
        console.error('[WS] parse error', e);
      }
    });

    socket.on('connect', () => {
      console.log('[WS] connected:', socket.id);
      socketRef.current = socket;

      // 先发送 auth 认证
      const { token: t } = useAuthStore.getState();
      socket.emit('auth', {
        v: 1,
        type: 'auth',
        clientSeq: 0,
        ts: Date.now(),
        payload: { token: t },
      } as C2SMessage);

      // 冲刷积压消息
      const queue = sendQueueRef.current;
      while (queue.length > 0) {
        const data = queue.shift()!;
        socket.emit(data.type, data);
      }

      // 心跳
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (socket.connected) {
          socket.emit('heartbeat', {
            v: 1,
            type: 'heartbeat',
            clientSeq: 0,
            ts: Date.now(),
            payload: {},
          } as C2SMessage);
        }
      }, HEARTBEAT_INTERVAL);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WS] disconnected:', reason);
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[WS] connection error:', err.message);
    });
  }, []);

  const send = useCallback(
    (msg: { type: string; payload: unknown }) => {
      clientSeq++;
      const data: C2SMessage = {
        v: 1,
        type: msg.type,
        clientSeq,
        ts: Date.now(),
        payload: msg.payload as Record<string, unknown>,
      };

      if (socketRef.current?.connected) {
        // 以消息类型作为 socket.io 事件名发送（不再用 'message' 包装）
        socketRef.current.emit(msg.type, data);
      } else {
        sendQueueRef.current.push(data);
      }
    },
    [],
  );

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    sendQueueRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  return { connect, send, disconnect, currentSeq: seqRef.current };
}
