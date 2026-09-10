import { db } from '../db/dexieDb';
import type { Wave } from '../types';

export async function updateWaveSettings(id: string, changes: Pick<Wave, 'waveNumber' | 'name' | 'scheduledStartTime' | 'maxParticipants'>) {
  if (!Number.isSafeInteger(changes.waveNumber) || changes.waveNumber < 1) {
    throw new Error('Kies een positief geheel getal als startgroepnummer.');
  }
  await db.transaction('rw', db.waves, async () => {
    const wave = await db.waves.get(id);
    if (!wave) throw new Error('Deze startgroep bestaat niet meer.');
    const duplicate = await db.waves.where('eventId').equals(wave.eventId)
      .filter(other => other.id !== id && other.waveNumber === changes.waveNumber).first();
    if (duplicate) throw new Error(`Startgroepnummer ${changes.waveNumber} is al in gebruik. Kies een ander nummer.`);
    await db.waves.update(id, changes);
  });
}
