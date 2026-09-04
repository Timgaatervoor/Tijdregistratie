import React, { useState } from 'react';
import {
  Trophy,
  Search,
  Filter,
  Medal,
  Tv,
  Lock,
  Download,
  Share2,
  Crosshair,
  Flag,
} from 'lucide-react';
import type { RaceResult, Category, Wave, RaceEvent } from '../../types';
import { downloadCsvFile } from '../../services/backupService';

interface LiveLeaderboardViewProps {
  results: RaceResult[];
  categories: Category[];
  waves: Wave[];
  event: RaceEvent | null;
  mode?: 'live' | 'results';
  onSelectParticipant: (result: RaceResult) => void;
}

export const LiveLeaderboardView: React.FC<LiveLeaderboardViewProps> = ({
  results,
  categories,
  waves,
  event,
  mode = 'live',
  onSelectParticipant,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedWave, setSelectedWave] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'STARTED' | 'FINISHED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isKioskMode, setIsKioskMode] = useState<boolean>(false);

  // Filter logic
  const filteredResults = results.filter((r) => {
    if (selectedCategory !== 'ALL' && r.categoryId !== selectedCategory) return false;
    if (selectedWave !== 'ALL' && r.waveId !== selectedWave) return false;
    if (selectedGender !== 'ALL' && r.gender !== selectedGender) return false;
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.name.toLowerCase().includes(q);
      const matchBib = String(r.bibNumber || '').includes(q);
      const matchClub = (r.club || '').toLowerCase().includes(q);
      if (!matchName && !matchBib && !matchClub) return false;
    }
    return true;
  });

  // Top 3 Podium finishers for the current filter
  const finishedPodium = filteredResults
    .filter((r) => r.status === 'FINISHED' && r.rankCategory)
    .slice(0, 3);

  const handleExportCsv = () => {
    const headers =
      'Plaats,Startnummer,Naam,Club,Geslacht,Categorie,Wave,Starttijd,Finishtijd,Looptijd (Raw),Missers,Straftijd,Officiële Tijd,Verschil,Status\n';
    const rows = filteredResults.map((r) => {
      return `${r.rankCategory || r.rankOverall || ''},${r.bibNumber || ''},"${r.name}","${
        r.club || ''
      }",${r.gender || ''},"${r.categoryName || ''}","${r.waveName || ''}",${r.startTime || ''},${
        r.finishTime || ''
      },${r.rawElapsedFormatted || ''},${r.totalMisses || 0},${r.penaltyFormatted || ''},${
        r.officialTimeFormatted || ''
      },${r.gapFormatted || ''},${r.status}`;
    });

    const csv = headers + rows.join('\n');
    downloadCsvFile(csv, `uitslagen_${Date.now()}.csv`);
  };

  return (
    <div className={`space-y-6 ${isKioskMode ? 'p-6 bg-slate-950 min-h-screen' : ''}`}>
      {/* Top Banner & TV Kiosk Mode Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
              {mode === 'results' ? 'Officiële Wedstrijduitslagen' : 'Live Wedstrijdbord (Realtime)'}
            </span>
            {event?.officialResultsLocked ? (
              <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                <Lock className="w-3 h-3" /> Officieel Vastgelegd
              </span>
            ) : (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase">
                {mode === 'results' ? 'Voorlopige Uitslag' : 'Live Tussentijden'}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {event?.name || 'Run Biathlon De Haan 2026'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {mode === 'results'
              ? `Eindklassementen inclusief schietstraftijden (+${event?.penaltySecondsPerMiss || 20}s per misser) en categorie-podia`
              : `Realtime updates tijdens de race: actieve lopers op parcours, live schietbeurten en virtuele tussenstanden`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <Download className="w-4 h-4" /> CSV Export
          </button>
          <button
            onClick={() => setIsKioskMode(!isKioskMode)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              isKioskMode
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-200 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>{isKioskMode ? 'Kiosk Mode Sluiten' : 'TV Kiosk Modus'}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek op naam, startnummer of club..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
        >
          <option value="ALL">Alle Categorieën ({categories.length})</option>
          {categories.map((c) => (
            <option key={`lb-cat-${c.id}`} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Wave Filter */}
        <select
          value={selectedWave}
          onChange={(e) => setSelectedWave(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
        >
          <option value="ALL">Alle Waves ({waves.length})</option>
          {waves.map((w) => (
            <option key={`lb-wave-${w.id}`} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        {/* Gender Filter */}
        <select
          value={selectedGender}
          onChange={(e) => setSelectedGender(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
        >
          <option value="ALL">Geslacht (Alle)</option>
          <option value="M">Heren</option>
          <option value="F">Dames</option>
        </select>
      </div>

      {/* Podium Cards if finishes exist */}
      {finishedPodium.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Silver #2 */}
          {finishedPodium[1] && (
            <div
              onClick={() => onSelectParticipant(finishedPodium[1])}
              className="bg-slate-900 border border-slate-750 hover:border-slate-600 rounded-2xl p-5 shadow cursor-pointer transition flex flex-col justify-between order-2 sm:order-1 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-9 h-9 rounded-xl bg-slate-300 text-slate-950 font-black text-base flex items-center justify-center shadow">
                  #2
                </span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  ZILVER
                </span>
              </div>
              <div>
                <span className="text-lg font-bold text-white block">
                  {finishedPodium[1].name}
                </span>
                <span className="text-xs text-slate-400">
                  Bib #{finishedPodium[1].bibNumber} • {finishedPodium[1].categoryName}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {finishedPodium[1].totalMisses} missers ({finishedPodium[1].penaltyFormatted})
                </span>
                <span className="font-mono font-black text-slate-200 text-base">
                  {finishedPodium[1].officialTimeFormatted}
                </span>
              </div>
            </div>
          )}

          {/* Gold #1 */}
          {finishedPodium[0] && (
            <div
              onClick={() => onSelectParticipant(finishedPodium[0])}
              className="bg-gradient-to-b from-amber-950/40 to-slate-900 border-2 border-amber-500/60 rounded-2xl p-6 shadow-2xl cursor-pointer transition flex flex-col justify-between order-1 sm:order-2 scale-105 z-10 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-11 h-11 rounded-xl bg-amber-400 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shadow-amber-400/30">
                  #1
                </span>
                <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-1">
                  <Medal className="w-4 h-4" /> GOUD
                </span>
              </div>
              <div>
                <span className="text-xl font-black text-white block">
                  {finishedPodium[0].name}
                </span>
                <span className="text-xs text-slate-300">
                  Bib #{finishedPodium[0].bibNumber} • {finishedPodium[0].categoryName}
                </span>
                {finishedPodium[0].club && (
                  <span className="text-[11px] text-slate-400 block italic">
                    {finishedPodium[0].club}
                  </span>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  {finishedPodium[0].totalMisses} missers ({finishedPodium[0].penaltyFormatted})
                </span>
                <span className="font-mono font-black text-amber-400 text-xl">
                  {finishedPodium[0].officialTimeFormatted}
                </span>
              </div>
            </div>
          )}

          {/* Bronze #3 */}
          {finishedPodium[2] && (
            <div
              onClick={() => onSelectParticipant(finishedPodium[2])}
              className="bg-slate-900 border border-slate-750 hover:border-slate-600 rounded-2xl p-5 shadow cursor-pointer transition flex flex-col justify-between order-3 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="w-9 h-9 rounded-xl bg-amber-700 text-slate-100 font-black text-base flex items-center justify-center shadow">
                  #3
                </span>
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
                  BRONS
                </span>
              </div>
              <div>
                <span className="text-lg font-bold text-white block">
                  {finishedPodium[2].name}
                </span>
                <span className="text-xs text-slate-400">
                  Bib #{finishedPodium[2].bibNumber} • {finishedPodium[2].categoryName}
                </span>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {finishedPodium[2].totalMisses} missers ({finishedPodium[2].penaltyFormatted})
                </span>
                <span className="font-mono font-black text-slate-200 text-base">
                  {finishedPodium[2].officialTimeFormatted}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Results Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-850 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <th className="py-3.5 px-4 w-14 text-center">Pl.</th>
                <th className="py-3.5 px-3 w-16 text-center">Bib</th>
                <th className="py-3.5 px-4">Deelnemer</th>
                <th className="py-3.5 px-4">Categorie</th>
                <th className="py-3.5 px-4">Wave</th>
                <th className="py-3.5 px-4 text-center">Schieten (H/M)</th>
                <th className="py-3.5 px-4 text-right">Looptijd (Raw)</th>
                <th className="py-3.5 px-4 text-right">Straf</th>
                <th className="py-3.5 px-4 text-right font-bold text-white">Officiële Tijd</th>
                <th className="py-3.5 px-4 text-right">Verschil</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 italic">
                    Geen deelnemers gevonden die aan de filters voldoen.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r) => {
                  const isFinished = r.status === 'FINISHED';

                  return (
                    <tr
                      key={`lb-row-${r.participantId}`}
                      onClick={() => onSelectParticipant(r)}
                      className="hover:bg-slate-850/80 cursor-pointer transition"
                    >
                      {/* Rank */}
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {r.rankCategory ? (
                          <span
                            className={`inline-block w-6 h-6 rounded text-xs leading-6 ${
                              r.rankCategory === 1
                                ? 'bg-amber-400 text-slate-950 font-black'
                                : r.rankCategory === 2
                                ? 'bg-slate-300 text-slate-950 font-black'
                                : r.rankCategory === 3
                                ? 'bg-amber-700 text-white font-black'
                                : 'text-slate-400'
                            }`}
                          >
                            {r.rankCategory}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Bib */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                        #{r.bibNumber || '-'}
                      </td>

                      {/* Name + Club */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-white block">{r.name}</span>
                        {r.club && <span className="text-[11px] text-slate-400">{r.club}</span>}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {r.categoryName || '-'}
                      </td>

                      {/* Wave */}
                      <td className="py-3 px-4 text-slate-400">{r.waveName || '-'}</td>

                      {/* Shooting Splits */}
                      <td className="py-3 px-4 text-center">
                        {r.shootingRounds.length === 0 ? (
                          <span className="text-slate-600">-</span>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
                            {r.shootingRounds.map((sr, sIdx) => (
                              <span
                                key={sr.id ? `sr-pill-${sr.id}` : `sr-pill-${r.participantId}-${sr.round}-${sIdx}`}
                                className={`px-1.5 py-0.5 rounded ${
                                  sr.misses === 0
                                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                                    : 'bg-red-950/60 text-red-300 border border-red-800'
                                }`}
                              >
                                {sr.hits}/{sr.shots ?? 5}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Raw Elapsed */}
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {r.rawElapsedFormatted || '-'}
                      </td>

                      {/* Penalty */}
                      <td className="py-3 px-4 text-right font-mono text-amber-400 font-semibold">
                        {r.totalMisses > 0 ? r.penaltyFormatted : '-'}
                      </td>

                      {/* Official Time */}
                      <td className="py-3 px-4 text-right font-mono font-black text-sm text-emerald-400">
                        {isFinished ? r.officialTimeFormatted : '-'}
                      </td>

                      {/* Gap */}
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {r.gapFormatted || '-'}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            r.status === 'FINISHED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : r.status === 'STARTED'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : r.status === 'DNF' || r.status === 'DNS' || r.status === 'DSQ'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
