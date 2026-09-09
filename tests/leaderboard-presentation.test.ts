import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTvKioskConfig, leaderboardPage, nextLeaderboardSlide, rotationCategories, leaderboardSummary } from '../src/services/leaderboardPresentation';
import type { RaceResult } from '../src/types';

const result = (id: number, categoryId = 'a', status: RaceResult['status'] = 'FINISHED'): RaceResult => ({
  participantId: String(id), bibNumber: id, name: `Atleet ${id}`, categoryId, categoryName: categoryId,
  waveName: '', gender: 'F', status, rawElapsedFormatted: '', shootingRounds: [], totalMisses: 0,
  penaltySeconds: 0, penaltyFormatted: '', officialTimeFormatted: '', rankOverall: id,
});

test('existing kiosk preferences survive new defaults and malformed storage', () => {
  const legacy = { showPodium: false, showClock: false, rotateCategories: true, categoryIds: ['b'], rotationSeconds: 30, textScale: 'extra-large' };
  const config = readTvKioskConfig(legacy);
  for (const key of Object.keys(legacy)) assert.deepEqual(config[key], legacy[key]);
  assert.equal(config.autoPaginate, true);
  assert.equal(config.pageSize, 12);
  assert.equal(config.theme, 'dark');
  assert.deepEqual(readTvKioskConfig(null), readTvKioskConfig({}));
  assert.deepEqual(readTvKioskConfig('invalid'), readTvKioskConfig({}));
  for (const pageSize of [-1, 0.5, NaN, Infinity, '12', 999]) {
    assert.equal(readTvKioskConfig({ pageSize }).pageSize, 12);
  }
  const saved = readTvKioskConfig({ ...config, pageSize: 0, theme: 'daylight', autoPaginate: false, kioskPin: '001234' });
  assert.deepEqual(readTvKioskConfig(JSON.parse(JSON.stringify(saved))), saved);
});

test('pagination shows every row once without mutating ranks or ordering', () => {
  const rows = Array.from({ length: 25 }, (_, i) => result(i + 1));
  const before = structuredClone(rows);
  const pages = [0, 1, 2].map(page => leaderboardPage(rows, 12, page));
  assert.deepEqual(pages.map(page => page.rows.length), [12, 12, 1]);
  assert.deepEqual(pages.flatMap(page => page.rows), rows);
  assert.equal(pages[1].rows[0].rankOverall, 13);
  assert.deepEqual(rows, before);
  assert.deepEqual(leaderboardPage(rows, 0, 2).rows, rows, 'normal view / no paging retains all rows');
});

test('empty, shrinking, growing and reordered live results always produce a valid page', () => {
  assert.deepEqual(leaderboardPage([], 12, 99), { page: 0, totalPages: 1, size: 12, rows: [] });
  const rows = Array.from({ length: 25 }, (_, i) => result(i + 1));
  assert.equal(leaderboardPage(rows, 12, -1).page, 0);
  const shrunk = leaderboardPage(rows.slice(0, 13), 12, 2);
  assert.equal(shrunk.page, 1);
  assert.equal(shrunk.rows[0].participantId, '13');
  const grown = leaderboardPage(rows, 12, shrunk.page);
  assert.equal(grown.page, 1);
  assert.equal(grown.rows.length, 12);
  assert.equal(leaderboardPage([...rows].reverse(), 12, 1).rows[0].participantId, '13');
});

test('rotation displays all pages before switching categories and wraps around', () => {
  const ids = ['a', 'b'];
  const first = nextLeaderboardSlide('a', 0, 3, ids, true, true);
  const second = nextLeaderboardSlide(first.categoryId, first.page, 3, ids, true, true);
  const third = nextLeaderboardSlide(second.categoryId, second.page, 3, ids, true, true);
  assert.deepEqual(first, { categoryId: 'a', page: 1 });
  assert.deepEqual(second, { categoryId: 'a', page: 2 });
  assert.deepEqual(third, { categoryId: 'b', page: 0 });
  assert.deepEqual(nextLeaderboardSlide('b', 0, 1, ids, true, true), { categoryId: 'a', page: 0 });
  assert.deepEqual(nextLeaderboardSlide('deleted', 0, 1, ids, true, true), { categoryId: 'a', page: 0 });
});

test('page rotation works without category rotation, and both switches are respected', () => {
  assert.deepEqual(nextLeaderboardSlide('ALL', 0, 2, [], false, true), { categoryId: 'ALL', page: 1 });
  assert.deepEqual(nextLeaderboardSlide('ALL', 1, 2, [], false, true), { categoryId: 'ALL', page: 0 });
  assert.deepEqual(nextLeaderboardSlide('a', 0, 3, ['a', 'b'], true, false), { categoryId: 'b', page: 0 });
  assert.deepEqual(nextLeaderboardSlide('a', 1, 3, ['a', 'b'], false, false), { categoryId: 'a', page: 1 });
  assert.deepEqual(nextLeaderboardSlide('ALL', 0, 1, [], true, true), { categoryId: 'ALL', page: 0 });
});

test('rotation skips empty categories and respects chosen categories under changing filters', () => {
  const rows = [result(1, 'a'), result(2, 'b')];
  assert.deepEqual(rotationCategories(['a', 'b', 'empty'], [], rows), ['a', 'b']);
  assert.deepEqual(rotationCategories(['a', 'b'], ['b'], rows), ['b']);
  assert.deepEqual(rotationCategories(['a', 'b'], ['b'], rows.slice(0, 1)), []);
  assert.deepEqual(rotationCategories(['a', 'b'], ['b'], rows), ['b'], 'chosen category returns when visible again');
  assert.deepEqual(rotationCategories(['a'], ['deleted'], rows), ['a']);
  assert.deepEqual(rotationCategories([], [], []), []);
});

test('status totals cover the entire selection and update with new results', () => {
  const shooting = { round: 1, hits: 5, misses: 0, timestamp: '', station: '' };
  const rows = [result(1), result(2, 'a', 'STARTED'), { ...result(3, 'a', 'STARTED'), shootingRounds: [shooting, shooting] },
    result(4, 'a', 'READY'), result(5, 'a', 'REGISTERED'), result(6, 'a', 'CHECKED_IN'), result(7, 'a', 'DNF')];
  assert.deepEqual(leaderboardSummary(rows), { finished: 1, onCourse: 2, shootingRecorded: 1, waiting: 3 });
  rows[2].status = 'FINISHED';
  assert.deepEqual(leaderboardSummary(rows), { finished: 2, onCourse: 1, shootingRecorded: 0, waiting: 3 });
  assert.deepEqual(leaderboardSummary([]), { finished: 0, onCourse: 0, shootingRecorded: 0, waiting: 0 });
});
