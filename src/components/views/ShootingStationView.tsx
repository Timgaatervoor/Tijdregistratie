import React, { useState } from 'react';
import { Crosshair, CheckCircle2, AlertCircle, RotateCcw, Edit2, ShieldAlert } from 'lucide-react';
import type { Participant, ShootingResult, RaceEvent } from '../../types';
import { db } from '../../db/dexieDb';
import { operationService } from '../../services/operationService';
import { soundService } from '../../services/soundService';
import { formatLocalTime } from '../../services/timingEngine';

interface ShootingStationViewProps {
  event: RaceEvent | null;
  participants: Participant[];
  shootingResults: ShootingResult[];
  onRefresh: () => void;
}

export const ShootingStationView: React.FC<ShootingStationViewProps> = ({
  event,
  participants,
  shootingResults,
  onRefresh,
}) => {
  const [stationName, setStationName] = useState('Stand 1');
  const [bibInput, setBibInput] = useState('');
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [targets, setTargets] = useState<boolean[]>([true, true, true, true, true]); // true = hit, false = miss
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  // Correction state
  const [editingResult, setEditingResult] = useState<ShootingResult | null>(null);
  const [editHits, setEditHits] = useState(5);
  const [editReason, setEditReason] = useState('');

  const hits = targets.filter(Boolean).length;
  const misses = 5 - hits;
  const penaltyPerMiss = event?.penaltySecondsPerMiss || 20;
  const totalPenaltySec = misses * penaltyPerMiss;

  // Matched participant
  const parsedBib = parseInt(bibInput.trim(), 10);
  const matchedParticipant = !isNaN(parsedBib)
    ? participants.find((p) => p.bibNumber === parsedBib)
    : undefined;

  // Toggle individual target circle
  const toggleTarget = (index: number) => {
    const next = [...targets];
    next[index] = !next[index];
    setTargets(next);
    if (next[index]) {
      soundService.playSuccess();
    } else {
      soundService.playWarning();
    }
  };

  // Quick preset buttons (5/5, 4/5, etc.)
  const setPreset = (hitCount: number) => {
    const next = Array(5).fill(false).map((_, i) => i < hitCount);
    setTargets(next);
    if (hitCount === 5) soundService.playSuccess();
    else soundService.playWarning();
  };

  const handleRecordShooting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedBib) || parsedBib <= 0) {
      setFeedback({ text: 'Voer een geldig startnummer in', type: 'warn' });
      soundService.playWarning();
      return;
    }

    setIsSubmitting(true);
    try {
      await operationService.recordShooting(
        event?.id || 'event-de-haan-2026',
        matchedParticipant || {
          id: `unknown-${parsedBib}`,
          firstName: 'Onbekend',
          lastName: `#${parsedBib}`,
          categoryId: '',
          raceProfileId: '',
          bibNumber: parsedBib,
          status: 'STARTED',
          createdAt: '',
          updatedAt: '',
        },
        roundNumber,
        stationName,
        5,
        hits,
        misses,
        targets
      );

      soundService.playSuccess();
      setFeedback({
        text: `Schietronde ${roundNumber} opgeslagen voor Bib #${parsedBib}: ${hits}/5 treffers (+${totalPenaltySec}s straf)`,
        type: 'success',
      });

      // Reset form for next runner
      setBibInput('');
      setTargets([true, true, true, true, true]);
      onRefresh();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ text: `Fout bij opslaan: ${err?.message}`, type: 'warn' });
      soundService.playError();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save correction
  const handleSaveCorrection = async () => {
    if (!editingResult) return;
    if (!editReason.trim()) {
      alert('Een reden van correctie is verplicht (Req 44)');
      return;
    }

    const newMisses = 5 - editHits;
    const p = participants.find((item) => item.id === editingResult.participantId);

    if (p) {
      await operationService.recordShooting(
        event?.id || 'event-de-haan-2026',
        p,
        editingResult.round,
        editingResult.station,
        5,
        editHits,
        newMisses,
        undefined,
        true,
        editReason
      );
    }

    setEditingResult(null);
    setEditReason('');
    onRefresh();
  };

  // Recent shooting feed
  const recentShooting = [...shootingResults]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Station Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-blue-400 font-bold flex items-center gap-1.5">
            <Crosshair className="w-4 h-4" /> Schietstand Post
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
            Schietproef Registratie
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-semibold">Schietstand Nummer:</label>
          <select
            value={stationName}
            onChange={(e) => setStationName(e.target.value)}
            className="bg-slate-850 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-bold focus:outline-none focus:border-blue-500"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={`shooting-stand-opt-${i + 1}`} value={`Stand ${i + 1}`}>
                Stand {i + 1}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Touch Input Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Target Board */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <form onSubmit={handleRecordShooting} className="space-y-6">
            {/* Bib Input & Round Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Startnummer (Bib):
                </label>
                <input
                  type="number"
                  value={bibInput}
                  onChange={(e) => setBibInput(e.target.value)}
                  placeholder="Voer startnummer in..."
                  autoFocus
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl px-4 py-3 text-2xl font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                />
                {matchedParticipant ? (
                  <span className="text-xs text-emerald-400 font-semibold mt-1 block">
                    ✓ {matchedParticipant.firstName} {matchedParticipant.lastName} (
                    {matchedParticipant.categoryName || 'Cat'})
                  </span>
                ) : bibInput ? (
                  <span className="text-xs text-amber-400 font-semibold mt-1 block">
                    ⚠ Onbekend startnummer (wordt als noodrecord gelogd)
                  </span>
                ) : null}
              </div>

              <div>
                <label className="text-xs text-slate-400 font-semibold block mb-1">
                  Schietbeurt:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoundNumber(1)}
                    className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider border transition ${
                      roundNumber === 1
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    Ronde 1 (Liggend)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoundNumber(2)}
                    className={`py-3 rounded-xl font-bold text-xs uppercase tracking-wider border transition ${
                      roundNumber === 2
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    Ronde 2 (Staand)
                  </button>
                </div>
              </div>
            </div>

            {/* 5 Big Touch Target Circles (Biathlon Stijl) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Tik op doelschijf om te wisselen (Treffer / Misser)
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {hits}/5 Treffers • {misses} Misser{misses !== 1 ? 's' : ''} (+{totalPenaltySec}s)
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2 sm:gap-4 p-4 bg-slate-950 rounded-2xl border border-slate-800">
                {targets.map((isHit, idx) => (
                  <button
                    key={`target-circle-${idx}`}
                    type="button"
                    onClick={() => toggleTarget(idx)}
                    className={`aspect-square rounded-full flex flex-col items-center justify-center border-4 shadow-xl active:scale-95 transition-all select-none ${
                      isHit
                        ? 'bg-white border-emerald-500 text-slate-950 shadow-emerald-500/20'
                        : 'bg-slate-900 border-slate-700 text-red-400'
                    }`}
                  >
                    <span className="text-xl sm:text-2xl font-black">{idx + 1}</span>
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        isHit ? 'text-emerald-700' : 'text-red-400'
                      }`}
                    >
                      {isHit ? 'RAAK' : 'MIS'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Hit Preset Buttons */}
            <div>
              <span className="text-xs font-semibold text-slate-400 block mb-2">
                Of kies direct aantal treffers (1-touch):
              </span>
              <div className="grid grid-cols-6 gap-2">
                {[5, 4, 3, 2, 1, 0].map((h) => (
                  <button
                    key={`preset-hits-${h}`}
                    type="button"
                    onClick={() => setPreset(h)}
                    className={`py-2.5 rounded-lg text-xs font-bold transition border ${
                      hits === h
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    {h}/5
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !bibInput.trim()}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black text-base shadow-xl shadow-blue-500/25 active:scale-98 transition disabled:opacity-40 uppercase tracking-wider"
            >
              SCHIETBEURT OPSLAAN ({hits}/5 TREFFERS)
            </button>
          </form>

          {feedback && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/60 border border-amber-500/40 text-amber-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{feedback.text}</span>
            </div>
          )}
        </div>

        {/* Right: Recent Shooting Feed with Edit Mode */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-blue-400" /> Recente Schietresultaten
          </h3>

          {/* Edit Modal / Inline form if active */}
          {editingResult && (
            <div className="p-4 bg-blue-950/30 border border-blue-500/40 rounded-xl space-y-3 text-xs">
              <span className="font-bold text-white block">
                Correctie voor Bib #{editingResult.bibNumber} (Ronde {editingResult.round})
              </span>
              <div>
                <label className="text-slate-300 block mb-1">Gewijzigde Treffers (0-5):</label>
                <div className="flex gap-2">
                  {[5, 4, 3, 2, 1, 0].map((h) => (
                    <button
                      key={`edit-preset-hits-${h}`}
                      type="button"
                      onClick={() => setEditHits(h)}
                      className={`px-2.5 py-1 rounded text-xs font-bold border ${
                        editHits === h
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-slate-300 block mb-1">
                  Reden van correctie <span className="text-red-400">*</span>:
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="bv. Schijf 3 alsnog geteld na inspectie"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setEditingResult(null)}
                  className="px-3 py-1 rounded bg-slate-800 text-slate-400"
                >
                  Annuleren
                </button>
                <button
                  onClick={handleSaveCorrection}
                  className="px-3 py-1 rounded bg-blue-600 font-bold text-white"
                >
                  Correctie Opslaan
                </button>
              </div>
            </div>
          )}

          {recentShooting.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-6 text-center">
              Nog geen schietbeurten gelogd
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {recentShooting.map((res) => {
                const p = participants.find((item) => item.id === res.participantId);

                return (
                  <div
                    key={res.id}
                    className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 font-mono font-bold text-blue-400 flex items-center justify-center">
                        #{res.bibNumber}
                      </span>
                      <div>
                        <span className="font-bold text-white block">
                          {p ? `${p.firstName} ${p.lastName}` : `Bib #${res.bibNumber}`}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Ronde {res.round} ({res.station}) • {formatLocalTime(res.timestamp, true)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-400 block">
                          {res.hits}/5 Treffers
                        </span>
                        <span className="text-[10px] text-red-400 font-semibold">
                          +{res.misses * penaltyPerMiss}s straf
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setEditingResult(res);
                          setEditHits(res.hits);
                        }}
                        className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition"
                        title="Corrigeer schietresultaat"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
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
  );
};
