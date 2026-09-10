import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:http';
import { allowsLocalBackup, saveLocalBackup, localBackupPlugin } from '../server/localBackup';

test('local folder actions reject remote clients and cross-origin requests', () => {
  const request = (headers = {}, remoteAddress = '127.0.0.1') => ({ socket: { remoteAddress }, headers: { host: 'localhost:3000', 'x-local-backup': '1', ...headers } }) as unknown as IncomingMessage;
  assert.equal(allowsLocalBackup(request()), true);
  assert.equal(allowsLocalBackup(request({}, '192.168.1.2')), false);
  assert.equal(allowsLocalBackup(request({ host: 'attacker.test' })), false);
  assert.equal(allowsLocalBackup(request({ origin: 'https://attacker.test' })), false);
  assert.equal(allowsLocalBackup(request({ 'x-local-backup': undefined })), false);
});

test('disk backup preserves Unicode and checksum, never overwrites and rejects corruption', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tijdregistratie-backup-test-'));
  try {
    const data = { event: { id: 'test', name: 'Wedstrijd België' }, participants: [] };
    const snapshot = { data, checksum: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
    const content = JSON.stringify(snapshot);
    const first = await saveLocalBackup(directory, content);
    const second = await saveLocalBackup(directory, content);
    assert.notEqual(first.path, second.path);
    assert.equal(await readFile(first.path, 'utf8'), content);
    assert.equal((await readdir(directory)).length, 2);
    await assert.rejects(saveLocalBackup(directory, content.replace('België', 'changed')), /checksum/);
    assert.equal((await readdir(directory)).length, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('local API exposes folder status, saves a backup and blocks static backup downloads', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tijdregistratie-api-test-'));
  let middleware: any;
  const plugin = localBackupPlugin();
  (plugin.configureServer as Function)({ config: { root }, middlewares: { use: (handler: unknown) => { middleware = handler; } } });
  const server = createServer((req, res) => void middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    const headers = { 'X-Local-Backup': '1', 'Content-Type': 'application/json' };
    const status = await fetch(`${base}/api/local-backup/status`, { headers });
    assert.equal((await status.json()).directory, path.join(root, 'backups'));
    assert.equal((await fetch(`${base}/api/local-backup/status`)).status, 403);
    const data = { event: { id: 'test' }, participants: [] };
    const snapshot = { data, checksum: createHash('sha256').update(JSON.stringify(data)).digest('hex') };
    const saved = await fetch(`${base}/api/local-backup/save`, { method: 'POST', headers, body: JSON.stringify(snapshot) });
    assert.equal(saved.status, 200);
    const result = await saved.json();
    assert.deepEqual(JSON.parse(await readFile(result.path, 'utf8')), snapshot);
    assert.equal((await fetch(`${base}/backups/${result.fileName}`)).status, 403);
    assert.equal((await fetch(`${base}/%62ackups/${result.fileName}`)).status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
