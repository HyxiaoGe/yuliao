import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUuid, isValidDeviceId, titleFromContent, validateCreateConversation, validateSendMessage } from '../validate.ts';

const cfg = { arkModel: 'default-model', allowedModels: new Set(['other-model']), maxChars: 20 };

test('validateSendMessage：模型白名单、thinking 默认关闭、其余字段丢弃', () => {
  const r = validateSendMessage({ content: ' hi ', temperature: 2 }, cfg);
  assert.ok(r.ok);
  assert.deepEqual(r.value, { content: 'hi', thinking: 'disabled', model: 'default-model' });
  const r2 = validateSendMessage({ content: 'x', model: 'other-model', thinking: { type: 'enabled' } }, cfg);
  assert.ok(r2.ok && r2.value.model === 'other-model' && r2.value.thinking === 'enabled');
  const r3 = validateSendMessage({ content: 'x', model: 'evil', thinking: { type: 'auto' } }, cfg);
  assert.ok(r3.ok && r3.value.model === 'default-model' && r3.value.thinking === 'disabled');
});

test('validateSendMessage：非法输入', () => {
  for (const body of [null, [], { content: '' }, { content: '   ' }, { content: 1 }, { content: 'x'.repeat(21) }]) {
    assert.ok(!validateSendMessage(body, cfg).ok, JSON.stringify(body));
  }
});

test('validateCreateConversation', () => {
  assert.deepEqual(validateCreateConversation(undefined), { ok: true, title: null });
  assert.deepEqual(validateCreateConversation({}), { ok: true, title: null });
  assert.deepEqual(validateCreateConversation({ title: '  聊天 ' }), { ok: true, title: '聊天' });
  assert.ok(!validateCreateConversation({ title: 3 }).ok);
  assert.ok(!validateCreateConversation([]).ok);
});

test('id 校验与标题生成', () => {
  assert.ok(isValidDeviceId('3f2a9c1e-0b7d-4e21-9a6f-1c2d3e4f5a6b'));
  assert.ok(!isValidDeviceId('short'));
  assert.ok(!isValidDeviceId('has space 1234567'));
  assert.ok(isUuid('3f2a9c1e-0b7d-4e21-9a6f-1c2d3e4f5a6b'));
  assert.ok(!isUuid('nope'));
  assert.equal(titleFromContent('  你好\n\n世界  '.repeat(10)).length, 30);
});
