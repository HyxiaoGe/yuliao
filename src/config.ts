/**
 * 运行时配置。所有值来自 EXPO_PUBLIC_* 环境变量（.env.local）。
 * App 只和 server/ 通信：CHAT_BASE_URL 指向其部署地址（…/v1），CHAT_TOKEN 填后端 APP_TOKENS 之一。
 * 对话历史、上下文拼接和系统提示词都在服务端。
 */
export const config = {
  chatBaseUrl: (process.env.EXPO_PUBLIC_CHAT_BASE_URL ?? '').replace(/\/+$/, ''),
  chatToken: process.env.EXPO_PUBLIC_CHAT_TOKEN ?? '',
  /** 走后端时可留空，由后端决定模型 */
  chatModel: process.env.EXPO_PUBLIC_CHAT_MODEL ?? '',
  /**
   * 是否开启豆包深度思考。聊天场景默认关闭：实测 Seed 2.0 Mini 开启时首字约 2.4s，关闭后约 0.7s。
   * 设 EXPO_PUBLIC_CHAT_THINKING=1 开启。
   */
  chatThinking: process.env.EXPO_PUBLIC_CHAT_THINKING === '1',
  /** 语音识别语言 */
  asrLang: 'zh-CN',
} as const;

export function assertLlmConfigured(): string | null {
  if (!config.chatBaseUrl) return '未配置 EXPO_PUBLIC_CHAT_BASE_URL，请参考 .env.example 创建 .env.local';
  if (!config.chatToken) return '未配置 EXPO_PUBLIC_CHAT_TOKEN，请参考 .env.example 创建 .env.local';
  return null;
}
