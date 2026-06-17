/**
 * TRTC 语音服务 —— 已废弃
 *
 * H5 朋友局使用微信群语音替代，无需 TRTC 集成。
 * 保留此文件占位，避免其他模块 import 报错。
 */

export type MicMode = 'free' | 'ptt' | 'mute';

class TrtcService {
  async enterRoom(_roomCode: string): Promise<void> {
    console.log('[TRTC] disabled — use WeChat group voice instead');
  }

  exitRoom(): void {
    // no-op
  }

  setMicMode(_mode: MicMode): MicMode {
    return 'mute';
  }

  getMicMode(): MicMode {
    return 'mute';
  }

  pushToTalk(_pressed: boolean): void {
    // no-op
  }

  onSpeaking(_cb: (speaking: boolean) => void): void {
    // no-op
  }

  getConfig(): null {
    return null;
  }
}

export const trtcService = new TrtcService();
