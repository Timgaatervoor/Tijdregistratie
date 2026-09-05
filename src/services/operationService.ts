import { db } from '../db/dexieDb';
import type {
  RaceOperation,
  TimingRecord,
  ShootingResult,
  Participant,
  AuditLog,
  RaceConflict,
  SyncStatus,
} from '../types';

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// BroadcastChannel for cross-tab and multi-device local simulated synchronization
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  broadcastChannel = new BroadcastChannel('biathlon_race_sync');
}

export class OperationService {
  private currentDeviceId = 'FINISH-01';
  private currentOperator = 'Operator';

  public setDeviceAndOperator(deviceId: string, operator: string) {
    this.currentDeviceId = deviceId;
    this.currentOperator = operator;
  }

  public getDeviceId(): string {
    return this.currentDeviceId;
  }

  public getOperator(): string {
    return this.currentOperator;
  }

  /**
   * Log an audit action
   */
  public async logAudit(
    action: string,
    details: string,
    participantId?: string,
    bibNumber?: number,
    reason?: string
  ): Promise<AuditLog> {
    const log: AuditLog = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      deviceId: this.currentDeviceId,
      operator: this.currentOperator,
      action,
      details,
      participantId,
      bibNumber,
      reason,
    };
    await db.auditLogs.add(log);
    return log;
  }

  /**
   * Records a finish time with failsafe T1 timestamp capture.
   * Immediately writes to IndexedDB and operations queue.
   */
  public async recordFinish(
    eventId: string,
    bibNumber: number,
    participant: Participant | undefined,
    capturedTimestamp: string,
    monotonicMs: number,
    clockOffsetMs = 0
  ): Promise<{ record: TimingRecord; conflict?: RaceConflict }> {
    const recordId = generateUUID();
    const operationId = generateUUID();

    // Check if participant already has a non-reversed finish record (Conflict detection Req 33)
    let existingFinish: TimingRecord | undefined = undefined;
    if (participant) {
      existingFinish = await db.timingRecords
        .where({ bibNumber, type: 'FINISH' })
        .and((r) => !r.isReversed)
        .first();
    }

    const record: TimingRecord = {
      id: recordId,
      eventId,
      participantId: participant?.id,
      bibNumber,
      type: 'FINISH',
      timestamp: capturedTimestamp,
      monotonicMs,
      clockOffsetMs,
      deviceId: this.currentDeviceId,
      operatorId: this.currentOperator,
      isUnknownBib: !participant,
      isConfirmed: true,
      syncStatus: 'LOCAL_ONLY' as SyncStatus,
    };

    // Save record to IndexedDB immediately
    await db.timingRecords.put(record);

    // If participant exists, update participant status to FINISHED
    if (participant) {
      await db.participants.update(participant.id, {
        status: 'FINISHED',
        updatedAt: new Date().toISOString(),
      });
    }

    // Check for conflict
    let conflict: RaceConflict | undefined = undefined;
    if (existingFinish && existingFinish.id !== record.id) {
      conflict = {
        id: generateUUID(),
        eventId,
        participantId: participant?.id || '',
        bibNumber,
        type: 'FINISH_CONFLICT',
        recordA: existingFinish,
        recordB: record,
        createdAt: new Date().toISOString(),
      };
      await db.conflicts.put(conflict);

      await this.logAudit(
        'FINISH_CONFLICT_DETECTED',
        `Conflict ontdekt voor bib #${bibNumber}: ${existingFinish.deviceId} (${existingFinish.timestamp}) vs ${this.currentDeviceId} (${record.timestamp})`,
        participant?.id,
        bibNumber
      );
    }

    // Save operation (immutable event log)
    const operation: RaceOperation = {
      operationId,
      eventId,
      participantId: participant?.id,
      type: 'FINISH_RECORDED',
      deviceId: this.currentDeviceId,
      operatorId: this.currentOperator,
      deviceTimestamp: capturedTimestamp,
      payload: {
        recordId,
        bibNumber,
        timestamp: capturedTimestamp,
        monotonicMs,
        isUnknownBib: !participant,
      },
      syncStatus: 'LOCAL_ONLY',
      revision: 1,
    };

    await db.operations.put(operation);

    await this.logAudit(
      'FINISH_RECORDED',
      `Finish geregistreerd voor #${bibNumber} om ${capturedTimestamp}`,
      participant?.id,
      bibNumber
    );

    // Broadcast event
    this.broadcast({ type: 'FINISH_RECORDED', operation, record, conflict });

    return { record, conflict };
  }

  /**
   * Records a start time (Individual or Mass start)
   */
  public async recordStart(
    eventId: string,
    bibNumber: number,
    participant: Participant | undefined,
    capturedTimestamp: string,
    monotonicMs: number,
    clockOffsetMs = 0
  ): Promise<TimingRecord> {
    const recordId = generateUUID();
    const operationId = generateUUID();

    const record: TimingRecord = {
      id: recordId,
      eventId,
      participantId: participant?.id,
      bibNumber,
      type: 'START',
      timestamp: capturedTimestamp,
      monotonicMs,
      clockOffsetMs,
      deviceId: this.currentDeviceId,
      operatorId: this.currentOperator,
      isUnknownBib: !participant,
      isConfirmed: true,
      syncStatus: 'LOCAL_ONLY',
    };

    await db.timingRecords.put(record);

    if (participant) {
      await db.participants.update(participant.id, {
        status: 'STARTED',
        updatedAt: new Date().toISOString(),
      });
    }

    const operation: RaceOperation = {
      operationId,
      eventId,
      participantId: participant?.id,
      type: 'START_RECORDED',
      deviceId: this.currentDeviceId,
      operatorId: this.currentOperator,
      deviceTimestamp: capturedTimestamp,
      payload: {
        recordId,
        bibNumber,
        timestamp: capturedTimestamp,
      },
      syncStatus: 'LOCAL_ONLY',
      revision: 1,
    };

    await db.operations.put(operation);

    await this.logAudit(
      'START_RECORDED',
      `Start geregistreerd voor #${bibNumber} om ${capturedTimestamp}`,
      participant?.id,
      bibNumber
    );

    this.broadcast({ type: 'START_RECORDED', operation, record });
    return record;
  }

  /**
   * Mass start for all participants in a wave
   */
  public async recordMassWaveStart(
    eventId: string,
    waveId: string,
    waveNumber: number,
    participants: Participant[],
    capturedTimestamp: string
  ): Promise<void> {
    const monotonic = typeof performance !== 'undefined' ? performance.now() : Date.now();

    for (const p of participants) {
      if (p.bibNumber && p.status !== 'DNS' && p.status !== 'DSQ') {
        const rec: TimingRecord = {
          id: generateUUID(),
          eventId,
          participantId: p.id,
          bibNumber: p.bibNumber,
          type: 'START',
          timestamp: capturedTimestamp,
          monotonicMs: monotonic,
          clockOffsetMs: 0,
          deviceId: this.currentDeviceId,
          operatorId: this.currentOperator,
          isConfirmed: true,
          syncStatus: 'LOCAL_ONLY',
        };
        await db.timingRecords.put(rec);
        await db.participants.update(p.id, {
          status: 'STARTED',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await db.waves.update(waveId, {
      actualStartTime: capturedTimestamp,
      status: 'STARTED',
    });

    const operation: RaceOperation = {
      operationId: generateUUID(),
      eventId,
      type: 'WAVE_STARTED',
      deviceId: this.currentDeviceId,
      operatorId: this.currentOperator,
      deviceTimestamp: capturedTimestamp,
      payload: { waveId, waveNumber, timestamp: capturedTimestamp, count: participants.length },
      syncStatus: 'LOCAL_ONLY',
      revision: 1,
    };

    await db.operations.put(operation);

    await this.logAudit(
      'WAVE_STARTED',
      `Mass start voor Wave ${waveNumber} (${participants.length} deelnemers) om ${capturedTimestamp}`
    );

    this.broadcast({ type: 'WAVE_STARTED', operation, waveId });
  }

  /**
   * Records a shooting result for a round
   */
  public async recordShooting(
    eventId: string,
    participant: Participant,
    round: number,
    station: string,
    shots: number,
    hits: number,
    misses: number,
    targetDetails?: boolean[],
    isCorrection = false,
    correctionReason?: string
  ): Promise<ShootingResult> {
    const recordId = generateUUID();
    const operationId = generateUUID();
    const timestamp = new Date().toISOString();

    const record: ShootingResult = {
      id: recordId,
      eventId,
      participantId: participant.id,
      bibNumber: participant.bibNumber || 0,
      round,
      station,
      timestamp,
      shots,
      hits,
      misses,
      targetDetails,
      operatorId: this.currentOperator,
      deviceId: this.currentDeviceId,
      isCorrection,
      correctionReason,
      syncStatus: 'LOCAL_ONLY',
    };

    await db.shootingResults.put(record);

    const operation: RaceOperation = {
      operationId,
      eventId,
      participantId: participant.id,
      type: 'SHOOTING_RECORDED',
      deviceId: this.currentDeviceId,
      operatorId: this.currentOperator,
      deviceTimestamp: timestamp,
      payload: {
        recordId,
        bibNumber: participant.bibNumber,
        round,
        station,
          shots,
        hits,
        misses,
          targetDetails,
        isCorrection,
        correctionReason,
      },
      syncStatus: 'LOCAL_ONLY',
      revision: 1,
    };

    await db.operations.put(operation);

    await this.logAudit(
      isCorrection ? 'SHOOTING_CORRECTED' : 'SHOOTING_RECORDED',
      `Schietronde ${round} voor #${participant.bibNumber}: ${hits}/${shots} hits, ${misses} missers ${
        correctionReason ? `(Reden: ${correctionReason})` : ''
      }`,
      participant.id,
      participant.bibNumber,
      correctionReason
    );

    this.broadcast({ type: 'SHOOTING_RECORDED', operation, record });
    return record;
  }

  /**
   * Undo the last timing record for a bib (without hard deleting, preserves audit history)
   */
  public async undoTimingRecord(recordId: string, reason = 'Operator undo'): Promise<void> {
    const record = await db.timingRecords.get(recordId);
    if (!record) return;

    await db.timingRecords.update(recordId, {
      isReversed: true,
      reversedReason: reason,
    });

    // Revert participant status if needed
    if (record.participantId) {
      if (record.type === 'FINISH') {
        await db.participants.update(record.participantId, {
          status: 'STARTED',
          updatedAt: new Date().toISOString(),
        });
      } else if (record.type === 'START') {
        await db.participants.update(record.participantId, {
          status: 'READY',
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const op: RaceOperation = {
      operationId: generateUUID(),
      eventId: record.eventId,
      participantId: record.participantId,
      type: 'RECORD_UNDO',
      deviceId: this.currentDeviceId,
      operatorId: this.currentOperator,
      deviceTimestamp: new Date().toISOString(),
      payload: { recordId, bibNumber: record.bibNumber, type: record.type, reason },
      syncStatus: 'LOCAL_ONLY',
      revision: 1,
    };
    await db.operations.put(op);

    await this.logAudit(
      'RECORD_UNDO',
      `Undo ${record.type} voor #${record.bibNumber}. Reden: ${reason}`,
      record.participantId,
      record.bibNumber,
      reason
    );

    this.broadcast({ type: 'RECORD_UNDO', recordId, bibNumber: record.bibNumber });
  }

  private broadcast(message: any) {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage(message);
      } catch {
        // ignore
      }
    }
  }

  public onBroadcastMessage(callback: (msg: any) => void) {
    if (broadcastChannel) {
      broadcastChannel.onmessage = (event) => callback(event.data);
    }
  }
}

export const operationService = new OperationService();
