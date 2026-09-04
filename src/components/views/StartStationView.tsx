import React, { useState } from 'react';
import { PlayCircle, Clock, CheckCircle2, RotateCcw, AlertTriangle, Users } from 'lucide-react';
import type { Wave, Participant, TimingRecord, Category } from '../../types';
import { db } from '../../db/dexieDb';
import { operationService, generateUUID } from '../../services/operationService';
import { soundService } from '../../services/soundService';
import { formatLocalTime } from '../../services/timingEngine';

interface StartStationViewProps {
  waves: Wave[];
  participants: Participant[];
  categories: Category[];
  timingRecords: TimingRecord[];
  onRefresh: () => void;
}

export const StartStationView: React.FC<StartStationViewProps> = ({
  waves,
  participants,
  categories,
  timingRecords,
  onRefresh,
}) => {
  const [selectedWaveId, setSelectedWaveId] = useState<string>(waves[0]?.id || '');
  const [isStarting, setIsStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [singleBibInput, setSingleBibInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  const selectedWave = waves.find((w) => w.id === selectedWaveId) || waves[0];
  const waveParticipants = participants.filter((p) => p.waveId === selectedWave?.id);
  const startedParticipants = waveParticipants.filter((p) => p.status === 'STARTED' || p.status === 'FINISHED');

  // Recent starts
  const recentStarts = [...timingRecords]
    .filter((r) => r.type === 'START' && !r.isReversed)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

  const handleStartWave = async () => {
    if (!selectedWave) return;

    setIsStarting(true);
    soundService.playWarning(); // warning beep

    // 3 second visual & acoustic countdown
    setCountdown(3);
    setTimeout(() => {
      soundService.playWarning();
      setCountdown(2);
      setTimeout(() => {
        soundService.playWarning();
        setCountdown(1);
        setTimeout(async () => {
          setCountdown(null);
          soundService.playSuccess();

          const nowIso = new Date().toISOString();
          const monotonicNow = performance.now();

          const updatedParticipants: Participant[] = [];
          const newTimingRecords: TimingRecord[] = [];

          for (const p of waveParticipants) {
            if (p.status === 'FINISHED') continue; // Don't reset already finished

            updatedParticipants.push({
              ...p,
              status: 'STARTED',
              updatedAt: nowIso,
            });

            if (p.bibNumber) {
              newTimingRecords.push({
                id: generateUUID(),
                eventId: selectedWave.eventId,
                participantId: p.id,
                bibNumber: p.bibNumber,
                type: 'START',
                timestamp: nowIso,
                monotonicMs: monotonicNow,
                clockOffsetMs: 0,
                deviceId: operationService.getDeviceId(),
                operatorId: operationService.getOperator(),
                isConfirmed: true,
                syncStatus: 'LOCAL_ONLY',
              });
            }
          }

          // Update Wave
          await db.waves.update(selectedWave.id, {
            status: 'STARTED',
            actualStartTime: nowIso,
          });

          // Save records & participants in IndexedDB
          if (updatedParticipants.length > 0) {
            await db.participants.bulkPut(updatedParticipants);
          }
          if (newTimingRecords.length > 0) {
            await db.timingRecords.bulkPut(newTimingRecords);
          }

          // Log operation & audit
          await operationService.logAudit(
            'WAVE_STARTED',
            `Wave "${selectedWave.name}" gestart om ${formatLocalTime(nowIso, true)} met ${newTimingRecords.length} deelnemers`
          );

          setFeedbackMsg({
            text: `Wave "${selectedWave.name}" succesvol gestart! ${newTimingRecords.length} deelnemers onderweg.`,
            type: 'success',
          });
          setIsStarting(false);
          onRefresh();
          setTimeout(() => setFeedbackMsg(null), 4000);
        }, 1000);
      }, 1000);
    }, 1000);
  };

  const handleSingleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const bib = parseInt(singleBibInput.trim(), 10);
    if (isNaN(bib) || bib <= 0) return;

    const p = participants.find((item) => item.bibNumber === bib);
    const nowIso = new Date().toISOString();

    await operationService.recordStart(
      'event-de-haan-2026',
      bib,
      p,
      nowIso,
      performance.now()
    );

    soundService.playSuccess();
    setFeedbackMsg({
      text: `Individuele start geregistreerd voor Bib #${bib} (${p ? `${p.firstName} ${p.lastName}` : 'Onbekend'})`,
      type: 'success',
    });
    setSingleBibInput('');
    onRefresh();
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleUndoStart = async (recordId: string, bibNumber: number) => {
    const reason = prompt('Reden voor annuleren van start (verplicht):');
    if (!reason || !reason.trim()) return;

    await db.timingRecords.update(recordId, {
      isReversed: true,
      reversedReason: reason,
    });

    const p = participants.find((item) => item.bibNumber === bibNumber);
    if (p) {
      await db.participants.update(p.id, {
        status: 'READY',
        updatedAt: new Date().toISOString(),
      });
    }

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
      {/* Wave Selector & Mass Start Hero */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1.5">
              <PlayCircle className="w-4 h-4" /> Startpost • Wave Management
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
              Massastart Registratie
            </h2>
          </div>

          {/* Wave Dropdown */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-slate-400 font-semibold">Selecteer Wave:</label>
            <select
              value={selectedWave?.id || ''}
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

        {/* Selected Wave Overview Card */}
        {selectedWave && (
          <div className="bg-slate-850 rounded-xl p-5 border border-slate-750 flex flex-col md:flex-row items-center justify-between gap-6">
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
              <p className="text-xs text-slate-400 mt-1">
                Gepland startuur: <strong className="text-white font-mono">{selectedWave.scheduledStartTime}</strong>{' '}
                • Deelnemers in wave: <strong className="text-white">{waveParticipants.length}</strong>
              </p>
              <p className="text-xs text-slate-400">
                Reeds gestart:{' '}
                <strong className="text-emerald-400">{startedParticipants.length}</strong> van{' '}
                <strong className="text-white">{waveParticipants.length}</strong>
              </p>
            </div>

            {/* Giant Start Button with countdown */}
            <div className="w-full md:w-auto">
              <button
                onClick={handleStartWave}
                disabled={isStarting || waveParticipants.length === 0}
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

        {feedbackMsg && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{feedbackMsg.text}</span>
          </div>
        )}
      </div>

      {/* Grid: Individual Start & Recent Starts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Individual Start Entry (Late arrival or separate timer) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" /> Individuele Start / Laatkomer
          </h3>
          <p className="text-xs text-slate-400">
            Registreer een individuele start voor een atleet die buiten de wave vertrekt.
          </p>

          <form onSubmit={handleSingleStart} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-semibold block mb-1">
                Startnummer (Bib):
              </label>
              <input
                type="number"
                value={singleBibInput}
                onChange={(e) => setSingleBibInput(e.target.value)}
                placeholder="bv. 42"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={!singleBibInput.trim()}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider shadow transition disabled:opacity-40"
            >
              Start Registreren
            </button>
          </form>

          {/* Quick list of participants in selected wave not yet started */}
          <div className="pt-4 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Nog niet gestart in {selectedWave?.name}:
            </span>
            <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
              {waveParticipants
                .filter((p) => p.status !== 'STARTED' && p.status !== 'FINISHED')
                .map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSingleBibInput(String(p.bibNumber || ''))}
                    className="p-2 rounded bg-slate-800/60 hover:bg-slate-750 cursor-pointer flex items-center justify-between transition"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">#{p.bibNumber}</span>
                      <span className="text-slate-200">
                        {p.firstName} {p.lastName}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium">Klik om te selecteren</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Right: Recent Starts Feed with Undo */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" /> Recente Startregistraties
          </h3>

          {recentStarts.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-6 text-center">
              Nog geen starts gelogd
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
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

                    <button
                      onClick={() => handleUndoStart(rec.id, rec.bibNumber)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700 hover:bg-red-950/60 text-slate-300 hover:text-red-300 border border-slate-600 hover:border-red-600/50 transition text-[11px] font-medium"
                      title="Annuleer deze startregistratie met reden"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Ongedaan maken
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
