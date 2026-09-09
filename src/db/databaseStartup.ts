import type Dexie from 'dexie';

export type DatabaseStartupStatus = { state: 'idle' | 'opening' | 'blocked' | 'slow' | 'ready' | 'error'; message?: string };

/** One open request, even when StrictMode or a refresh retries while Firefox is waiting. */
export class DatabaseStartup {
  private pending?: Promise<void>;
  private status: DatabaseStartupStatus = { state: 'idle' };
  private listeners = new Set<() => void>();
  constructor(private database: Dexie, private timeoutMs = 15000) {
    database.on('blocked', () => this.update({ state: 'blocked', message: 'Een ander tabblad of venster houdt de lokale database open. Sluit de andere tabbladen van Tijdregistratie. Het laden gaat daarna automatisch verder.' }));
  }
  getStatus = () => this.status;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(status: DatabaseStartupStatus) { this.status = status; this.listeners.forEach(listener => listener()); }
  open(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.database.isOpen()) return Promise.resolve();
    this.update({ state: 'opening' });
    const timer = setTimeout(() => {
      if (this.status.state === 'opening') this.update({ state: 'slow', message: 'Firefox wacht nog op de lokale opslag. Sluit andere tabbladen van Tijdregistratie. Blijft dit duren, sluit Firefox volledig en open de app opnieuw. Wis geen websitegegevens: daarin staan je lokale wedstrijdregistraties.' });
    }, this.timeoutMs);
    this.pending = this.database.open().then(() => {
      this.update({ state: 'ready' });
    }).catch(error => {
      this.update({ state: 'error', message: `De lokale database kon niet worden geopend: ${error?.message || String(error)}` });
      throw error;
    }).finally(() => { clearTimeout(timer); this.pending = undefined; });
    return this.pending;
  }
}
