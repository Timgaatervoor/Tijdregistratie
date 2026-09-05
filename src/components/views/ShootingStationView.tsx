import React, { useEffect, useState } from 'react';
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
  const [simpleMode, setSimpleMode] = useState(() => localStorage.getItem('shooting_simple_mode') === 'true');
  const targetCount = 5;
  const [bibInput, setBibInput] = useState('');
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [targets, setTargets] = useState<boolean[]>(() => Array(targetCount).fill(true)); // true = hit, false = miss
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'warn' } | null>(null);

  useEffect(() => {
    const loadDeviceIdentity = async () => {
      const device = await db.devices.toCollection().first();
      if (device) {
        operationService.setDeviceAndOperator(device.id, device.operatorName || 'Operator');
      }
    };
    loadDeviceIdentity();
  }, []);

  const toggleSimpleMode = () => {
    setSimpleMode((current) => {
      const next = !current;
      localStorage.setItem('shooting_simple_mode', String(next));
      if (next) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      return next;
    });
  };

  // Correction state
  const [editingResult, setEditingResult] = useState<ShootingResult | null>(null);
  const [editHits, setEditHits] = useState(5);
  const [editReason, setEditReason] = useState('');

  // Duplicate conflict state (Req 21)
  const [duplicateConflict, setDuplicateConflict] = useState<{
    existing: ShootingResult;
    newHits: number;
    newMisses: number;
    reason: string;
  } | null>(null);

  const hits = targets.filter(Boolean).length;
  const misses = targetCount - hits;
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

  // Quick preset buttons for the configured number of targets.
  const setPreset = (hitCount: number) => {
    const next = Array(targetCount).fill(false).map((_, i) => i < hitCount);
    setTargets(next);
    if (hitCount === 5) soundService.playSuccess();
    else soundService.playWarning();
  };

  const handleRecordShooting = async (e?: React.FormEvent, forceExtra = false) => {
    e?.preventDefault?.();
    if (isNaN(parsedBib) || parsedBib <= 0) {
      setFeedback({ text: 'Voer een geldig startnummer in', type: 'warn' });
      soundService.playWarning();
      return;
    }

    // Check duplicate round (Req 21)
    if (!forceExtra) {
      const existing = shootingResults.find(
        (r) => r.bibNumber === parsedBib && r.round === roundNumber && !r.isCorrected
      );
      if (existing) {
        soundService.playWarning();
        setDuplicateConflict({
          existing,
          newHits: hits,
          newMisses: misses,
          reason: '',
        });
        return;
      }
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
        targetCount,
        hits,
        misses,
        targets
      );

      soundService.playSuccess();
      setFeedback({
        text: `Schietronde ${roundNumber} opgeslagen voor Bib #${parsedBib}: ${hits}/${targetCount} treffers (+${totalPenaltySec}s straf)`,
        type: 'success',
      });

      // Reset form for next runner
      setBibInput('');
      setTargets(Array(targetCount).fill(true));
      setDuplicateConflict(null);
      onRefresh();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ text: `Fout bij opslaan: ${err?.message}`, type: 'warn' });
      soundService.playError();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resolve duplicate via Correction (Req 21)
  const handleResolveConflictCorrection = async () => {
    if (!duplicateConflict) return;
    if (!duplicateConflict.reason.trim()) {
      alert('Een reden van correctie is verplicht (Req 21 & 44)');
      return;
    }

    setIsSubmitting(true);
    try {
      const p = participants.find((item) => item.bibNumber === duplicateConflict.existing.bibNumber) || {
        id: duplicateConflict.existing.participantId,
        firstName: 'Deelnemer',
        lastName: `#${duplicateConflict.existing.bibNumber}`,
        categoryId: '',
        raceProfileId: '',
        bibNumber: duplicateConflict.existing.bibNumber,
        status: 'STARTED',
        createdAt: '',
        updatedAt: '',
      };

      // Mark old as corrected
      await db.shootingResults.update(duplicateConflict.existing.id, {
        isCorrected: true,
        correctionReason: duplicateConflict.reason,
      });

      // Record corrected shooting
      await operationService.recordShooting(
        event?.id || 'event-de-haan-2026',
        p,
        duplicateConflict.existing.round,
        stationName,
        targetCount,
        duplicateConflict.newHits,
        duplicateConflict.newMisses,
        undefined,
        true,
        duplicateConflict.reason
      );

      soundService.playSuccess();
      setFeedback({
        text: `Ronde ${duplicateConflict.existing.round} gecorrigeerd voor Bib #${duplicateConflict.existing.bibNumber} (${duplicateConflict.newHits}/${targetCount}).`,
        type: 'success',
      });

      setBibInput('');
      setTargets(Array(targetCount).fill(true));
      setDuplicateConflict(null);
      onRefresh();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ text: `Fout bij correctie: ${err?.message}`, type: 'warn' });
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

    const newMisses = targetCount - editHits;
    const p = participants.find((item) => item.id === editingResult.participantId);

    if (p) {
      await operationService.recordShooting(
        event?.id || 'event-de-haan-2026',
        p,
        editingResult.round,
        editingResult.station,
        targetCount,
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
          <button
            type="button"
            onClick={toggleSimpleMode}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
              simpleMode
                ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {simpleMode ? 'Eenvoudige modus aan' : 'Eenvoudige modus'}
          </button>
        </div>
      </div>

      {simpleMode && (
        <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-4 sm:p-6 shadow-xl space-y-5 max-w-xl mx-auto min-h-[calc(100vh-10rem)]">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Jury-invoer</span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-1">Snelle schietproef</h3>
            <p className="text-xs text-slate-400 mt-1">Kies het nummer, het resultaat en bevestig.</p>
          </div>

          <div className="space-y-3">
            <div className="w-full min-h-20 rounded-2xl bg-slate-900 border-2 border-emerald-500/60 flex items-center justify-center text-5xl font-mono font-black text-white tracking-widest">
              {bibInput || '—'}
            </div>
            {matchedParticipant && (
              <p className="text-center text-sm text-emerald-400 font-bold">
                {matchedParticipant.firstName} {matchedParticipant.lastName}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setBibInput((current) => `${current}${number}`.slice(0, 4))}
                  className="min-h-14 rounded-xl bg-slate-800 border border-slate-700 text-2xl font-black text-white active:scale-95 hover:bg-slate-700"
                >
                  {number}
                </button>
              ))}
              <button type="button" onClick={() => setBibInput('')} className="min-h-14 rounded-xl bg-red-950/60 border border-red-800 text-red-300 font-bold active:scale-95">Wis</button>
              <button type="button" onClick={() => setBibInput((current) => `${current}0`.slice(0, 4))} className="min-h-14 rounded-xl bg-slate-800 border border-slate-700 text-2xl font-black text-white active:scale-95 hover:bg-slate-700">0</button>
              <button type="button" onClick={() => setBibInput((current) => current.slice(0, -1))} className="min-h-14 rounded-xl bg-slate-800 border border-slate-700 text-xl font-black text-amber-300 active:scale-95">⌫</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="text-xs text-slate-300 font-bold flex items-center">
              Activiteit: <span className="ml-1 text-emerald-400">5 doelen</span>
            </div>
            <div className="text-xs text-slate-300 font-bold">
              Ronde
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[1, 2].map((round) => (
                  <button key={round} type="button" onClick={() => setRoundNumber(round)} className={`py-3 rounded-xl font-bold border ${roundNumber === round ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>{round}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {targets.map((isHit, index) => (
              <button
                key={index}
                type="button"
                onClick={() => toggleTarget(index)}
                aria-label={`Doel ${index + 1}: ${isHit ? 'raak' : 'gemist'}`}
                className={`aspect-square rounded-full text-xs sm:text-sm font-black border-4 active:scale-95 transition ${isHit ? 'bg-emerald-500 text-slate-950 border-emerald-300' : 'bg-red-600 text-white border-red-300'}`}
              >
                <span className="block text-lg">{index + 1}</span>
                <span className="block text-[9px] uppercase">{isHit ? 'Raak' : 'Gemist'}</span>
              </button>
            ))}
          </div>

          <p className="text-center text-sm font-bold text-slate-300">
            {hits}/{targetCount} raak, {misses} gemist
          </p>

          <button
            type="button"
            onClick={() => handleRecordShooting()}
            disabled={isSubmitting || !bibInput.trim()}
            className="w-full min-h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-lg active:scale-95 transition disabled:opacity-40"
          >
            BEVESTIG EN SLA OP
          </button>

          {feedback && (
            <div className={`p-3 rounded-xl text-sm font-bold text-center ${feedback.type === 'success' ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/60 text-amber-300'}`}>
              {feedback.text}
            </div>
          )}
        </div>
      )}

      {/* Main Touch Input Form */}
      <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${simpleMode ? 'hidden' : ''}`}>
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
                  {hits}/{targetCount} Treffers • {misses} Misser{misses !== 1 ? 's' : ''} (+{totalPenaltySec}s)
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
              SCHIETBEURT OPSLAAN ({hits}/{targetCount} TREFFERS)
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
                          {res.hits}/{res.shots} Treffers
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

      {/* DUPLICATE SCHIETREGISTRATIE MODAL (Requirement 21) */}
      {duplicateConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border-2 border-amber-500/70 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  ⚠ RONDE {duplicateConflict.existing.round} IS REEDS GEREGISTREERD
                </h3>
                <span className="text-xs text-amber-300 font-semibold">
                  Deelnemer Bib #{duplicateConflict.existing.bibNumber} heeft al een registratie voor deze ronde.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/60">
                <span className="text-slate-400 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                  Bestaande Registratie:
                </span>
                <p className="font-mono font-bold text-white text-sm">
                  {duplicateConflict.existing.hits} hits, {duplicateConflict.existing.misses} missers
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tijd: {formatLocalTime(duplicateConflict.existing.timestamp, true)}
                </p>
                <p className="text-[11px] text-slate-400">
                  Stand: {duplicateConflict.existing.station}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/40">
                <span className="text-blue-300 font-bold block mb-1 uppercase tracking-wider text-[10px]">
                  Nieuwe Registratie:
                </span>
                <p className="font-mono font-bold text-emerald-400 text-sm">
                  {duplicateConflict.newHits} hits, {duplicateConflict.newMisses} missers
                </p>
                <p className="text-[11px] text-slate-300 mt-1">
                  Stand: {stationName}
                </p>
                <p className="text-[11px] text-slate-300">
                  Straf: +{duplicateConflict.newMisses * penaltyPerMiss}s
                </p>
              </div>
            </div>

            {/* Optional Correction Reason input */}
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Reden bij correctie (verplicht voor CORRIGEREN):
              </label>
              <input
                type="text"
                value={duplicateConflict.reason}
                onChange={(e) =>
                  setDuplicateConflict({ ...duplicateConflict, reason: e.target.value })
                }
                placeholder="bv. Schietkaart herbekeken, doelschijf 2 geteld"
                className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 3 Explicit Buttons from Requirement 21 */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDuplicateConflict(null)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition text-center"
              >
                ANNULEREN
              </button>

              <button
                type="button"
                onClick={handleResolveConflictCorrection}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wider transition text-center shadow"
              >
                CORRIGEREN
              </button>

              <button
                type="button"
                onClick={(e) => handleRecordShooting(e, true)}
                className="flex-1 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider transition text-center shadow"
              >
                TOEVOEGEN ALS EXTRA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
