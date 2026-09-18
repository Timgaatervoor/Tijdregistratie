import { useEffect, useState } from 'react';
import type { Wave } from '../types';
import { getSyncDeviceId } from '../db/syncJournal';
import { startDueWave } from '../services/automaticWaveStart';
import { soundService } from '../services/soundService';
import { keepScreenAwake } from '../services/screenWakeLock';

export function useAutomaticWaveStarts(waves: Wave[], onRefresh: () => void) {
  const [error, setError] = useState('');
  const ids = JSON.stringify(waves.filter(w => w.autoStartEnabled && w.autoStartDeviceId === getSyncDeviceId() && w.status === 'SCHEDULED').map(w => w.id).sort());
  useEffect(() => {
    const waveIds: string[] = JSON.parse(ids);
    if (!waveIds.length) return;
    let stopped = false;
    let busy = false;
    const wake = keepScreenAwake(document, navigator.wakeLock, window.isSecureContext, () => {});
    const tick = async () => {
      if (stopped || busy) return;
      busy = true;
      try {
        for (const id of waveIds) {
          if (stopped) break;
          const result = await startDueWave(id);
          if (stopped) break;
          if (result.started) { soundService.playGoFanfare(); onRefresh(); }
          if (result.error) { setError(result.error); onRefresh(); }
        }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Automatische start mislukt.'); }
      finally { busy = false; }
    };
    const timer = window.setInterval(() => void tick(), 250);
    document.addEventListener('visibilitychange', tick);
    void tick();
    return () => { stopped = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); wake.stop(); };
  }, [ids, onRefresh]);
  return { error, clearError: () => setError('') };
}
