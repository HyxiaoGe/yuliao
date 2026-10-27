import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { config } from '../config';
import { getDeviceId } from './device';

/**
 * 朗读队列：句子按入队顺序合成（并行请求）并顺序播放。
 * 合成走自家后端 /v1/tts，音频落到缓存目录后用 expo-audio 播放。
 */
type Item = { text: string; file: Promise<File | null> };

class SpeechQueue {
  private queue: Item[] = [];
  private player: AudioPlayer | null = null;
  private playing = false;
  /** 每次 stop() 递增，用来丢弃过期的异步结果 */
  private generation = 0;
  private modeReady = false;
  private listeners = new Set<(speaking: boolean) => void>();

  /** 启动时预热音频会话和播放器，避免第一句才初始化 */
  async warmUp() {
    if (!this.modeReady) {
      this.modeReady = true;
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' }).catch(() => {});
    }
    if (!this.player) this.player = createAudioPlayer(null, { updateInterval: 250 });
  }

  /** 记录一轮回复的起点，用于打印首句音频延迟 */
  markStart() {
    this.startedAt = Date.now();
    this.firstPlayed = false;
  }
  private startedAt = 0;
  private firstPlayed = false;

  onChange(fn: (speaking: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  enqueue(text: string) {
    const t = text.trim();
    if (!t) return;
    const gen = this.generation;
    this.queue.push({ text: t, file: this.synthesize(t, gen) });
    this.drain();
  }

  stop() {
    this.generation++;
    this.queue = [];
    if (this.player) {
      try {
        this.player.pause();
      } catch {}
    }
    this.setPlaying(false);
  }

  private setPlaying(v: boolean) {
    if (v === this.playing) return;
    this.playing = v;
    for (const fn of this.listeners) fn(v);
  }

  private async synthesize(text: string, gen: number): Promise<File | null> {
    const file = new File(Paths.cache, `tts-${hash(text)}.mp3`);
    try {
      if (file.exists && file.size > 0) return file;
      const resp = await fetch(`${config.chatBaseUrl}/tts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.chatToken}`, 'X-Device-Id': getDeviceId(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!resp.ok) {
        console.warn(`[tts] ${resp.status}`, (await resp.text()).slice(0, 200));
        return null;
      }
      const bytes = new Uint8Array(await resp.arrayBuffer());
      if (gen !== this.generation) return null;
      file.write(bytes);
      return file;
    } catch (e) {
      console.warn('[tts] synth failed', e);
      return null;
    }
  }

  private async drain() {
    if (this.playing) return;
    this.setPlaying(true);
    const gen = this.generation;
    try {
      await this.warmUp();
      while (this.queue.length && gen === this.generation) {
        const item = this.queue.shift()!;
        const file = await item.file;
        if (gen !== this.generation) break;
        if (!file) continue;
        await this.playFile(file, gen);
      }
    } finally {
      if (gen === this.generation) this.setPlaying(false);
    }
  }

  private playFile(file: File, gen: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.player) this.player = createAudioPlayer(null, { updateInterval: 250 });
      const player = this.player;
      const sub = player.addListener('playbackStatusUpdate', (st) => {
        if (st.didJustFinish || gen !== this.generation) {
          sub.remove();
          resolve();
        }
      });
      try {
        player.replace({ uri: file.uri });
        player.play();
        if (!this.firstPlayed && this.startedAt) {
          this.firstPlayed = true;
          console.log(`[tts] first audio after ${Date.now() - this.startedAt}ms`);
        }
      } catch (e) {
        console.warn('[tts] play failed', e);
        sub.remove();
        resolve();
      }
    });
  }
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

export const speech = new SpeechQueue();
