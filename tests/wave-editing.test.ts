import 'fake-indexeddb/auto';
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/dexieDb';
import { updateWaveSettings } from '../src/services/waveEditing';
import type { Wave } from '../src/types';

const wave = (id: string, waveNumber: number): Wave => ({ id, eventId: 'event', waveNumber, name: id, scheduledStartTime: '10:00:00', maxParticipants: 25, categoryIds: [], status: 'SCHEDULED' });
after(async () => { assert.equal(db.name, 'BiathlonDeHaanDB-node-test'); await db.delete(); });

test('renumbering allows corrections and unchanged numbers, but rejects occupied and invalid numbers without saving other changes', async () => {
  await db.waves.bulkPut([wave('a', 1), wave('b', 2)]);
  await updateWaveSettings('a', { ...wave('a', 3), name: 'Corrected' });
  assert.equal((await db.waves.get('a'))?.waveNumber, 3);
  await updateWaveSettings('a', { ...wave('a', 3), name: 'Unchanged number' });
  for (const number of [2, 0, -1, 1.5, NaN]) {
    await assert.rejects(updateWaveSettings('a', { ...wave('a', number), name: 'Must not save' }));
    assert.equal((await db.waves.get('a'))?.waveNumber, 3);
    assert.equal((await db.waves.get('a'))?.name, 'Unchanged number');
  }
});

test('simultaneous corrections cannot claim the same number', async () => {
  await db.waves.bulkPut([wave('c', 4), wave('d', 5)]);
  const results = await Promise.allSettled([
    updateWaveSettings('c', wave('c', 6)),
    updateWaveSettings('d', wave('d', 6)),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(await db.waves.where('waveNumber').equals(6).count(), 1);
});
