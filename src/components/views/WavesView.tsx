import React, { useState } from 'react';
import { Layers, Clock, Users, Plus, Edit2, PlayCircle, AlertCircle } from 'lucide-react';
import type { Wave, Category, Participant } from '../../types';
import { db } from '../../db/dexieDb';
import { generateUUID, operationService } from '../../services/operationService';

interface WavesViewProps {
  waves: Wave[];
  categories: Category[];
  participants: Participant[];
  onRefresh: () => void;
}

export const WavesView: React.FC<WavesViewProps> = ({
  waves,
  categories,
  participants,
  onRefresh,
}) => {
  const [editingWave, setEditingWave] = useState<Wave | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWaveName, setNewWaveName] = useState('');
  const [newStartTime, setNewStartTime] = useState('10:00:00');
  const [newCapacity, setNewCapacity] = useState(25);

  const handleAddWave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaveName.trim()) return;

    const nextWaveNum = waves.length + 1;
    const wave: Wave = {
      id: generateUUID(),
      eventId: 'event-de-haan-2026',
      name: newWaveName.trim(),
      waveNumber: nextWaveNum,
      scheduledStartTime: newStartTime,
      categoryIds: [],
      maxParticipants: newCapacity,
      status: 'SCHEDULED',
    };

    await db.waves.put(wave);
    await operationService.logAudit('WAVE_CREATED', `Wave ${wave.name} aangemaakt`);
    setShowAddModal(false);
    setNewWaveName('');
    onRefresh();
  };

  const handleDelayWave = async (wave: Wave, minutes: number) => {
    const [h, m, s] = wave.scheduledStartTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + minutes, s || 0);
    const updatedTime = date.toTimeString().split(' ')[0];

    await db.waves.update(wave.id, {
      scheduledStartTime: updatedTime,
    });

    await operationService.logAudit(
      'WAVE_DELAYED',
      `Wave ${wave.name} uitgesteld met ${minutes} minuten naar ${updatedTime}`
    );
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
            <Layers className="w-4 h-4" /> Startgroepen
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
            Waves & Startindeling
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {waves.length} waves ingesteld om overbevolking op het loopparcours en schietstand te vermijden
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition"
        >
          <Plus className="w-4 h-4" /> Nieuwe Wave Toevoegen
        </button>
      </div>

      {/* Wave Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {waves.map((w) => {
          const waveParticipants = participants.filter((p) => p.waveId === w.id);
          const finishedCount = waveParticipants.filter((p) => p.status === 'FINISHED').length;
          const startedCount = waveParticipants.filter((p) => p.status === 'STARTED').length;

          return (
            <div
              key={w.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 relative overflow-hidden"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black font-mono flex items-center justify-center text-sm">
                      #{w.waveNumber}
                    </span>
                    <h3 className="text-base font-bold text-white">{w.name}</h3>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                      w.status === 'STARTED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : w.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : w.status === 'DELAYED'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {w.status}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-slate-400 mt-3">
                  <div className="flex items-center justify-between">
                    <span>Gepland startuur:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {w.scheduledStartTime}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Deelnemers:</span>
                    <span className="font-semibold text-slate-200">
                      {waveParticipants.length} / {w.maxParticipants || 25} max
                    </span>
                  </div>
                  {w.actualStartTime && (
                    <div className="flex items-center justify-between">
                      <span>Werkelijke start:</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {new Date(w.actualStartTime).toLocaleTimeString('nl-BE')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-4 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Voortgang</span>
                    <span>
                      {finishedCount} gefinisht, {startedCount} onderweg
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-400 h-full transition-all"
                      style={{
                        width: `${
                          waveParticipants.length > 0
                            ? (finishedCount / waveParticipants.length) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Quick delay buttons if scheduled */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                <span className="text-[11px] text-slate-500">Uitstellen:</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleDelayWave(w, 5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono text-[11px]"
                    title="Stel wave uit met 5 minuten"
                  >
                    +5m
                  </button>
                  <button
                    onClick={() => handleDelayWave(w, 10)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 font-mono text-[11px]"
                    title="Stel wave uit met 10 minuten"
                  >
                    +10m
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Wave Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-xs">
            <h3 className="text-base font-bold text-white">Nieuwe Wave Toevoegen</h3>

            <form onSubmit={handleAddWave} className="space-y-3">
              <div>
                <label className="text-slate-400 block mb-1">Wave Naam:</label>
                <input
                  type="text"
                  required
                  value={newWaveName}
                  onChange={(e) => setNewWaveName(e.target.value)}
                  placeholder={`bv. Wave ${waves.length + 1}`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Gepland Startuur (uu:mm:ss):</label>
                <input
                  type="text"
                  required
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Max Capaciteit (deelnemers):</label>
                <input
                  type="number"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 font-medium"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-amber-500 text-slate-950 font-bold"
                >
                  Wave Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
