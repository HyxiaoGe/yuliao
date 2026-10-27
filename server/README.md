# yuliao-server

语聊的轻量后端：持有火山方舟 Key，把 App 的 Chat Completions 流式请求原样转发给豆包。无数据库、无状态，一个 Node 进程。

## 接口

所有 `/v1/*` 接口需要两个请求头：`Authorization: Bearer <APP_TOKEN>` 和 `X-Device-Id: <设备 ID>`（8–64 位字母数字 `-_`）。对话按设备 ID 归属，跨设备访问一律 404。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /healthz | 健康检查（无需鉴权） |
| GET | /v1/conversations | 对话列表，按最近活跃排序，含标题与最后一条消息预览 |
| POST | /v1/conversations | 新建对话，body 可选 `{ "title" }`；标题为空时用首条消息自动生成 |
| DELETE | /v1/conversations/:id | 删除对话及其消息 |
| GET | /v1/conversations/:id/messages | 该对话的消息（时间正序，最多 500 条），助手消息含 `sources: [{title,url}] \| null` |
| POST | /v1/conversations/:id/messages | 发送一条消息 `{ "content", "thinking"?, "model"? }`，SSE 流式返回 OpenAI 格式 chunk；开启联网搜索时最后一个 chunk 的 `delta.annotations` 带 `url_citation` 引用 |
| POST | /v1/tts | `{ "text" }` → `audio/mpeg`，豆包语音合成 2.0，边合成边下发；未配置 TTS_API_KEY 时 503 |

发送流程：落库用户消息 → 取最近 `HISTORY_LIMIT` 条拼上下文 → 流式转发方舟 → 边转发边累积 → 落库助手回复。客户端中途断开时，已生成的部分照常落库并同步取消上游。
`thinking` 默认 disabled，显式 `{ "type": "enabled" }` 才开；`model` 仅白名单内生效，否则用服务端默认；其余字段丢弃。

错误统一为 `{ "error": { "message", "type" } }`，App 直接展示 message。

| 状态 | 含义 |
|---|---|
| 400 | 请求体或请求头不合法 |
| 401 | App token 无效 |
| 404 | 对话不存在或不属于该设备 |
| 429 | 超过 RATE_LIMIT_PER_MIN，带 Retry-After |
| 502 | 上游不可达或上游返回 5xx / 401（服务端 Key 问题） |
| 503 | 该功能未在服务端配置（如 TTS_API_KEY 为空） |

## 数据

Postgres 两张表：`conversations(id, device_id, title, created_at, updated_at)`、`messages(id, conversation_id, role, content, created_at)`，启动时幂等建表（`src/db.ts`）。dev 服务器用共享实例里的 `yuliao` 库。

## 本地运行

```bash
cd server
npm install
cp .env.example .env        # 填 ARK_API_KEY、APP_TOKENS（openssl rand -hex 16 生成）、DATABASE_URL
# 本地 Postgres：docker run -d --name yuliao-pg-dev -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=devpass -e POSTGRES_DB=yuliao -p 5433:5432 postgres:15-alpine
npm run dev                 # 热重载；npm start 为普通启动
npm test && npm run typecheck
```

App 侧 `.env.local` 填 `EXPO_PUBLIC_CHAT_BASE_URL=http://<本机局域网 IP>:8787/v1`、`EXPO_PUBLIC_CHAT_TOKEN=<APP_TOKENS 之一>`。

## Docker

```bash
docker build -t yuliao-server .
docker run -d --name yuliao-server -p 8787:8787 --env-file .env --restart unless-stopped yuliao-server
```

或用 `docker-compose.yml`（.env 放同目录）：`docker compose up -d`。

## 部署（dev 服务器）

- 目录 `~/project/yuliao`，容器名 `yuliao-server`，宿主端口 8787，接入 `middleware_default` 与 `postgres_default`
- 依赖从 npmmirror 安装（dev 服务器直连 npmjs 不稳定）；node 基础镜像是从 Mac `docker save --platform linux/amd64` 传过去的
- 推送到 main 且改动涉及 `server/**` 时，GitHub Actions self-hosted runner 自动 `docker compose up -d --build`
- 内网域名 `http://yuliao.dev.seanfield.org`（nginx-proxy 反代，已关 buffering 以支持 SSE），App 填 `…/v1`
- Uptime Kuma 探活 `/healthz`

## 已验证

- 鉴权、设备归属、限流、参数校验、模型白名单
- 多轮上下文（第二轮能答出第一轮说的名字）、标题自动生成、删除级联
- 流式透传，首字延迟与直连方舟一致（约 0.6s）
- 客户端中途断开（App 点"停止"）时同步取消上游请求，已生成部分落库
- 上游 401 对客户端表现为 502，不会被误认为 App token 错误
- Docker 镜像构建与容器健康检查
