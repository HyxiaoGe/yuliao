/**
 * 运行时配置。所有值来自 EXPO_PUBLIC_* 环境变量（.env.local）。
 *
 * 原型阶段 APP 直连火山方舟；接入轻量后端后，只需把 ARK_BASE_URL 改成后端地址，
 * 并让后端持有 API Key（此时 ARK_API_KEY 可留空）。
 */
export const config = {
  arkBaseUrl: (process.env.EXPO_PUBLIC_ARK_BASE_URL ?? 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, ''),
  arkApiKey: process.env.EXPO_PUBLIC_ARK_API_KEY ?? '',
  arkModel: process.env.EXPO_PUBLIC_ARK_MODEL ?? 'doubao-seed-2-0-mini-260428',
  /**
   * 是否开启豆包深度思考。聊天场景默认关闭：实测 Seed 2.0 Mini 开启时首字约 2.4s，关闭后约 0.7s。
   * 设 EXPO_PUBLIC_ARK_THINKING=1 开启。
   */
  arkThinking: process.env.EXPO_PUBLIC_ARK_THINKING === '1',
  /** 语音识别语言 */
  asrLang: 'zh-CN',
  /** 发送给模型的最近消息条数（含用户和助手），控制上下文长度 */
  historyLimit: 20,
  systemPrompt: '你是一个友好、简洁的中文聊天助手。',
} as const;

export function assertLlmConfigured(): string | null {
  if (!config.arkApiKey && config.arkBaseUrl.includes('volces.com')) {
    return '未配置 EXPO_PUBLIC_ARK_API_KEY，请参考 .env.example 创建 .env.local';
  }
  return null;
}
