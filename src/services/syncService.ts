import { raceClock } from './raceClock';
import { db } from '../db/dexieDb';
import type { RaceOperation, ShootingResult, TimingRecord } from '../types';

export type NetworkState = 'ONLINE_SYNCED' | 'OFFLINE_PENDING' | 'SYNCING' | 'SYNC_ERROR';

export interface SyncConfig {
  enabled: boolean;
  projectUrl: string;
  anonKey: string;
  eventId: string;
}

const SYNC_CONFIG_KEY = 'biathlon_sync_config';

const defaultConfig: SyncConfig = {
  enabled: false,
  projectUrl: '',
  anonKey: '',
  eventId: '',
};

class SyncService {
  private isSimulatedOffline = false;
  private listeners: Array<() => void> = [];
  private clockCheck?: Promise<number>;
  private syncing?: Promise<{ syncedCount: number; error?: string }>;
  private lastError?: string;
  private lastSyncAt?: string;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.triggerChange());
      window.addEventListener('offline', () => this.triggerChange());

      // Periodic check of clock sync against reference
      void this.checkClockOffset();
      window.setInterval(() => { void this.checkClockOffset(); }, 60000);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private triggerChange() {
    this.listeners.forEach((l) => l());
  }

  public getIsSimulatedOffline(): boolean {
    return this.isSimulatedOffline;
  }

  public getConfig(): SyncConfig {
    if (typeof localStorage === 'undefined') return { ...defaultConfig };
    try {
      return { ...defaultConfig, ...JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || '{}') };
    } catch {
      return { ...defaultConfig };
    }
  }

  public saveConfig(config: SyncConfig): void {
    const normalized = {
      ...config,
      projectUrl: config.projectUrl.trim().replace(/\/$/, ''),
      anonKey: config.anonKey.trim(),
      eventId: config.eventId.trim(),
    };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(normalized));
    }
    raceClock.reset(normalized.projectUrl);
    if (normalized.enabled) void this.checkClockOffset();
    this.triggerChange();
  }

  public async testConnection(config = this.getConfig()): Promise<{ ok: boolean; error?: string }> {
    if (!config.projectUrl || !config.anonKey) {
      return { ok: false, error: 'Supabase Project URL en anon key zijn verplicht.' };
    }

    try {
      const response = await fetch(`${config.projectUrl}/rest/v1/race_operations?select=operation_id&limit=1`, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      });
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 180);
        if (response.status === 401) {
          return { ok: false, error: 'HTTP 401: de publishable/anon key is ongeldig of onvolledig.' };
        }
        if (response.status === 404) {
          return { ok: false, error: 'HTTP 404: tabel race_operations bestaat nog niet.' };
        }
        if (response.status === 403) {
          return { ok: false, error: 'HTTP 403: RLS blokkeert lezen. Voeg de SELECT-policy uit de handleiding toe.' };
        }
        return { ok: false, error: `Supabase antwoordde met HTTP ${response.status}: ${detail}` };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: 'Supabase is niet bereikbaar. Controleer URL en internetverbinding.' };
    }
  }

  public setSimulatedOffline(offline: boolean) {
    this.isSimulatedOffline = offline;
    this.triggerChange();
  }

  public getClockOffsetMs(): number { return raceClock.status().offsetMs; }
  public getClockStatus() { return raceClock.status(); }
  public getSyncHealth() { return { lastError: this.lastError, lastSyncAt: this.lastSyncAt }; }
  public checkClockOffset(): Promise<number> {
    if (this.clockCheck) return this.clockCheck;
    const config = this.getConfig();
    if (!config.enabled || !config.projectUrl || !config.anonKey || this.isSimulatedOffline) return Promise.resolve(raceClock.status().offsetMs);
    this.clockCheck = raceClock.synchronize(config.projectUrl, async () => {
      const response = await fetch(`${config.projectUrl}/rest/v1/rpc/race_server_time`, {
        method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(3000),
        headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!response.ok) throw new Error(`Tijdserver HTTP ${response.status}. Installeer supabase/reliability.sql in dit project.`);
      return Number(await response.json());
    }).then(status => { this.triggerChange(); return status.offsetMs; }).finally(() => { this.clockCheck = undefined; });
    return this.clockCheck;
  }

  private async refreshParticipantStatus(participantId: string) {
    const p = await db.participants.get(participantId);
    if (!p || ['DNS', 'DNF', 'DSQ'].includes(p.status)) return;
    const timing = (await db.timingRecords.toArray()).filter(t => !t.isReversed && (t.participantId === p.id || t.bibNumber === p.bibNumber));
    await db.participants.update(p.id, { status: timing.some(t => t.type === 'FINISH') ? 'FINISHED' : timing.some(t => t.type === 'START') ? 'STARTED' : 'READY' });
  }

  public async getPendingCount(): Promise<number> {
    try {
      return await db.operations.where('syncStatus').equals('LOCAL_ONLY').count();
    } catch {
      return 0;
    }
  }

  private async applyRemoteOperation(operation: RaceOperation): Promise<void> {
    const payload = operation.payload || {};

    if (operation.type === 'START_RECORDED' || operation.type === 'FINISH_RECORDED') {
      const recordId = String(payload.recordId || '');
      if (!recordId || (await db.timingRecords.get(recordId))) return;

      const record: TimingRecord = {
        id: recordId,
        eventId: operation.eventId,
        participantId: operation.participantId,
        bibNumber: Number(payload.bibNumber || 0),
        type: operation.type === 'START_RECORDED' ? 'START' : 'FINISH',
        timestamp: String(payload.timestamp || operation.deviceTimestamp),
        monotonicMs: Number(payload.monotonicMs || 0),
        clockOffsetMs: Number(payload.clockOffsetMs || 0),
        clockSource: payload.clockSource, clockUncertaintyMs: payload.clockUncertaintyMs,
        clockSyncedAt: payload.clockSyncedAt, localTimestamp: payload.localTimestamp,
        deviceId: operation.deviceId,
        operatorId: operation.operatorId,
        isUnknownBib: Boolean(payload.isUnknownBib),
        isConfirmed: true,
        syncStatus: 'SYNCED',
      };
      // A revoke can arrive before its original record (same upload batch or offline devices).
      const revokes = (await db.operations.toArray()).filter(op => op.eventId === record.eventId && ((op.type === 'RECORD_UNDO' && op.payload.recordId === record.id) || (op.type === 'CONFLICT_RESOLVED' && op.payload.discardedRecordId === record.id)));
      if (revokes.length) { record.isReversed = true; record.reversedReason = 'Herroepen door gesynchroniseerde correctie'; }
      const participant = record.participantId ? await db.participants.get(record.participantId) : undefined;
      if (participant?.bibNumber) record.bibNumber = participant.bibNumber;
      await db.timingRecords.put(record);
      const duplicates = await db.timingRecords.where({ bibNumber: record.bibNumber, type: record.type }).filter(t => t.eventId === record.eventId && !t.isReversed && t.id !== record.id).toArray();
      for (const other of record.isReversed ? [] : duplicates) await db.conflicts.put({ id: `conflict-${[other.id, record.id].sort().join('-')}`, eventId: record.eventId, participantId: record.participantId ?? '', bibNumber: record.bibNumber, type: record.type === 'START' ? 'START_CONFLICT' : 'FINISH_CONFLICT', recordA: other, recordB: record, createdAt: operation.deviceTimestamp });
      if (operation.participantId) await this.refreshParticipantStatus(operation.participantId);
      return;
    }

    if (operation.type === 'SHOOTING_RECORDED') {
      const recordId = String(payload.recordId || '');
      if (!recordId || (await db.shootingResults.get(recordId))) return;

      const result: ShootingResult = {
        id: recordId,
        eventId: operation.eventId,
        participantId: operation.participantId || '',
        bibNumber: Number(payload.bibNumber || 0),
        round: Number(payload.round || 1),
        station: String(payload.station || ''),
        timestamp: operation.deviceTimestamp,
        shots: Number(payload.shots || Number(payload.hits || 0) + Number(payload.misses || 0)),
        hits: Number(payload.hits || 0),
        misses: Number(payload.misses || 0),
        isCorrection: Boolean(payload.isCorrection),
        supersedesIds: Array.isArray(payload.supersedesIds) ? payload.supersedesIds : undefined,
        correctionReason: payload.correctionReason,
        operatorId: operation.operatorId,
        deviceId: operation.deviceId,
        syncStatus: 'SYNCED',
      };
      await db.shootingResults.put(result);
      return;
    }

    if (operation.type === 'WAVE_STARTED' && payload.waveId) {
      await db.waves.update(String(payload.waveId), {
        actualStartTime: String(payload.timestamp || operation.deviceTimestamp),
        status: 'STARTED',
      });
      return;
    }

    if ((operation.type === 'PARTICIPANT_UPDATED' || operation.type === 'STATUS_CHANGED' || operation.type === 'BIB_ASSIGNED') && operation.participantId) {
      const patch = payload.updates || payload;
      const allowed = Object.fromEntries(['firstName','lastName','birthDate','gender','categoryId','raceProfileId','waveId','bibNumber','status','statusReason','penaltyLapsCompleted'].filter(key => key in patch).map(key => [key, patch[key]]));
      await db.participants.update(operation.participantId, allowed);
      if (allowed.bibNumber) {
        await db.timingRecords.where('participantId').equals(operation.participantId).modify({ bibNumber: allowed.bibNumber });
        await db.shootingResults.where('participantId').equals(operation.participantId).modify({ bibNumber: allowed.bibNumber });
      }
      return;
    }

    if (operation.type === 'CONFLICT_RESOLVED' && payload.discardedRecordId) {
      await db.timingRecords.update(payload.discardedRecordId, { isReversed: true, reversedReason: payload.reason });
      await db.conflicts.filter(c => c.id === payload.conflictId || (c.recordA.id === payload.discardedRecordId && c.recordB.id === payload.chosenRecordId) || (c.recordB.id === payload.discardedRecordId && c.recordA.id === payload.chosenRecordId)).modify({ resolvedAt: operation.deviceTimestamp, resolvedReason: payload.reason, resolvedWinner: payload.selectedWinner });
      if (operation.participantId) await this.refreshParticipantStatus(operation.participantId);
      return;
    }
    if (operation.type === 'RECORD_UNDO' && payload.recordId) {
      await db.timingRecords.update(String(payload.recordId), {
        isReversed: true,
        reversedReason: String(payload.reason || 'Online undo'),
      });
      if (operation.participantId) await this.refreshParticipantStatus(operation.participantId);
    }
  }

  private async pullRemoteOperations(config: SyncConfig): Promise<number> {
    let applied = 0;
    for (let offset = 0; ; offset += 500) {
    const response = await fetch(
      `${config.projectUrl}/rest/v1/race_operations?event_id=eq.${encodeURIComponent(config.eventId)}&order=created_at.asc,operation_id.asc&limit=500&offset=${offset}`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      }
    );
    if (!response.ok) throw new Error(`Download synchronisatie mislukt (HTTP ${response.status}).`);

    const rows = (await response.json()) as Array<Record<string, any>>;
    for (const row of rows) {
      if (String(row.event_id) !== config.eventId) continue;
      const operation: RaceOperation = {
        operationId: String(row.operation_id),
        eventId: String(row.event_id),
        participantId: row.participant_id || undefined,
        type: row.type,
        deviceId: String(row.device_id),
        operatorId: String(row.operator_id),
        deviceTimestamp: String(row.device_timestamp),
        serverTimestamp: row.server_timestamp || undefined,
        payload: row.payload || {},
        syncStatus: 'SYNCED',
        revision: Number(row.revision || 1),
      };

      await db.transaction('rw', [db.events, db.operations, db.timingRecords, db.shootingResults, db.participants, db.waves, db.conflicts], async () => {
        // A reset can finish while the HTTP request is still in flight. Check
        // inside the transaction so old operations cannot repopulate a new event.
        if (!this.isCurrentConnection(config) || !await db.events.get(config.eventId)) return;
        if (await db.operations.get(operation.operationId)) return;
        await db.operations.put(operation);
        await this.applyRemoteOperation(operation);
        applied += 1;
      });
    }
    if (rows.length < 500 || !this.isCurrentConnection(config)) break;
    }
    return applied;
  }

  private isCurrentConnection(config: SyncConfig): boolean {
    const current = this.getConfig();
    return current.enabled && current.eventId === config.eventId && current.projectUrl === config.projectUrl && current.anonKey === config.anonKey;
  }

  public syncNow(): Promise<{ syncedCount: number; error?: string }> {
    if (this.syncing) return this.syncing;
    this.syncing = this.performSync().then(result => {
      this.lastError = result.error;
      if (!result.error) this.lastSyncAt = raceClock.nowISO();
      this.triggerChange();
      return result;
    }).finally(() => { this.syncing = undefined; });
    return this.syncing;
  }
  private async performSync(): Promise<{ syncedCount: number; error?: string }> {
    if (this.isSimulatedOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { syncedCount: 0, error: 'Apparaat is offline' };
    }

    try {
      const pending = await db.operations.where('syncStatus').equals('LOCAL_ONLY').toArray();

      const config = this.getConfig();
      if (!config.enabled) {
        return { syncedCount: 0, error: 'Online synchronisatie is niet geconfigureerd.' };
      }
      if (!config.projectUrl || !config.anonKey) {
        return { syncedCount: 0, error: 'Supabase Project URL en anon key ontbreken.' };
      }
      const activeEvent = await db.events.toCollection().first();
      if (!config.eventId || activeEvent?.id !== config.eventId) {
        return { syncedCount: 0, error: 'Het Supabase Event-ID moet overeenkomen met het huidige evenement.' };
      }

      const uploadable = pending.filter(
        (operation) => operation.eventId === config.eventId
      );
      const pulledCount = await this.pullRemoteOperations(config);
      if (!this.isCurrentConnection(config) || !await db.events.get(config.eventId)) return { syncedCount: 0 };
      if (uploadable.length === 0) return { syncedCount: pulledCount };

      const response = await fetch(`${config.projectUrl}/rest/v1/race_operations?on_conflict=operation_id`, {
        method: 'POST',
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(
          uploadable.map((operation) => ({
            operation_id: operation.operationId,
            event_id: operation.eventId,
            participant_id: operation.participantId || null,
            type: operation.type,
            device_id: operation.deviceId,
            operator_id: operation.operatorId,
            device_timestamp: operation.deviceTimestamp,
            server_timestamp: operation.serverTimestamp || null,
            payload: operation.payload,
            revision: operation.revision,
          }))
        ),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 240);
        return {
          syncedCount: 0,
          error: `Supabase synchronisatie mislukt (HTTP ${response.status}): ${detail}`,
        };
      }

      for (const op of uploadable) {
        await db.operations.update(op.operationId, {
          syncStatus: 'SYNCED',
          serverTimestamp: new Date().toISOString(),
        });
      }

      this.triggerChange();
      return { syncedCount: uploadable.length + pulledCount };
    } catch (err: any) {
      return { syncedCount: 0, error: err?.message || 'Synchronisatiefout' };
    }
  }
}

export const syncService = new SyncService();
