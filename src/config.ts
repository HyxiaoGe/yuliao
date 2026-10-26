/**
 * 运行时配置。所有值来自 EXPO_PUBLIC_* 环境变量（.env.local）。
 *
 * 聊天接口是 OpenAI 兼容的 Chat Completions，有两种接法：
 * - 走自己的后端（推荐）：CHAT_BASE_URL 指向 server/ 部署地址（…/v1），CHAT_TOKEN 填后端的 APP_TOKENS 之一
 * - 直连火山方舟（仅本地调试）：CHAT_BASE_URL 指向方舟，CHAT_TOKEN 填方舟 API Key。Key 会打进客户端包，不要用于分发的版本
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
  /** 发送给模型的最近消息条数（含用户和助手），控制上下文长度 */
  historyLimit: 20,
  systemPrompt: '你是一个友好、简洁的中文聊天助手。',
} as const;

export function assertLlmConfigured(): string | null {
  if (!config.chatBaseUrl) return '未配置 EXPO_PUBLIC_CHAT_BASE_URL，请参考 .env.example 创建 .env.local';
  if (!config.chatToken) return '未配置 EXPO_PUBLIC_CHAT_TOKEN，请参考 .env.example 创建 .env.local';
  return null;
}
