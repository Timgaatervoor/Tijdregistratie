import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepScreenAwake, type ScreenAwakeStatus } from '../src/services/screenWakeLock';

class Page extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  show(visible: boolean) {
    this.visibilityState = visible ? 'visible' : 'hidden';
    this.dispatchEvent(new Event('visibilitychange'));
  }
}
class Lock extends EventTarget {
  released = false;
  async release() { this.released = true; this.dispatchEvent(new Event('release')); }
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('wake lock resumes after returning to the page and is released on exit', async () => {
  const page = new Page();
  const states: ScreenAwakeStatus[] = [];
  const locks: Lock[] = [];
  const session = keepScreenAwake(page, { request: async type => {
    assert.equal(type, 'screen');
    const lock = new Lock(); locks.push(lock); return lock as WakeLockSentinel;
  } }, true, status => states.push(status));
  await tick();
  assert.equal(states.at(-1), 'active');
  page.dispatchEvent(new Event('pointerdown'));
  assert.equal(locks.length, 1);
  page.show(false);
  assert.equal(locks[0].released, true);
  page.show(true);
  await tick();
  assert.equal(locks.length, 2);
  assert.equal(states.at(-1), 'active');
  session.stop();
  assert.equal(locks[1].released, true);
  page.show(true);
  page.dispatchEvent(new Event('pointerdown'));
  await tick();
  assert.equal(locks.length, 2);
});

test('a request completing after exit immediately releases without updating the UI', async () => {
  const states: ScreenAwakeStatus[] = [];
  let resolve!: (value: WakeLockSentinel) => void;
  const session = keepScreenAwake(new Page(), { request: () => new Promise(done => { resolve = done; }) }, true, status => states.push(status));
  session.stop();
  const lock = new Lock();
  resolve(lock as WakeLockSentinel);
  await tick();
  assert.equal(lock.released, true);
  assert.deepEqual(states, ['requesting']);
});

test('browser refusal can be retried and system release is shown honestly', async () => {
  const states: ScreenAwakeStatus[] = [];
  let attempts = 0;
  const lock = new Lock();
  const session = keepScreenAwake(new Page(), { request: async () => {
    if (++attempts === 1) throw new Error('Low battery');
    return lock as WakeLockSentinel;
  } }, true, status => states.push(status));
  await tick();
  assert.equal(states.at(-1), 'inactive');
  await session.request();
  assert.equal(states.at(-1), 'active');
  await lock.release();
  assert.equal(states.at(-1), 'inactive');
  session.stop();
});

test('unsupported browsers and insecure connections show a useful status', () => {
  for (const [secure, expected] of [[true, 'unavailable'], [false, 'https-required']] as const) {
    const states: ScreenAwakeStatus[] = [];
    const session = keepScreenAwake(new Page(), undefined, secure, status => states.push(status));
    assert.equal(states.at(-1), expected);
    session.stop();
  }
});
