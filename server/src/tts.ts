/**
 * 豆包语音合成 2.0：单向流式 HTTP 接口。
 * 上游用 HTTP chunked 返回一串连续的 JSON 对象（不保证按对象边界分块），
 * 每个对象的 data 字段是一段 base64 音频；code 非 0 表示失败。
 */

/** 把连续到达的文本切成完整的顶层 JSON 对象；残缺部分留到下次 */
export class JsonObjectSplitter {
  private buf = '';
  private depth = 0;
  private inString = false;
  private escaped = false;
  private start = -1;

  push(text: string): string[] {
    const out: string[] = [];
    const base = this.buf.length;
    this.buf += text;
    for (let i = base; i < this.buf.length; i++) {
      const ch = this.buf[i];
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === '\\') this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }
      if (ch === '"') this.inString = true;
      else if (ch === '{') {
        if (this.depth === 0) this.start = i;
        this.depth++;
      } else if (ch === '}') {
        this.depth--;
        if (this.depth === 0 && this.start >= 0) {
          out.push(this.buf.slice(this.start, i + 1));
          this.start = -1;
        }
      }
    }
    if (this.depth === 0) this.buf = '';
    else if (this.start > 0) {
      this.buf = this.buf.slice(this.start);
      this.start = 0;
    }
    return out;
  }
}

export type TtsChunk = { code: number; message?: string; data?: string; usage?: { text_words?: number } };

export type TtsOptions = {
  apiKey: string;
  resourceId: string;
  speaker: string;
  text: string;
  signal?: AbortSignal;
};

export type TtsError = { status: number; message: string };

/**
 * 调用上游，逐段回调音频字节。返回计费字符数（上游未给则为 null）。
 * 上游 HTTP 非 2xx 或首个 JSON 的 code 非 0 时抛 TtsError。
 */
export async function synthesize(opts: TtsOptions, onAudio: (bytes: Buffer) => void): Promise<number | null> {
  const resp = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
    method: 'POST',
    headers: {
      'X-Api-Key': opts.apiKey,
      'X-Api-Resource-Id': opts.resourceId,
      'X-Api-Request-Id': crypto.randomUUID(),
      'X-Control-Require-Usage-Tokens-Return': '*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      req_params: {
        text: opts.text,
        speaker: opts.speaker,
        audio_params: { format: 'mp3', sample_rate: 24000 },
      },
    }),
    signal: opts.signal,
  });
  if (!resp.ok || !resp.body) {
    let message = `上游返回 ${resp.status}`;
    try {
      const j: any = await resp.json();
      message = j?.header?.message ?? j?.message ?? message;
    } catch {}
    throw { status: resp.status, message } satisfies TtsError;
  }

  const splitter = new JsonObjectSplitter();
  const decoder = new TextDecoder();
  let usage: number | null = null;
  const handle = (raw: string) => {
    let chunk: TtsChunk;
    try {
      chunk = JSON.parse(raw);
    } catch {
      return;
    }
    // 20000000 是上游的结束标记（message=OK，data=null），不是错误
    if (chunk.code !== 0 && chunk.code !== 20000000) throw { status: 502, message: chunk.message || `上游合成失败 code=${chunk.code}` } satisfies TtsError;
    if (chunk.data) onAudio(Buffer.from(chunk.data, 'base64'));
    if (typeof chunk.usage?.text_words === 'number') usage = chunk.usage.text_words;
  };
  const reader = resp.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const raw of splitter.push(decoder.decode(value, { stream: true }))) handle(raw);
  }
  for (const raw of splitter.push(decoder.decode())) handle(raw);
  return usage;
}
