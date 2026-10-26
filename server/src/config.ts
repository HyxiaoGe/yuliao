function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`环境变量 ${name} 必须是正数，当前为 "${v}"`);
  return n;
}

function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadConfig() {
  const arkApiKey = process.env.ARK_API_KEY ?? '';
  const appTokens = list('APP_TOKENS');
  if (!arkApiKey) throw new Error('缺少 ARK_API_KEY');
  if (appTokens.length === 0) throw new Error('缺少 APP_TOKENS，至少配置一个 App 鉴权 token');

  return {
    port: num('PORT', 8787),
    arkApiKey,
    arkBaseUrl: (process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, ''),
    arkModel: process.env.ARK_MODEL ?? 'doubao-seed-2-0-mini-260428',
    allowedModels: new Set(list('ALLOWED_MODELS')),
    appTokens: new Set(appTokens),
    rateLimitPerMin: num('RATE_LIMIT_PER_MIN', 30),
    maxMessages: num('MAX_MESSAGES', 40),
    maxChars: num('MAX_CHARS', 20000),
  };
}

export type Config = ReturnType<typeof loadConfig>;
