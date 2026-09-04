import React, { useState } from 'react';
import {
  Trash2,
  RefreshCw,
  Clock,
  Layers,
  Users,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  Plus,
  ArrowRight,
  ShieldAlert,
  Database,
  Calendar,
  Save,
} from 'lucide-react';
import type { RaceEvent, Wave, Participant, Category } from '../../types';
import { db } from '../../db/dexieDb';
import {
  clearAllParticipants,
  clearAllWaves,
  resetTimingAndShooting,
  resetToBlankEvent,
  initializeSampleData,
} from '../../services/sampleDataService';
import { generateUUID, operationService } from '../../services/operationService';
import { soundService } from '../../services/soundService';

interface EventSetupAndResetProps {
  event: RaceEvent | null;
  waves: Wave[];
  participants: Participant[];
  categories: Category[];
  onRefresh: () => void;
}

export const EventSetupAndReset: React.FC<EventSetupAndResetProps> = ({
  event,
  waves,
  participants,
  categories,
  onRefresh,
}) => {
  // Wave state for adding
  const [newWaveName, setNewWaveName] = useState('');
  const [newWaveTime, setNewWaveTime] = useState('10:00:00');
  const [newWaveCapacity, setNewWaveCapacity] = useState(25);

  // Quick edit wave time
  const [waveTimes, setWaveTimes] = useState<Record<string, string>>({});

  // Bulk assignment state
  const [selectedBulkCategory, setSelectedBulkCategory] = useState<string>('');
  const [targetBulkWave, setTargetBulkWave] = useState<string>(waves[0]?.id || '');
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  // Add single participant state
  const [newBib, setNewBib] = useState<number>(
    participants.length > 0 ? Math.max(...participants.map((p) => p.bibNumber)) + 1 : 1
  );
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newCatId, setNewCatId] = useState(categories[0]?.id || '');
  const [newWaveId, setNewWaveId] = useState(waves[0]?.id || '');
  const [newClub, setNewClub] = useState('');
  const [participantAddSuccess, setParticipantAddSuccess] = useState(false);

  // Blank event modal state
  const [showBlankEventModal, setShowBlankEventModal] = useState(false);
  const [blankName, setBlankName] = useState('Run-Biathlon De Haan 2026');
  const [blankDate, setBlankDate] = useState('2026-09-06');
  const [blankLocation, setBlankLocation] = useState('De Haan');

  // Handle resetting time registrations only
  const handleResetTimingOnly = async () => {
    if (
      !confirm(
        'Weet u zeker dat u ALLE geregistreerde start-, loop-, schiet- en finishtijden wilt resetten naar blanco?\n\nDeelnemers en waves blijven volledig behouden. Alle statussen gaan terug naar "READY". Ideaal na het proefdraaien vóór de wedstrijd!'
      )
    ) {
      return;
    }

    await resetTimingAndShooting();
    soundService.playSuccess();
    await onRefresh();
    alert('Tijdregistraties en schietresultaten zijn succesvol gereset naar blanco!');
  };

  // Handle clearing all participants
  const handleClearParticipants = async () => {
    if (
      !confirm(
        '⚠️ OPGELET: Weet u zeker dat u ALLE deelnemers wilt wissen?\n\nHiermee wordt de deelnemerslijst volledig leeggemaakt zodat u met een schone lei kunt beginnen of een nieuw bestand kunt importeren.'
      )
    ) {
      return;
    }

    await clearAllParticipants();
    soundService.playWarning();
    await onRefresh();
    alert('Alle deelnemers zijn gewist uit het systeem.');
  };

  // Handle clearing all waves
  const handleClearWaves = async () => {
    if (
      !confirm(
        '⚠️ OPGELET: Weet u zeker dat u ALLE waves wilt wissen?\n\nBestaande deelnemers blijven behouden maar worden ontkoppeld van hun startgroep.'
      )
    ) {
      return;
    }

    await clearAllWaves();
    soundService.playWarning();
    await onRefresh();
    alert('Alle waves zijn gewist.');
  };

  // Handle factory reset to blank event
  const handleFactoryResetBlank = async (e: React.FormEvent) => {
    e.preventDefault();
    await resetToBlankEvent(blankName.trim(), blankDate, blankLocation.trim());
    soundService.playWarning();
    setShowBlankEventModal(false);
    await onRefresh();
    alert(`Het systeem is volledig gewist en klaar gezet voor "${blankName}".`);
  };

  // Handle reload demo sample data
  const handleRestoreSampleData = async () => {
    if (
      !confirm(
        'Wilt u de voorbeeldtestdata herstellen? Dit wist de huidige data en zet 200 voorbeelddeelnemers en 10 waves klaar.'
      )
    ) {
      return;
    }

    await initializeSampleData(true);
    soundService.playSuccess();
    await onRefresh();
    alert('Voorbeeldtestdata is succesvol hersteld!');
  };

  // Add new wave
  const handleAddNewWave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaveName.trim()) return;

    const nextWaveNum = waves.length > 0 ? Math.max(...waves.map((w) => w.waveNumber)) + 1 : 1;
    const wave: Wave = {
      id: generateUUID(),
      eventId: event?.id || 'event-de-haan-2026',
      name: newWaveName.trim(),
      waveNumber: nextWaveNum,
      scheduledStartTime: newWaveTime.trim() || '10:00:00',
      categoryIds: [],
      maxParticipants: newWaveCapacity || 25,
      status: 'SCHEDULED',
    };

    await db.waves.put(wave);
    await operationService.logAudit(
      'WAVE_CREATED',
      `Nieuwe wave "${wave.name}" aangemaakt (Startuur: ${wave.scheduledStartTime})`
    );

    soundService.playSuccess();
    setNewWaveName('');
    await onRefresh();
  };

  // Save updated wave time directly
  const handleSaveWaveTime = async (w: Wave) => {
    const timeToSave = waveTimes[w.id] || w.scheduledStartTime;
    await db.waves.update(w.id, {
      scheduledStartTime: timeToSave.trim(),
    });
    await operationService.logAudit(
      'WAVE_UPDATED',
      `Startuur van wave "${w.name}" aangepast naar ${timeToSave.trim()}`
    );
    soundService.playSuccess();
    await onRefresh();
  };

  // Delete wave
  const handleDeleteWave = async (w: Wave) => {
    if (!confirm(`Weet u zeker dat u "${w.name}" wilt verwijderen?`)) return;

    await db.waves.delete(w.id);
    await db.participants.where('waveId').equals(w.id).modify({ waveId: undefined });
    await operationService.logAudit('WAVE_DELETED', `Wave "${w.name}" verwijderd`);

    soundService.playWarning();
    await onRefresh();
  };

  // Bulk assign by category or unassigned
  const handleBulkAssign = async () => {
    if (!targetBulkWave) return;
    const targetW = waves.find((w) => w.id === targetBulkWave);
    if (!targetW) return;

    let targetParticipants: Participant[] = [];

    if (selectedBulkCategory === '__UNASSIGNED__') {
      targetParticipants = participants.filter((p) => !p.waveId);
    } else if (selectedBulkCategory) {
      targetParticipants = participants.filter((p) => p.categoryId === selectedBulkCategory);
    } else {
      targetParticipants = participants.filter((p) => !p.waveId);
    }

    if (targetParticipants.length === 0) {
      setBulkMessage('Geen overeenkomende deelnemers gevonden om toe te wijzen.');
      setTimeout(() => setBulkMessage(null), 3000);
      return;
    }

    for (const p of targetParticipants) {
      await db.participants.update(p.id, { waveId: targetBulkWave });
    }

    await operationService.logAudit(
      'PARTICIPANT_UPDATED',
      `${targetParticipants.length} deelnemers in bulk toegewezen aan wave "${targetW.name}"`
    );

    soundService.playSuccess();
    setBulkMessage(`${targetParticipants.length} deelnemers succesvol toegewezen aan ${targetW.name}!`);
    await onRefresh();
    setTimeout(() => setBulkMessage(null), 4000);
  };

  // Add single participant
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim()) return;

    const targetCat = categories.find((c) => c.id === newCatId) || categories[0];
    const newP: Participant = {
      id: generateUUID(),
      bibNumber: newBib,
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      gender: 'M',
      categoryId: targetCat?.id || 'cat-1',
      raceProfileId: targetCat?.raceProfileId || 'profile-default',
      waveId: newWaveId || undefined,
      club: newClub.trim() || undefined,
      status: 'READY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.participants.put(newP);
    await operationService.logAudit(
      'PARTICIPANT_CREATED',
      `Deelnemer #${newBib} ${newFirstName} ${newLastName} aangemaakt`
    );

    soundService.playSuccess();
    setParticipantAddSuccess(true);
    setNewFirstName('');
    setNewLastName('');
    setNewBib((prev) => prev + 1);
    await onRefresh();
    setTimeout(() => setParticipantAddSuccess(false), 3000);
  };

  const unassignedCount = participants.filter((p) => !p.waveId).length;

  return (
    <div className="space-y-8">
      {/* 1. Evenement Schonen & Data Reset Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-red-400 font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Evenement Schonen & Resetten
            </span>
            <h3 className="text-xl font-black text-white mt-0.5">
              Data Beheer, Blanco Start & Proefdraai Reset
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Veilig wissen van testdata, blanco opstarten voor een nieuwe wedstrijd of terugzetten naar demo
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              {participants.length} deelnemers • {waves.length} waves
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Reset timing only */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <RefreshCw className="w-4 h-4" /> Tijdregistraties Resetten
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Wist alle start-, loop-, finish- en schiettijden. Deelnemers en waves blijven intact! Ideaal na het proefdraaien vóór de wedstrijd.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetTimingOnly}
              className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition"
            >
              Reset Tijden & Schieten
            </button>
          </div>

          {/* Clear participants */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                <Trash2 className="w-4 h-4" /> Alle Deelnemers Wissen
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Maakt de deelnemerslijst helemaal leeg (0 deelnemers) om met een schone lei te beginnen of een Excel te importeren.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearParticipants}
              className="w-full py-2 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-xs font-bold transition"
            >
              Wis {participants.length} Deelnemers
            </button>
          </div>

          {/* Clear waves */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
                <Layers className="w-4 h-4" /> Alle Waves Wissen
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Wist alle startgroepen om een geheel nieuwe wave-indeling aan te maken. Deelnemers blijven bewaard.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearWaves}
              className="w-full py-2 px-3 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-xs font-bold transition"
            >
              Wis {waves.length} Waves
            </button>
          </div>

          {/* Factory reset to blank event */}
          <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Database className="w-4 h-4" /> Volledig Blanco Start
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Start een geheel nieuw evenement. Wist alle deelnemers, waves en tijden, en stelt een nieuw blanco evenement in.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setShowBlankEventModal(true)}
                className="w-full py-2 px-3 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition"
              >
                Nieuw Blanco Evenement
              </button>
              <button
                type="button"
                onClick={handleRestoreSampleData}
                className="w-full py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-semibold transition"
              >
                Herstel De Haan Demo Data
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Waves & Starturen Beheer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Starttijden & Wave-indeling
            </span>
            <h3 className="text-xl font-black text-white mt-0.5">
              Waves & Starturen Instellen
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pas het exacte startuur van elke wave aan, voeg nieuwe startgroepen toe en koppel categorieën
            </p>
          </div>

          <form onSubmit={handleAddNewWave} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              required
              value={newWaveName}
              onChange={(e) => setNewWaveName(e.target.value)}
              placeholder={`Naam (bv. Wave ${waves.length + 1})`}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 w-44 font-semibold"
            />
            <input
              type="text"
              required
              value={newWaveTime}
              onChange={(e) => setNewWaveTime(e.target.value)}
              placeholder="10:00:00"
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono w-28 text-center"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={newWaveCapacity}
              onChange={(e) => setNewWaveCapacity(parseInt(e.target.value, 10) || 25)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono w-20 text-center"
              title="Max capaciteit"
            />
            <button
              type="submit"
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
            >
              <Plus className="w-4 h-4" /> Wave Toevoegen
            </button>
          </form>
        </div>

        {/* Waves List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Wave Naam</th>
                <th className="py-2.5 px-3">Exact Startuur (uu:mm:ss)</th>
                <th className="py-2.5 px-3">Deelnemers</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {waves.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                    Geen waves aanwezig. Voeg hierboven een nieuwe wave toe.
                  </td>
                </tr>
              ) : (
                waves.map((w) => {
                  const assigned = participants.filter((p) => p.waveId === w.id);
                  const currentTime = waveTimes[w.id] ?? w.scheduledStartTime;

                  return (
                    <tr key={w.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-3 font-mono font-bold text-amber-400">
                        #{w.waveNumber}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">
                        {w.name}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={currentTime}
                            onChange={(e) =>
                              setWaveTimes({ ...waveTimes, [w.id]: e.target.value })
                            }
                            placeholder="10:00:00"
                            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs w-28 text-center focus:border-amber-400 focus:outline-none"
                          />
                          {waveTimes[w.id] !== undefined && waveTimes[w.id] !== w.scheduledStartTime && (
                            <button
                              type="button"
                              onClick={() => handleSaveWaveTime(w)}
                              className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center gap-1 shadow"
                            >
                              <Save className="w-3 h-3" /> Opslaan
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-300">
                          {assigned.length} / {w.maxParticipants || 25} lopers
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            w.status === 'STARTED'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : w.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteWave(w)}
                          className="p-1.5 rounded-lg bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-800/40 transition"
                          title="Wave verwijderen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Deelnemers Toewijzen aan Waves (Bulk & Automatisering) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bulk Wave Assignment */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" /> Deelnemers Toewijzen aan Waves
          </h4>
          <p className="text-slate-400 leading-relaxed">
            Wijs snel groepen deelnemers toe aan een bepaalde wave. Momenteel hebben{' '}
            <strong className="text-amber-400 font-mono font-bold">{unassignedCount}</strong>{' '}
            deelnemers nog geen startwave.
          </p>

          <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Selecteer groep deelnemers:
              </label>
              <select
                value={selectedBulkCategory}
                onChange={(e) => setSelectedBulkCategory(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
              >
                <option value="__UNASSIGNED__">
                  Alle deelnemers ZONDER wave ({unassignedCount} lopers)
                </option>
                {categories.map((c) => {
                  const inCat = participants.filter((p) => p.categoryId === c.id).length;
                  return (
                    <option key={c.id} value={c.id}>
                      Categorie: {c.name} ({inCat} lopers)
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Wijs toe aan deze startwave:
              </label>
              <select
                value={targetBulkWave}
                onChange={(e) => setTargetBulkWave(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
              >
                {waves.map((w) => (
                  <option key={w.id} value={w.id}>
                    #{w.waveNumber} {w.name} (Start: {w.scheduledStartTime})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              {bulkMessage && (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {bulkMessage}
                </span>
              )}
              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={waves.length === 0}
                className="ml-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow"
              >
                <span>Toewijzen aan Wave</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Add Single Participant */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-400" /> Nieuwe Deelnemer Toevoegen
          </h4>
          <p className="text-slate-400 leading-relaxed">
            Schrijf snel een individuele deelnemer in en koppel direct aan de gewenste wave en categorie.
          </p>

          <form onSubmit={handleAddParticipant} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Startnummer:</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newBib}
                  onChange={(e) => setNewBib(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-center"
                />
              </div>
              <div className="col-span-2">
                <label className="text-slate-300 font-semibold block mb-1">Club / Woonplaats:</label>
                <input
                  type="text"
                  value={newClub}
                  onChange={(e) => setNewClub(e.target.value)}
                  placeholder="bv. Kids Atletiek De Haan"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Voornaam:</label>
                <input
                  type="text"
                  required
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="bv. Lucas"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Achternaam:</label>
                <input
                  type="text"
                  required
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  placeholder="bv. Peeters"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Categorie:</label>
                <select
                  value={newCatId}
                  onChange={(e) => setNewCatId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Startwave:</label>
                <select
                  value={newWaveId}
                  onChange={(e) => setNewWaveId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="">-- Geen wave (later toewijzen) --</option>
                  {waves.map((w) => (
                    <option key={w.id} value={w.id}>
                      #{w.waveNumber} {w.name} ({w.scheduledStartTime})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {participantAddSuccess && (
                <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Deelnemer toegevoegd!
                </span>
              )}
              <button
                type="submit"
                className="ml-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" /> Deelnemer Opslaan
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Blank Event Modal */}
      {showBlankEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" /> Nieuw Blanco Evenement Starten
              </h3>
            </div>

            <p className="text-slate-300 leading-relaxed">
              Hiermee wist u alle huidige deelnemers, waves en tijden, en creëert u een schoon evenement met 1 standaard parcoursopbouw.
            </p>

            <form onSubmit={handleFactoryResetBlank} className="space-y-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Wedstrijdnaam:</label>
                <input
                  type="text"
                  required
                  value={blankName}
                  onChange={(e) => setBlankName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Datum:</label>
                  <input
                    type="date"
                    required
                    value={blankDate}
                    onChange={(e) => setBlankDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Locatie:</label>
                  <input
                    type="text"
                    required
                    value={blankLocation}
                    onChange={(e) => setBlankLocation(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBlankEventModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold uppercase tracking-wider"
                >
                  Start Schoon Evenement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
