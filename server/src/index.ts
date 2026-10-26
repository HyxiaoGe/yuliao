import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { loadConfig, type Config } from './config.ts';
import { RateLimiter } from './rateLimit.ts';
import { validateChatRequest } from './validate.ts';

const cfg = loadConfig();
const limiter = new RateLimiter(cfg.rateLimitPerMin);
setInterval(() => limiter.sweep(), 60_000).unref();

const MAX_BODY_BYTES = 256 * 1024;

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function errorBody(message: string, type = 'invalid_request') {
  // 与 OpenAI 兼容的错误结构，客户端已按 error.message 展示
  return { error: { message, type } };
}

function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7).trim() || null;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error('请求体过大');
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function handleChat(req: IncomingMessage, res: ServerResponse, cfg: Config) {
  const token = bearer(req);
  if (!token || !cfg.appTokens.has(token)) return json(res, 401, errorBody('App token 无效', 'unauthorized'));
  const tokenId = token.slice(0, 6);

  const retryAfter = limiter.check(token);
  if (retryAfter !== null) {
    res.setHeader('Retry-After', String(retryAfter));
    return json(res, 429, errorBody(`请求过于频繁，${retryAfter} 秒后再试`, 'rate_limited'));
  }

  let body: unknown;
  try {
    body = await readJson(req);
  } catch (e: any) {
    return json(res, 400, errorBody(e?.message === '请求体过大' ? '请求体过大' : '请求体不是合法 JSON'));
  }
  const v = validateChatRequest(body, cfg);
  if (!v.ok) return json(res, 400, errorBody(v.error));

  const started = Date.now();
  const upstreamAbort = new AbortController();
  // 客户端断开（如点了"停止"）时同步中止上游，避免白白消耗 token
  res.on('close', () => {
    if (!res.writableFinished) upstreamAbort.abort();
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.arkBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.arkApiKey}` },
      body: JSON.stringify(v.value),
      signal: upstreamAbort.signal,
    });
  } catch (e: any) {
    if (upstreamAbort.signal.aborted) return;
    console.error(`[chat] token=${tokenId} upstream fetch failed: ${e?.message}`);
    return json(res, 502, errorBody('上游模型服务不可达', 'upstream_error'));
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    let message = `上游返回 ${upstream.status}`;
    try {
      message = JSON.parse(text)?.error?.message ?? message;
    } catch {}
    // 方舟的 401 是服务器 Key 的问题，对客户端表现为 502，不要让客户端误以为自己的 token 错了
    const status = upstream.status === 429 ? 429 : upstream.status >= 500 || upstream.status === 401 ? 502 : upstream.status;
    console.error(`[chat] token=${tokenId} upstream ${upstream.status}: ${message}`);
    return json(res, status, errorBody(message, 'upstream_error'));
  }

  res.writeHead(200, {
    'Content-Type': upstream.headers.get('content-type') ?? (v.value.stream ? 'text/event-stream' : 'application/json'),
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (!upstream.body) return res.end();

  try {
    // pipeline 会在客户端断开时销毁上游流（取消 fetch 读取），并以 PREMATURE_CLOSE 结束，不会挂起
    await pipeline(Readable.fromWeb(upstream.body as any), res);
  } catch (e: any) {
    if (!upstreamAbort.signal.aborted && e?.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error(`[chat] token=${tokenId} stream error: ${e?.message}`);
    }
    res.destroy();
  } finally {
    console.log(`[chat] token=${tokenId} model=${v.value.model} msgs=${v.value.messages.length} ${Date.now() - started}ms${upstreamAbort.signal.aborted ? ' (client aborted)' : ''}`);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/healthz') return json(res, 200, { ok: true });
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') return await handleChat(req, res, cfg);
    return json(res, 404, errorBody('Not found', 'not_found'));
  } catch (e: any) {
    console.error(`[server] unhandled: ${e?.stack ?? e}`);
    if (!res.headersSent) json(res, 500, errorBody('服务器内部错误', 'server_error'));
    else res.destroy();
  }
});

server.listen(cfg.port, () => {
  console.log(`yuliao-server listening on :${cfg.port}, model=${cfg.arkModel}, tokens=${cfg.appTokens.size}, rate=${cfg.rateLimitPerMin}/min`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`received ${sig}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
