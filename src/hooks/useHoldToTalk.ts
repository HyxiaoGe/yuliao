import { useCallback, useEffect, useRef, useState } from 'react';
import { createAsr, type Asr } from '../services/asr';

export type TalkState = 'idle' | 'listening' | 'finishing';
/** 松手时的意图：直接发送，或填入输入框编辑 */
export type TalkIntent = 'send' | 'edit';

type Options = {
  /** 最终结果（松手后） */
  onFinal: (text: string, intent: TalkIntent) => void;
  onError: (message: string) => void;
};

/**
 * "按住说话、松开转文字"的状态机。
 * pressIn -> 请求权限并开始识别；pressOut(intent) -> 停止录音并等待最终结果；cancel -> 丢弃本次。
 * 实时识别文本与音量通过 transcript / volume 暴露给 UI。
 */
export function useHoldToTalk({ onFinal, onError }: Options) {
  const [state, setState] = useState<TalkState>('idle');
  const [transcript, setTranscript] = useState('');
  const [volume, setVolume] = useState(0);
  const asrRef = useRef<Asr | null>(null);
  const lastTextRef = useRef('');
  const gotFinalRef = useRef(false);
  const cancelledRef = useRef(false);
  const intentRef = useRef<TalkIntent>('send');
  /** 手指是否仍按住；权限弹窗期间松手时据此避免卡在录音状态 */
  const heldRef = useRef(false);
  // 用 ref 持有最新回调，避免监听器闭包过期
  const cbRef = useRef({ onFinal, onError });
  useEffect(() => {
    cbRef.current = { onFinal, onError };
  }, [onFinal, onError]);

  const asr = () => (asrRef.current ??= createAsr());

  useEffect(() => () => asrRef.current?.abort(), []);

  const reset = () => {
    setState('idle');
    setTranscript('');
    setVolume(0);
  };

  const pressIn = useCallback(async () => {
    if (state !== 'idle') return;
    heldRef.current = true;
    const granted = await asr().requestPermission();
    if (!granted) {
      cbRef.current.onError('需要麦克风和语音识别权限才能使用按住说话');
      return;
    }
    // 首次使用会弹系统权限框，用户此时大概率已经松手，不再开始录音
    if (!heldRef.current) return;
    lastTextRef.current = '';
    gotFinalRef.current = false;
    cancelledRef.current = false;
    setTranscript('');
    setState('listening');
    asr().start({
      onResult: (text, isFinal) => {
        if (cancelledRef.current) return;
        lastTextRef.current = text;
        setTranscript(text);
        if (isFinal) {
          gotFinalRef.current = true;
          cbRef.current.onFinal(text, intentRef.current);
        }
      },
      onVolume: setVolume,
      onError: (msg) => {
        if (!cancelledRef.current) cbRef.current.onError(msg);
        reset();
      },
      onEnd: () => {
        if (!cancelledRef.current && !gotFinalRef.current) {
          // 部分平台 stop 后不再下发 isFinal 结果，用最后一次中间结果兜底
          if (lastTextRef.current) cbRef.current.onFinal(lastTextRef.current, intentRef.current);
          else cbRef.current.onError('没有听到声音，请再试一次');
        }
        reset();
      },
    });
  }, [state]);

  const pressOut = useCallback(
    (intent: TalkIntent = 'send') => {
      heldRef.current = false;
      if (state !== 'listening') return;
      intentRef.current = intent;
      setState('finishing');
      asr().stop();
    },
    [state],
  );

  const cancel = useCallback(() => {
    heldRef.current = false;
    cancelledRef.current = true;
    asr().abort();
    reset();
  }, []);

  return { state, transcript, volume, pressIn, pressOut, cancel };
}
