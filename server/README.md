# yuliao-server

语聊的轻量后端：持有火山方舟 Key，把 App 的 Chat Completions 流式请求原样转发给豆包。无数据库、无状态，一个 Node 进程。

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | /healthz | 健康检查 |
| POST | /v1/chat/completions | OpenAI 兼容，SSE 流式透传。需 `Authorization: Bearer <APP_TOKEN>` |

请求体只放行 `messages`、`stream`、`thinking`、`model`（仅白名单内生效，否则用服务端默认），其余字段丢弃。错误统一为 `{ "error": { "message", "type" } }`，App 直接展示 message。

| 状态 | 含义 |
|---|---|
| 401 | App token 无效 |
| 429 | 超过 RATE_LIMIT_PER_MIN，带 Retry-After |
| 400 | 请求体不合法（消息数、总字符数、role 等） |
| 502 | 上游不可达或上游返回 5xx / 401（服务端 Key 问题） |

## 本地运行

```bash
cd server
npm install
cp .env.example .env        # 填 ARK_API_KEY、APP_TOKENS（openssl rand -hex 16 生成）
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

## 已验证

- 鉴权、限流、参数校验、模型白名单
- 流式透传，首字延迟与直连方舟一致（约 0.6s）
- 客户端中途断开（App 点"停止"）时同步取消上游请求
- 上游 401 对客户端表现为 502，不会被误认为 App token 错误
- Docker 镜像构建与容器健康检查
