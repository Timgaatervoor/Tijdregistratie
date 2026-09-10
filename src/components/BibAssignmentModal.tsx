import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpDown, Eye, Plus, Trash2, X } from 'lucide-react';
import type { Participant } from '../types';
import { db } from '../db/dexieDb';
import { competitionAge } from '../services/participantClassification';
import {
  planAgeBibs,
  readBibAssignmentPreferences,
  saveBibAssignmentPreferences,
  updateBibs,
  type BibAgeRange,
  type BibChange,
} from '../services/bibAssignment';

const fieldClass = 'block w-full h-10 mt-1.5 rounded-xl bg-slate-800 border border-slate-700 px-3 text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition';
const secondaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 text-xs font-bold text-slate-200 transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-50';

export function BibAssignmentModal({ participants, onClose, onRefresh }: { participants: Participant[]; onClose: () => void; onRefresh: () => void }) {
  const [eventId, setEventId] = useState('');
  const [date, setDate] = useState('');
  const [ranges, setRanges] = useState<BibAgeRange[]>([{ minAge: 0, maxAge: 11, firstBib: 1, lastBib: 100 }]);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preview, setPreview] = useState<BibChange[]>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void db.events.toCollection().first().then(event => {
      setDate(event?.date ?? '');
      setEventId(event?.id ?? '');
      const saved = readBibAssignmentPreferences(event?.id ?? '');
      setRanges(saved.ranges);
      setOnlyMissing(saved.onlyMissing);
      setPreferencesReady(true);
    }).catch(error => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (preferencesReady && eventId) saveBibAssignmentPreferences(eventId, { ranges, onlyMissing });
  }, [eventId, onlyMissing, preferencesReady, ranges]);

  const changeRanges = (next: BibAgeRange[]) => {
    setRanges(next);
    setPreview(undefined);
    setMessage('');
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try { await action(); } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const missingBirthDate = participants.filter(participant =>
    !participant.stamhoofdInactive &&
    (!onlyMissing || !participant.bibNumber) &&
    competitionAge(participant.birthDate, date) === undefined
  ).length;

  return <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto bg-slate-950/85 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="bib-assignment-title">
    <div className="my-auto w-full max-w-4xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 shadow-2xl text-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-400"><ArrowUpDown className="h-5 w-5" /></div>
          <div>
            <h2 id="bib-assignment-title" className="text-lg font-bold">Borstnummers beheren</h2>
            <p className="mt-1 text-xs text-slate-400">Toewijzing per leeftijdsbereik voor het volledige evenement.</p>
          </div>
        </div>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Dialoog sluiten" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-50"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-5 space-y-5">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-relaxed text-slate-300">
          Leeftijd op 31 december {date.slice(0, 4) || '(stel eerst de evenementdatum in)'}. Grenzen zijn inclusief. Binnen elk bereik worden deelnemers alfabetisch op achternaam en voornaam genummerd. Reeds bezette nummers buiten de selectie worden overgeslagen.
          <span className="mt-2 block text-amber-300">De instellingen hieronder worden automatisch voor dit evenement op dit toestel bewaard.</span>
        </div>

        <fieldset disabled={busy} className="space-y-5">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold text-white">Leeftijds- en nummerbereiken</h3>
              <p className="mt-1 text-xs text-slate-400">Bereiken mogen elkaar niet overlappen.</p>
            </div>
            {ranges.map((range, index) => <div key={index} className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 sm:p-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
                {([['minAge', 'Leeftijd vanaf'], ['maxAge', 'Leeftijd t/m'], ['firstBib', 'Borstnummer vanaf'], ['lastBib', 'Borstnummer t/m']] as const).map(([key, label]) => <label key={key} className="text-xs font-semibold text-slate-300">
                  {label}
                  <input
                    type="number"
                    min={key.includes('Age') ? 0 : 1}
                    step="1"
                    value={Number.isNaN(range[key]) ? '' : range[key]}
                    onChange={event => changeRanges(ranges.map((current, currentIndex) => currentIndex === index ? { ...current, [key]: event.target.value === '' ? Number.NaN : Number(event.target.value) } : current))}
                    className={fieldClass}
                  />
                </label>)}
                <button type="button" onClick={() => changeRanges(ranges.filter((_, currentIndex) => currentIndex !== index))} className="col-span-2 lg:col-span-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-800/60 bg-red-950/40 px-3 text-xs font-bold text-red-300 transition hover:bg-red-900/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400">
                  <Trash2 className="h-4 w-4" /> Verwijderen
                </button>
              </div>
            </div>)}
            <button type="button" onClick={() => changeRanges([...ranges, {
              minAge: (ranges.at(-1)?.maxAge ?? -1) + 1,
              maxAge: (ranges.at(-1)?.maxAge ?? -1) + 10,
              firstBib: (ranges.at(-1)?.lastBib ?? 0) + 1,
              lastBib: (ranges.at(-1)?.lastBib ?? 0) + 100,
            }])} className={secondaryButtonClass}><Plus className="h-4 w-4" /> Bereik toevoegen</button>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200">
            <input type="checkbox" checked={onlyMissing} onChange={event => { setOnlyMissing(event.target.checked); setPreview(undefined); setMessage(''); }} className="mt-0.5 h-4 w-4 rounded accent-amber-500 focus:ring-amber-400" />
            <span><strong className="block text-white">Alleen deelnemers zonder borstnummer</strong><span className="mt-1 block text-xs text-slate-400">Bestaande borstnummers blijven behouden en worden bij de toewijzing overgeslagen.</span></span>
          </label>

          <div className="flex items-start gap-2 rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{missingBirthDate} deelnemers zonder geldige geboortedatum worden overgeslagen. Deelnemers buiten de leeftijdsbereiken blijven ongewijzigd. Dit geldt voor alle deelnemers, ongeacht het lijstfilter.</p>
          </div>

          <button type="button" className={primaryButtonClass} onClick={() => {
            try {
              setMessage('');
              setPreview(planAgeBibs(participants, date, ranges, onlyMissing));
            } catch (error) {
              setPreview(undefined);
              setMessage((error as Error).message);
            }
          }}><Eye className="h-4 w-4" /> Preview bekijken</button>

          {preview && <div className="space-y-4 border-t border-slate-800 pt-5">
            <p className="text-sm font-semibold text-white">{preview.length} borstnummers worden aangepast.</p>
            <div className="max-h-64 overflow-auto rounded-xl border border-slate-800">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="sticky top-0 bg-slate-800 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-3">Deelnemer</th><th className="px-4 py-3">Leeftijd</th><th className="px-4 py-3">Oud</th><th className="px-4 py-3">Nieuw</th></tr></thead>
                <tbody className="divide-y divide-slate-800">{preview.map(row => <tr key={row.participantId}><td className="px-4 py-3 font-semibold text-white">{row.name}</td><td className="px-4 py-3 text-slate-300">{row.age}</td><td className="px-4 py-3 font-mono text-slate-400">{row.oldBib ?? '—'}</td><td className="px-4 py-3 font-mono font-bold text-amber-400">{row.bibNumber}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className={secondaryButtonClass} onClick={() => setPreview(undefined)}>Preview sluiten</button>
              <button type="button" disabled={!preview.length} className={primaryButtonClass} onClick={() => run(async () => {
                const count = await updateBibs({ clear: false, ranges, onlyMissing, preview });
                setPreview(undefined);
                setMessage(`${count} borstnummers toegekend.`);
                onRefresh();
              })}>Borstnummers toekennen</button>
            </div>
          </div>}
        </fieldset>
        {message && <p role="status" className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 text-sm text-amber-300">{message}</p>}
      </div>
    </div>
  </div>;
}
