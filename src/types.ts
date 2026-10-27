export type Role = 'user' | 'assistant';

export type Message = {
  /** 服务端消息 id；本地临时消息用 local- 前缀 */
  id: string;
  role: Role;
  content: string;
  /** 助手消息流式输出中 */
  streaming?: boolean;
  /** 请求失败时的错误信息 */
  error?: string;
};

export type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message: string | null;
};

export function localId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
