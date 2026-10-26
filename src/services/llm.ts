import { fetch } from 'expo/fetch';
import { config } from '../config';
import type { ChatTurn } from '../types';
import { SseLineBuffer, extractDelta } from './sse';

/**
 * 调用 OpenAI 兼容的 Chat Completions 流式接口（自己的后端 server/，或直连火山方舟）。
 * POST {baseUrl}/chat/completions，SSE 返回 `data: {...}`，以 `data: [DONE]` 结束。
 *
 * @param onDelta 每收到一段增量文本回调一次
 * @returns 完整回复文本
 */
export async function streamChat(
  turns: ChatTurn[],
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const resp = await fetch(`${config.chatBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.chatToken}` },
    body: JSON.stringify({
      ...(config.chatModel ? { model: config.chatModel } : {}),
      messages: turns,
      stream: true,
      thinking: { type: config.chatThinking ? 'enabled' : 'disabled' },
    }),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(formatHttpError(resp.status, text));
  }
  if (!resp.body) throw new Error('响应不支持流式读取');

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  const lines = new SseLineBuffer();
  let full = '';
  const consume = (payloads: string[]) => {
    for (const p of payloads) {
      const delta = extractDelta(p);
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    consume(lines.push(decoder.decode(value, { stream: true })));
  }
  consume(lines.flush());
  return full;
}

function formatHttpError(status: number, body: string): string {
  let detail = '';
  try {
    const json = JSON.parse(body);
    detail = json?.error?.message ?? json?.message ?? '';
  } catch {
    detail = body.slice(0, 200);
  }
  if (status === 401) return `鉴权失败（401）：${detail || '请检查 EXPO_PUBLIC_CHAT_TOKEN'}`;
  if (status === 404) return `接口或模型不存在（404）：${detail || '请检查 EXPO_PUBLIC_CHAT_BASE_URL / CHAT_MODEL'}`;
  if (status === 502) return `上游服务异常（502）：${detail || '稍后再试'}`;
  if (status === 429) return `请求过于频繁（429）：${detail || '稍后再试'}`;
  return `请求失败（${status}）${detail ? `：${detail}` : ''}`;
}
