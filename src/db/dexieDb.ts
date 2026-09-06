import Dexie, { type Table } from 'dexie';
import type {
  RaceEvent,
  RaceProfile,
  Category,
  Wave,
  Participant,
  TimingRecord,
  ShootingResult,
  RaceOperation,
  RaceConflict,
  AuditLog,
  EventSnapshot,
  DeviceConfig,
} from '../types';

export class BiathlonDatabase extends Dexie {
  events!: Table<RaceEvent, string>;
  raceProfiles!: Table<RaceProfile, string>;
  categories!: Table<Category, string>;
  waves!: Table<Wave, string>;
  participants!: Table<Participant, string>;
  timingRecords!: Table<TimingRecord, string>;
  shootingResults!: Table<ShootingResult, string>;
  operations!: Table<RaceOperation, string>;
  conflicts!: Table<RaceConflict, string>;
  auditLogs!: Table<AuditLog, string>;
  snapshots!: Table<EventSnapshot, string>;
  devices!: Table<DeviceConfig, string>;

  constructor() {
    super('BiathlonDeHaanDB');

    this.version(1).stores({
      events: 'id, status, isTestMode',
      raceProfiles: 'id, name',
      categories: 'id, code, raceProfileId',
      waves: 'id, eventId, waveNumber, status',
      participants: 'id, externalId, bibNumber, waveId, categoryId, status, [categoryId+status]',
      timingRecords: 'id, eventId, participantId, bibNumber, type, timestamp, syncStatus, [bibNumber+type]',
      shootingResults: 'id, eventId, participantId, bibNumber, round, [participantId+round], syncStatus',
      operations: 'operationId, eventId, participantId, type, syncStatus, deviceTimestamp',
      conflicts: 'id, eventId, participantId, resolvedWinner',
      auditLogs: 'id, timestamp, action, participantId, bibNumber',
      snapshots: 'snapshotId, eventId, timestamp',
      devices: 'id, role',
    });

    this.version(2)
      .stores({
        events: 'id, status, isTestMode',
        raceProfiles: 'id, name',
        categories: 'id, code, raceProfileId, *raceProfileIds',
        waves: 'id, eventId, waveNumber, status',
        participants: 'id, externalId, bibNumber, waveId, categoryId, status, [categoryId+status]',
        timingRecords: 'id, eventId, participantId, bibNumber, type, timestamp, syncStatus, [bibNumber+type]',
        shootingResults: 'id, eventId, participantId, bibNumber, round, [participantId+round], syncStatus',
        operations: 'operationId, eventId, participantId, type, syncStatus, deviceTimestamp',
        conflicts: 'id, eventId, participantId, resolvedWinner',
        auditLogs: 'id, timestamp, action, participantId, bibNumber',
        snapshots: 'snapshotId, eventId, timestamp',
        devices: 'id, role',
      })
      .upgrade(async (transaction) => {
        await transaction.table<Category>('categories').toCollection().modify((category) => {
          const legacyProfileId = category.raceProfileId;
          const existingIds = Array.isArray(category.raceProfileIds) ? category.raceProfileIds : [];
          category.raceProfileIds = [...new Set([...existingIds, ...(legacyProfileId ? [legacyProfileId] : [])])];
          category.raceProfileId = category.raceProfileIds[0];
        });
      });
  }
}

export const db = new BiathlonDatabase();
