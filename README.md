# 语聊（yuliao）

一个极简的语音聊天原型：**按住说话，松开转文字**，识别结果填入输入框，确认后发送给豆包大模型，回复流式显示在聊天列表里。

技术栈：Expo SDK 58 / React Native / TypeScript，语音识别用设备端能力（`expo-speech-recognition`），大模型走火山方舟 Chat Completions 流式接口，经由 `server/` 里的轻量 Node 后端转发（Key 只在服务器上）。

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
server/                      轻量后端：持有方舟 Key，转发流式请求（见 server/README.md）
```

## 配置

```bash
cp .env.example .env.local
# EXPO_PUBLIC_CHAT_BASE_URL 指向后端（…/v1），EXPO_PUBLIC_CHAT_TOKEN 填后端 APP_TOKENS 之一
```

`EXPO_PUBLIC_*` 都会打进客户端包，所以 App 里只放后端地址和 App token，方舟 Key 只存在于 `server/.env`。
仅本地调试时可直连方舟：BASE_URL 填方舟地址，TOKEN 填方舟 Key，并填 `EXPO_PUBLIC_CHAT_MODEL`。

真实值只能写在 `.env.local`，不要写进 `.env.example`（后者会提交到仓库）。

深度思考默认关闭，实测 Seed 2.0 Mini 开启时首字约 2.4s，关闭后约 0.7s；需要时设 `EXPO_PUBLIC_CHAT_THINKING=1`。

## 运行

语音识别是原生模块，**不能用 Expo Go**，需要 development build，并且**必须真机**（模拟器没有麦克风和语音识别）。

首次准备 iOS 环境（只需一次）：

1. App Store 安装 Xcode，打开一次同意许可并安装 iOS 平台组件
2. `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. `brew install cocoapods`
4. iPhone 连接电脑并信任，手机上开启开发者模式（设置 > 隐私与安全性）
5. 签名：Xcode > Settings > Accounts 登录 Apple ID（免费 Personal Team 即可）。
   `app.json` 里的 `ios.appleTeamId` 换成你自己的团队 ID，Bundle ID 全球唯一，被占用时换一个。

```bash
npm install
npx expo prebuild --platform ios   # 生成 ios/ 并 pod install
open ios/yuliao.xcworkspace        # 首次签名需要在 Xcode 里完成：选真机，⌘R 安装
npx expo start --dev-client        # 启动 Metro；App 打开后在启动页选中本机，或手动填 http://<Mac 局域网 IP>:8081
```

> 命令行 `npm run ios` 在首次签名时拿不到 Xcode 里的 Apple ID 会话，会报 "No profiles"；
> 用 Xcode 跑过一次、描述文件生成后，之后再用 `npm run ios` 即可。
> 免费签名 7 天过期，过期后在 Xcode 里重新 ⌘R 一次。
> 手机与 Mac 必须在同一 Wi-Fi。
> iOS ATS 只放行局域网 IP 的明文 HTTP；`app.json` 已为 `*.dev.seanfield.org` 加了例外，改动后需重装原生包才生效。

```bash
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

## 真机验证记录

2026-10-27 在 iPhone（iOS 26.3）上验证通过：按住说话识别中文、文字填入输入框、豆包流式回复。

## 已知边界

- 设备端识别依赖系统能力：iOS 用 SFSpeechRecognizer，Android 依赖 Google 语音服务，国内部分安卓机可能不可用，这也是后续接豆包 ASR 的动机。
- 中间识别结果会实时覆盖进输入框，按下时输入框已有的文字会保留并追加。
- 对话上下文只带最近 20 条消息，不做持久化，杀掉 App 即清空。
