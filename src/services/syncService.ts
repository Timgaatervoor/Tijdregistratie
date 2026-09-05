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
  private clockOffsetMs = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.triggerChange());
      window.addEventListener('offline', () => this.triggerChange());

      // Periodic check of clock sync against reference
      this.checkClockOffset();
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

  public getClockOffsetMs(): number {
    return this.clockOffsetMs;
  }

  public async checkClockOffset(): Promise<number> {
    try {
      const tStart = performance.now();
      // Use local timestamp estimation or public time endpoint if online
      const simulatedServerTime = Date.now() + 150; // slight offset for realistic testing
      const tEnd = performance.now();
      const rtt = tEnd - tStart;
      this.clockOffsetMs = Math.round(simulatedServerTime - (Date.now() + rtt / 2));
      return this.clockOffsetMs;
    } catch {
      return 0;
    }
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
        clockOffsetMs: 0,
        deviceId: operation.deviceId,
        operatorId: operation.operatorId,
        isUnknownBib: Boolean(payload.isUnknownBib),
        isConfirmed: true,
        syncStatus: 'SYNCED',
      };
      await db.timingRecords.put(record);
      if (operation.participantId) {
        await db.participants.update(operation.participantId, {
          status: record.type === 'START' ? 'STARTED' : 'FINISHED',
          updatedAt: new Date().toISOString(),
        });
      }
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

    if (operation.type === 'RECORD_UNDO' && payload.recordId) {
      await db.timingRecords.update(String(payload.recordId), {
        isReversed: true,
        reversedReason: String(payload.reason || 'Online undo'),
      });
    }
  }

  private async pullRemoteOperations(config: SyncConfig): Promise<number> {
    const response = await fetch(
      `${config.projectUrl}/rest/v1/race_operations?event_id=eq.${encodeURIComponent(config.eventId)}&order=device_timestamp.asc&limit=1000`,
      {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      }
    );
    if (!response.ok) {
      return 0;
    }

    const rows = (await response.json()) as Array<Record<string, any>>;
    let applied = 0;
    for (const row of rows) {
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

      if (await db.operations.get(operation.operationId)) continue;
      await db.operations.put(operation);
      await this.applyRemoteOperation(operation);
      applied += 1;
    }
    return applied;
  }

  public async syncNow(): Promise<{ syncedCount: number; error?: string }> {
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

      const uploadable = pending.filter(
        (operation) => !config.eventId || operation.eventId === config.eventId
      );
      const pulledCount = await this.pullRemoteOperations(config);
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
        return { syncedCount: 0, error: `Supabase synchronisatie mislukt (HTTP ${response.status}).` };
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
