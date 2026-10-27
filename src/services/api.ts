import { fetch } from 'expo/fetch';
import { config } from '../config';
import { getDeviceId } from './device';
import { SseLineBuffer, extractDelta } from './sse';
import type { Conversation, Message } from '../types';

/** 与 server/ 的约定：所有接口在 /v1 下，鉴权用 App token + X-Device-Id */
function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${config.chatToken}`,
    'X-Device-Id': getDeviceId(),
    ...extra,
  };
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const resp = await fetch(`${config.chatBaseUrl}${path}`, {
    method,
    headers: headers(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!resp.ok) throw new Error(await describeHttpError(resp));
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

export const api = {
  listConversations: () => request<{ conversations: Conversation[] }>('GET', '/conversations').then((r) => r.conversations),
  createConversation: (title?: string) =>
    request<{ conversation: Conversation }>('POST', '/conversations', title ? { title } : {}).then((r) => r.conversation),
  deleteConversation: (id: string) => request<void>('DELETE', `/conversations/${id}`),
  listMessages: (id: string) =>
    request<{ messages: Message[] }>('GET', `/conversations/${id}/messages`).then((r) => r.messages),

  /**
   * 发送一条消息并流式接收回复。服务器负责落库和拼接上下文。
   * @returns 完整回复文本
   */
  async sendMessage(conversationId: string, content: string, onDelta: (delta: string) => void, signal?: AbortSignal): Promise<string> {
    const resp = await fetch(`${config.chatBaseUrl}/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        content,
        ...(config.chatModel ? { model: config.chatModel } : {}),
        thinking: { type: config.chatThinking ? 'enabled' : 'disabled' },
      }),
      signal,
    });
    if (!resp.ok) throw new Error(await describeHttpError(resp));
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
  },
};

async function describeHttpError(resp: Response): Promise<string> {
  const status = resp.status;
  let detail = '';
  try {
    const json = await resp.json();
    detail = json?.error?.message ?? '';
  } catch {}
  if (status === 401) return `鉴权失败（401）：${detail || '请检查 EXPO_PUBLIC_CHAT_TOKEN'}`;
  if (status === 404) return `${detail || '资源不存在'}（404）`;
  if (status === 429) return `请求过于频繁（429）：${detail || '稍后再试'}`;
  if (status === 502) return `上游服务异常（502）：${detail || '稍后再试'}`;
  return `请求失败（${status}）${detail ? `：${detail}` : ''}`;
}
