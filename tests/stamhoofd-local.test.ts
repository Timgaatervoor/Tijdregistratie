import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createLocalStamhoofd, isLocalRequest, stamhoofdLocalPlugin } from '../server/stamhoofdLocal';

test('local credentials reject LAN clients, DNS rebinding and cross-origin requests', () => {
  const request = (headers = {}, remoteAddress = '127.0.0.1') => ({ socket: { remoteAddress }, headers: { host: 'localhost:3000', 'x-stamhoofd-local': '1', ...headers } }) as unknown as IncomingMessage;
  assert.equal(isLocalRequest(request()), true);
  assert.equal(isLocalRequest(request({}, '192.168.1.2')), false);
  assert.equal(isLocalRequest(request({ host: 'attacker.example:3000' })), false);
  assert.equal(isLocalRequest(request({ origin: 'https://attacker.example' })), false);
  assert.equal(isLocalRequest(request({ 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(isLocalRequest(request({ 'x-stamhoofd-local': undefined })), false);
});

test('local key persists across restarts and is used only for upstream requests', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'stamhoofd-local-test-'));
  let middleware = createLocalStamhoofd(root);
  const server = createServer((req, res) => void middleware(req, res, () => { res.statusCode = 404; res.end(); }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const transport = globalThis.fetch;
  const local = (route: string, init: RequestInit = {}) => transport(`${base}/api/stamhoofd${route}`, { ...init, headers: { 'X-Stamhoofd-Local': '1', ...init.headers } });
  const key = 'local-test-placeholder-'.repeat(3);
  try {
    assert.deepEqual(await (await local('/health')).json(), { local: true, configured: false });
    const denied = await local('/configure', { method: 'POST', headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
    assert.equal(denied.status, 403);
    const configured = await local('/configure', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
    assert.equal(configured.status, 200);
    assert.ok(!(await configured.text()).includes(key));
    assert.ok((await readFile(path.join(root, '.env.stamhoofd.local'), 'utf8')).includes(key));
    middleware = createLocalStamhoofd(root);
    assert.deepEqual(await (await local('/health')).json(), { local: true, configured: true });
    const calls: { url: string; authorization?: string }[] = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), authorization: (init?.headers as Record<string, string>)?.Authorization });
      if (String(url).includes('/webshop/orders') || String(url).includes('/tickets/private')) return Response.json({ results: [], next: null });
      return Response.json({ id: '603e808b-9ac6-47cb-933c-bf7b4c66f357', meta: { name: 'Local test' } });
    };
    const response = await local('/sync?organizationId=af201d93-dcd6-4cfe-bfc7-ed3d2a209236&webshopId=603e808b-9ac6-47cb-933c-bf7b4c66f357');
    assert.equal(response.status, 200);
    assert.ok(!(await response.text()).includes(key));
    assert.equal(calls.length, 3);
    assert.ok(calls.every(call => call.authorization === `Bearer ${key}` && call.url.startsWith('https://af201d93-dcd6-4cfe-bfc7-ed3d2a209236.api.stamhoofd.app/v417/')));
    const invalid = await local('/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'invalid\nINJECT=value' }) });
    assert.equal(invalid.status, 400);
    assert.ok((await readFile(path.join(root, '.env.stamhoofd.local'), 'utf8')).includes(key));
  } finally {
    globalThis.fetch = transport;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('stamhoofd-local-test-'));
    await rm(root, { recursive: true, force: true });
  }
});

test('Vite starts local middleware automatically and does not serve the saved secret file', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'stamhoofd-local-test-'));
  const vite = await createViteServer({ root, configFile: false, logLevel: 'silent', plugins: [stamhoofdLocalPlugin()], server: { host: '127.0.0.1', port: 0 } });
  try {
    await vite.listen();
    const base = `http://127.0.0.1:${(vite.httpServer.address() as { port: number }).port}`;
    const key = 'vite-local-test-placeholder';
    const response = await fetch(`${base}/api/stamhoofd/configure`, { method: 'POST', headers: { 'X-Stamhoofd-Local': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
    assert.equal(response.status, 200);
    for (const suffix of ['', '?raw', '?url', '?import']) {
      const file = await fetch(`${base}/.env.stamhoofd.local${suffix}`);
      assert.equal(file.status, 403);
      assert.ok(!(await file.text()).includes(key));
    }
  } finally {
    await vite.close();
    assert.equal(path.dirname(root), path.resolve(tmpdir()));
    assert.ok(path.basename(root).startsWith('stamhoofd-local-test-'));
    await rm(root, { recursive: true, force: true });
  }
});
