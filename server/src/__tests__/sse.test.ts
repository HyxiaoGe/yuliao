import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SseAccumulator } from '../sse.ts';

const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;

test('跨 chunk 拼接并忽略 [DONE] 与 reasoning', () => {
  const acc = new SseAccumulator();
  const line = chunk('世界');
  acc.push(chunk('你好') + line.slice(0, 8));
  acc.push(line.slice(8) + 'data: {"choices":[{"delta":{"reasoning_content":"x"}}]}\n' + 'data: [DONE]\n');
  acc.flush();
  assert.equal(acc.text, '你好世界');
});
