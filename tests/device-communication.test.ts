import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BiathlonDatabase } from '../src/db/dexieDb';
import { SyncService } from '../src/services/syncService';

test('realtime device messages are addressed and never need database rows', async () => {
  const database = new BiathlonDatabase(`communication-${crypto.randomUUID()}`);
  await database.devices.put({ id: 'START-01', name: 'Start laptop', stationName: 'Start', operatorName: 'Tim', role: 'START_OPERATOR', isLocked: false, clockOffsetMs: 0 });
  const service = new SyncService(database);
  service.getConfig = () => ({ enabled: true, eventId: 'event', projectUrl: 'https://test.invalid', anonKey: 'test' });
  const sent: any[] = [];
  Object.assign(service as any, {
    realtimeStatus: 'connected', realtimeKey: JSON.stringify(service.getConfig()),
    communicationChannel: {
      send: async (message: any) => { sent.push(message); return 'ok'; },
      track: async () => 'ok',
      presenceState: () => ({ one: [{ installationId: 'one', deviceId: 'START-01', role: 'START_OPERATOR', onlineAt: new Date().toISOString() }] }),
    },
  });

  await service.sendDeviceMessage('  Kom naar de start  ', 'finish-installation');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.text, 'Kom naar de start');
  assert.equal(sent[0].payload.targetInstallationId, 'finish-installation');
  assert.equal(service.getDeviceMessages().length, 1);
  assert.equal(await database.operations.count(), 0);
  await assert.rejects(service.sendDeviceMessage('   '), /Vul eerst/);
  await database.delete();
});
