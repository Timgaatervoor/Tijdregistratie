import { db } from '../db/dexieDb';
import { getSyncDeviceId } from '../db/syncJournal';
import type { Wave } from '../types';
import { operationService } from './operationService';
import { raceClock } from './raceClock';

export function scheduledWaveTime(wave: Pick<Wave, 'scheduledStartTime'>, date: string): number {
  const time = wave.scheduledStartTime;
  if (/^\d{4}-\d{2}-\d{2}T/.test(time)) return Date.parse(time);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) return NaN;
  const parsed = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  // Reject invalid dates and local times skipped by a daylight-saving transition.
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month && parsed.getDate() === day && parsed.getHours() === hour && parsed.getMinutes() === minute ? parsed.getTime() : NaN;
}

export async function setAutomaticWaveStart(waveId: string, enabled: boolean) {
  await db.transaction('rw', [db.events, db.waves, db.auditLogs], async () => {
    const wave = await db.waves.get(waveId);
    if (!wave || wave.status !== 'SCHEDULED' || wave.actualStartTime) throw new Error('Deze startgroep is al gestart of bestaat niet meer.');
    const event = await db.events.get(wave.eventId);
    if (!event || event.officialResultsLocked) throw new Error('Het evenement ontbreekt of de uitslagen zijn vergrendeld.');
    const time = scheduledWaveTime(wave, event.date);
    if (enabled && (!Number.isFinite(time) || time <= raceClock.nowMs())) throw new Error('Kies een geldige wedstrijddatum en een gepland startuur in de toekomst.');
    await db.waves.update(waveId, { autoStartEnabled: enabled, autoStartDeviceId: enabled ? getSyncDeviceId() : undefined, autoStartAt: enabled ? new Date(time).toISOString() : undefined });
    await operationService.logAudit('WAVE_AUTO_START', `${wave.name}: automatisch starten ${enabled ? 'aan' : 'uit'}`);
  });
}

export async function startDueWave(waveId: string, now = raceClock.nowMs()): Promise<{ started: boolean; error?: string }> {
  return db.transaction('rw', [db.events, db.waves, db.participants, db.timingRecords, db.shootingResults, db.operations, db.auditLogs, db.conflicts], async () => {
    const wave = await db.waves.get(waveId);
    if (!wave?.autoStartEnabled || wave.autoStartDeviceId !== getSyncDeviceId() || wave.status !== 'SCHEDULED' || wave.actualStartTime) return { started: false };
    const event = await db.events.get(wave.eventId);
    const scheduled = event ? scheduledWaveTime(wave, event.date) : NaN;
    const armedTime = Date.parse(wave.autoStartAt ?? '');
    let error: string | undefined;
    if (!event || event.officialResultsLocked) error = 'Het evenement ontbreekt of de uitslagen zijn vergrendeld.';
    else if (!Number.isFinite(scheduled) || scheduled !== armedTime) error = 'Datum of startuur gewijzigd; schakel automatisch starten opnieuw in.';
    else if (now < scheduled) return { started: false };
    // Do not silently backdate a race after a closed/suspended browser resumes.
    else if (now - scheduled > 5000) error = 'Startuur gemist doordat de app niet tijdig actief was. Start de groep handmatig.';
    if (error) {
      await db.waves.update(waveId, { autoStartEnabled: false });
      await operationService.logAudit('WAVE_AUTO_START_FAILED', `${wave.name}: ${error}`);
      return { started: false, error: `${wave.name}: ${error}` };
    }
    const participants = await db.participants.where('waveId').equals(waveId).toArray();
    await operationService.recordMassWaveStart(wave.eventId, wave.id, wave.waveNumber, participants, new Date(scheduled).toISOString());
    return { started: true };
  });
}
