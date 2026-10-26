import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';
import { config } from '../config';

/**
 * 语音识别抽象。当前实现为设备端识别（iOS SFSpeechRecognizer / Android SpeechRecognizer）。
 * 后续接入豆包 ASR 时，新增一个实现同样接口的类（录音 -> 上传/流式推送 -> 回调），
 * 在 createAsr() 里切换即可，UI 层不需要改动。
 */
export type AsrListener = {
  /** 识别到文本；isFinal=false 为中间结果，会被后续结果覆盖 */
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (message: string) => void;
  /** 识别会话结束（无论成功或失败都会触发） */
  onEnd: () => void;
};

export interface Asr {
  requestPermission(): Promise<boolean>;
  start(listener: AsrListener): void;
  /** 停止录音，等待最终结果 */
  stop(): void;
  /** 立刻中止，丢弃结果 */
  abort(): void;
}

class DeviceAsr implements Asr {
  private subs: { remove(): void }[] = [];

  async requestPermission(): Promise<boolean> {
    const res = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    return res.granted;
  }

  start(listener: AsrListener): void {
    this.detach();
    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (e: ExpoSpeechRecognitionResultEvent) => {
        const text = e.results[0]?.transcript ?? '';
        listener.onResult(text, e.isFinal);
      }),
      ExpoSpeechRecognitionModule.addListener('error', (e: ExpoSpeechRecognitionErrorEvent) => {
        if (e.error === 'aborted') return;
        listener.onError(describeError(e));
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        this.detach();
        listener.onEnd();
      }),
    );
    ExpoSpeechRecognitionModule.start({
      lang: config.asrLang,
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      iosTaskHint: 'dictation',
    });
  }

  stop(): void {
    ExpoSpeechRecognitionModule.stop();
  }

  abort(): void {
    ExpoSpeechRecognitionModule.abort();
    this.detach();
  }

  private detach() {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
  }
}

function describeError(e: ExpoSpeechRecognitionErrorEvent): string {
  switch (e.error) {
    case 'not-allowed':
      return '未授权麦克风或语音识别权限';
    case 'no-speech':
      return '没有听到声音，请再试一次';
    case 'network':
      return '语音识别需要网络，请检查连接';
    case 'service-not-allowed':
    case 'language-not-supported':
      return '当前设备不支持该语音识别服务';
    case 'audio-capture':
      return '录音失败，请检查麦克风';
    default:
      return e.message || `语音识别失败（${e.error}）`;
  }
}

export function createAsr(): Asr {
  return new DeviceAsr();
}
