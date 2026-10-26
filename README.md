# 语聊（yuliao）

一个极简的语音聊天原型：**按住说话，松开转文字**，识别结果填入输入框，确认后发送给豆包大模型，回复流式显示在聊天列表里。

技术栈：Expo SDK 58 / React Native / TypeScript，语音识别用设备端能力（`expo-speech-recognition`），大模型走火山方舟 Chat Completions 流式接口。

## 目录

```
App.tsx                      入口
src/config.ts                环境变量与常量
src/types.ts                 消息类型
src/services/llm.ts          豆包流式调用（OpenAI 兼容 SSE）
src/services/sse.ts          SSE 行解析（纯函数，有单测）
src/services/asr.ts          语音识别抽象 + 设备端实现（后续接豆包 ASR 在这里换实现）
src/hooks/useHoldToTalk.ts   按住说话状态机
src/components/              消息气泡、按住说话按钮、输入区
src/screens/ChatScreen.tsx   聊天页
```

## 配置

```bash
cp .env.example .env.local
# 填入 EXPO_PUBLIC_ARK_API_KEY，按控制台"开通管理"确认 EXPO_PUBLIC_ARK_MODEL
```

Key 只能写在 `.env.local`，不要写进 `.env.example`（后者会提交到仓库）。

深度思考默认关闭，实测 Seed 2.0 Mini 开启时首字约 2.4s，关闭后约 0.7s；需要时设 `EXPO_PUBLIC_ARK_THINKING=1`。

> `EXPO_PUBLIC_*` 会打进客户端包。原型阶段直连方舟可以接受；正式版本由轻量后端持有 Key，
> APP 只需把 `EXPO_PUBLIC_ARK_BASE_URL` 指向后端（接口保持 OpenAI 兼容格式即可，APP 代码不用改）。

## 运行

语音识别是原生模块，**不能用 Expo Go**，需要 development build，并且**必须真机**（模拟器没有麦克风和语音识别）。

首次准备 iOS 环境（只需一次）：

1. App Store 安装 Xcode，打开一次同意许可并安装 iOS 平台组件
2. `sudo xcode-select -s /Applications/Xcode.app`
3. `brew install cocoapods`
4. iPhone 连接电脑并信任，手机上开启开发者模式（设置 > 隐私与安全性）

```bash
npm install
npm run ios        # 首次会生成 ios/ 并 pod install，再装到连接的 iPhone
npm run android    # 需要 Android SDK / 真机
```

没有本地原生工具链时可用 EAS 云构建：

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile development --platform ios
```

## 校验

```bash
npm run typecheck
npm run lint
npm test
```

## 已知边界

- 设备端识别依赖系统能力：iOS 用 SFSpeechRecognizer，Android 依赖 Google 语音服务，国内部分安卓机可能不可用，这也是后续接豆包 ASR 的动机。
- 中间识别结果会实时覆盖进输入框，按下时输入框已有的文字会保留并追加。
- 对话上下文只带最近 20 条消息，不做持久化，杀掉 App 即清空。
