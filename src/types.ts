export type Role = 'user' | 'assistant';

export type Message = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  /** 助手消息流式输出中 */
  streaming?: boolean;
  /** 请求失败时的错误信息 */
  error?: string;
};

export type ChatTurn = { role: Role | 'system'; content: string };

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
