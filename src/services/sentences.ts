/** 句末标点：遇到就切一句 */
const END = /[。！？!?；;\n]/;
/** 句子过长时允许在逗号处切，避免第一段音频等太久 */
const SOFT = /[，,：:]/;
const SOFT_MIN = 40;
/** 句末标点离得太远时不等它，转而找逗号 */
const HARD_MAX = 60;

/**
 * 把流式到达的文本切成适合朗读的句子。
 * push 返回已完整的句子；flush 返回剩余部分。
 */
export class SentenceSplitter {
  private buf = '';

  push(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    while (true) {
      const m = END.exec(this.buf);
      let cut = -1;
      if (m && m.index < HARD_MAX) cut = m.index + 1;
      else if (this.buf.length >= SOFT_MIN) {
        const soft = this.buf.slice(SOFT_MIN - 1).search(SOFT);
        if (soft !== -1) cut = SOFT_MIN - 1 + soft + 1;
      }
      if (cut === -1) break;
      const s = this.buf.slice(0, cut);
      this.buf = this.buf.slice(cut);
      if (s.trim()) out.push(s.trim());
    }
    return out;
  }

  flush(): string | null {
    const s = this.buf.trim();
    this.buf = '';
    return s || null;
  }
}

/** 去掉 Markdown 符号和链接，只留给人听的文字 */
export function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/https?:\/\/\S+/g, '链接')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
