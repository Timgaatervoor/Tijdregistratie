import 'fake-indexeddb/auto';
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/dexieDb';
import { scheduledWaveTime, setAutomaticWaveStart, startDueWave } from '../src/services/automaticWaveStart';
import { updateWaveSettings } from '../src/services/waveEditing';
import { operationService } from '../src/services/operationService';
import type { Participant, RaceEvent, Wave } from '../src/types';

const wave: Wave = { id: 'w', eventId: 'e', name: 'Wave 1', waveNumber: 1, scheduledStartTime: '12:00:00', categoryIds: [], maxParticipants: 25, status: 'SCHEDULED' };
const due = scheduledWaveTime(wave, '2099-06-01');
const runner: Participant = { id: 'p', eventId: 'e', firstName: 'Test', lastName: 'Loper', bibNumber: 1, waveId: 'w', categoryId: 'c', raceProfileId: 'r', status: 'READY', createdAt: '', updatedAt: '' };
beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  await db.events.put({ id: 'e', date: '2099-06-01' } as RaceEvent);
  await db.waves.put(wave);
  await db.participants.put(runner);
});
after(async () => { await db.delete(); });

test('automatic start is off by default and only runs once at the planned timestamp', async () => {
  assert.equal((await startDueWave('w', due)).started, false);
  await setAutomaticWaveStart('w', true);
  assert.equal((await startDueWave('w', due - 1)).started, false);
  const results = await Promise.all([startDueWave('w', due + 100), startDueWave('w', due + 100)]);
  assert.equal(results.filter(r => r.started).length, 1);
  assert.equal(await db.timingRecords.count(), 1);
  assert.equal((await db.timingRecords.toCollection().first())?.timestamp, new Date(due).toISOString());
  assert.equal((await db.waves.get('w'))?.autoStartEnabled, false);
});

test('automatic start uses current attendance and keeps individual DNS starts possible', async () => {
  await setAutomaticWaveStart('w', true);
  await operationService.setWaveStartAbsence('e', 'p', true);
  assert.equal((await startDueWave('w', due)).started, true);
  assert.equal((await db.participants.get('p'))?.status, 'DNS');
  assert.equal(await db.timingRecords.count(), 0);
  await operationService.recordStart('e', 1, runner, new Date(due + 60000).toISOString(), 0);
  assert.equal((await db.participants.get('p'))?.status, 'STARTED');
});

test('disabled automatic starts and other devices never trigger a wave', async () => {
  await setAutomaticWaveStart('w', true);
  await setAutomaticWaveStart('w', false);
  assert.equal((await startDueWave('w', due)).started, false);
  await setAutomaticWaveStart('w', true);
  await db.waves.update('w', { autoStartDeviceId: 'another-device' });
  assert.equal((await startDueWave('w', due)).started, false);
  assert.equal(await db.timingRecords.count(), 0);
});

test('manual start cancels an armed automatic start', async () => {
  await setAutomaticWaveStart('w', true);
  await operationService.recordMassWaveStart('e', 'w', 1, [runner], new Date(due - 1000).toISOString());
  assert.equal((await startDueWave('w', due)).started, false);
  assert.equal(await db.timingRecords.count(), 1);
});

test('missed schedules, locked results and changed dates disarm without backdated starts', async () => {
  await setAutomaticWaveStart('w', true);
  assert.match((await startDueWave('w', due + 5001)).error!, /gemist/);
  await setAutomaticWaveStart('w', true);
  await db.events.update('e', { officialResultsLocked: true });
  assert.match((await startDueWave('w', due)).error!, /vergrendeld/);
  await db.events.update('e', { officialResultsLocked: false });
  await setAutomaticWaveStart('w', true);
  await db.events.update('e', { date: '2099-06-02' });
  assert.match((await startDueWave('w', due)).error!, /gewijzigd/);
  assert.equal(await db.timingRecords.count(), 0);
});

test('changing start time disarms and invalid or past schedules cannot be enabled', async () => {
  await setAutomaticWaveStart('w', true);
  await updateWaveSettings('w', { ...wave, scheduledStartTime: '12:10:00' });
  assert.equal((await db.waves.get('w'))?.autoStartEnabled, false);
  await db.events.update('e', { date: '2000-01-01' });
  await assert.rejects(setAutomaticWaveStart('w', true), /toekomst/);
  assert.ok(Number.isNaN(scheduledWaveTime({ scheduledStartTime: '25:00' }, '2099-06-01')));
  assert.ok(Number.isNaN(scheduledWaveTime(wave, '2099-02-30')));
  assert.equal(scheduledWaveTime({ scheduledStartTime: '2099-06-01T10:00:00Z' }, ''), Date.parse('2099-06-01T10:00:00Z'));
});
