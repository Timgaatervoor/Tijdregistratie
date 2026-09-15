import React from 'react';
import { Delete, Smartphone, Minimize2 } from 'lucide-react';
import { useMobileMode } from '../hooks/useMobileMode';

export function GlobalMobileModeButton() {
  const { modes, setAll } = useMobileMode();
  const enabled = Object.values(modes).every(Boolean);
  return <button type="button" aria-pressed={enabled} onClick={() => setAll(!enabled)}
    title="Gsm-modus voor Start, Schieten en Finish op dit toestel"
    className={`min-h-11 rounded-xl border px-3 text-xs font-bold flex items-center gap-2 ${enabled ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-200'}`}>
    <Smartphone className="w-4 h-4" /> Gsm: alle posten
  </button>;
}

export function MobileModeButton({ onClick, enabled = false, disabled = false }: { onClick: () => void; enabled?: boolean; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-pressed={enabled}
    className="min-h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40">
    {enabled ? <Minimize2 className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
    {enabled ? 'Gewone weergave' : 'Gsm-modus'}
  </button>;
}

export function MobileStationShell({ title, onClose, navigation, busy = false, children }: {
  title: string; onClose: () => void; navigation?: React.ReactNode; busy?: boolean; children: React.ReactNode;
}) {
  return <section aria-label={`Gsm-modus ${title}`} className="mobile-station fixed inset-0 z-[45] h-[100dvh] overflow-y-auto overscroll-contain bg-slate-950 text-white">
    <div className="mx-auto w-full max-w-md space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black">{title}</h2>
        <MobileModeButton enabled onClick={onClose} disabled={busy} />
      </header>
      <fieldset disabled={busy} className="mobile-station-navigation min-w-0">{navigation}</fieldset>
      {children}
    </div>
  </section>;
}

export function BibKeypad({ value, onChange, participantName, disabled = false }: {
  value: string; onChange: React.Dispatch<React.SetStateAction<string>>; participantName?: string; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="min-w-0 space-y-2">
    <legend className="text-xs font-bold text-slate-400">Startnummer</legend>
    <output aria-label="Ingevoerd startnummer" className="block rounded-2xl border border-slate-600 bg-slate-900 py-2 text-center text-4xl font-mono font-black break-all">{value || '—'}</output>
    <p aria-live="polite" className={`min-h-5 text-center text-sm font-bold ${participantName ? 'text-emerald-400' : 'text-slate-400'}`}>
      {participantName || (value ? 'Onbekend startnummer' : 'Voer een startnummer in')}
    </p>
    <div className="grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Wis', '0', 'backspace'].map(digit => (
        <button key={digit} type="button" aria-label={digit === 'backspace' ? 'Laatste cijfer wissen' : digit}
          onClick={() => onChange(current => digit === 'Wis' ? '' : digit === 'backspace' ? current.slice(0, -1) : `${current}${digit}`.slice(0, 9))}
          className="min-h-12 rounded-xl border border-slate-700 bg-slate-800 text-2xl font-bold active:bg-slate-600 disabled:opacity-40 touch-manipulation flex items-center justify-center">
          {digit === 'backspace' ? <Delete className="w-6 h-6" /> : digit}
        </button>
      ))}
    </div>
  </fieldset>;
}
