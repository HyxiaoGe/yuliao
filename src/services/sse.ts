/**
 * 最小 SSE 行解析器：把字节流切成 `data:` 载荷。
 * 独立成纯函数，便于不依赖 RN 运行时做单测。
 */
export class SseLineBuffer {
  private buffer = '';

  /** 喂入一段文本，返回其中完整行解析出的 data 载荷（不含 [DONE]） */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const out: string[] = [];
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '');
      this.buffer = this.buffer.slice(idx + 1);
      const payload = extractData(line);
      if (payload) out.push(payload);
    }
    return out;
  }

  /** 流结束时调用，处理没有换行结尾的最后一行 */
  flush(): string[] {
    const payload = extractData(this.buffer.trim());
    this.buffer = '';
    return payload ? [payload] : [];
  }
}

function extractData(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  return payload;
}

/** 从一条 OpenAI 兼容的流式 chunk 中取出增量文本；返回 null 表示本条无文本 */
export function extractDelta(payload: string): string | null {
  let json: any;
  try {
    json = JSON.parse(payload);
  } catch {
    return null;
  }
  if (json?.error) throw new Error(json.error.message ?? '模型返回错误');
  const delta = json?.choices?.[0]?.delta?.content;
  return typeof delta === 'string' && delta.length > 0 ? delta : null;
}
