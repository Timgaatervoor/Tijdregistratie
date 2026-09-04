import { db } from '../db/dexieDb';

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
      const response = await fetch(`${config.projectUrl}/rest/v1/`, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
        },
      });
      if (!response.ok) {
        return { ok: false, error: `Supabase antwoordde met HTTP ${response.status}.` };
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

  public async syncNow(): Promise<{ syncedCount: number; error?: string }> {
    if (this.isSimulatedOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { syncedCount: 0, error: 'Apparaat is offline' };
    }

    try {
      const pending = await db.operations.where('syncStatus').equals('LOCAL_ONLY').toArray();
      if (pending.length === 0) {
        return { syncedCount: 0 };
      }

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
      if (uploadable.length === 0) {
        return { syncedCount: 0 };
      }

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
      return { syncedCount: pending.length };
    } catch (err: any) {
      return { syncedCount: 0, error: err?.message || 'Synchronisatiefout' };
    }
  }
}

export const syncService = new SyncService();
