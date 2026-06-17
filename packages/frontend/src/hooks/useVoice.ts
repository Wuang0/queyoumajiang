import { useState, useCallback } from 'react';
import type { MicMode } from '../services/trtc';

export interface VoiceState {
  connected: boolean;
  micMode: MicMode;
  isSpeaking: boolean;
  error: string | null;
}

/**
 * 语音 Hook —— 已废弃
 *
 * H5 朋友局版本不使用内置语音。
 * 朋友间通过微信群语音/腾讯会议实时通话。
 * 保留此 Hook 签名避免所有调用方报错。
 */
export function useVoice() {
  const [state] = useState<VoiceState>({
    connected: false,
    micMode: 'mute',
    isSpeaking: false,
    error: null,
  });

  const enterRoom = useCallback(async (_roomCode: string) => {
    console.log('[Voice] disabled — use WeChat group voice');
  }, []);

  const exitRoom = useCallback(() => {}, []);

  const cycleMicMode = useCallback(() => {}, []);

  const setMicMode = useCallback((_mode: MicMode) => {}, []);

  const pushToTalk = useCallback((_pressed: boolean) => {}, []);

  const getPusherConfig = useCallback(() => null, []);

  return {
    ...state,
    enterRoom,
    exitRoom,
    cycleMicMode,
    setMicMode,
    pushToTalk,
    getPusherConfig,
  };
}
