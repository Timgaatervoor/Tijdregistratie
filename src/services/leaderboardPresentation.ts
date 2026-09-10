import type { RaceResult } from '../types';

export interface TvKioskConfig {
  showPodium: boolean;
  showClock: boolean;
  rotateCategories: boolean;
  categoryIds: string[];
  rotationSeconds: number;
  textScale: 'normal' | 'large' | 'extra-large' | 'jumbo-tv';
  theme: 'dark' | 'daylight';
  pageSize: number;
  autoPaginate: boolean;
  kioskPin: string;
}

export const KIOSK_PAGE_SIZES = [5, 8, 10, 12, 15, 16, 20, 25, 30, 40, 50] as const;

// The storage key and all existing preferences remain compatible.
export function readTvKioskConfig(value: unknown): TvKioskConfig {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    showPodium: stored.showPodium !== false,
    showClock: stored.showClock !== false,
    rotateCategories: stored.rotateCategories === true,
    categoryIds: Array.isArray(stored.categoryIds) ? stored.categoryIds.filter((id): id is string => typeof id === 'string') : [],
    rotationSeconds: [10, 15, 20, 30, 60].includes(Number(stored.rotationSeconds)) ? Number(stored.rotationSeconds) : 15,
    textScale: ['normal', 'large', 'extra-large', 'jumbo-tv'].includes(String(stored.textScale)) ? stored.textScale as TvKioskConfig['textScale'] : 'large',
    theme: stored.theme === 'daylight' ? 'daylight' : 'dark',
    pageSize: (stored.pageSize === 0 || KIOSK_PAGE_SIZES.includes(stored.pageSize as typeof KIOSK_PAGE_SIZES[number]))
      ? stored.pageSize as number
      : 12,
    autoPaginate: stored.autoPaginate !== false,
    kioskPin: typeof stored.kioskPin === 'string' ? stored.kioskPin.trim().slice(0, 6) : '',
  };
}

export function leaderboardPage<T>(rows: T[], pageSize: number, currentPage: number) {
  const size = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : rows.length || 1;
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const page = Math.max(0, Math.min(Number.isFinite(currentPage) ? Math.floor(currentPage) : 0, totalPages - 1));
  return { page, totalPages, size, rows: rows.slice(page * size, (page + 1) * size) };
}

export function nextLeaderboardSlide(categoryId: string, page: number, totalPages: number,
  categoryIds: string[], rotateCategories: boolean, autoPaginate: boolean) {
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  if (autoPaginate && safePage < totalPages - 1) return { categoryId, page: safePage + 1 };
  if (rotateCategories && categoryIds.length) {
    return { categoryId: categoryIds[(categoryIds.indexOf(categoryId) + 1) % categoryIds.length], page: 0 };
  }
  return { categoryId, page: autoPaginate ? 0 : safePage };
}

export function rotationCategories(availableIds: string[], configuredIds: string[], visibleRows: RaceResult[]) {
  const configured = configuredIds.filter(id => availableIds.includes(id));
  return (configured.length ? configured : availableIds).filter(id => visibleRows.some(row => row.categoryId === id));
}

export function leaderboardSummary(rows: RaceResult[]) {
  return {
    finished: rows.filter(row => row.status === 'FINISHED').length,
    onCourse: rows.filter(row => row.status === 'STARTED').length,
    // A recorded shooting round does not prove the athlete is still on the range.
    shootingRecorded: rows.filter(row => row.status === 'STARTED' && row.shootingRounds.length > 0).length,
    waiting: rows.filter(row => ['REGISTERED', 'READY', 'CHECKED_IN'].includes(row.status)).length,
  };
}
