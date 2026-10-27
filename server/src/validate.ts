import type { Config } from './config.ts';

export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

/** 发往方舟的请求体 */
export type ArkChatRequest = {
  model: string;
  messages: ChatTurn[];
  stream: true;
  stream_options?: { include_usage: boolean };
  thinking: { type: 'enabled' | 'disabled' };
  /** 方舟 Chat API 的联网搜索开关（豆包搜索 Custom 版），传 {} 即由模型自行判断是否搜索 */
  web_search_options?: Record<string, never>;
};

export type SendMessageInput = { content: string; thinking: 'enabled' | 'disabled'; model: string };

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidDeviceId(v: unknown): v is string {
  return typeof v === 'string' && DEVICE_ID_RE.test(v);
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** 校验"发送一条消息"的请求体。模型按白名单决定，其余参数一律丢弃。 */
export function validateSendMessage(
  body: unknown,
  cfg: Pick<Config, 'arkModel' | 'allowedModels' | 'maxChars'>,
): { ok: true; value: SendMessageInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: '请求体必须是 JSON 对象' };
  const b = body as Record<string, unknown>;
  if (typeof b.content !== 'string' || !b.content.trim()) return { ok: false, error: 'content 必须是非空字符串' };
  if (b.content.length > cfg.maxChars) return { ok: false, error: `content 不能超过 ${cfg.maxChars} 字符` };
  const model = typeof b.model === 'string' && cfg.allowedModels.has(b.model) ? b.model : cfg.arkModel;
  // 深度思考默认关闭：聊天场景首字快 3 倍以上；客户端显式传 enabled 才开启
  const thinking = b.thinking as Record<string, unknown> | undefined;
  const thinkingType = thinking && typeof thinking === 'object' && thinking.type === 'enabled' ? 'enabled' : 'disabled';
  return { ok: true, value: { content: b.content.trim(), thinking: thinkingType, model } };
}

export function validateCreateConversation(body: unknown): { ok: true; title: string | null } | { ok: false; error: string } {
  if (body === undefined || body === null) return { ok: true, title: null };
  if (typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: '请求体必须是 JSON 对象' };
  const t = (body as Record<string, unknown>).title;
  if (t === undefined || t === null) return { ok: true, title: null };
  if (typeof t !== 'string') return { ok: false, error: 'title 必须是字符串' };
  const title = t.trim().slice(0, 60);
  return { ok: true, title: title || null };
}

/** 用首条用户消息生成标题 */
export function titleFromContent(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 30);
}
