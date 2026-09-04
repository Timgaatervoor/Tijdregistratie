import React, { useState } from 'react';
import { X, User, Crosshair, Flag, Clock, Edit3, ShieldAlert } from 'lucide-react';
import type { RaceResult, AuditLog, ParticipantStatus, Participant } from '../types';
import { db } from '../db/dexieDb';
import { operationService, generateUUID } from '../services/operationService';
import { formatLocalTime } from '../services/timingEngine';

interface ParticipantDetailModalProps {
  isOpen?: boolean;
  onClose: () => void;
  result?: RaceResult | null;
  participant?: Participant | null;
  auditLogs?: AuditLog[];
  categories?: any[];
  waves?: any[];
  timingRecords?: any[];
  shootingResults?: any[];
  onUpdated: () => void;
}

export const ParticipantDetailModal: React.FC<ParticipantDetailModalProps> = ({
  isOpen,
  onClose,
  result,
  participant,
  auditLogs = [],
  categories = [],
  waves = [],
  onUpdated,
}) => {
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<ParticipantStatus>('FINISHED');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldShow = isOpen !== undefined ? isOpen : (result != null || participant != null);
  if (!shouldShow) return null;

  const activeResult: RaceResult | null = result || (participant ? {
    participantId: participant.id,
    bibNumber: participant.bibNumber || 0,
    name: `${participant.firstName} ${participant.lastName}`.trim(),
    categoryName: categories.find((c: any) => c.id === participant.categoryId)?.name || 'Onbekend',
    categoryId: participant.categoryId,
    waveName: waves.find((w: any) => w.id === participant.waveId)?.name || 'Geen wave',
    waveId: participant.waveId,
    gender: participant.gender || 'X',
    status: participant.status,
    statusReason: participant.statusReason,
    rawElapsedFormatted: '--:--',
    shootingRounds: [],
    totalMisses: 0,
    penaltySeconds: 0,
    penaltyFormatted: '0s',
    officialTimeFormatted: '--:--',
  } : null);

  if (!activeResult) return null;

  const relevantAudits = (auditLogs || []).filter(
    (a) => a.participantId === activeResult.participantId || (activeResult.bibNumber && a.bibNumber === activeResult.bibNumber)
  );

  const handleStatusChange = async () => {
    if (!reason.trim()) {
      setError('Een reden van wijziging is verplicht (Req 44)');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await db.participants.update(activeResult.participantId, {
        status: newStatus,
        statusReason: reason,
        updatedAt: new Date().toISOString(),
      });

      const op = {
        operationId: generateUUID(),
        eventId: 'event-de-haan-2026',
        participantId: activeResult.participantId,
        type: 'STATUS_CHANGED' as const,
        deviceId: operationService.getDeviceId(),
        operatorId: operationService.getOperator(),
        deviceTimestamp: new Date().toISOString(),
        payload: {
          bibNumber: activeResult.bibNumber,
          oldStatus: activeResult.status,
          newStatus,
          reason,
        },
        syncStatus: 'LOCAL_ONLY' as const,
        revision: 1,
      };
      await db.operations.put(op);

      await operationService.logAudit(
        'STATUS_OVERRIDE',
        `Status gewijzigd van ${activeResult.status} naar ${newStatus}. Reden: ${reason}`,
        activeResult.participantId,
        activeResult.bibNumber,
        reason
      );

      setIsEditingStatus(false);
      setReason('');
      onUpdated();
    } catch (err: any) {
      setError(err?.message || 'Fout bij opslaan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              #{activeResult.bibNumber || '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>{activeResult.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                    activeResult.status === 'FINISHED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : activeResult.status === 'STARTED'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : activeResult.status === 'DNS' || activeResult.status === 'DNF' || activeResult.status === 'DSQ'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {activeResult.status}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {activeResult.categoryName} • {activeResult.waveName} • {activeResult.gender === 'M' ? 'Man' : activeResult.gender === 'F' ? 'Vrouw' : 'Open'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Timing & Penalty Breakdown (Req 69) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-400" /> Starttijd
              </span>
              <span className="text-base font-mono font-bold text-white block mt-1">
                {formatLocalTime(activeResult.startTime, true)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700">
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Flag className="w-3.5 h-3.5 text-emerald-400" /> Finishtijd
              </span>
              <span className="text-base font-mono font-bold text-white block mt-1">
                {formatLocalTime(activeResult.finishTime, true)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-800/70 border border-slate-700">
              <span className="text-xs text-slate-400">Looptijd (Raw)</span>
              <span className="text-base font-mono font-bold text-white block mt-1">
                {activeResult.rawElapsedFormatted}
              </span>
            </div>
          </div>

          {/* Official Calculation Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-850 to-slate-800 border border-slate-700 shadow">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">
                  Totale Straf (Missers)
                </span>
                <span className="text-lg font-mono font-bold text-amber-400 mt-0.5 block">
                  {activeResult.totalMisses} missers ({activeResult.penaltyFormatted})
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block uppercase tracking-wider font-semibold">
                  Officiële Wedstrijdtijd
                </span>
                <span className="text-2xl font-mono font-black text-emerald-400 mt-0.5 block">
                  {activeResult.officialTimeFormatted}
                </span>
              </div>
            </div>
            {activeResult.rankOverall && (
              <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center gap-4 text-xs">
                <span className="text-slate-300">
                  Algemeen Klassement: <strong className="text-white">#{activeResult.rankOverall}</strong>
                </span>
                {activeResult.rankCategory && (
                  <span className="text-slate-300">
                    Categorie ({activeResult.categoryName}):{' '}
                    <strong className="text-white">#{activeResult.rankCategory}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Shooting Rounds Splits */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-amber-400" /> Schietbeurten
            </h4>
            {activeResult.shootingRounds.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-800/40 rounded-lg">
                Nog geen schietbeurten geregistreerd
              </p>
            ) : (
              <div className="space-y-2">
                {activeResult.shootingRounds.map((sr, sIdx) => (
                  <div
                    key={sr.id ? `modal-sr-${sr.id}` : `modal-sr-${activeResult.participantId}-${sr.round}-${sIdx}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-700 font-bold flex items-center justify-center text-slate-300">
                        {sr.round}
                      </span>
                      <div>
                        <span className="font-semibold text-white block">
                          Ronde {sr.round} ({sr.station})
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatLocalTime(sr.timestamp, true)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-emerald-400 font-bold">{sr.hits}/5 Treffers</span>
                        <span className="text-slate-500 mx-1">•</span>
                        <span className="text-red-400 font-bold">{sr.misses} Missers</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Override / Correction Form (Req 44) */}
          <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-400" /> Manuele Correctie
              </h4>
              {!isEditingStatus && (
                <button
                  onClick={() => setIsEditingStatus(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium underline"
                >
                  Status Wijzigen
                </button>
              )}
            </div>

            {isEditingStatus ? (
              <div className="space-y-3 mt-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Nieuwe Status:</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as ParticipantStatus)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="FINISHED">FINISHED (Gefinisht)</option>
                    <option value="STARTED">STARTED (Onderweg)</option>
                    <option value="READY">READY (Klaar voor start)</option>
                    <option value="DNF">DNF (Did Not Finish)</option>
                    <option value="DNS">DNS (Did Not Start)</option>
                    <option value="DSQ">DSQ (Gediskwalificeerd)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    Reden van wijziging <span className="text-red-400">*</span>:
                  </label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="bv. Foutieve finish registratie gecorrigeerd"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setIsEditingStatus(false);
                      setError(null);
                    }}
                    className="px-3 py-1.5 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={handleStatusChange}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded text-xs bg-blue-600 text-white font-bold hover:bg-blue-500"
                  >
                    {isSaving ? 'Opslaan...' : 'Wijziging Toepassen & Loggen'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Huidige status: <span className="font-semibold text-white">{activeResult.status}</span>
                {activeResult.statusReason && <span className="text-slate-400"> ({activeResult.statusReason})</span>}
              </p>
            )}
          </div>

          {/* Audit History Log (Req 34) */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-slate-400" /> Audit Historie
            </h4>
            {relevantAudits.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Geen specifieke audit events</p>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-800">
                {relevantAudits.map((a) => (
                  <div key={`modal-audit-${a.id}`} className="text-slate-400">
                    <span className="text-slate-500">{formatLocalTime(a.timestamp, true)}</span> •{' '}
                    <span className="text-amber-400 font-semibold">{a.action}</span> •{' '}
                    <span className="text-slate-300">{a.details}</span>{' '}
                    <span className="text-slate-500">[{a.deviceId} / {a.operator}]</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );
};
