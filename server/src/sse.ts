/** 与 App 端相同的最小 SSE 解析：从转发流里顺带提取助手回复文本，用于落库 */
export class SseAccumulator {
  private buffer = '';
  text = '';

  push(chunk: string): void {
    this.buffer += chunk;
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      this.handle(this.buffer.slice(0, idx).replace(/\r$/, ''));
      this.buffer = this.buffer.slice(idx + 1);
    }
  }

  flush(): void {
    this.handle(this.buffer.trim());
    this.buffer = '';
  }

  private handle(line: string) {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    try {
      const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') this.text += delta;
    } catch {
      /* 非 JSON 行忽略 */
    }
  }
}
