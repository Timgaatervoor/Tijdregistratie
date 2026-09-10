import { DevicePairingPanel } from './components/DevicePairingPanel';
import React, { useState } from 'react';
import { useEventData } from './hooks/useEventData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Header } from './components/Header';
import { Navigation, getLockedTabForRole, type ActiveTab } from './components/Navigation';

// Views
import { EventDashboardView } from './components/views/EventDashboardView';
import { StartStationView } from './components/views/StartStationView';
import { ShootingStationView } from './components/views/ShootingStationView';
import { FinishStationView } from './components/views/FinishStationView';
import { LiveLeaderboardView } from './components/views/LiveLeaderboardView';
import { ParticipantsView } from './components/views/ParticipantsView';
import { WavesView } from './components/views/WavesView';
import { AttentionView } from './components/views/AttentionView';
import { SettingsView } from './components/views/SettingsView';

// Modals
import { SystemHealthModal } from './components/SystemHealthModal';
import { PreRaceCheckModal } from './components/PreRaceCheckModal';
import { PrintModal } from './components/PrintModal';
import { ConflictResolverModal } from './components/ConflictResolverModal';
import { ParticipantDetailModal } from './components/ParticipantDetailModal';

import type { RaceConflict, Participant, RaceResult } from './types';
import { AlertTriangle, KeyRound, Lock, Unlock } from 'lucide-react';
import { db } from './db/dexieDb';
import { soundService } from './services/soundService';
import { SafeConfirmButton } from './components/SafeConfirmButton';
import { createActionGate } from './services/safeConfirmLogic';

const validTabs = new Set<ActiveTab>([
  'event', 'participants', 'waves', 'start', 'shooting', 'finish',
  'live', 'results', 'attention', 'settings',
]);

const getInitialTab = (): ActiveTab => {
  if (typeof window === 'undefined') return 'event';
  const hashTab = window.location.hash.replace(/^#/, '') as ActiveTab;
  return validTabs.has(hashTab) ? hashTab : 'event';
};

export default function App() {
  const {
    event,
    participants,
    categories,
    waves,
    raceProfiles,
    timingRecords,
    shootingResults,
    results,
    conflicts,
    auditLogs,
    deviceConfig,
    pendingSyncCount,
    refresh,
    loading,
    loadError,
  } = useEventData();

  const { isSimulatedOffline, toggleSimulatedOffline } = useOnlineStatus();
  const [currentTab, setCurrentTab] = useState<ActiveTab>(getInitialTab);
  const [joinLink, setJoinLink] = useState(() => location.hash.startsWith('#join=') ? location.href : '');
  const [isLeaderboardKiosk, setIsLeaderboardKiosk] = useState(false);

  // Modals state
  const [showPreRaceModal, setShowPreRaceModal] = useState(false);
  const [showSystemHealthModal, setShowSystemHealthModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activeConflict, setActiveConflict] = useState<RaceConflict | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  const unresolvedConflictsCount = conflicts.filter((c) => !c.resolvedAt).length;
  const activeTimingRecords = timingRecords.filter((record) => !record.isReversed);
  const unknownBibCount = activeTimingRecords.filter((record) => record.isUnknownBib).length;
  const startedBibs = new Set(
    activeTimingRecords.filter((record) => record.type === 'START').map((record) => record.bibNumber)
  );
  const finishedBibs = new Set(
    activeTimingRecords.filter((record) => record.type === 'FINISH').map((record) => record.bibNumber)
  );
  const missingStartCount = [...finishedBibs].filter((bib) => !startedBibs.has(bib)).length;
  const missingShootingCount = results.filter((result) => result.status === 'FINISHED' && result.isPendingShooting).length;
  const attentionCount = unknownBibCount + missingStartCount + missingShootingCount;
  const lockedTab = deviceConfig?.isLocked ? getLockedTabForRole(deviceConfig.role) : null;
  const displayedTab = lockedTab || currentTab;

  React.useEffect(() => {
    if (deviceConfig?.isLocked) {
      setCurrentTab(getLockedTabForRole(deviceConfig.role));
    }
  }, [deviceConfig?.isLocked, deviceConfig?.role]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.startsWith('#join=')) return;
      const nextHash = `#${currentTab}`;
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, '', nextHash);
      }
    }
  }, [currentTab]);

  React.useEffect(() => {
    const restoreTabFromHistory = () => {
      if (window.location.hash.startsWith('#join=')) { setJoinLink(window.location.href); return; }
      const hashTab = window.location.hash.replace(/^#/, '') as ActiveTab;
      if (validTabs.has(hashTab)) setCurrentTab(hashTab);
    };
    window.addEventListener('popstate', restoreTabFromHistory);
    window.addEventListener('hashchange', restoreTabFromHistory);
    return () => {
      window.removeEventListener('popstate', restoreTabFromHistory);
      window.removeEventListener('hashchange', restoreTabFromHistory);
    };
  }, []);

  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPinInput, setUnlockPinInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const unlockGate = React.useRef(createActionGate());

  const handleOpenUnlockModal = () => {
    if (!deviceConfig?.isLocked) return;
    unlockGate.current.leave();
    setUnlockPinInput(''); setUnlockError(''); setUnlocking(false); setShowUnlockModal(true);
  };

  const unlockDevice = async () => {
    if (!deviceConfig?.isLocked || !unlockGate.current.enter()) return;
    setUnlocking(true); setUnlockError('');
    try {
      await db.devices.update(deviceConfig.id, { isLocked: false });
      await refresh();
      soundService.playSuccess();
      setShowUnlockModal(false);
      setCurrentTab('event');
    } catch (error) {
      unlockGate.current.leave();
      setUnlocking(false);
      setUnlockError(error instanceof Error ? error.message : 'Ontgrendelen is mislukt.');
      soundService.playError();
    }
  };

  const handleConfirmUnlockWithPin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deviceConfig?.isLocked) return;
    if (deviceConfig.pin && unlockPinInput !== deviceConfig.pin) {
      soundService.playError();
      setUnlockError('Onjuiste beheerderscode. Het toestel blijft vergrendeld.');
      return;
    }
    await unlockDevice();
  };

  const handleSelectParticipantFromResult = (result: RaceResult) => {
    const p = participants.find((item) => item.id === result.participantId);
    if (p) setSelectedParticipant(p);
  };

  if (!event && loadError) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-200">
      <div className="max-w-lg space-y-4 rounded-xl border border-amber-500/40 bg-slate-900 p-6">
        <h1 className="text-lg font-bold">Lokale wedstrijddata laden lukt nog niet</h1>
        <p role="alert" className="text-sm leading-relaxed break-words">{loadError}</p>
        <p className="text-sm text-slate-400">Je wedstrijddata wordt niet gewist. Sluit andere tabbladen of vensters van deze app en probeer opnieuw.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-amber-500 px-4 py-2 font-bold text-slate-950">Opnieuw laden</button>
      </div>
    </div>;
  }
  if (loading && !event) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wider font-mono">
          Biathlon Tijdregistratie laden...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {joinLink && <div className="fixed inset-0 z-[100] bg-slate-950/95 overflow-auto p-6"><div className="max-w-2xl mx-auto"><DevicePairingPanel initialLink={joinLink} onJoined={() => { setJoinLink(''); location.reload(); }} /><button className="p-3" onClick={() => { setJoinLink(''); history.replaceState(null, '', location.pathname); }}>Sluiten</button></div></div>}
      {/* Test Mode / Simulated Offline Banner */}
      {!isLeaderboardKiosk && (event?.isTestMode || isSimulatedOffline) && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-black uppercase tracking-wider flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isSimulatedOffline
                ? 'GEFORCEERDE OFFLINE MODUS ACTIEF: Apparaat opereert 100% autonoom op lokale IndexedDB'
                : `TESTMODUS: ${event?.name || 'Biathlon Tijdregistratie'} Testset actief`}
            </span>
          </div>
          {isSimulatedOffline && (
            <button
              onClick={toggleSimulatedOffline}
              className="bg-slate-950 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-slate-900 transition"
            >
              Hervat Netwerk
            </button>
          )}
        </div>
      )}

      {!isLeaderboardKiosk && <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <Header
          stationNavigation={<Navigation variant="stations" activeTab={displayedTab} onSelectTab={setCurrentTab} conflictCount={unresolvedConflictsCount} attentionCount={attentionCount} deviceConfig={deviceConfig} />}
          event={event}
          deviceConfig={deviceConfig}
          pendingSyncCount={pendingSyncCount}
          onOpenPreRaceCheck={() => setShowPreRaceModal(true)}
          onOpenSystemHealth={() => setShowSystemHealthModal(true)}
          onOpenPrint={() => setShowPrintModal(true)}
          onUnlockDevice={handleOpenUnlockModal}
          isTestMode={event?.isTestMode ?? false}
        />
        <Navigation
          activeTab={displayedTab}
          onSelectTab={setCurrentTab}
          conflictCount={unresolvedConflictsCount}
          attentionCount={attentionCount}
          deviceConfig={deviceConfig}
        />
      </div>}

      {/* Main Content View */}
      <main className={isLeaderboardKiosk
        ? 'flex-1 w-full'
        : 'flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-16'}>
        {displayedTab === 'event' && (
          <EventDashboardView
            event={event}
            participants={participants}
            waves={waves}
            timingRecords={timingRecords}
            shootingResults={shootingResults}
            results={results}
            conflicts={conflicts}
            onNavigate={setCurrentTab}
            onOpenPreRaceCheck={() => setShowPreRaceModal(true)}
          />
        )}

        {displayedTab === 'start' && (
          <StartStationView
            event={event}
            categories={categories}
            waves={waves}
            participants={participants}
            timingRecords={timingRecords}
            onRefresh={refresh}
          />
        )}

        {displayedTab === 'shooting' && (
          <ShootingStationView
            categories={categories}
            event={event}
            participants={participants}
            shootingResults={shootingResults}
            raceProfiles={raceProfiles}
            onRefresh={refresh}
          />
        )}

        {displayedTab === 'finish' && (
          <FinishStationView
            categories={categories}
            waves={waves}
            event={event}
            participants={participants}
            timingRecords={timingRecords}
            onRefresh={refresh}
          />
        )}

        {(displayedTab === 'live' || displayedTab === 'results') && (
          <LiveLeaderboardView
            key={event?.id}
            results={results}
            categories={categories}
            waves={waves}
            event={event}
            mode={displayedTab === 'results' ? 'results' : 'live'}
            onSelectParticipant={handleSelectParticipantFromResult}
            onKioskModeChange={setIsLeaderboardKiosk}
          />
        )}

        {displayedTab === 'participants' && (
          <ParticipantsView
            participants={participants}
            categories={categories}
            waves={waves}
            profiles={raceProfiles}
            onRefresh={refresh}
            onSelectParticipant={setSelectedParticipant}
          />
        )}

        {displayedTab === 'waves' && (
          <WavesView
            waves={waves}
            categories={categories}
            participants={participants}
            onRefresh={refresh}
          />
        )}

        {displayedTab === 'attention' && (
          <AttentionView
            conflicts={conflicts}
            participants={participants}
            timingRecords={timingRecords}
            shootingResults={shootingResults}
            auditLogs={auditLogs}
            onOpenConflict={setActiveConflict}
            onSelectParticipant={setSelectedParticipant}
          />
        )}

        {displayedTab === 'settings' && (
          <SettingsView
            event={event}
            deviceConfig={deviceConfig}
            profiles={raceProfiles}
            categories={categories}
            waves={waves}
            participants={participants}
            onRefresh={refresh}
          />
        )}
      </main>

      {/* Global Modals */}
      <SystemHealthModal
        isOpen={showSystemHealthModal}
        onClose={() => setShowSystemHealthModal(false)}
        deviceConfig={deviceConfig}
      />
      <PreRaceCheckModal
        isOpen={showPreRaceModal}
        onClose={() => setShowPreRaceModal(false)}
        event={event}
        participants={participants}
        waves={waves}
        categories={categories}
        profiles={raceProfiles}
        conflicts={conflicts}
        pendingSyncCount={pendingSyncCount}
        onGoLiveSuccess={refresh}
      />

      <PrintModal
        profiles={raceProfiles}
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        participants={participants}
        categories={categories}
        waves={waves}
        event={event}
      />

      <ConflictResolverModal
        isOpen={!!activeConflict}
        conflict={activeConflict}
        onClose={() => setActiveConflict(null)}
        onResolved={refresh}
      />

      <ParticipantDetailModal
        isOpen={!!selectedParticipant}
        participant={selectedParticipant}
        result={selectedParticipant ? results.find((r) => r.participantId === selectedParticipant.id) || null : null}
        auditLogs={auditLogs}
        timingRecords={timingRecords}
        shootingResults={shootingResults}
        categories={categories}
        waves={waves}
        profiles={raceProfiles}
        onClose={() => setSelectedParticipant(null)}
        onUpdated={refresh}
      />

      {showUnlockModal && deviceConfig?.isLocked && (
        <div role="dialog" aria-modal="true" aria-labelledby="unlock-device-title" className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4 text-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3"><div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400"><Lock className="w-5 h-5" /></div><div><h3 id="unlock-device-title" className="font-bold">Toestel ontgrendelen</h3><p className="text-xs text-slate-400">Alle beheermenu’s worden weer zichtbaar.</p></div></div>
            {unlockError && <p role="alert" className="rounded-xl border border-red-800 bg-red-950/60 p-3 text-xs text-red-300">{unlockError}</p>}
            {deviceConfig.pin ? <form onSubmit={handleConfirmUnlockWithPin} className="space-y-4">
              <label className="block text-xs text-slate-300"><span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5 text-amber-400" />Beheerders-PIN</span><input type="password" inputMode="numeric" autoFocus disabled={unlocking} value={unlockPinInput} onChange={event => { setUnlockPinInput(event.target.value); setUnlockError(''); }} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-center text-xl tracking-widest font-mono disabled:opacity-50" /></label>
              <div className="flex gap-2"><button type="button" disabled={unlocking} onClick={() => setShowUnlockModal(false)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold disabled:opacity-50">Annuleren</button><button type="submit" disabled={unlocking} className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-black text-slate-950 flex items-center justify-center gap-1 disabled:opacity-50"><Unlock className="w-4 h-4" />{unlocking ? 'Bezig…' : 'Ontgrendelen'}</button></div>
            </form> : <div className="space-y-4"><p className="text-xs text-slate-300">Er is geen PIN ingesteld. Houd de knop ingedrukt om het toestel te ontgrendelen.</p><div className="flex gap-2"><button type="button" onClick={() => setShowUnlockModal(false)} className="flex-1 rounded-xl bg-slate-800 py-2.5 text-xs font-bold">Annuleren</button><SafeConfirmButton mode="hold" holdDurationSeconds={2} variant="warning" onConfirm={unlockDevice} className="flex-1 py-2.5"><Unlock className="w-4 h-4" />Ontgrendelen</SafeConfirmButton></div></div>}
          </div>
        </div>
      )}
    </div>
  );
}
