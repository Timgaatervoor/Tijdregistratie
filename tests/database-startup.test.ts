import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Dexie from 'dexie';
import { DatabaseStartup } from '../src/db/databaseStartup';

test('blocked upgrades report the cause and resume without deleting existing data', async () => {
  const name = `blocked-${crypto.randomUUID()}`;
  const old = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, 10);
    req.onupgradeneeded = () => req.result.createObjectStore('records', { keyPath: 'id' }).put({ id: 'saved', value: 42 });
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  const database = new Dexie(name);
  database.version(1).stores({ records: 'id' });
  database.version(2).stores({ records: 'id, value' });
  const startup = new DatabaseStartup(database, 1000);
  let release: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const unsubscribe = startup.subscribe(() => { if (startup.getStatus().state === 'blocked') release(); });
  let timeout: ReturnType<typeof setTimeout>;
  try {
    const opening = startup.open();
    assert.equal(startup.open(), opening, 'polling shares the same pending open');
    await Promise.race([blocked, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Blocked event missing')), 2000); })]);
    assert.match(startup.getStatus().message!, /ander tabblad/);
    old.close(); await opening;
    assert.equal(startup.getStatus().state, 'ready');
    assert.equal((await database.table('records').get('saved')).value, 42);
  } finally { clearTimeout(timeout); unsubscribe(); old.close(); await database.delete(); }
});

test('slow open shows recovery instructions and still completes the original request', async () => {
  const database = new Dexie(`slow-${crypto.randomUUID()}`);
  let finish: (db: Dexie) => void;
  database.open = () => new Promise<Dexie>(resolve => { finish = resolve; }) as any;
  const startup = new DatabaseStartup(database, 5);
  let slow: () => void;
  const notified = new Promise<void>(resolve => { slow = resolve; });
  startup.subscribe(() => { if (startup.getStatus().state === 'slow') slow(); });
  const pending = startup.open(); await notified;
  assert.match(startup.getStatus().message!, /Wis geen/);
  assert.equal(startup.open(), pending);
  finish(database); await pending;
  assert.equal(startup.getStatus().state, 'ready');
});

test('open failure is surfaced and can be retried', async () => {
  const database = new Dexie(`error-${crypto.randomUUID()}`);
  database.version(1).stores({ records: 'id' });
  const realOpen = database.open.bind(database);
  database.open = () => Promise.reject(new Error('Storage unavailable')) as any;
  const startup = new DatabaseStartup(database);
  await assert.rejects(startup.open(), /Storage unavailable/);
  assert.equal(startup.getStatus().state, 'error');
  database.open = realOpen; await startup.open();
  assert.equal(startup.getStatus().state, 'ready');
  await database.delete();
});
