import type { Config } from './config.ts';

export type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatRequest = {
  model: string;
  messages: ChatTurn[];
  stream: boolean;
  thinking: { type: 'enabled' | 'disabled' };
};

const ROLES = new Set(['system', 'user', 'assistant']);

/**
 * 校验并规范化客户端请求体。只放行我们认识的字段，模型按白名单决定，
 * 其余参数一律丢弃，避免客户端随意透传参数到方舟。
 */
export function validateChatRequest(
  body: unknown,
  cfg: Pick<Config, 'arkModel' | 'allowedModels' | 'maxMessages' | 'maxChars'>,
): { ok: true; value: ChatRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: '请求体必须是 JSON 对象' };
  const b = body as Record<string, unknown>;

  if (!Array.isArray(b.messages) || b.messages.length === 0) return { ok: false, error: 'messages 必须是非空数组' };
  if (b.messages.length > cfg.maxMessages) return { ok: false, error: `messages 最多 ${cfg.maxMessages} 条` };

  const messages: ChatTurn[] = [];
  let chars = 0;
  for (const m of b.messages) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'messages 元素必须是对象' };
    const { role, content } = m as Record<string, unknown>;
    if (typeof role !== 'string' || !ROLES.has(role)) return { ok: false, error: `不支持的 role: ${String(role)}` };
    if (typeof content !== 'string') return { ok: false, error: 'content 必须是字符串' };
    chars += content.length;
    messages.push({ role: role as ChatTurn['role'], content });
  }
  if (chars > cfg.maxChars) return { ok: false, error: `消息总长度不能超过 ${cfg.maxChars} 字符` };

  const model = typeof b.model === 'string' && cfg.allowedModels.has(b.model) ? b.model : cfg.arkModel;

  // 深度思考默认关闭：聊天场景首字快 3 倍以上；客户端显式传 enabled 才开启
  const thinking = b.thinking as Record<string, unknown> | undefined;
  const thinkingType = thinking && typeof thinking === 'object' && thinking.type === 'enabled' ? 'enabled' : 'disabled';
  const out: ChatRequest = { model, messages, stream: b.stream !== false, thinking: { type: thinkingType } };
  return { ok: true, value: out };
}
