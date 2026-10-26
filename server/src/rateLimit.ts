/** 固定窗口限流：每个 key 在 windowMs 内最多 limit 次 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(limit: number, windowMs = 60_000, now: () => number = Date.now) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
  }

  /** 返回 null 表示放行，否则返回距离窗口重置的秒数 */
  check(key: string): number | null {
    const t = this.now();
    const cur = this.hits.get(key);
    if (!cur || cur.resetAt <= t) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
      return null;
    }
    if (cur.count >= this.limit) return Math.ceil((cur.resetAt - t) / 1000);
    cur.count += 1;
    return null;
  }

  /** 清理过期窗口，避免 map 无限增长 */
  sweep(): void {
    const t = this.now();
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}
