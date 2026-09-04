import React, { useState } from 'react';
import { useEventData } from './hooks/useEventData';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Header } from './components/Header';
import { Navigation, type ActiveTab } from './components/Navigation';

// Views
import { EventDashboardView } from './components/views/EventDashboardView';
import { StartStationView } from './components/views/StartStationView';
import { ShootingStationView } from './components/views/ShootingStationView';
import { FinishStationView } from './components/views/FinishStationView';
import { LiveLeaderboardView } from './components/views/LiveLeaderboardView';
import { ParticipantsView } from './components/views/ParticipantsView';
import { WavesView } from './components/views/WavesView';
import { AttentionView } from './components/views/AttentionView';
import { BackupRecoveryView } from './components/views/BackupRecoveryView';
import { SimulatorView } from './components/views/SimulatorView';
import { SettingsView } from './components/views/SettingsView';

// Modals
import { PreRaceCheckModal } from './components/PreRaceCheckModal';
import { PrintModal } from './components/PrintModal';
import { ConflictResolverModal } from './components/ConflictResolverModal';
import { ParticipantDetailModal } from './components/ParticipantDetailModal';

import type { RaceConflict, Participant, RaceResult } from './types';
import { AlertTriangle } from 'lucide-react';

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
  } = useEventData();

  const { isSimulatedOffline, toggleSimulatedOffline } = useOnlineStatus();
  const [currentTab, setCurrentTab] = useState<ActiveTab>('event');

  // Modals state
  const [showPreRaceModal, setShowPreRaceModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activeConflict, setActiveConflict] = useState<RaceConflict | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);

  const unresolvedConflictsCount = conflicts.filter((c) => !c.resolvedAt).length;

  const handleSelectParticipantFromResult = (result: RaceResult) => {
    const p = participants.find((item) => item.id === result.participantId);
    if (p) setSelectedParticipant(p);
  };

  if (loading && !event) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold tracking-wider font-mono">
          Run Biathlon De Haan Timing laden...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Test Mode / Simulated Offline Banner */}
      {(event?.isTestMode || isSimulatedOffline) && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-black uppercase tracking-wider flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            <span>
              {isSimulatedOffline
                ? 'GEFORCEERDE OFFLINE MODUS ACTIEF: Apparaat opereert 100% autonoom op lokale IndexedDB'
                : `TESTMODUS: ${event?.name || 'Run Biathlon De Haan'} Testset actief`}
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

      {/* Global Header */}
      <Header
        event={event}
        deviceConfig={deviceConfig}
        pendingSyncCount={pendingSyncCount}
        onOpenPreRaceCheck={() => setShowPreRaceModal(true)}
        onOpenPrint={() => setShowPrintModal(true)}
        isTestMode={event?.isTestMode ?? false}
      />

      {/* Main Tab Navigation */}
      <Navigation
        activeTab={currentTab}
        onSelectTab={setCurrentTab}
        conflictCount={unresolvedConflictsCount}
        attentionCount={0}
      />

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 pb-16">
        {currentTab === 'event' && (
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

        {currentTab === 'start' && (
          <StartStationView
            event={event}
            waves={waves}
            participants={participants}
            timingRecords={timingRecords}
            onRefresh={refresh}
          />
        )}

        {currentTab === 'shooting' && (
          <ShootingStationView
            event={event}
            participants={participants}
            shootingResults={shootingResults}
            onRefresh={refresh}
          />
        )}

        {currentTab === 'finish' && (
          <FinishStationView
            event={event}
            participants={participants}
            timingRecords={timingRecords}
            onRefresh={refresh}
          />
        )}

        {(currentTab === 'live' || currentTab === 'results') && (
          <LiveLeaderboardView
            results={results}
            categories={categories}
            waves={waves}
            event={event}
            mode={currentTab === 'results' ? 'results' : 'live'}
            onSelectParticipant={handleSelectParticipantFromResult}
          />
        )}

        {currentTab === 'participants' && (
          <ParticipantsView
            participants={participants}
            categories={categories}
            waves={waves}
            onRefresh={refresh}
            onSelectParticipant={setSelectedParticipant}
          />
        )}

        {currentTab === 'waves' && (
          <WavesView
            waves={waves}
            categories={categories}
            participants={participants}
            onRefresh={refresh}
          />
        )}

        {currentTab === 'attention' && (
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

        {currentTab === 'backup' && (
          <BackupRecoveryView event={event} onRefresh={refresh} />
        )}

        {currentTab === 'simulator' && <SimulatorView onRefresh={refresh} />}

        {currentTab === 'settings' && (
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
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        results={results}
        categories={categories}
        waves={waves}
        event={event}
      />

      <ConflictResolverModal
        conflict={activeConflict}
        participants={participants}
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
        onClose={() => setSelectedParticipant(null)}
        onUpdated={refresh}
      />
    </div>
  );
}
