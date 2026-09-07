import React, { useEffect, useState } from 'react';
import { syncService } from '../services/syncService';
import { syncStyles as ui } from './syncSettingsStyles';
import { raceClock } from '../services/raceClock';
export function ClockStatus({ embedded = false }: { embedded?: boolean }) {
  const [, tick] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const id = setInterval(() => tick(v => v + 1), 1000); return () => clearInterval(id); }, []);
  const clock = raceClock.status();
  const health = syncService.getSyncHealth();
  return <div className={embedded ? 'text-xs text-slate-400 space-y-3' : 'bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 space-y-1'} role="status">
    <div className="flex flex-wrap items-center gap-3"><strong className={clock.state === 'SYNCED' ? 'text-emerald-300' : 'text-amber-300'}>Centrale tijd: {clock.state === 'SYNCED' ? 'gemeten' : clock.state === 'STALE' ? 'meting verouderd — loopt lokaal door' : 'nog niet gemeten'}</strong><span className="font-mono">{new Date(raceClock.nowMs()).toLocaleTimeString('nl-BE')}</span>
      <button disabled={busy} className={embedded ? ui.secondary : 'underline disabled:opacity-50'} onClick={async () => { setBusy(true); try { await syncService.checkClockOffset(); } finally { setBusy(false); } }}>{busy ? 'Meten…' : 'Tijd opnieuw meten'}</button>
    </div>
    {clock.syncedAt && <p>Correctie toestelklok: {Math.round(clock.offsetMs)} ms · geschatte onzekerheid ±{Math.ceil(clock.uncertaintyMs!)} ms · meting {Math.floor(clock.ageMs! / 1000)} seconden geleden.</p>}
    {clock.error && <p className="text-amber-300">{clock.error}</p>}
    {health.lastError && syncService.getConfig().enabled && <p className="text-red-300">Synchronisatie: {health.lastError}</p>}
    {health.lastSyncAt && <p>Laatste gegevenssynchronisatie: {new Date(health.lastSyncAt).toLocaleTimeString('nl-BE')}</p>}
  </div>;
}
