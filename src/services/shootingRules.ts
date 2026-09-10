import type { RaceProfile, ShootingResult } from '../types';

export function normalizeShootingRound(round: number, shootingRoundCount: number): number {
  const count = Math.max(1, Math.floor(Number.isFinite(shootingRoundCount) ? shootingRoundCount : 1));
  return Math.max(1, Math.min(Math.floor(Number.isFinite(round) ? round : 1), count));
}

export function shootingHitPresets(targetCount: number): number[] {
  const count = Math.max(1, Math.min(10, Math.floor(Number.isFinite(targetCount) ? targetCount : 5)));
  return Array.from({ length: count + 1 }, (_, index) => count - index);
}

export function effectiveShooting(records: ShootingResult[]) {
  const grouped = new Map<string, ShootingResult[]>();
  for (const r of records.filter(r => !r.isCorrected)) {
    const key = JSON.stringify([r.eventId, r.participantId, r.round]);
    grouped.set(key, [...(grouped.get(key) ?? []), r]);
  }
  const issues = new Set<string>();
  const effective = [...grouped.values()].map(group => {
    const superseded = new Set(group.flatMap(r => r.supersedesIds ?? []));
    const current = group.filter(r => !superseded.has(r.id));
    // Legacy corrections have no explicit predecessor: use the latest correction.
    const corrections = current.filter(r => r.isCorrection && r.supersedesIds === undefined);
    const candidates = corrections.length ? corrections : current;
    if (current.length > 1 && !corrections.length) issues.add(group[0].participantId);
    return candidates.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id))[0];
  }).filter(Boolean);
  return { effective, issues };
}
export function shootingPenalty(profile: RaceProfile | undefined, round: number, misses: number, fallback = 20) {
  const leg = profile?.legs.filter(l => l.type === 'SHOOT')[round - 1];
  const type = leg?.penaltyType ?? profile?.penaltyType ?? 'time';
  const value = leg?.penaltyValueSeconds ?? profile?.penaltySecondsPerMiss ?? fallback;
  const laps = type === 'lap' ? misses * (leg?.penaltyLapsPerMiss ?? profile?.penaltyLapsPerMiss ?? 1) : 0;
  const lapDistanceMeters = profile?.penaltyLapDistanceMeters ?? 0;
  return {
    type,
    seconds: type === 'time' ? misses * value : type === 'fixed' && misses > 0 ? value : 0,
    laps,
    lapDistanceMeters,
    totalLapDistanceMeters: laps * lapDistanceMeters,
  };
}
