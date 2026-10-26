import { useCallback, useEffect, useRef, useState } from 'react';
import { createAsr, type Asr } from '../services/asr';

export type TalkState = 'idle' | 'listening' | 'finishing';

type Options = {
  /** 中间结果（会被后续结果覆盖） */
  onInterim: (text: string) => void;
  /** 最终结果 */
  onFinal: (text: string) => void;
  onError: (message: string) => void;
};

/**
 * "按住说话、松开转文字"的状态机。
 * pressIn -> 请求权限并开始识别；pressOut -> 停止录音并等待最终结果。
 */
export function useHoldToTalk({ onInterim, onFinal, onError }: Options) {
  const [state, setState] = useState<TalkState>('idle');
  const asrRef = useRef<Asr | null>(null);
  const lastTextRef = useRef('');
  const gotFinalRef = useRef(false);
  /** 手指是否仍按住；权限弹窗期间松手时据此避免卡在录音状态 */
  const heldRef = useRef(false);
  // 用 ref 持有最新回调，避免监听器闭包过期
  const cbRef = useRef({ onInterim, onFinal, onError });
  useEffect(() => {
    cbRef.current = { onInterim, onFinal, onError };
  }, [onInterim, onFinal, onError]);

  const asr = () => (asrRef.current ??= createAsr());

  useEffect(() => () => asrRef.current?.abort(), []);

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
    setState('listening');
    asr().start({
      onResult: (text, isFinal) => {
        lastTextRef.current = text;
        if (isFinal) {
          gotFinalRef.current = true;
          cbRef.current.onFinal(text);
        } else {
          cbRef.current.onInterim(text);
        }
      },
      onError: (msg) => {
        cbRef.current.onError(msg);
        setState('idle');
      },
      onEnd: () => {
        // 部分平台 stop 后不再下发 isFinal 结果，用最后一次中间结果兜底
        if (!gotFinalRef.current && lastTextRef.current) {
          cbRef.current.onFinal(lastTextRef.current);
        }
        setState('idle');
      },
    });
  }, [state]);

  const pressOut = useCallback(() => {
    heldRef.current = false;
    if (state !== 'listening') return;
    setState('finishing');
    asr().stop();
  }, [state]);

  const cancel = useCallback(() => {
    heldRef.current = false;
    asr().abort();
    setState('idle');
  }, []);

  return { state, pressIn, pressOut, cancel };
}
