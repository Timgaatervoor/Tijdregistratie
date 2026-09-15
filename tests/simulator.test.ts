import 'fake-indexeddb/auto';
import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/db/dexieDb';
import { simulateRace } from '../src/services/simulatorService';
import type { Participant } from '../src/types';

beforeEach(async () => {
  assert.equal(db.name, 'BiathlonDeHaanDB-node-test');
  await db.delete();
  await db.open();
  await db.events.put({ id: 'simulation-event' } as any);
  await db.waves.put({ id: 'later-wave', waveNumber: 3 } as any);
});

after(async () => {
  assert.equal(db.name, 'BiathlonDeHaanDB-node-test');
  await db.delete();
});

for (const bibs of [[undefined, 11, undefined, 12, 13], [11, 12, undefined], [11, 12, 13], [undefined, undefined]]) {
  test(`simulation keeps each participant's start time with bibs ${JSON.stringify(bibs)}`, async () => {
    const participants: Participant[] = bibs.map((bibNumber, i) => ({
      id: `participant-${i}`, firstName: 'Test', lastName: `${i}`, bibNumber,
      categoryId: 'category', raceProfileId: 'profile',
      waveId: i % 2 ? 'later-wave' : undefined,
      status: 'REGISTERED', createdAt: '', updatedAt: '',
    }));
    await db.participants.bulkPut(participants);
    const savedParticipants = await db.participants.toArray();
    const progress: number[] = [];

    await simulateRace((_step, percent) => progress.push(percent));

    const timing = await db.timingRecords.toArray();
    const shooting = await db.shootingResults.toArray();
    const eligibleCount = bibs.filter(Boolean).length;
    assert.equal(timing.length, eligibleCount * 2);
    assert.equal(shooting.length, eligibleCount * 2);
    assert.equal(progress.at(-1), 100);
    assert.equal(await db.auditLogs.where('action').equals('SIMULATION_COMPLETED').count(), 1);

    for (const [i, participant] of participants.entries()) {
      const records = timing.filter(record => record.participantId === participant.id);
      const shots = shooting.filter(record => record.participantId === participant.id);
      const updated = await db.participants.get(participant.id);
      if (!participant.bibNumber) {
        assert.equal(records.length, 0);
        assert.equal(shots.length, 0);
        assert.deepEqual(updated, savedParticipants.find(saved => saved.id === participant.id));
        continue;
      }
      const start = records.find(record => record.type === 'START');
      const finish = records.find(record => record.type === 'FINISH');
      assert.ok(start);
      assert.ok(finish);
      const startMs = Date.parse('2026-09-19T09:00:00.000Z') + (i % 2 ? 24 * 60 * 1000 : 0) + (i % 5) * 500;
      assert.equal(Date.parse(start.timestamp), startMs);
      assert.equal(Date.parse(finish.timestamp) - startMs, (24 * 60 + ((i * 19) % (25 * 60))) * 1000 + (i * 1234) % 1000);
      assert.equal(Date.parse(shots.find(shot => shot.round === 1)!.timestamp) - startMs, (7 + i % 8) * 60 * 1000);
      assert.equal(Date.parse(shots.find(shot => shot.round === 2)!.timestamp) - startMs, (16 + i % 12) * 60 * 1000);
      assert.ok([...records, ...shots].every(record => record.bibNumber === participant.bibNumber));
      assert.equal(updated?.status, 'FINISHED');
    }
  });
}
