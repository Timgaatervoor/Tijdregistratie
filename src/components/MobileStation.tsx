import React, { useEffect, useState } from 'react';
import { Delete, Smartphone, Minimize2, Maximize2 } from 'lucide-react';
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

export function MobileStationShell({ title, onClose, navigation, busy = false, compact = false, children }: {
  title: string; onClose: () => void; navigation?: React.ReactNode; busy?: boolean; compact?: boolean; children: React.ReactNode;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    update();
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggleFullscreen = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setFullscreenError('Deze browser ondersteunt geen volledig scherm.');
    } catch {
      setFullscreenError('Volledig scherm openen of sluiten lukt niet. Probeer opnieuw.');
    }
  };
  const fullscreenButton = <button type="button" onClick={toggleFullscreen} aria-pressed={fullscreen}
    aria-label={fullscreen ? 'Scherm verkleinen' : 'Volledig scherm'} title={fullscreen ? 'Scherm verkleinen' : 'Volledig scherm'}
    className={`${compact ? 'w-11 shrink-0' : 'w-full'} min-h-11 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-700`}>
    {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
    <span className={compact ? 'sr-only' : ''}>{fullscreen ? 'Scherm verkleinen' : 'Volledig scherm'}</span>
  </button>;
  return <section aria-label={`Gsm-modus ${title}`} className={`mobile-station ${compact ? 'mobile-station-compact' : ''} fixed inset-0 z-[45] h-[100dvh] overflow-y-auto overscroll-contain bg-slate-950 text-white`}>
    <div className={compact ? 'mobile-station-compact-inner' : 'mx-auto w-full max-w-md space-y-3'}>
      {compact ? <header className="flex items-center gap-2 relative">
        <h2 className="text-lg font-black flex-1">{title}</h2>
        {fullscreenButton}
        <details className="relative">
          <summary className="min-h-11 px-3 rounded-xl border border-slate-700 bg-slate-800 flex items-center cursor-pointer font-bold text-sm">Menu</summary>
          <div className="absolute right-0 top-full mt-1 z-10 w-72 max-w-[calc(100vw-16px)] rounded-xl border border-slate-600 bg-slate-900 p-3 shadow-xl space-y-3">
            <fieldset disabled={busy} className="mobile-station-navigation min-w-0">{navigation}</fieldset>
            <MobileModeButton enabled onClick={onClose} disabled={busy} />
          </div>
        </details>
      </header> : <>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black">{title}</h2>
        <MobileModeButton enabled onClick={onClose} disabled={busy} />
      </header>
      {fullscreenButton}
      </>}
      {fullscreenError && <p role="status" className="text-sm text-amber-300">{fullscreenError}</p>}
      {!compact && <fieldset disabled={busy} className="mobile-station-navigation min-w-0">{navigation}</fieldset>}
      {children}
    </div>
  </section>;
}

export function BibKeypad({ value, onChange, participantName, disabled = false, maxLength = 9 }: {
  value: string; onChange: React.Dispatch<React.SetStateAction<string>>; participantName?: string; disabled?: boolean; maxLength?: number;
}) {
  return <fieldset disabled={disabled} className="bib-keypad min-w-0 space-y-2">
    <legend className="text-xs font-bold text-slate-400">Startnummer</legend>
    <output aria-label="Ingevoerd startnummer" className="block rounded-2xl border-2 border-emerald-500/60 bg-slate-900 py-3 text-center text-4xl font-mono font-black text-white break-all">{value || '—'}</output>
    <p aria-live="polite" className={`min-h-5 text-center text-sm font-bold ${participantName ? 'text-emerald-400' : 'text-slate-400'}`}>
      {participantName || (value ? 'Onbekend startnummer' : 'Voer een startnummer in')}
    </p>
    <div className="grid grid-cols-3 gap-2">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Wis', '0', 'backspace'].map(digit => (
        <button key={digit} type="button" aria-label={digit === 'backspace' ? 'Laatste cijfer wissen' : digit}
          title={digit === 'Wis' ? 'Volledig startnummer wissen' : digit === 'backspace' ? 'Laatste cijfer wissen' : undefined}
          onClick={() => onChange(current => digit === 'Wis' ? '' : digit === 'backspace' ? current.slice(0, -1) : `${current}${digit}`.slice(0, maxLength))}
          className={`min-h-12 sm:min-h-14 rounded-xl border font-black active:scale-95 disabled:opacity-40 touch-manipulation flex items-center justify-center transition ${digit === 'Wis'
            ? 'border-red-800 bg-red-950/60 text-red-300 text-base hover:bg-red-900/70'
            : digit === 'backspace'
            ? 'border-slate-700 bg-slate-800 text-amber-300 hover:bg-slate-700'
            : 'border-slate-700 bg-slate-800 text-white text-2xl hover:bg-slate-700'}`}>
          {digit === 'backspace' ? <Delete className="w-6 h-6" /> : digit}
        </button>
      ))}
    </div>
  </fieldset>;
}
