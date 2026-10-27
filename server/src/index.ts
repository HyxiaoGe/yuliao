import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { loadConfig, type Config } from './config.ts';
import { RateLimiter } from './rateLimit.ts';
import {
  createDb, migrate, listConversations, createConversation, getOwnedConversation, deleteConversation,
  listMessages, recentTurns, insertMessage, touchConversation, type Db,
} from './db.ts';
import { SseAccumulator } from './sse.ts';
import { synthesize } from './tts.ts';
import { isUuid, isValidDeviceId, titleFromContent, validateCreateConversation, validateSendMessage, type ArkChatRequest } from './validate.ts';

const cfg = loadConfig();
const db = createDb(cfg.databaseUrl);
const limiter = new RateLimiter(cfg.rateLimitPerMin);
setInterval(() => limiter.sweep(), 60_000).unref();

const MAX_BODY_BYTES = 256 * 1024;

type Ctx = { req: IncomingMessage; res: ServerResponse; cfg: Config; db: Db; deviceId: string; tokenId: string };

class HttpError extends Error {
  status: number;
  type: string;
  constructor(status: number, message: string, type = 'invalid_request') {
    super(message);
    this.status = status;
    this.type = type;
  }
}

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

const errorBody = (message: string, type = 'invalid_request') => ({ error: { message, type } });

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
    if (size > MAX_BODY_BYTES) throw new HttpError(413, '请求体过大');
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, '请求体不是合法 JSON');
  }
}

// ---------- 路由 ----------

async function handleListConversations({ res, db, deviceId }: Ctx) {
  json(res, 200, { conversations: await listConversations(db, deviceId) });
}

async function handleCreateConversation({ req, res, db, deviceId }: Ctx) {
  const v = validateCreateConversation(await readJson(req));
  if (!v.ok) throw new HttpError(400, v.error);
  json(res, 201, { conversation: await createConversation(db, deviceId, v.title) });
}

async function handleListMessages({ res, db, deviceId }: Ctx, conversationId: string) {
  if (!(await getOwnedConversation(db, deviceId, conversationId))) throw new HttpError(404, '对话不存在', 'not_found');
  json(res, 200, { messages: await listMessages(db, conversationId) });
}

async function handleDeleteConversation({ res, db, deviceId }: Ctx, conversationId: string) {
  if (!(await deleteConversation(db, deviceId, conversationId))) throw new HttpError(404, '对话不存在', 'not_found');
  res.writeHead(204).end();
}

/**
 * 发送一条消息：落库用户消息 -> 取上下文 -> 流式转发方舟 -> 边转发边累积回复 -> 落库助手消息。
 * 客户端中途断开时，已生成的部分也会落库（与用户看到的一致），并同步中止上游。
 */
async function handleSendMessage(ctx: Ctx, conversationId: string) {
  const { req, res, cfg, db, deviceId, tokenId } = ctx;
  const conv = await getOwnedConversation(db, deviceId, conversationId);
  if (!conv) throw new HttpError(404, '对话不存在', 'not_found');

  const v = validateSendMessage(await readJson(req), cfg);
  if (!v.ok) throw new HttpError(400, v.error);
  const { content, thinking, model } = v.value;

  const history = await recentTurns(db, conversationId, cfg.historyLimit - 1);
  const userMsg = await insertMessage(db, conversationId, 'user', content);
  await touchConversation(db, conversationId, conv.title ? null : titleFromContent(content));

  const arkBody: ArkChatRequest = {
    model,
    stream: true,
    stream_options: { include_usage: true },
    thinking: { type: thinking },
    messages: [{ role: 'system', content: cfg.systemPrompt }, ...history, { role: 'user', content }],
    ...(cfg.webSearch ? { web_search_options: {} } : {}),
  };

  const started = Date.now();
  const upstreamAbort = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) upstreamAbort.abort();
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.arkBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.arkApiKey}` },
      body: JSON.stringify(arkBody),
      signal: upstreamAbort.signal,
    });
  } catch (e: any) {
    if (upstreamAbort.signal.aborted) return;
    console.error(`[chat] token=${tokenId} upstream fetch failed: ${e?.message}`);
    throw new HttpError(502, '上游模型服务不可达', 'upstream_error');
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    let message = `上游返回 ${upstream.status}`;
    try {
      message = JSON.parse(text)?.error?.message ?? message;
    } catch {}
    // 方舟 401 是服务器 Key 的问题，对客户端表现为 502，不要让客户端误以为自己的 token 错了
    const status = upstream.status === 429 ? 429 : upstream.status >= 500 || upstream.status === 401 ? 502 : upstream.status;
    console.error(`[chat] token=${tokenId} upstream ${upstream.status}: ${message}`);
    throw new HttpError(status, message, 'upstream_error');
  }
  if (!upstream.body) throw new HttpError(502, '上游无响应体', 'upstream_error');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'X-User-Message-Id': userMsg.id,
  });

  const acc = new SseAccumulator();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  let streamError: string | null = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc.push(decoder.decode(value, { stream: true }));
      if (res.destroyed) break;
      if (!res.write(value)) await once(res, 'drain');
    }
    acc.flush();
  } catch (e: any) {
    if (!upstreamAbort.signal.aborted) streamError = e?.message ?? String(e);
  } finally {
    reader.cancel().catch(() => {});
  }

  const aborted = upstreamAbort.signal.aborted;
  if (acc.text) {
    await insertMessage(db, conversationId, 'assistant', acc.text, acc.sources);
    await touchConversation(db, conversationId, null);
  }
  if (streamError) {
    console.error(`[chat] token=${tokenId} stream error: ${streamError}`);
    res.destroy();
  } else if (!res.destroyed) {
    res.end();
  }
  console.log(
    `[chat] token=${tokenId} conv=${conversationId.slice(0, 8)} model=${model} ctx=${history.length + 1} reply=${acc.text.length}ch search=${acc.searchCount} sources=${acc.sources.length} ${Date.now() - started}ms${aborted ? ' (client aborted)' : ''}`,
  );
}

/** POST /v1/tts {text} -> audio/mpeg（整段 mp3，边合成边下发） */
async function handleTts({ req, res, cfg, tokenId }: Ctx) {
  if (!cfg.ttsApiKey) throw new HttpError(503, '服务端未配置语音合成', 'not_configured');
  const body: any = await readJson(req);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) throw new HttpError(400, 'text 不能为空');
  if (text.length > cfg.ttsMaxChars) throw new HttpError(400, `text 不能超过 ${cfg.ttsMaxChars} 字`);

  const controller = new AbortController();
  req.on('close', () => controller.abort());
  const started = Date.now();
  let bytes = 0;
  let usage: number | null = null;
  try {
    usage = await synthesize(
      { apiKey: cfg.ttsApiKey, resourceId: cfg.ttsResourceId, speaker: cfg.ttsSpeaker, text, loudness: cfg.ttsLoudness, signal: controller.signal },
      (buf) => {
        if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
        bytes += buf.length;
        res.write(buf);
      },
    );
  } catch (e: any) {
    if (controller.signal.aborted) return;
    if (res.headersSent) throw e;
    const status = typeof e?.status === 'number' ? e.status : 502;
    // 上游 401/403 是服务端 Key 的问题，对客户端统一是上游错误
    throw new HttpError(status >= 500 || status === 401 || status === 403 ? 502 : status, `语音合成失败：${e?.message ?? '未知错误'}`, 'upstream_error');
  }
  if (!res.headersSent) throw new HttpError(502, '上游未返回音频', 'upstream_error');
  res.end();
  console.log(`[tts] token=${tokenId} chars=${text.length} billed=${usage ?? '?'} bytes=${bytes} ${Date.now() - started}ms`);
}

// ---------- 分发 ----------

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  try {
    if (req.method === 'GET' && path === '/healthz') return json(res, 200, { ok: true });
    if (!path.startsWith('/v1/')) throw new HttpError(404, 'Not found', 'not_found');

    const token = bearer(req);
    if (!token || !cfg.appTokens.has(token)) throw new HttpError(401, 'App token 无效', 'unauthorized');
    const deviceId = req.headers['x-device-id'];
    if (!isValidDeviceId(deviceId)) throw new HttpError(400, '缺少或非法的 X-Device-Id 请求头');

    const retryAfter = limiter.check(`${token}:${deviceId}`);
    if (retryAfter !== null) {
      return json(res, 429, errorBody(`请求过于频繁，${retryAfter} 秒后再试`, 'rate_limited'), { 'Retry-After': String(retryAfter) });
    }

    const ctx: Ctx = { req, res, cfg, db, deviceId, tokenId: token.slice(0, 6) };
    const seg = path.split('/').slice(2); // ['conversations', ':id', 'messages']

    if (seg[0] === 'conversations') {
      if (seg.length === 1 && req.method === 'GET') return await handleListConversations(ctx);
      if (seg.length === 1 && req.method === 'POST') return await handleCreateConversation(ctx);
      if (seg.length >= 2 && !isUuid(seg[1])) throw new HttpError(404, '对话不存在', 'not_found');
      if (seg.length === 2 && req.method === 'DELETE') return await handleDeleteConversation(ctx, seg[1]);
      if (seg.length === 3 && seg[2] === 'messages' && req.method === 'GET') return await handleListMessages(ctx, seg[1]);
      if (seg.length === 3 && seg[2] === 'messages' && req.method === 'POST') return await handleSendMessage(ctx, seg[1]);
    }
    if (seg[0] === 'tts' && seg.length === 1 && req.method === 'POST') return await handleTts(ctx);
    throw new HttpError(404, 'Not found', 'not_found');
  } catch (e: any) {
    if (res.headersSent) {
      console.error(`[server] error after headers sent: ${e?.message}`);
      return res.destroy();
    }
    if (e instanceof HttpError) return json(res, e.status, errorBody(e.message, e.type));
    console.error(`[server] unhandled: ${e?.stack ?? e}`);
    json(res, 500, errorBody('服务器内部错误', 'server_error'));
  }
});

await migrate(db);
server.listen(cfg.port, () => {
  console.log(`yuliao-server listening on :${cfg.port}, model=${cfg.arkModel}, tokens=${cfg.appTokens.size}, rate=${cfg.rateLimitPerMin}/min, history=${cfg.historyLimit}`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`received ${sig}, shutting down`);
    server.close(() => db.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
