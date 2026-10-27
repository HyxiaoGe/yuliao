export type Source = { title: string; url: string };

/** 与 App 端相同的最小 SSE 解析：从转发流里顺带提取助手回复文本与引用来源，用于落库 */
export class SseAccumulator {
  private buffer = '';
  text = '';
  /** 联网搜索引用（按 url 去重，保持出现顺序） */
  sources: Source[] = [];
  /** 本次回复实际执行的联网搜索次数（来自 usage.tool_usage.web_search） */
  searchCount = 0;

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
    let json: any;
    try {
      json = JSON.parse(payload);
    } catch {
      return; // 非 JSON 行忽略
    }
    const delta = json?.choices?.[0]?.delta;
    if (typeof delta?.content === 'string') this.text += delta.content;
    for (const s of extractSources(delta?.annotations)) {
      if (!this.sources.some((x) => x.url === s.url)) this.sources.push(s);
    }
    const n = json?.usage?.tool_usage?.web_search;
    if (typeof n === 'number') this.searchCount = n;
  }
}

/** 从 OpenAI 格式的 annotations 里取 url_citation；上游偶尔会给空 url 的条目，丢掉 */
export function extractSources(annotations: unknown): Source[] {
  if (!Array.isArray(annotations)) return [];
  const out: Source[] = [];
  for (const a of annotations) {
    const c = a?.url_citation;
    if (a?.type !== 'url_citation' || typeof c?.url !== 'string' || !/^https?:\/\//.test(c.url)) continue;
    out.push({ title: typeof c.title === 'string' && c.title ? c.title : c.url, url: c.url });
  }
  return out;
}
