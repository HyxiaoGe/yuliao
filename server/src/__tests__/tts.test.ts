import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JsonObjectSplitter } from '../tts.ts';

test('完整对象一次到达', () => {
  const s = new JsonObjectSplitter();
  assert.deepEqual(s.push('{"code":0,"data":"AA=="}'), ['{"code":0,"data":"AA=="}']);
});

test('一个 chunk 含多个对象，对象之间可有换行', () => {
  const s = new JsonObjectSplitter();
  assert.deepEqual(s.push('{"a":1}\n{"b":{"c":2}}'), ['{"a":1}', '{"b":{"c":2}}']);
});

test('对象跨 chunk 到达，字符串里的大括号和转义引号不计入', () => {
  const s = new JsonObjectSplitter();
  assert.deepEqual(s.push('{"t":"a}\\"'), []);
  assert.deepEqual(s.push('{b","n":{"x":1}'), []);
  assert.deepEqual(s.push('}{"d":2}'), ['{"t":"a}\\"{b","n":{"x":1}}', '{"d":2}']);
});

test('base64 大块分成很多片也能拼回', () => {
  const s = new JsonObjectSplitter();
  const obj = `{"code":0,"data":"${'QUJD'.repeat(500)}"}`;
  const out: string[] = [];
  for (let i = 0; i < obj.length; i += 7) out.push(...s.push(obj.slice(i, i + 7)));
  assert.deepEqual(out, [obj]);
});
