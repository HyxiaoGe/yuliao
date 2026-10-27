import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SseAccumulator, extractSources } from '../sse.ts';

const chunk = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;

test('跨 chunk 拼接并忽略 [DONE] 与 reasoning', () => {
  const acc = new SseAccumulator();
  const line = chunk('世界');
  acc.push(chunk('你好') + line.slice(0, 8));
  acc.push(line.slice(8) + 'data: {"choices":[{"delta":{"reasoning_content":"x"}}]}\n' + 'data: [DONE]\n');
  acc.flush();
  assert.equal(acc.text, '你好世界');
});

test('收集引用来源（按 url 去重、丢弃空 url）与搜索次数', () => {
  const acc = new SseAccumulator();
  const ann = (list: unknown[]) => `data: ${JSON.stringify({ choices: [{ delta: { annotations: list } }] })}\n`;
  acc.push(chunk('今天'));
  acc.push(ann([{ type: 'url_citation', url_citation: { title: '空', url: '' } }, { type: 'url_citation', url_citation: { title: '气象局', url: 'http://a.cn/x' } }]));
  acc.push(ann([{ type: 'url_citation', url_citation: { title: '重复', url: 'http://a.cn/x' } }, { type: 'url_citation', url_citation: { url: 'https://b.cn/' } }]));
  acc.push('data: {"choices":[],"usage":{"tool_usage":{"web_search":2}}}\n');
  acc.flush();
  assert.equal(acc.text, '今天');
  assert.deepEqual(acc.sources, [
    { title: '气象局', url: 'http://a.cn/x' },
    { title: 'https://b.cn/', url: 'https://b.cn/' },
  ]);
  assert.equal(acc.searchCount, 2);
});

test('extractSources 对非数组输入返回空', () => {
  assert.deepEqual(extractSources(undefined), []);
  assert.deepEqual(extractSources('x'), []);
});
