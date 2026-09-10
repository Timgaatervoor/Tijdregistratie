import { spawn } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

export function allowsLocalBackup(request: IncomingMessage) {
  const host = request.headers.host ?? '';
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '') &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host) &&
    request.headers['x-local-backup'] === '1' &&
    (!request.headers.origin || [`http://${host}`, `https://${host}`].includes(request.headers.origin)) &&
    (!request.headers['sec-fetch-site'] || request.headers['sec-fetch-site'] === 'same-origin');
}

export async function saveLocalBackup(directory: string, content: string) {
  const snapshot = JSON.parse(content);
  if (!snapshot.data?.event?.id || !Array.isArray(snapshot.data.participants) ||
      createHash('sha256').update(JSON.stringify(snapshot.data)).digest('hex') !== snapshot.checksum) {
    throw new Error('Ongeldige back-up of afwijkende checksum.');
  }
  await mkdir(directory, { recursive: true });
  const fileName = `biathlon-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.json`;
  const destination = path.join(directory, fileName);
  const temporary = `${destination}.tmp`;
  try {
    await writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return { fileName, path: destination };
}

async function openFolder(directory: string) {
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [directory], { shell: false, windowsHide: true, stdio: 'ignore', detached: true });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

export function localBackupPlugin(): Plugin {
  const install = (server: { config: { root: string }; middlewares: { use: Function } }) => {
    const root = path.resolve(server.config.root);
    const directory = path.join(root, 'backups');
    server.middlewares.use(async (request: IncomingMessage, response: ServerResponse, next: () => void) => {
      const route = (request.url ?? '').split('?')[0];
      // Backups contain private event data and must never be served as static files.
      let decodedRoute: string;
      try { decodedRoute = decodeURIComponent(route); } catch { response.statusCode = 400; response.end('Bad request'); return; }
      if (/(?:^|[\/\\])backups(?:[\/\\]|$)/i.test(decodedRoute)) {
        response.statusCode = 403; response.end('Forbidden'); return;
      }
      if (!route.startsWith('/api/local-backup/')) return next();
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      const reply = (status: number, data: unknown) => { response.statusCode = status; response.end(JSON.stringify(data)); };
      if (!allowsLocalBackup(request)) return reply(403, { error: 'Open de app op deze computer via localhost.' });
      try {
        if (route === '/api/local-backup/status' && request.method === 'GET') return reply(200, { directory, projectDirectory: root });
        if (request.method !== 'POST') return reply(405, { error: 'Actie niet toegestaan.' });
        if (route === '/api/local-backup/open' || route === '/api/local-backup/open-project') {
          const target = route.endsWith('open-project') ? root : directory;
          await mkdir(target, { recursive: true });
          await openFolder(target);
          return reply(200, { ok: true });
        }
        if (route !== '/api/local-backup/save') return reply(404, { error: 'Actie niet gevonden.' });
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of request) {
          const buffer = Buffer.from(chunk);
          size += buffer.length;
          if (size > 100 * 1024 * 1024) return reply(413, { error: 'Back-up is groter dan 100 MB. Gebruik de downloadknop.' });
          chunks.push(buffer);
        }
        return reply(200, await saveLocalBackup(directory, Buffer.concat(chunks).toString('utf8')));
      } catch (error) { reply(500, { error: `Lokale back-upactie mislukt: ${(error as Error).message}` }); }
    });
  };
  return { name: 'local-backup', configureServer: install, configurePreviewServer: install };
}
