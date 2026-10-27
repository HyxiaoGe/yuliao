import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateChatRequest } from '../validate.ts';

const cfg = { arkModel: 'default-model', allowedModels: new Set(['other-model']), maxMessages: 3, maxChars: 20 };
const ok = (body: unknown) => {
  const r = validateChatRequest(body, cfg);
  assert.ok(r.ok, `expected ok, got ${JSON.stringify(r)}`);
  return r.value;
};
const bad = (body: unknown) => {
  const r = validateChatRequest(body, cfg);
  assert.ok(!r.ok, `expected error, got ${JSON.stringify(r)}`);
  return r.error;
};

test('合法请求：模型按白名单，其余字段丢弃，stream 默认 true', () => {
  const v = ok({ messages: [{ role: 'user', content: 'hi' }], temperature: 2, max_tokens: 99999 });
  assert.deepEqual(v, { model: 'default-model', messages: [{ role: 'user', content: 'hi' }], stream: true, thinking: { type: 'disabled' } });
  assert.equal(ok({ model: 'other-model', messages: [{ role: 'user', content: 'hi' }] }).model, 'other-model');
  assert.equal(ok({ model: 'evil-model', messages: [{ role: 'user', content: 'hi' }] }).model, 'default-model');
  assert.equal(ok({ messages: [{ role: 'user', content: 'hi' }], stream: false }).stream, false);
});

test('thinking 默认关闭，只有显式 enabled 才开启', () => {
  assert.deepEqual(ok({ messages: [{ role: 'user', content: 'x' }] }).thinking, { type: 'disabled' });
  assert.deepEqual(ok({ messages: [{ role: 'user', content: 'x' }], thinking: { type: 'enabled' } }).thinking, { type: 'enabled' });
  assert.deepEqual(ok({ messages: [{ role: 'user', content: 'x' }], thinking: { type: 'auto' } }).thinking, { type: 'disabled' });
});

test('非法请求', () => {
  assert.match(bad(null), /JSON 对象/);
  assert.match(bad({ messages: [] }), /非空/);
  assert.match(bad({ messages: [{ role: 'tool', content: 'x' }] }), /role/);
  assert.match(bad({ messages: [{ role: 'user', content: ['x'] }] }), /字符串/);
  assert.match(bad({ messages: Array(4).fill({ role: 'user', content: 'x' }) }), /最多 3/);
  assert.match(bad({ messages: [{ role: 'user', content: 'x'.repeat(21) }] }), /20 字符/);
});
