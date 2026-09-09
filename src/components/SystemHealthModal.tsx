import React, { useEffect, useState } from 'react';
import {
  Activity,
  Database,
  Wifi,
  WifiOff,
  Clock,
  Volume2,
  VolumeX,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  X,
  Laptop,
  Play,
} from 'lucide-react';
import { db } from '../db/dexieDb';
import { raceClock } from '../services/raceClock';
import { soundService } from '../services/soundService';
import { syncService } from '../services/syncService';
import type { DeviceConfig } from '../types';

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceConfig: DeviceConfig | null;
}

interface HealthData {
  indexedDB: {
    persisted: boolean | null;
    quotaUsedMb: number | null;
    quotaTotalGb: number | null;
    counts: {
      participants: number | null;
      timingRecords: number | null;
      shootingResults: number | null;
      operations: number | null;
    };
    readTestPassed: boolean;
    latencyMs: number | null;
  };
  pwa: {
    serviceWorkerActive: boolean;
    isStandalone: boolean;
    cacheStorageSupported: boolean;
    isOnline: boolean;
  };
  clock: {
    offsetMs: number;
    uncertaintyMs?: number;
    isSynced: boolean;
    status: ReturnType<typeof raceClock.status>;
  };
  audio: {
    isSupported: boolean;
    state: string;
    isMuted: boolean;
  };
  sync: {
    pendingCount: number | null;
    isConfigured: boolean;
    lastSyncAt?: string;
    lastError?: string;
  };
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({
  isOpen,
  onClose,
  deviceConfig,
}) => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [persisting, setPersisting] = useState(false);
  const [soundTesting, setSoundTesting] = useState(false);
  const [syncingClock, setSyncingClock] = useState(false);

  const [message, setMessage] = useState('');

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const startRead = performance.now();
      let readTestPassed = false;
      let latencyMs: number | null = null;

      try {
        // Read-only diagnostic: do not modify race data or claim a write test.
        const count = await db.participants.count();
        if (typeof count === 'number') {
          latencyMs = Math.round(performance.now() - startRead);
          readTestPassed = true;
        }
      } catch {
        readTestPassed = false;
      }

      // Storage estimate
      let quotaUsedMb: number | null = null;
      let quotaTotalGb: number | null = null;
      let persisted: boolean | null = null;

      if (typeof navigator !== 'undefined' && navigator.storage) {
        try {
          if (navigator.storage.persisted) {
            persisted = await navigator.storage.persisted();
          }
          if (navigator.storage.estimate) {
            const est = await navigator.storage.estimate();
            if (est.usage !== undefined) quotaUsedMb = Math.round((est.usage / (1024 * 1024)) * 10) / 10;
            if (est.quota !== undefined) quotaTotalGb = Math.round((est.quota / (1024 * 1024 * 1024)) * 10) / 10;
          }
        } catch {
          // Storage estimate failed or unsupported
        }
      }

      // Counts
      let participantCount: number | null = null;
      let timingCount: number | null = null;
      let shootingCount: number | null = null;
      let opCount: number | null = null;

      try {
        [participantCount, timingCount, shootingCount, opCount] = await Promise.all([
          db.participants.count(),
          db.timingRecords.count(),
          db.shootingResults.count(),
          db.operations.count(),
        ]);
      } catch {
        // counts fallback
      }

      // PWA & Service Worker
      const serviceWorkerActive =
        typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
      const isStandalone =
        typeof window !== 'undefined' &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true);
      const cacheStorageSupported = typeof window !== 'undefined' && 'caches' in window;
      const isOnline = !syncService.getIsSimulatedOffline() && navigator.onLine;

      // Clock
      const clockStatus = raceClock.status();

      // Audio
      const isAudioSupported = soundService.isAudioSupported();
      const audioState = soundService.getAudioState();
      const isMuted = !soundService.getSoundEnabled();

      // Sync
      let pendingCount: number | null = null;
      try {
        pendingCount = await db.operations.where('syncStatus').equals('LOCAL_ONLY').filter(op => op.eventId === syncService.getConfig().eventId).count();
      } catch {
        pendingCount = null;
      }
      const syncHealth = syncService.getSyncHealth();
      const isConfigured = syncService.getConfig().enabled;

      setHealth({
        indexedDB: {
          persisted,
          quotaUsedMb,
          quotaTotalGb,
          counts: {
            participants: participantCount,
            timingRecords: timingCount,
            shootingResults: shootingCount,
            operations: opCount,
          },
          readTestPassed,
          latencyMs,
        },
        pwa: {
          serviceWorkerActive,
          isStandalone,
          cacheStorageSupported,
          isOnline,
        },
        clock: {
          offsetMs: clockStatus.offsetMs,
          uncertaintyMs: clockStatus.uncertaintyMs,
          isSynced: clockStatus.state === 'SYNCED' && !clockStatus.error,
          status: clockStatus,
        },
        audio: {
          isSupported: isAudioSupported,
          state: audioState,
          isMuted,
        },
        sync: {
          pendingCount,
          isConfigured,
          lastSyncAt: syncHealth.lastSyncAt,
          lastError: syncHealth.lastError,
        },
      });
    } catch (error) {
      setHealth(null);
      setMessage(`Systeemcontrole mislukt: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      void runHealthCheck();
    }
    if (!isOpen) return;
    const timer = window.setInterval(() => {
      const status = raceClock.status();
      setHealth(current => current && ({ ...current, clock: {
        status, offsetMs: status.offsetMs, uncertaintyMs: status.uncertaintyMs,
        isSynced: status.state === 'SYNCED' && !status.error,
      } }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  const handleRequestPersistentStorage = async () => {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      setPersisting(true);
      try {
        const granted = await navigator.storage.persist();
        setMessage(granted ? 'Opslagbehoud toegestaan. Handmatig wissen blijft mogelijk.' : 'De browser heeft opslagbehoud niet toegestaan.');
        if (granted) {
          soundService.playSuccess();
        } else {
          soundService.playWarning();
        }
        await runHealthCheck();
      } catch {
        setMessage('Opslagbehoud aanvragen is mislukt.');
        soundService.playError();
      } finally {
        setPersisting(false);
      }
    }
  };

  const handleTestAudioSignal = async () => {
    setSoundTesting(true);
    try {
      await soundService.testSound();
      setMessage('Testsignaal afgespeeld. Controleer of je het hebt gehoord.');
      await runHealthCheck();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setTimeout(() => setSoundTesting(false), 1000);
    }
  };

  const handleSyncClockNow = async () => {
    setSyncingClock(true);
    try {
      const config = syncService.getConfig();
      if (syncService.getIsSimulatedOffline() || !navigator.onLine) {
        throw new Error('Geen klokmeting uitgevoerd: het toestel staat offline.');
      }
      if (config.enabled) {
        if (!config.projectUrl || !config.anonKey) throw new Error('Kloksynchronisatie is niet volledig ingesteld.');
        await syncService.checkClockOffset();
      } else {
        await raceClock.syncWithNetwork();
      }
      const status = raceClock.status();
      if (status.state !== 'SYNCED' || status.error) {
        throw new Error(status.error || 'Geen geldige netwerkklokmeting ontvangen.');
      }
      setMessage('Netwerkkloksynchronisatie geslaagd.');
      soundService.playSuccess();
    } catch (error) {
      setMessage(`Kloksynchronisatie niet geslaagd: ${error instanceof Error ? error.message : String(error)}`);
      soundService.playError();
    } finally {
      await runHealthCheck();
      setSyncingClock(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div role="dialog" aria-modal="true" aria-labelledby="system-health-title" className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2 id="system-health-title" className="text-lg font-bold text-white flex items-center gap-2">
                Systeemdiagnose & Gezondheid
              </h2>
              <p className="text-xs text-slate-400">
                Hardware- en opslagcontroles voor offline betrouwbaarheid en tijdregistratie
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Systeemstatus sluiten"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && <p role="status" className="text-sm text-amber-300">{message}</p>}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
            <p className="text-xs">Systeemspecificaties en datastores controleren...</p>
          </div>
        ) : health ? (
          <div className="space-y-4">
            {/* 1. IndexedDB & Lokale Opslag */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span>IndexedDB & Lokale Datastore</span>
                </div>
                {health.indexedDB.readTestPassed ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Leesbaar ({health.indexedDB.latencyMs}ms)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                    <XCircle className="w-3.5 h-3.5" /> Lezen mislukt
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Deelnemers</span>
                  <span className="text-base font-bold text-white font-mono">
                    {health.indexedDB.counts.participants ?? 'Onbekend'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Tijdrecords</span>
                  <span className="text-base font-bold text-white font-mono">
                    {health.indexedDB.counts.timingRecords ?? 'Onbekend'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Schietbeurten</span>
                  <span className="text-base font-bold text-white font-mono">
                    {health.indexedDB.counts.shootingResults ?? 'Onbekend'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Ops-Journal</span>
                  <span className="text-base font-bold text-white font-mono">
                    {health.indexedDB.counts.operations ?? 'Onbekend'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/60 text-xs">
                <div className="text-slate-400">
                  <span>Gebruik: </span>
                  <span className="text-white font-mono font-medium">
                    {health.indexedDB.quotaUsedMb !== null ? `${health.indexedDB.quotaUsedMb} MB` : 'Onbekend'}
                  </span>
                  {health.indexedDB.quotaTotalGb !== null && (
                    <span className="text-slate-500"> / {health.indexedDB.quotaTotalGb} GB opslaglimiet</span>
                  )}
                  <span className="mx-2">•</span>
                  <span>Persistentie: </span>
                  <span className={`font-semibold ${health.indexedDB.persisted ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {health.indexedDB.persisted ? 'Opslagbehoud toegestaan' : health.indexedDB.persisted === null ? 'Onbekend / niet ondersteund' : 'Niet toegestaan'}
                  </span>
                </div>
                {!health.indexedDB.persisted && (
                  <button
                    type="button"
                    disabled={persisting || !navigator.storage?.persist}
                    onClick={handleRequestPersistentStorage}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition shadow"
                  >
                    {persisting ? 'Aanvragen...' : 'Opslagbehoud aanvragen'}
                  </button>
                )}
              </div>
            </div>

            {/* 2. PWA & Offline Status */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>PWA & Offline Gereedheid</span>
                </div>
                {health.pwa.serviceWorkerActive ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Serviceworker actief
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5" /> Geen actieve Service Worker
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Netwerkstatus</span>
                  <span className="font-bold flex items-center gap-1 text-emerald-400">
                    {health.pwa.isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
                    {health.pwa.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Installatiemodus</span>
                  <span className="font-bold text-slate-200">
                    {health.pwa.isStandalone ? 'Geïnstalleerd (App)' : 'Browser Tab'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Cache API</span>
                  <span className="font-bold text-emerald-400">
                    {health.pwa.cacheStorageSupported ? 'Ondersteund' : 'Nee'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Wedstrijdklok & Synchronisatie */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Wedstrijdklok & Tijdssynchronisatie</span>
                </div>
                <button
                  type="button"
                  disabled={syncingClock}
                  onClick={handleSyncClockNow}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-medium transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingClock ? 'animate-spin text-amber-400' : ''}`} />
                  <span>Klok nu synchroniseren</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Klok Offset</span>
                  <span className="text-base font-bold text-white font-mono">
                    {Math.round(health.clock.offsetMs)} ms
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Onzekerheidsmarge</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {health.clock.uncertaintyMs === undefined ? 'Onbekend' : `±${Math.ceil(health.clock.uncertaintyMs)} ms`}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">Sync Status</span>
                  <span className={`text-xs font-bold block mt-1 ${health.clock.isSynced ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {health.clock.isSynced ? 'Netwerkmeting geslaagd' : health.clock.status.error ? 'Netwerkmeting mislukt' : health.clock.status.state === 'STALE' ? 'Meting verouderd' : 'Lokale tijd (geen netwerkmeting)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <p>Klokbron: {health.clock.status.source || 'Lokale toestelklok'}</p>
              {health.clock.status.syncedAt && <p>Laatste geldige klokmeting: {new Date(health.clock.status.syncedAt).toLocaleString('nl-BE')}. De klok loopt daarna lokaal door.</p>}
              {health.clock.status.error && <p className="text-amber-300">{health.clock.status.error}</p>}
            </div>

            {/* 4. Audio & Signaalfeedback */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  {health.audio.isMuted ? (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-amber-400" />
                  )}
                  <span>Web Audio Context (Akoestische Feedback)</span>
                </div>
                <button
                  type="button"
                  disabled={soundTesting}
                  onClick={handleTestAudioSignal}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition shadow"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{soundTesting ? 'Speelt af...' : 'Test Geluid'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Audio Ondersteuning</span>
                  <span className="font-bold text-emerald-400">
                    {health.audio.isSupported ? 'Beschikbaar' : 'Niet Ondersteund'}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Context Status</span>
                  <span className="font-bold font-mono text-slate-200 uppercase">
                    {health.audio.state}
                  </span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-400">Geluid</span>
                  <span className="font-bold text-slate-200">
                    {health.audio.isMuted ? 'Uitgeschakeld' : 'Ingeschakeld'}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <p>Gegevenssynchronisatie: {health.sync.isConfigured ? 'Ingeschakeld' : 'Niet ingesteld; data blijft lokaal'}</p>
              <p>Laatste gegevenssynchronisatie: {health.sync.lastSyncAt ? new Date(health.sync.lastSyncAt).toLocaleString('nl-BE') : 'Nog geen geslaagde synchronisatie'}</p>
              {health.sync.lastError && <p className="text-amber-300">{health.sync.lastError}</p>}
            </div>

            {/* 5. Toestel & Wachtrij */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <Laptop className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-slate-300 font-bold">Toestel-ID: </span>
                  <span className="text-amber-400 font-mono font-semibold break-all">{deviceConfig?.id || 'Niet ingesteld'}</span>
                  <span className="text-slate-500 mx-2">|</span>
                  <span className="text-slate-300">Rol: </span>
                  <span className="text-slate-200">{deviceConfig?.role || 'Niet ingesteld'}</span>
                </div>
              </div>
              <div className="text-slate-400">
                <span>Wachtrij: </span>
                <span className={`font-mono font-bold ${health.sync.pendingCount === null || health.sync.pendingCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {health.sync.pendingCount ?? 'Onbekend'} ongesynchroniseerd
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={runHealthCheck}
            disabled={loading || syncingClock || persisting || soundTesting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" /> Opnieuw controleren
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
