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

const DEFAULT_SYSTEM_PROMPT = '你是一个友好、简洁的中文聊天助手。涉及最新动态、实时信息或你不确定的事实时，先联网搜索再回答。';

export function loadConfig() {
  const arkApiKey = process.env.ARK_API_KEY ?? '';
  const appTokens = list('APP_TOKENS');
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!arkApiKey) throw new Error('缺少 ARK_API_KEY');
  if (appTokens.length === 0) throw new Error('缺少 APP_TOKENS，至少配置一个 App 鉴权 token');
  if (!databaseUrl) throw new Error('缺少 DATABASE_URL');

  return {
    port: num('PORT', 8787),
    databaseUrl,
    /** 发给模型的最近消息条数（用户+助手） */
    historyLimit: num('HISTORY_LIMIT', 20),
    systemPrompt: process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT,
    /** 豆包搜索 Custom 版联网搜索（需在方舟控制台开通组件）；WEB_SEARCH=0 关闭 */
    webSearch: process.env.WEB_SEARCH !== '0',
    arkApiKey,
    arkBaseUrl: (process.env.ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, ''),
    arkModel: process.env.ARK_MODEL ?? 'doubao-seed-2-0-mini-260428',
    allowedModels: new Set(list('ALLOWED_MODELS')),
    appTokens: new Set(appTokens),
    rateLimitPerMin: num('RATE_LIMIT_PER_MIN', 30),
    maxMessages: num('MAX_MESSAGES', 40),
    maxChars: num('MAX_CHARS', 20000),
    /** 豆包语音合成（可选）：为空时 /v1/tts 返回 503 */
    ttsApiKey: process.env.TTS_API_KEY ?? '',
    ttsResourceId: process.env.TTS_RESOURCE_ID ?? 'seed-tts-2.0',
    ttsSpeaker: process.env.TTS_SPEAKER ?? 'zh_female_vv_uranus_bigtts',
    ttsMaxChars: num('TTS_MAX_CHARS', 600),
    /** 上游 loudness_rate，-50..100，100 为 2 倍音量；豆包默认输出约 -20 LUFS 偏小，默认提到 1.7 倍 */
    ttsLoudness: Number(process.env.TTS_LOUDNESS ?? 70),
  };
}

export type Config = ReturnType<typeof loadConfig>;
