import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Lock,
  Unlock,
  Volume2,
  Laptop,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { RaceEvent, DeviceConfig } from '../../types';
import { db } from '../../db/dexieDb';
import { operationService } from '../../services/operationService';
import { soundService } from '../../services/soundService';

interface SettingsViewProps {
  event: RaceEvent | null;
  deviceConfig: DeviceConfig | null;
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  event,
  deviceConfig,
  onRefresh,
}) => {
  const [penaltySeconds, setPenaltySeconds] = useState(event?.penaltySecondsPerMiss || 20);
  const [deviceId, setDeviceId] = useState(deviceConfig?.id || 'FINISH-01');
  const [operatorName, setOperatorName] = useState('Jan Peeters');
  const [stationName, setStationName] = useState(deviceConfig?.stationName || 'Finish Hoofdpost');
  const [isTestMode, setIsTestMode] = useState(event?.isTestMode ?? true);
  const [isLocked, setIsLocked] = useState(event?.officialResultsLocked ?? false);
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;

    await db.events.update(event.id, {
      penaltySecondsPerMiss: penaltySeconds,
      isTestMode,
      officialResultsLocked: isLocked,
      officialResultsVersion: isLocked ? 'Definitief 1.0' : 'Voorlopig',
      updatedAt: new Date().toISOString(),
    });

    await db.devices.put({
      id: deviceId.trim() || 'FINISH-01',
      name: `Tablet ${deviceId}`,
      role: 'FINISH_OPERATOR',
      stationName,
      isLocked: false,
      clockOffsetMs: 0,
    });

    operationService.setDeviceAndOperator(deviceId, operatorName);

    await operationService.logAudit(
      'SETTINGS_UPDATED',
      `Instellingen bijgewerkt: ${penaltySeconds}s straftijd, Testmodus: ${isTestMode}, Resultaten vergrendeld: ${isLocked}`
    );

    soundService.playSuccess();
    setSavedMessage(true);
    onRefresh();
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const toggleOfficialLock = async () => {
    if (!event) return;
    const nextLocked = !isLocked;
    const promptMsg = nextLocked
      ? 'Wilt u de officiële resultaten vergrendelen en publiceren? Wijzigingen vereisen daarna beheerderstoestemming.'
      : 'Wilt u de officiële resultaten ontgrendelen voor correcties?';

    if (!confirm(promptMsg)) return;

    setIsLocked(nextLocked);
    await db.events.update(event.id, {
      officialResultsLocked: nextLocked,
      officialResultsVersion: nextLocked ? 'Officieel Vastgelegd v1.0' : 'Voorlopig (in bewerking)',
      updatedAt: new Date().toISOString(),
    });

    await operationService.logAudit(
      nextLocked ? 'RESULTS_LOCKED' : 'RESULTS_UNLOCKED',
      `Officiële resultaten ${nextLocked ? 'VERGRENDELD' : 'ONTGRENDELD'}`
    );

    soundService.playSuccess();
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
            <Settings className="w-4 h-4" /> Systeemconfiguratie
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
            Instellingen & Parameters
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Wedstrijdregels, straftijden, apparaatidentiteit en officiële vergrendeling
          </p>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rules & Biathlon Calculation */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Wedstrijdreglement & Straftijden
            </h3>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Straftijd per gemiste schijf (seconden):
              </label>
              <input
                type="number"
                value={penaltySeconds}
                onChange={(e) => setPenaltySeconds(parseInt(e.target.value, 10))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-base font-mono font-bold text-white"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                Standaard biathlon tijdstraf: 20 seconden per misser
              </span>
            </div>

            <div className="pt-3 border-t border-slate-800">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTestMode}
                  onChange={(e) => setIsTestMode(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500"
                />
                <div>
                  <span className="font-bold text-white block">Test Modus Actief</span>
                  <span className="text-[11px] text-slate-400">
                    Toont testbanner en laat alle demodata en simulaties toe
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Device & Operator Identity (Req 31) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Laptop className="w-4 h-4 text-blue-400" /> Toestel- & Operator Identiteit
            </h3>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Apparaat Identificatie (Device ID):
              </label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="bv. FINISH-01"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Huidige Operator Naam:
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                placeholder="bv. Jan Peeters"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              />
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">Station Locatie:</label>
              <input
                type="text"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="bv. Finish Straat Hoofdpost"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Results Freezing & Locking (Req 48, 59) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {isLocked ? (
                <Lock className="w-5 h-5 text-red-400" />
              ) : (
                <Unlock className="w-5 h-5 text-emerald-400" />
              )}
              <h3 className="text-sm font-bold text-white">
                Officiële Resultatenstatus:{' '}
                <span className={isLocked ? 'text-red-400' : 'text-emerald-400'}>
                  {isLocked ? 'VERGRENDELD' : 'VOORLOPIG'}
                </span>
              </h3>
            </div>
            <p className="text-slate-400">
              Wanneer vergrendeld, zijn de uitslagen definitief en worden ze gemarkeerd als goedgekeurd door de jury.
            </p>
          </div>

          <button
            type="button"
            onClick={toggleOfficialLock}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
              isLocked
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isLocked ? 'Ontgrendelen voor Wijziging' : 'Vergrendel als Officieel'}
          </button>
        </div>

        <div className="flex justify-end items-center gap-4">
          {savedMessage && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Instellingen opgeslagen!
            </span>
          )}
          <button
            type="submit"
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition uppercase tracking-wider"
          >
            Instellingen Opslaan
          </button>
        </div>
      </form>
    </div>
  );
};
