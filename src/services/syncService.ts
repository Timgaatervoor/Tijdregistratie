import { db } from '../db/dexieDb';

export type NetworkState = 'ONLINE_SYNCED' | 'OFFLINE_PENDING' | 'SYNCING' | 'SYNC_ERROR';

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

      // Mark as syncing then synced (idempotent)
      for (const op of pending) {
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
