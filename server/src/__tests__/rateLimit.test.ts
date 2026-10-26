import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../rateLimit.ts';

test('窗口内超过上限即拒绝，窗口过后重置', () => {
  let now = 1_000;
  const rl = new RateLimiter(2, 60_000, () => now);
  assert.equal(rl.check('a'), null);
  assert.equal(rl.check('a'), null);
  assert.equal(rl.check('a'), 60);
  assert.equal(rl.check('b'), null, '不同 key 互不影响');
  now += 30_000;
  assert.equal(rl.check('a'), 30);
  now += 30_000;
  assert.equal(rl.check('a'), null);
});

test('sweep 清理过期窗口', () => {
  let now = 0;
  const rl = new RateLimiter(1, 1000, () => now);
  rl.check('a');
  now = 2000;
  rl.sweep();
  assert.equal(rl.check('a'), null);
});
