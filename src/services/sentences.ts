/** 句末标点：遇到就切一句 */
const END = /[。！？!?；;\n]/;
/** 句子过长时允许在逗号处切，避免第一段音频等太久 */
const SOFT = /[，,：:]/;
const SOFT_MIN = 40;
/** 句末标点离得太远时不等它，转而找逗号 */
const HARD_MAX = 60;
/** 第一段尽量短：超过这个长度就允许在逗号切，让第一段音频尽早开始 */
const FIRST_SOFT_MIN = 8;

/**
 * 把流式到达的文本切成适合朗读的句子。
 * push 返回已完整的句子；flush 返回剩余部分。
 */
export class SentenceSplitter {
  private buf = '';
  private emitted = 0;

  push(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    while (true) {
      const m = END.exec(this.buf);
      const softMin = this.emitted === 0 ? FIRST_SOFT_MIN : SOFT_MIN;
      let cut = -1;
      if (m && m.index < HARD_MAX && !(this.emitted === 0 && m.index >= softMin && hasSoftBefore(this.buf, softMin, m.index))) cut = m.index + 1;
      else if (this.buf.length >= softMin) {
        const soft = this.buf.slice(softMin - 1).search(SOFT);
        if (soft !== -1) cut = softMin - 1 + soft + 1;
      }
      if (cut === -1) break;
      const s = this.buf.slice(0, cut);
      this.buf = this.buf.slice(cut);
      if (s.trim()) {
        out.push(s.trim());
        this.emitted++;
      }
    }
    return out;
  }

  flush(): string | null {
    const s = this.buf.trim();
    this.buf = '';
    return s || null;
  }
}

/** [from, to) 之间是否有逗号类标点 */
function hasSoftBefore(buf: string, from: number, to: number): boolean {
  return buf.slice(from - 1, to).search(SOFT) !== -1;
}

/** 去掉 Markdown 符号和链接，只留给人听的文字；没有可读字符（只有标点、表情）时返回空串 */
export function stripForSpeech(text: string): string {
  const t = text
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
  return /[\p{L}\p{N}]/u.test(t) ? t : '';
}
