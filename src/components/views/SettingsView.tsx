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
  Layers,
  Database,
  Cloud,
} from 'lucide-react';
import type { RaceEvent, DeviceConfig, RaceProfile, Category, Wave, Participant } from '../../types';
import { db } from '../../db/dexieDb';
import { operationService } from '../../services/operationService';
import { soundService } from '../../services/soundService';
import { syncService, type SyncConfig } from '../../services/syncService';
import { RaceProfileEditor } from './RaceProfileEditor';
import { EventSetupAndReset } from './EventSetupAndReset';

interface SettingsViewProps {
  event: RaceEvent | null;
  deviceConfig: DeviceConfig | null;
  profiles?: RaceProfile[];
  categories?: Category[];
  waves?: Wave[];
  participants?: Participant[];
  onRefresh: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  event,
  deviceConfig,
  profiles = [],
  categories = [],
  waves = [],
  participants = [],
  onRefresh,
}) => {
  const [activeSection, setActiveSection] = useState<'general' | 'profiles' | 'event_setup' | 'sync'>('general');

  // Race Event Settings
  const [eventName, setEventName] = useState(event?.name || 'Run-Biathlon De Haan 2026');
  const [eventDate, setEventDate] = useState(event?.date || '2026-09-06');
  const [eventLocation, setEventLocation] = useState(event?.location || 'De Haan');
  const [organizer, setOrganizer] = useState(event?.organizer || 'Kids Atletiek De Haan');
  const [penaltySeconds, setPenaltySeconds] = useState(event?.penaltySecondsPerMiss || 20);
  const [requireStartConfirmation, setRequireStartConfirmation] = useState(event?.requireStartConfirmation ?? true);
  const [requireFinishConfirmation, setRequireFinishConfirmation] = useState(event?.requireFinishConfirmation ?? true);
  const [isPublicResultsLive, setIsPublicResultsLive] = useState(event?.isPublicResultsLive ?? true);
  const [isTestMode, setIsTestMode] = useState(event?.isTestMode ?? true);
  const [isLocked, setIsLocked] = useState(event?.officialResultsLocked ?? false);

  // Device & Operator Settings
  const [deviceId, setDeviceId] = useState(deviceConfig?.id || 'FINISH-01');
  const [operatorName, setOperatorName] = useState(deviceConfig?.operatorName || 'Jan Peeters');
  const [stationName, setStationName] = useState(deviceConfig?.stationName || 'Finish Hoofdpost');
  const [savedMessage, setSavedMessage] = useState(false);

  // Synchronize on initial mount without overwriting during active typing
  const initialLoadRef = React.useRef(false);
  React.useEffect(() => {
    if (!initialLoadRef.current && event) {
      setEventName(event.name);
      setEventDate(event.date);
      setEventLocation(event.location);
      setOrganizer(event.organizer);
      setPenaltySeconds(event.penaltySecondsPerMiss || 20);
      setRequireStartConfirmation(event.requireStartConfirmation ?? true);
      setRequireFinishConfirmation(event.requireFinishConfirmation ?? true);
      setIsPublicResultsLive(event.isPublicResultsLive ?? true);
      setIsTestMode(event.isTestMode ?? true);
      setIsLocked(event.officialResultsLocked ?? false);
      initialLoadRef.current = true;
    }
  }, [event]);

  React.useEffect(() => {
    if (deviceConfig) {
      setDeviceId(deviceConfig.id);
      setOperatorName(deviceConfig.operatorName || 'Jan Peeters');
      setStationName(deviceConfig.stationName);
    }
  }, [deviceConfig]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentEvent = (await db.events.toCollection().first()) || event;
    const eventId = currentEvent?.id || event?.id || 'event-de-haan-2026';

    const updatedEvent: RaceEvent = {
      id: eventId,
      name: eventName.trim() || 'Run-Biathlon De Haan',
      date: eventDate,
      location: eventLocation.trim() || 'De Haan',
      organizer: organizer.trim() || 'Kids Atletiek De Haan',
      status: currentEvent?.status || 'READY',
      timezone: 'Europe/Brussels',
      penaltySecondsPerMiss: penaltySeconds,
      requireStartConfirmation,
      requireFinishConfirmation,
      isPublicResultsLive,
      isTestMode,
      officialResultsLocked: isLocked,
      officialResultsVersion: isLocked ? 'Definitief 1.0' : 'Voorlopig',
      createdAt: currentEvent?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.events.put(updatedEvent);

    const activeDeviceId = deviceId.trim() || 'FINISH-01';
    await db.devices.clear();
    await db.devices.put({
      id: activeDeviceId,
      name: `Tablet ${activeDeviceId}`,
      role: 'FINISH_OPERATOR',
      operatorName: operatorName.trim() || 'Operator',
      stationName,
      isLocked: false,
      clockOffsetMs: 0,
    });

    operationService.setDeviceAndOperator(activeDeviceId, operatorName.trim() || 'Operator');

    await operationService.logAudit(
      'SETTINGS_UPDATED',
      `Wedstrijdinstellingen bijgewerkt: "${eventName}", ${penaltySeconds}s straftijd, Datum: ${eventDate}, Testmodus: ${isTestMode}`
    );

    document.title = `${eventName.trim()} - Tijdregistratie Biathlon`;
    soundService.playSuccess();
    setSavedMessage(true);
    await onRefresh();
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
            Wedstrijdregels, parcoursopbouw (loop/schieten), apparaatidentiteit en officiële vergrendeling
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveSection('general')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === 'general'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Algemeen & Tijd</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('profiles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === 'profiles'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Wedstrijd Inhoud (Loop / Schiet)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('event_setup')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === 'event_setup'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Evenement Opzet & Reset (Waves & Lopers)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('sync')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeSection === 'sync'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>Online Synchronisatie</span>
          </button>
        </div>
      </div>

      {activeSection === 'profiles' ? (
        <RaceProfileEditor
          profiles={profiles}
          categories={categories}
          onRefresh={onRefresh}
        />
      ) : activeSection === 'event_setup' ? (
        <EventSetupAndReset
          event={event}
          waves={waves}
          participants={participants}
          categories={categories}
          onRefresh={onRefresh}
        />
      ) : activeSection === 'sync' ? (
        <SyncSettings eventId={event?.id || ''} />
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Race Event General Config */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" /> Wedstrijd Algemeen
            </h3>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Wedstrijdnaam:
              </label>
              <input
                type="text"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="bv. Run-Biathlon De Haan 2026"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Wedstrijddatum:
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Locatie:
                </label>
                <input
                  type="text"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="bv. Sportdomein Haneveld, De Haan"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Organiserende Club / Instantie:
              </label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="bv. Kids Atletiek De Haan"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Rules & Biathlon Calculation */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4 text-xs">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" /> Wedstrijdreglement & Tijdregistratie
            </h3>

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Straftijd per gemiste schijf (seconden):
              </label>
              <input
                type="number"
                min="0"
                value={penaltySeconds}
                onChange={(e) => setPenaltySeconds(parseInt(e.target.value, 10) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-base font-mono font-bold text-amber-400"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                Standaard biathlon tijdstraf: 20 seconden per misser
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPublicResultsLive}
                  onChange={(e) => setIsPublicResultsLive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500"
                />
                <div>
                  <span className="font-bold text-white block">Publieke Live Uitslagen Actief</span>
                  <span className="text-[11px] text-slate-400">
                    Toont resultaten op het live leaderboard en publieke schermen
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireFinishConfirmation}
                  onChange={(e) => setRequireFinishConfirmation(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500"
                />
                <div>
                  <span className="font-bold text-white block">Bevestiging bij Finish</span>
                  <span className="text-[11px] text-slate-400">
                    Voorkomt per ongeluk direct toewijzen van finish pulsen
                  </span>
                </div>
              </label>

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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-4 text-xs md:col-span-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Laptop className="w-4 h-4 text-blue-400" /> Toestel- & Operator Identiteit
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      )}
    </div>
  );
};

interface SyncSettingsProps {
  eventId: string;
}

const SyncSettings: React.FC<SyncSettingsProps> = ({ eventId }) => {
  const [config, setConfig] = useState<SyncConfig>(() => ({
    ...syncService.getConfig(),
    eventId: syncService.getConfig().eventId || eventId,
  }));
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const update = (changes: Partial<SyncConfig>) => {
    setConfig((current) => ({ ...current, ...changes }));
    setMessage(null);
  };

  const save = () => {
    syncService.saveConfig(config);
    setMessage('Supabase-instellingen opgeslagen op dit toestel.');
  };

  const test = async () => {
    setTesting(true);
    setMessage(null);
    const result = await syncService.testConnection(config);
    setTesting(false);
    setMessage(result.ok ? 'Verbinding met Supabase werkt.' : result.error || 'Verbinding mislukt.');
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-950/30 border border-blue-700/40 rounded-2xl p-6 text-xs text-slate-200 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-400" /> Synchronisatie instellen in 5 stappen
          </h3>
          <p className="text-slate-400 mt-1">
            Supabase is de gratis online database. De app bewaart elke actie eerst lokaal en synchroniseert daarna de wachtrij.
          </p>
        </div>

        <ol className="list-decimal list-inside space-y-2 text-slate-300">
          <li>Maak een gratis project aan op <strong className="text-white">supabase.com</strong>.</li>
          <li>Open in Supabase <strong className="text-white">SQL Editor</strong>, maak een nieuwe query en voer de SQL hieronder uit.</li>
          <li>Open <strong className="text-white">Project Settings &gt; API</strong> en kopieer de Project URL en de <strong className="text-white">Publishable key</strong> (of legacy anon public key).</li>
          <li>Vul die gegevens hieronder in, gebruik als Event-ID bijvoorbeeld <code className="text-amber-300">event-de-haan-2026</code>, en klik op <strong className="text-white">Verbinding testen</strong>.</li>
          <li>Krijg je “Verbinding met Supabase werkt”, klik dan op <strong className="text-white">Instellingen opslaan</strong>.</li>
        </ol>

        <details className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
          <summary className="cursor-pointer text-amber-300 font-bold">SQL voor de tabel race_operations tonen</summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">{`create table public.race_operations (
  operation_id text primary key,
  event_id text not null,
  participant_id text,
  type text not null,
  device_id text not null,
  operator_id text not null,
  device_timestamp timestamptz not null,
  server_timestamp timestamptz,
  payload jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.race_operations enable row level security;

create policy "race operations insert"
on public.race_operations for insert to anon
with check (true);

create policy "race operations read"
on public.race_operations for select to anon
using (true);`}</pre>
          <p className="mt-3 text-amber-200">
            Gebruik voor de app alleen de publieke <strong>publishable/anon key</strong>. Zet nooit de <strong>secret/service_role key</strong> in dit formulier of in GitHub.
          </p>
        </details>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow space-y-5 text-xs">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-400" /> Gratis online synchronisatie
          </h3>
          <p className="text-slate-400 mt-2 leading-relaxed">
            Gebruik een Supabase-project als centrale database. De app blijft eerst lokaal opslaan en stuurt alleen de lokale race-operaties door zodra internet beschikbaar is.
          </p>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(event) => update({ enabled: event.target.checked })}
            className="w-4 h-4 rounded text-amber-500"
          />
          <span className="font-bold text-white">Online synchronisatie inschakelen</span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-slate-300 font-semibold block mb-1">Supabase Project URL</label>
            <input
              type="url"
              value={config.projectUrl}
              onChange={(event) => update({ projectUrl: event.target.value })}
              placeholder="https://jouw-project.supabase.co"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-slate-300 font-semibold block mb-1">Supabase anon public key</label>
            <input
              type="password"
              value={config.anonKey}
              onChange={(event) => update({ anonKey: event.target.value })}
              placeholder="eyJ..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono"
            />
            <span className="text-[11px] text-slate-500 block mt-1">
              Gebruik alleen de anon/public key, nooit de service_role key.
            </span>
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Event-ID</label>
            <input
              type="text"
              value={config.eventId}
              onChange={(event) => update({ eventId: event.target.value })}
              placeholder={eventId || 'event-de-haan-2026'}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={save}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition"
          >
            Instellingen opslaan
          </button>
          <button
            type="button"
            onClick={test}
            disabled={testing}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold border border-slate-700 transition disabled:opacity-50"
          >
            {testing ? 'Verbinding testen...' : 'Verbinding testen'}
          </button>
          {message && <span className="text-emerald-400 font-semibold">{message}</span>}
        </div>
      </div>

      <div className="bg-amber-950/30 border border-amber-700/40 rounded-2xl p-5 text-xs text-amber-200">
        <strong>Eenmalige Supabase-inrichting:</strong> maak in Supabase een tabel `race_operations` met de kolommen uit de projectdocumentatie. De anon key mag in deze app staan; beveilig de tabel met Row Level Security.
      </div>
    </div>
  );
};
