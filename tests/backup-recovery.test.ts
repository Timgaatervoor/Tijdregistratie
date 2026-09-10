import 'fake-indexeddb/auto';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/dexieDb';
import { createFullSnapshot, restoreSnapshot, validateRecoveryFile } from '../src/services/backupService';
import type { RaceEvent } from '../src/types';

after(async () => { assert.equal(db.name, 'BiathlonDeHaanDB-node-test'); await db.delete(); });

test('full backup survives JSON export and restores race records and corrected wave numbers', async () => {
  const event = { id: 'backup-event', name: 'Backup test', date: '2026-09-10', status: 'PREPARATION' } as RaceEvent;
  await db.events.put(event);
  await db.waves.put({ id: 'wave', eventId: event.id, waveNumber: 7, name: 'Startgroep', scheduledStartTime: '10:00:00', maxParticipants: 25, categoryIds: [], status: 'SCHEDULED' });
  await db.participants.put({ id: 'p', firstName: 'Test', lastName: 'Runner', categoryId: 'cat', raceProfileId: 'profile', waveId: 'wave', status: 'REGISTERED', createdAt: '', updatedAt: '' });
  await db.timingRecords.put({ id: 'time', eventId: event.id, participantId: 'p', type: 'FINISH', timestamp: '2026-09-10T10:20:00Z' } as any);
  await db.shootingResults.put({ id: 'shot', eventId: event.id, participantId: 'p', round: 1, hits: 4 } as any);
  const snapshot = await createFullSnapshot(event);
  const copy = JSON.parse(JSON.stringify(snapshot));
  assert.equal((await validateRecoveryFile(JSON.stringify(copy))).isValid, true);
  await db.waves.update('wave', { waveNumber: 8 });
  await db.participants.clear();
  await db.timingRecords.clear();
  await db.shootingResults.clear();
  await restoreSnapshot(copy);
  assert.equal((await db.waves.get('wave'))?.waveNumber, 7);
  assert.equal((await db.participants.get('p'))?.waveId, 'wave');
  assert.equal(await db.timingRecords.count(), 1);
  assert.equal(await db.shootingResults.count(), 1);
  copy.data.waves[0].waveNumber = 99;
  assert.equal((await validateRecoveryFile(JSON.stringify(copy))).isValid, false);
  await assert.rejects(restoreSnapshot(copy), /checksum/);
  assert.equal((await db.waves.get('wave'))?.waveNumber, 7);
  const malformed = { event, participants: [], waves: {} };
  assert.equal((await validateRecoveryFile(JSON.stringify(malformed))).isValid, false);
});
