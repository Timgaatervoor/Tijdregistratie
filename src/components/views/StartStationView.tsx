import { raceClock } from '../../services/raceClock';
import React, { useState, useEffect, useRef } from 'react';
import {
  PlayCircle,
  Clock,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Users,
  UserCheck,
  Calendar,
  Edit3,
} from 'lucide-react';
import type { Wave, Participant, TimingRecord, Category, RaceEvent } from '../../types';
import { db, getActiveEventId } from '../../db/dexieDb';
import { operationService, generateUUID } from '../../services/operationService';
import { soundService } from '../../services/soundService';
import { formatLocalTime } from '../../services/timingEngine';
import { SafeConfirmDialog } from '../SafeConfirmDialog';
import { useStationMobileMode } from '../../hooks/useMobileMode';
import { BibKeypad, MobileModeButton, MobileStationShell } from '../MobileStation';

interface StartStationViewProps {
  mobileNavigation?: React.ReactNode;
  waves: Wave[];
  participants: Participant[];
  categories: Category[];
  timingRecords: TimingRecord[];
  event: RaceEvent | null;
  onRefresh: () => void;
}

export const StartStationView: React.FC<StartStationViewProps> = ({
  mobileNavigation,
  waves,
  participants,
  categories,
  timingRecords,
  event,
  onRefresh,
}) => {
  const [simpleMode, toggleSimpleMode] = useStationMobileMode('start');
  const [isSavingSingle, setIsSavingSingle] = useState(false);
  const singleStartGate = useRef(false);
  const [activeTab, setActiveTab] = useState<'mass' | 'individual' | 'manual'>('mass');
  const [selectedWaveId, setSelectedWaveId] = useState<string>(waves[0]?.id || '');
  const [isStarting, setIsStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const attendanceGate = useRef(false);

  // Individual start state (Requirement 16)
  const [singleBibInput, setSingleBibInput] = useState('');
  const [pendingSingleStart, setPendingSingleStart] = useState<{ bib: number; participant?: Participant; iso: string; monotonic: number } | null>(null);
  const singleInputRef = useRef<HTMLInputElement>(null);

  // Manual scheduled start state (Requirement 15)
  const [manualBibInput, setManualBibInput] = useState('');
  const [manualTimeInput, setManualTimeInput] = useState('');
  const [manualReason, setManualReason] = useState('');

  // Editing existing start record
  const [editingRecord, setEditingRecord] = useState<{ id: string; bib: number; currentTime: string } | null>(null);
  const [editNewTime, setEditNewTime] = useState('');
  const [editReason, setEditReason] = useState('');

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  const selectedWave = waves.find((w) => w.id === selectedWaveId) || waves[0];
  const waveParticipants = participants.filter((p) => p.waveId === selectedWave?.id);
  const startedParticipants = waveParticipants.filter((p) => p.status === 'STARTED' || p.status === 'FINISHED');

  const toggleAbsence = async (participant: Participant) => {
    if (attendanceGate.current || waveStartGate.current || !selectedWave) return;
    attendanceGate.current = true;
    setSavingAttendance(true);
    try {
      await operationService.setWaveStartAbsence(selectedWave.eventId, participant.id, !participant.absentFromWaveStart);
      onRefresh();
    } catch (error) {
      setFeedbackMsg({ text: error instanceof Error ? error.message : 'Aanwezigheid opslaan mislukt.', type: 'warn' });
    } finally {
      attendanceGate.current = false;
      setSavingAttendance(false);
    }
  };

  const attendanceToggle = (participant: Participant) => (
    participant.status === 'DNS' ? <span className="text-xs font-bold text-amber-300">DNS · Individueel starten mogelijk</span> :
    selectedWave?.status === 'SCHEDULED' && ['REGISTERED', 'CHECKED_IN', 'READY'].includes(participant.status) ? (
      <button
        type="button"
        aria-pressed={!!participant.absentFromWaveStart}
        aria-label={`Afwezig bij wavestart: ${participant.firstName} ${participant.lastName}`}
        disabled={isStarting || savingAttendance}
        onClick={e => { e.stopPropagation(); void toggleAbsence(participant); }}
        className={`min-h-11 shrink-0 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40 ${participant.absentFromWaveStart ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-slate-600 bg-slate-800 text-slate-300'}`}
      >
        {participant.absentFromWaveStart ? 'Afwezig · DNS bij start' : 'Aanwezig'}
      </button>
    ) : null
  );

  // Matched participant for Individual quick start
  const parsedSingleBib = parseInt(singleBibInput.trim(), 10);
  const matchedSingleParticipant = !isNaN(parsedSingleBib)
    ? participants.find((p) => p.bibNumber === parsedSingleBib)
    : undefined;

  // Matched participant for Manual start
  const parsedManualBib = parseInt(manualBibInput.trim(), 10);
  const matchedManualParticipant = !isNaN(parsedManualBib)
    ? participants.find((p) => p.bibNumber === parsedManualBib)
    : undefined;

  // Recent starts
  const recentStarts = [...timingRecords]
    .filter((r) => r.type === 'START' && !r.isReversed)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 15);

  // Global hotkey for quick start when in individual mode
  useEffect(() => {
    if (!simpleMode && activeTab === 'individual' && singleInputRef.current) {
      singleInputRef.current.focus();
    }
  }, [activeTab, simpleMode]);

  const waveStartGate = useRef(false);
  const waveStartTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(waveStartTimer.current), []);

  const handleStartWave = async () => {
    if (!selectedWave || waveStartGate.current || attendanceGate.current) return;
    waveStartGate.current = true;
    setIsStarting(true);
    try {
      for (const seconds of [3, 2, 1]) {
        setCountdown(seconds);
        soundService.playCountdownPip();
        await new Promise<void>(resolve => {
          waveStartTimer.current = window.setTimeout(resolve, 1000);
        });
      }
      setCountdown(null);
      const nowIso = raceClock.nowISO();
      soundService.playGoFanfare();
      await operationService.recordMassWaveStart(selectedWave.eventId, selectedWave.id, selectedWave.waveNumber, waveParticipants, nowIso);
      setFeedbackMsg({ text: `Startgroep "${selectedWave.name}" succesvol gestart!`, type: 'success' });
      onRefresh();
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (error) {
      soundService.playError();
      setFeedbackMsg({ text: error instanceof Error ? error.message : 'Groepsstart opslaan mislukt.', type: 'warn' });
    } finally {
      setCountdown(null);
      setIsStarting(false);
      waveStartGate.current = false;
    }
  };

  const executeSingleStart = async ({ bib, participant: p, iso, monotonic }: { bib: number; participant?: Participant; iso: string; monotonic: number }) => {
    if (singleStartGate.current) return;
    singleStartGate.current = true;
    setIsSavingSingle(true);
    try {
      await operationService.recordStart(
        await getActiveEventId(),
        bib,
        p,
        iso,
        monotonic
      );

      soundService.playGoFanfare();
      setFeedbackMsg({
        text: `Individuele start geregistreerd voor Bib #${bib} (${p ? `${p.firstName} ${p.lastName}` : 'Onbekend'}) om ${formatLocalTime(iso, true)}`,
        type: 'success',
      });
      setSingleBibInput('');
      if (!simpleMode) singleInputRef.current?.focus();
      onRefresh();
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (error) {
      setFeedbackMsg({ text: error instanceof Error ? error.message : 'Start opslaan mislukt.', type: 'warn' });
      throw error;
    } finally {
      singleStartGate.current = false;
      setIsSavingSingle(false);
    }
  };

  const handleSingleStart = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (singleStartGate.current || pendingSingleStart) return;
    const bib = parseInt(singleBibInput.trim(), 10);
    if (isNaN(bib) || bib <= 0) return;
    const request = {
      bib,
      participant: participants.find((item) => item.bibNumber === bib),
      iso: raceClock.nowISO(),
      monotonic: performance.now(),
    };
    if (event?.requireStartConfirmation) setPendingSingleStart(request);
    else try { await executeSingleStart(request); } catch { soundService.playError(); }
  };

  // Manual Scheduled Start Handler (Requirement 15: MANUAL SCHEDULED START)
  const handleManualScheduledStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedManualBib) || parsedManualBib <= 0) {
      alert('Voer een geldig startnummer in');
      return;
    }
    if (!manualTimeInput.trim()) {
      alert('Voer een starttijd in (bijv. 09:04:30)');
      return;
    }

    // Convert HH:mm:ss to ISO string on today's date
    const today = new Date();
    const [hh, mm, ss] = manualTimeInput.split(':').map((v) => parseInt(v, 10) || 0);
    today.setHours(hh, mm, ss, 0);
    const targetIso = today.toISOString();

    const p = participants.find((item) => item.bibNumber === parsedManualBib);

    // Check if an existing start record exists for this bib
    const existingStart = timingRecords.find(
      (r) => r.bibNumber === parsedManualBib && r.type === 'START' && !r.isReversed
    );

    if (existingStart) {
      // Update existing record
      await operationService.correctTimingRecord(existingStart.id, targetIso, manualReason || 'Manuele correctie starttijd');
      await operationService.logAudit(
        'START_CORRECTED',
        `Starttijd voor Bib #${parsedManualBib} gewijzigd naar ${manualTimeInput}. Reden: ${manualReason || 'Geen'}`,
        p?.id,
        parsedManualBib,
        manualReason
      );
    } else {
      // Create new record with manual timestamp
      await operationService.recordStart(
        await getActiveEventId(),
        parsedManualBib,
        p,
        targetIso,
        performance.now()
      );
      if (manualReason) {
        await operationService.logAudit(
          'MANUAL_START_RECORDED',
          `Handmatige starttijd voor Bib #${parsedManualBib}: ${manualTimeInput}. Notitie: ${manualReason}`,
          p?.id,
          parsedManualBib,
          manualReason
        );
      }
    }

    soundService.playSuccess();
    setFeedbackMsg({
      text: `Geplande/manuele starttijd ${manualTimeInput} opgeslagen voor Bib #${parsedManualBib}`,
      type: 'success',
    });
    setManualBibInput('');
    setManualTimeInput('');
    setManualReason('');
    onRefresh();
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Save edit of existing start record
  const handleSaveEditStart = async () => {
    if (!editingRecord) return;
    if (!editNewTime.trim()) {
      alert('Voer een nieuwe tijd in (bijv. 09:15:30)');
      return;
    }
    if (!editReason.trim()) {
      alert('Reden van wijziging is verplicht (Req 44)');
      return;
    }

    const today = new Date();
    const [hh, mm, ss] = editNewTime.split(':').map((v) => parseInt(v, 10) || 0);
    today.setHours(hh, mm, ss, 0);
    const newIso = today.toISOString();

    await operationService.correctTimingRecord(editingRecord.id, newIso, editReason);

    await operationService.logAudit(
      'START_TIME_MODIFIED',
      `Starttijd voor Bib #${editingRecord.bib} gewijzigd van ${formatLocalTime(editingRecord.currentTime, true)} naar ${editNewTime}. Reden: ${editReason}`,
      undefined,
      editingRecord.bib,
      editReason
    );

    soundService.playSuccess();
    setEditingRecord(null);
    setEditNewTime('');
    setEditReason('');
    onRefresh();
  };

  const handleUndoStart = async (recordId: string, bibNumber: number) => {
    const reason = prompt('Reden voor annuleren van start (verplicht):');
    if (!reason || !reason.trim()) return;

    await operationService.undoTimingRecord(recordId, reason);
    const p = participants.find(item => item.bibNumber === bibNumber);

    await operationService.logAudit(
      'START_CANCELLED',
      `Start voor bib #${bibNumber} geannuleerd. Reden: ${reason}`,
      p?.id,
      bibNumber,
      reason
    );

    soundService.playWarning();
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <SafeConfirmDialog
        isOpen={pendingSingleStart !== null}
        title="Individuele start bevestigen?"
        message={pendingSingleStart
          ? `Startnummer #${pendingSingleStart.bib}${pendingSingleStart.participant ? ` · ${pendingSingleStart.participant.firstName} ${pendingSingleStart.participant.lastName}` : ' · onbekende deelnemer'}\nDe starttijd werd vastgelegd op ${formatLocalTime(pendingSingleStart.iso, true)}.`
          : ''}
        confirmLabel="Start registreren"
        variant="info"
        onCancel={() => {
          setPendingSingleStart(null);
          if (!simpleMode) window.setTimeout(() => singleInputRef.current?.focus(), 0);
        }}
        onConfirm={async () => {
          if (pendingSingleStart) await executeSingleStart(pendingSingleStart);
        }}
      />
      {simpleMode && <MobileStationShell title="Start" onClose={toggleSimpleMode} navigation={mobileNavigation} busy={isStarting || isSavingSingle}>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={isStarting || isSavingSingle} aria-pressed={activeTab === 'mass'} onClick={() => setActiveTab('mass')} className={`min-h-12 rounded-xl font-bold ${activeTab === 'mass' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800'}`}>Groepsstart</button>
          <button type="button" disabled={isStarting || isSavingSingle} aria-pressed={activeTab !== 'mass'} onClick={() => setActiveTab('individual')} className={`min-h-12 rounded-xl font-bold ${activeTab !== 'mass' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800'}`}>Individueel</button>
        </div>
        {activeTab === 'mass' ? <div className="space-y-3">
          <label className="block text-sm font-bold">Startgroep
            <select value={selectedWave?.id || ''} disabled={isStarting} onChange={e => setSelectedWaveId(e.target.value)} className="mt-2 w-full min-h-12 rounded-xl border border-slate-600 bg-slate-900 px-3 text-base">
              {!waves.length && <option value="">Geen startgroepen</option>}
              {waves.map(wave => <option key={wave.id} value={wave.id}>{wave.name} · {wave.scheduledStartTime}</option>)}
            </select>
          </label>
          <p className="text-sm text-slate-300">{waveParticipants.filter(p => p.bibNumber).length} deelnemers met startnummer · {startedParticipants.length} al gestart</p>
          <p className="text-xs text-slate-400">Duid afwezige deelnemers aan. Zij krijgen DNS bij de groepsstart en kunnen later individueel starten.</p>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {waveParticipants.filter(p => p.status !== 'STARTED' && p.status !== 'FINISHED').map(p => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900 p-3">
                <span className="text-sm">#{p.bibNumber || '-'} {p.firstName} {p.lastName}</span>
                {attendanceToggle(p)}
              </div>
            ))}
          </div>
          <button type="button" onClick={handleStartWave} disabled={isStarting || savingAttendance || !selectedWave || !waveParticipants.length || selectedWave.status !== 'SCHEDULED'} className="w-full min-h-24 rounded-2xl bg-emerald-500 text-slate-950 text-xl font-black disabled:opacity-40">
            {countdown !== null ? `Start over ${countdown}…` : isStarting ? 'Start opslaan…' : selectedWave && selectedWave.status !== 'SCHEDULED' ? 'Startgroep al gestart' : 'Start groep (3 sec.)'}
          </button>
        </div> : <>
          <BibKeypad value={singleBibInput} onChange={setSingleBibInput} disabled={isSavingSingle || !!pendingSingleStart} participantName={matchedSingleParticipant ? `${matchedSingleParticipant.firstName} ${matchedSingleParticipant.lastName}` : undefined} />
          {singleBibInput && timingRecords.some(record => record.type === 'START' && !record.isReversed && record.bibNumber === parsedSingleBib) && <p role="status" className="text-sm text-amber-300">Dit startnummer heeft al een startregistratie.</p>}
          <button type="button" onClick={() => handleSingleStart()} disabled={isSavingSingle || !!pendingSingleStart || !(parsedSingleBib > 0)} className="w-full min-h-16 rounded-2xl bg-emerald-500 text-slate-950 text-xl font-black disabled:opacity-40">{isSavingSingle ? 'Opslaan…' : 'Start nu vastleggen'}</button>
          <p className="text-xs text-slate-400">{event?.requireStartConfirmation ? 'Bevestiging gevraagd; de tijd wordt meteen vastgelegd.' : 'Direct registreren zonder extra bevestiging.'}</p>
        </>}
        {feedbackMsg && <p role="status" className={`rounded-xl border p-3 text-sm ${feedbackMsg.type === 'success' ? 'border-emerald-700 text-emerald-300' : 'border-amber-700 text-amber-300'}`}>{feedbackMsg.text}</p>}
        <div className="rounded-xl bg-slate-900 p-3 text-sm space-y-2">
          <h3 className="font-bold">Laatste starts</h3>
          {!recentStarts.length && <p className="text-slate-400">Nog geen starts geregistreerd.</p>}
          {recentStarts.slice(0, 3).map(record => <p key={record.id} className="flex justify-between gap-2"><strong>#{record.bibNumber}</strong><span className="font-mono text-emerald-400">{formatLocalTime(record.timestamp, true)}</span></p>)}
        </div>
        <p className="text-xs text-slate-400">Handmatige tijden en correcties vind je via Gewone weergave.</p>
      </MobileStationShell>}
      <div hidden={simpleMode} className="space-y-6">
      {/* 3 Start Modes Navigation (Requirement 15) */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <PlayCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Startregistratie Station</h2>
            <span className="text-xs text-slate-400">Ondersteuning voor 3 startmodi conform reglement (Req 15)</span>
          </div>
        </div>

        <MobileModeButton onClick={toggleSimpleMode} disabled={isStarting || isSavingSingle} />
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-850 p-1.5 rounded-xl border border-slate-750">
          <button
            type="button"
            onClick={() => setActiveTab('mass')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'mass'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" /> Massastart (startgroep)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'individual'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" /> Snelle Individuele Start
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'manual'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" /> Gepland / Manueel Startuur
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* MODE 1: MASSASTART WAVE */}
      {activeTab === 'mass' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
                Modus 1: Mass Start
              </span>
              <h3 className="text-2xl font-black text-white tracking-tight mt-0.5">
                Massastart per startgroep
              </h3>
              <p className="text-xs text-slate-400">
                Aanwezige deelnemers krijgen exact dezelfde starttijd. Afwezige deelnemers krijgen DNS en kunnen later individueel starten.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-400 font-semibold">Startgroep:</label>
              <select
                value={selectedWave?.id || ''}
                disabled={isStarting || savingAttendance}
                onChange={(e) => setSelectedWaveId(e.target.value)}
                className="bg-slate-850 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
              >
                {waves.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.scheduledStartTime}) — {w.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedWave && (
            <div className="bg-slate-850 rounded-xl p-6 border border-slate-750 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-white">{selectedWave.name}</span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider ${
                      selectedWave.status === 'STARTED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedWave.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Gepland startuur: <strong className="text-white font-mono">{selectedWave.scheduledStartTime}</strong>{' '}
                  • Deelnemers in wave: <strong className="text-white">{waveParticipants.length}</strong>
                </p>
                <p className="text-xs text-slate-400">
                  Reeds vertrokken:{' '}
                  <strong className="text-emerald-400">{startedParticipants.length}</strong> van{' '}
                  <strong className="text-white">{waveParticipants.length}</strong>
                </p>
              </div>

              <div className="w-full md:w-auto">
                <button
                  onClick={handleStartWave}
                  disabled={isStarting || savingAttendance || waveParticipants.length === 0 || selectedWave.status !== 'SCHEDULED'}
                  className="w-full md:w-auto px-8 py-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-black text-xl shadow-2xl shadow-emerald-500/30 active:scale-98 transition flex items-center justify-center gap-3 disabled:opacity-40 uppercase tracking-wider"
                >
                  {countdown !== null ? (
                    <span className="text-3xl animate-ping">{countdown}</span>
                  ) : (
                    <>
                      <PlayCircle className="w-7 h-7" />
                      <span>START {selectedWave.name.toUpperCase()} NU</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: INDIVIDUELE START (Requirement 16) */}
      {activeTab === 'individual' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
              Modus 2: Zeer snel startschem
            </span>
            <h3 className="text-2xl font-black text-white tracking-tight mt-0.5">
              Individuele Start Registratie
            </h3>
            <p className="text-xs text-slate-400">
              Typ startnummer [ 128 ] + ENTER om direct live te starten. Invoerveld blijft actief voor razendsnelle bediening.
            </p>
          </div>

          <form onSubmit={handleSingleStart} className="max-w-2xl space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">
                Startnummer (Bib):
              </label>
              <input
                ref={singleInputRef}
                type="number"
                value={singleBibInput}
                onChange={(e) => setSingleBibInput(e.target.value)}
                placeholder="bv. 128"
                className="w-full bg-slate-850 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl px-5 py-4 text-3xl font-mono font-black text-white focus:outline-none"
              />
            </div>

            {/* Live matched preview card (Requirement 16: 128 ENTER -> toon: JAN PEETERS U12 Wave 3) */}
            {matchedSingleParticipant ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                <div>
                  <span className="font-mono text-emerald-400 font-black text-xl mr-3">
                    #{matchedSingleParticipant.bibNumber}
                  </span>
                  <span className="text-white font-bold text-base">
                    {matchedSingleParticipant.firstName} {matchedSingleParticipant.lastName}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Categorie: <strong className="text-slate-200">{categories.find(c => c.id === matchedSingleParticipant.categoryId)?.name || 'Cat'}</strong> • Wave:{' '}
                    <strong className="text-slate-200">{waves.find(w => w.id === matchedSingleParticipant.waveId)?.name || '1'}</strong> • Status:{' '}
                    <strong className="text-amber-400">{matchedSingleParticipant.status}</strong>
                  </p>
                </div>
                <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-3 py-1 rounded-lg">
                  Klaar voor start
                </span>
              </div>
            ) : singleBibInput ? (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300">
                ⚠ Geen geregistreerde deelnemer voor Bib #{singleBibInput}. Wordt als onbekende noodstart gelogd.
              </div>
            ) : null}

            <button
              type="submit"
              disabled={!singleBibInput.trim() || isSavingSingle}
              className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg uppercase tracking-wider shadow-xl shadow-emerald-500/25 active:scale-98 transition disabled:opacity-40"
            >
              START {matchedSingleParticipant ? `${matchedSingleParticipant.firstName.toUpperCase()} NU (ENTER)` : 'NU REGISTREREN'}
            </button>
          </form>
        </div>
      )}

      {/* MODE 3: MANUAL SCHEDULED START (Requirement 15: MANUAL SCHEDULED START) */}
      {activeTab === 'manual' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold">
              Modus 3: Geplande of Achteraf Gecorrigeerde Starttijd
            </span>
            <h3 className="text-2xl font-black text-white tracking-tight mt-0.5">
              Handmatige Starttijd Toewijzen / Corrigeren
            </h3>
            <p className="text-xs text-slate-400">
              Voer handmatig een starttijd in (bijv. 09:04:30) voor een individuele loper of corrigeer een eerdere foutieve starttijd.
            </p>
          </div>

          <form onSubmit={handleManualScheduledStart} className="max-w-2xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Startnummer (Bib):
                </label>
                <input
                  type="number"
                  value={manualBibInput}
                  onChange={(e) => setManualBibInput(e.target.value)}
                  placeholder="bv. 128"
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
                {matchedManualParticipant && (
                  <span className="text-xs text-emerald-400 font-semibold mt-1 block">
                    ✓ {matchedManualParticipant.firstName} {matchedManualParticipant.lastName} ({categories.find(c => c.id === matchedManualParticipant.categoryId)?.name})
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Starttijd (UU:MM:SS):
                </label>
                <input
                  type="text"
                  value={manualTimeInput}
                  onChange={(e) => setManualTimeInput(e.target.value)}
                  placeholder="bv. 09:04:30"
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">
                Reden / Toelichting (optioneel):
              </label>
              <input
                type="text"
                value={manualReason}
                onChange={(e) => setManualReason(e.target.value)}
                placeholder="bv. Handmatige start na materiaalcontrole of jurybesluit"
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={!manualBibInput.trim() || !manualTimeInput.trim()}
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow transition disabled:opacity-40"
            >
              STARTTIJD TOEPASSEN & LOGGEN
            </button>
          </form>
        </div>
      )}

      {/* Grid: Unstarted Runners & Recent Starts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Unstarted runners in wave */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400" /> Nog Niet Gestart in {selectedWave?.name}
          </h3>
          <p className="text-xs text-slate-400">
            Klik op een loper om het startnummer in te laden. Gebruik de aanwezigheidsknop om afwezigen aan te duiden; zij krijgen DNS bij de wavestart.
          </p>

          <div className="max-h-72 overflow-y-auto space-y-1.5 text-xs pr-1">
            {waveParticipants
              .filter((p) => p.status !== 'STARTED' && p.status !== 'FINISHED')
              .map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSingleBibInput(String(p.bibNumber || ''));
                    setManualBibInput(String(p.bibNumber || ''));
                  }}
                  className="p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-750 cursor-pointer flex flex-wrap gap-2 items-center justify-between transition border border-slate-700/50"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-black text-amber-400 w-8">#{p.bibNumber}</span>
                    <span className="text-slate-200 font-semibold">
                      {p.firstName} {p.lastName}
                    </span>
                  </div>
                  {attendanceToggle(p)}
                </div>
              ))}
            {waveParticipants.filter((p) => p.status !== 'STARTED' && p.status !== 'FINISHED').length === 0 && (
              <p className="text-xs text-slate-500 italic p-4 text-center">
                Alle deelnemers in deze wave zijn al gestart!
              </p>
            )}
          </div>
        </div>

        {/* Right: Recent Starts Feed with Edit & Undo */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" /> Recente Startregistraties
          </h3>

          {recentStarts.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-6 text-center">
              Nog geen starts gelogd
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {recentStarts.map((rec) => {
                const p = participants.find((item) => item.bibNumber === rec.bibNumber);

                return (
                  <div
                    key={rec.id}
                    className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 font-mono font-bold text-emerald-400 flex items-center justify-center">
                        #{rec.bibNumber}
                      </span>
                      <div>
                        <span className="font-bold text-white block">
                          {p ? `${p.firstName} ${p.lastName}` : `Deelnemer #${rec.bibNumber}`}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatLocalTime(rec.timestamp, true)} • Post: {rec.deviceId} ({rec.operatorId})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingRecord({ id: rec.id, bib: rec.bibNumber, currentTime: rec.timestamp });
                          setEditNewTime(formatLocalTime(rec.timestamp, false));
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-medium transition"
                        title="Wijzig starttijd"
                      >
                        <Edit3 className="w-3 h-3 text-amber-400" /> Wijzig
                      </button>

                      <button
                        onClick={() => handleUndoStart(rec.id, rec.bibNumber)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-600 hover:border-red-600/50 transition text-[11px] font-medium"
                        title="Annuleer deze startregistratie met reden"
                      >
                        <RotateCcw className="w-3 h-3" /> Undo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      </div>
      {/* Edit Start Time Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-750 rounded-2xl p-6 max-w-sm w-full space-y-4 text-white shadow-2xl">
            <h3 className="text-base font-bold">Starttijd Wijzigen voor Bib #{editingRecord.bib}</h3>
            <p className="text-xs text-slate-400">
              Huidig geregistreerd startuur: <strong className="text-white font-mono">{formatLocalTime(editingRecord.currentTime, true)}</strong>
            </p>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Nieuwe starttijd (UU:MM:SS):</label>
              <input
                type="text"
                value={editNewTime}
                onChange={(e) => setEditNewTime(e.target.value)}
                placeholder="bv. 09:12:30"
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">
                Reden van wijziging <span className="text-red-400">*</span>:
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="bv. Verkeerde wave geklikt"
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleSaveEditStart}
                className="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
