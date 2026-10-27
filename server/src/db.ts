import pg from 'pg';

export type Db = pg.Pool;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   text NOT NULL,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_device_updated_idx ON conversations (device_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id              bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages (conversation_id, id);
`;

export function createDb(databaseUrl: string): Db {
  return new pg.Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30_000 });
}

/** 幂等建表。表结构简单，先不引入迁移工具；后续有破坏性变更再加版本表。 */
export async function migrate(db: Db): Promise<void> {
  await db.query(SCHEMA);
}

export type ConversationRow = { id: string; title: string | null; created_at: string; updated_at: string; last_message: string | null };
export type MessageRow = { id: string; role: 'user' | 'assistant'; content: string; created_at: string };

export async function listConversations(db: Db, deviceId: string, limit = 50): Promise<ConversationRow[]> {
  const { rows } = await db.query<ConversationRow>(
    `SELECT c.id, c.title, c.created_at, c.updated_at,
            (SELECT left(m.content, 80) FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message
       FROM conversations c
      WHERE c.device_id = $1
      ORDER BY c.updated_at DESC
      LIMIT $2`,
    [deviceId, limit],
  );
  return rows;
}

export async function createConversation(db: Db, deviceId: string, title: string | null): Promise<ConversationRow> {
  const { rows } = await db.query<ConversationRow>(
    `INSERT INTO conversations (device_id, title) VALUES ($1, $2)
     RETURNING id, title, created_at, updated_at, NULL::text AS last_message`,
    [deviceId, title],
  );
  return rows[0];
}

/** 返回 null 表示不存在或不属于该设备（对外统一 404，不泄露存在性） */
export async function getOwnedConversation(db: Db, deviceId: string, id: string): Promise<{ id: string; title: string | null } | null> {
  const { rows } = await db.query<{ id: string; title: string | null }>(
    'SELECT id, title FROM conversations WHERE id = $1 AND device_id = $2',
    [id, deviceId],
  );
  return rows[0] ?? null;
}

export async function deleteConversation(db: Db, deviceId: string, id: string): Promise<boolean> {
  const r = await db.query('DELETE FROM conversations WHERE id = $1 AND device_id = $2', [id, deviceId]);
  return (r.rowCount ?? 0) > 0;
}

export async function listMessages(db: Db, conversationId: string, limit = 500): Promise<MessageRow[]> {
  const { rows } = await db.query<MessageRow>(
    `SELECT id::text, role, content, created_at FROM (
       SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY id DESC LIMIT $2
     ) t ORDER BY id ASC`,
    [conversationId, limit],
  );
  return rows;
}

/** 取最近 limit 条作为模型上下文（时间正序） */
export async function recentTurns(db: Db, conversationId: string, limit: number): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const rows = await listMessages(db, conversationId, limit);
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

export async function insertMessage(db: Db, conversationId: string, role: 'user' | 'assistant', content: string): Promise<MessageRow> {
  const { rows } = await db.query<MessageRow>(
    `INSERT INTO messages (conversation_id, role, content) VALUES ($1, $2, $3)
     RETURNING id::text, role, content, created_at`,
    [conversationId, role, content],
  );
  return rows[0];
}

/** 更新活跃时间；首条消息时顺带用它生成标题 */
export async function touchConversation(db: Db, conversationId: string, titleIfEmpty: string | null): Promise<void> {
  await db.query(
    `UPDATE conversations SET updated_at = now(), title = COALESCE(title, $2) WHERE id = $1`,
    [conversationId, titleIfEmpty],
  );
}
