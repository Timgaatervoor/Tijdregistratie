import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RaceClock } from '../src/services/raceClock';

const base = Date.parse('2026-09-10T12:00:00Z');

test('network failures never calibrate the clock against local wall time', async (t) => {
  for (const [name, fetchSample] of [
    ['unreachable', async () => { throw new Error('offline'); }],
    ['HTTP failure', async () => new Response('', { status: 503 })],
    ['invalid date', async () => Response.json({ utc_datetime: 'invalid' })],
    ['missing date', async () => Response.json({})],
    ['invalid JSON', async () => new Response('invalid JSON')],
  ] as const) {
    await t.test(name, async (t) => {
      t.mock.method(globalThis, 'fetch', fetchSample);
      const clock = new RaceClock(() => base, () => 0);
      const status = await clock.syncWithNetwork();
      assert.equal(status.state, 'UNSYNCED');
      assert.equal(status.syncedAt, undefined);
      assert.equal(status.uncertaintyMs, undefined);
      assert.ok(status.error);
      assert.equal(clock.nowMs(), base, 'local fallback is still usable');
    });
  }
});

test('network success uses server time; failed remeasurement preserves it with an error', async (t) => {
  let mono = 0;
  const clock = new RaceClock(() => base - 5000, () => mono);
  const fetchMock = t.mock.method(globalThis, 'fetch', async (input, init) => {
    assert.equal(input, 'https://worldtimeapi.org/api/timezone/Etc/UTC');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal);
    mono += 20;
    return Response.json({ utc_datetime: new Date(base + mono - 10).toISOString() });
  });
  const status = await clock.syncWithNetwork();
  assert.equal(status.state, 'SYNCED');
  assert.equal(status.error, undefined);
  assert.equal(status.source, 'network');
  assert.ok(status.uncertaintyMs! < 12);
  assert.equal(clock.nowMs(), base + mono);
  fetchMock.mock.mockImplementation(async () => { throw new Error('offline'); });
  const failed = await clock.syncWithNetwork();
  assert.equal(failed.syncedAt, status.syncedAt);
  assert.equal(failed.error, 'offline', 'a resolved promise is not evidence of success');
  mono += 360000;
  assert.equal(clock.status().state, 'STALE');
});

test('network sampling rejects slow measurements and permits a later retry', async () => {
  let mono = 0;
  const clock = new RaceClock(() => base, () => mono);
  const failed = await clock.syncWithNetwork('network', async () => { mono += 2100; return base; });
  assert.equal(failed.state, 'UNSYNCED');
  const recovered = await clock.syncWithNetwork('network', async () => base);
  assert.equal(recovered.state, 'SYNCED');
  assert.equal(recovered.error, undefined);
});
