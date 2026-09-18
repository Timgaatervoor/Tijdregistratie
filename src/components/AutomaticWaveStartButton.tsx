import React, { useRef, useState } from 'react';
import type { Wave } from '../types';
import { getSyncDeviceId } from '../db/syncJournal';
import { setAutomaticWaveStart } from '../services/automaticWaveStart';

export function AutomaticWaveStartButton({ wave, disabled = false, onRefresh }: { wave: Wave; disabled?: boolean; onRefresh: () => void }) {
  const gate = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const enabled = wave.autoStartEnabled === true;
  return <div className="space-y-1">
    <button type="button" aria-pressed={enabled} disabled={disabled || saving || wave.status !== 'SCHEDULED'}
      onClick={async () => {
        if (gate.current) return;
        gate.current = true; setSaving(true); setError('');
        try { await setAutomaticWaveStart(wave.id, !enabled); onRefresh(); }
        catch (e) { setError(e instanceof Error ? e.message : 'Automatisch starten instellen mislukt.'); }
        finally { gate.current = false; setSaving(false); }
      }}
      className={`min-h-11 w-full rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-40 ${enabled ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-slate-600 bg-slate-800 text-slate-300'}`}>
      Automatisch vertrekken: {enabled ? 'AAN' : 'UIT'}
    </button>
    {enabled && <p className="text-xs text-emerald-300">Start om {wave.scheduledStartTime}. {wave.autoStartDeviceId === getSyncDeviceId() ? 'Houd deze app open en dit toestel wakker.' : 'Actief op het toestel dat dit inschakelde.'} Na wijziging van datum of startuur opnieuw inschakelen.</p>}
    {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
  </div>;
}
