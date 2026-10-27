import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SseLineBuffer, extractDelta } from '../sse.ts';

const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;

test('按行切分，忽略 [DONE] 和空行', () => {
  const buf = new SseLineBuffer();
  const got = buf.push(`${chunk('你')}\n${chunk('好')}data: [DONE]\n\n`);
  assert.deepEqual(got.map(extractDelta), ['你', '好']);
});

test('跨 chunk 的半截行会被拼接', () => {
  const buf = new SseLineBuffer();
  const line = chunk('世界');
  const a = buf.push(line.slice(0, 10));
  const b = buf.push(line.slice(10));
  assert.deepEqual(a, []);
  assert.deepEqual(b.map(extractDelta), ['世界']);
});

test('没有换行结尾的最后一行由 flush 兜底，CRLF 也能处理', () => {
  const buf = new SseLineBuffer();
  const got = buf.push(`data: {"choices":[{"delta":{"content":"a"}}]}\r\ndata: {"choices":[{"delta":{"content":"b"}}]}`);
  assert.deepEqual(got.map(extractDelta), ['a']);
  assert.deepEqual(buf.flush().map(extractDelta), ['b']);
  assert.deepEqual(buf.flush(), []);
});

test('role 开头块和空 content 返回 null，error 字段抛错', () => {
  assert.equal(extractDelta(JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] })), null);
  assert.equal(extractDelta(JSON.stringify({ choices: [{ delta: { content: '' } }] })), null);
  assert.equal(extractDelta('not json'), null);
  assert.throws(() => extractDelta(JSON.stringify({ error: { message: 'bad key' } })), /bad key/);
});

test('extractSources 只取 url_citation，丢弃空 url，无 title 时用 url 顶替', () => {
  const payload = JSON.stringify({
    choices: [
      {
        delta: {
          annotations: [
            { type: 'url_citation', url_citation: { title: '空', url: '' } },
            { type: 'url_citation', url_citation: { title: '气象局', url: 'http://a.cn/x' } },
            { type: 'url_citation', url_citation: { url: 'https://b.cn/' } },
            { type: 'other', url_citation: { title: 'x', url: 'https://c.cn/' } },
          ],
        },
      },
    ],
  });
  assert.deepEqual(extractSources(payload), [
    { title: '气象局', url: 'http://a.cn/x' },
    { title: 'https://b.cn/', url: 'https://b.cn/' },
  ]);
  assert.deepEqual(extractSources('data'), []);
  assert.deepEqual(extractSources(JSON.stringify({ choices: [], usage: {} })), []);
});
