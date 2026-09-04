import { useState, useEffect, useCallback } from 'react';
import { db } from '../db/dexieDb';
import { operationService } from '../services/operationService';
import { syncService } from '../services/syncService';
import { calculateRaceResults } from '../services/timingEngine';
import { initializeSampleData } from '../services/sampleDataService';
import type {
  RaceEvent,
  Participant,
  TimingRecord,
  ShootingResult,
  Wave,
  Category,
  RaceProfile,
  RaceConflict,
  AuditLog,
  RaceResult,
  DeviceConfig,
} from '../types';

export function useEventData() {
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<RaceEvent | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [timingRecords, setTimingRecords] = useState<TimingRecord[]>([]);
  const [shootingResults, setShootingResults] = useState<ShootingResult[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [raceProfiles, setRaceProfiles] = useState<RaceProfile[]>([]);
  const [conflicts, setConflicts] = useState<RaceConflict[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [deviceConfig, setDeviceConfig] = useState<DeviceConfig | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  const refresh = useCallback(async () => {
    try {
      let ev = await db.events.toCollection().first();
      const isInitialized = typeof window !== 'undefined' && localStorage.getItem('biathlon_db_initialized') === 'true';

      if (!ev && !isInitialized) {
        await initializeSampleData(false);
        ev = await db.events.toCollection().first();
      }

      const [
        pList,
        tList,
        sList,
        wList,
        cList,
        profList,
        confList,
        aList,
        devList,
        pendingCount,
      ] = await Promise.all([
        db.participants.toArray(),
        db.timingRecords.toArray(),
        db.shootingResults.toArray(),
        db.waves.orderBy('waveNumber').toArray(),
        db.categories.toArray(),
        db.raceProfiles.toArray(),
        db.conflicts.toArray(),
        db.auditLogs.orderBy('timestamp').reverse().limit(100).toArray(),
        db.devices.toCollection().first(),
        syncService.getPendingCount(),
      ]);

      if (ev?.name && typeof document !== 'undefined') {
        document.title = `${ev.name} - Tijdregistratie Biathlon`;
      }

      setEvent(ev || null);
      setParticipants(pList);
      setTimingRecords(tList);
      setShootingResults(sList);
      setWaves(wList);
      setCategories(cList);
      setRaceProfiles(profList);
      setConflicts(confList);
      setAuditLogs(aList);
      setDeviceConfig(devList || null);
      setPendingSyncCount(pendingCount);
    } catch (err) {
      console.error('Error fetching event data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Listen to operations and local BroadcastChannel messages
    operationService.onBroadcastMessage(() => {
      refresh();
    });

    // Subscribe to sync service state changes
    const unsubSync = syncService.subscribe(() => {
      syncService.getPendingCount().then((count) => setPendingSyncCount(count));
    });

    // Poll periodically to catch internal Dexie changes
    const interval = setInterval(refresh, 2000);

    return () => {
      unsubSync();
      clearInterval(interval);
    };
  }, [refresh]);

  // Derived calculated race results
  const results: RaceResult[] = calculateRaceResults(
    participants,
    timingRecords,
    shootingResults,
    categories,
    waves,
    raceProfiles,
    event?.penaltySecondsPerMiss || 20
  );

  return {
    loading,
    event,
    participants,
    timingRecords,
    shootingResults,
    waves,
    categories,
    raceProfiles,
    conflicts,
    auditLogs,
    deviceConfig,
    pendingSyncCount,
    results,
    refresh,
  };
}
