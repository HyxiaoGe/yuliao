import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SentenceSplitter, stripForSpeech } from '../sentences.ts';

test('按句末标点切句，残句留到 flush', () => {
  const s = new SentenceSplitter();
  assert.deepEqual(s.push('你好。今天'), ['你好。']);
  assert.deepEqual(s.push('天气不错！还'), ['今天天气不错！']);
  assert.equal(s.flush(), '还');
  assert.equal(s.flush(), null);
});

test('流式到达的长句在逗号处提前切', () => {
  const s = new SentenceSplitter();
  const long = '一'.repeat(45) + '，' + '二'.repeat(10) + '。';
  const out: string[] = [];
  for (const ch of long) out.push(...s.push(ch));
  assert.deepEqual(out, ['一'.repeat(45) + '，', '二'.repeat(10) + '。']);
});

test('一次到达的长句，句末标点太远也在逗号切', () => {
  const s = new SentenceSplitter();
  const long = '一'.repeat(45) + '，' + '二'.repeat(30) + '。';
  assert.deepEqual(s.push(long), ['一'.repeat(45) + '，', '二'.repeat(30) + '。']);
});

test('第一段超过 8 字就在逗号切，之后恢复正常阈值', () => {
  const s = new SentenceSplitter();
  const out: string[] = [];
  for (const ch of '当然可以，下面我来介绍一下，这个东西很有意思。然后，是第二句。') out.push(...s.push(ch));
  assert.deepEqual(out, ['当然可以，下面我来介绍一下，', '这个东西很有意思。', '然后，是第二句。']);
});

test('第一段很短时不在逗号切', () => {
  const s = new SentenceSplitter();
  assert.deepEqual(s.push('嗯，好的。'), ['嗯，好的。']);
});

test('短句不在逗号切', () => {
  const s = new SentenceSplitter();
  const first = new SentenceSplitter();
  first.push('第一句。');
  assert.deepEqual(first.push('嗯，好的，'), []);
  assert.equal(first.flush(), '嗯，好的，');
  assert.deepEqual(s.push('嗯，好'), []);
});

test('stripForSpeech 去掉 Markdown', () => {
  assert.equal(stripForSpeech('**重点**：见 [文档](https://x.y)\n- 第一项\n`code`'), '重点：见 文档\n第一项\ncode');
});
