import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import type { WorkbookData } from '../src/services/eventWorkbook';
import { buildStartListTable, buildStartListWorkbook } from '../src/services/startListWorkbook';

const data: WorkbookData = {
  event: { id: 'event', name: 'De Duinenloop', date: '2026-09-19', location: 'De Haan', organizer: 'Test', status: 'READY' } as any,
  profiles: [],
  categories: [
    { id: 'adult', code: 'adult', name: 'Volwassenen', gender: 'ALL', raceProfileIds: [] },
    { id: 'youth', code: 'youth', name: 'Jeugd', gender: 'ALL', raceProfileIds: [] },
  ],
  waves: [
    { id: 'wave-2', eventId: 'event', name: 'Tweede wave', waveNumber: 2, scheduledStartTime: '10:15:00', categoryIds: [], maxParticipants: 25, status: 'SCHEDULED' },
    { id: 'wave-1', eventId: 'event', name: 'Eerste wave', waveNumber: 1, scheduledStartTime: '10:00:00', categoryIds: [], maxParticipants: 25, status: 'SCHEDULED' },
  ],
  participants: [
    { id: 'two', firstName: 'Zoë', lastName: 'Peeters', categoryId: 'adult', raceProfileId: '', waveId: 'wave-2', bibNumber: 20, club: 'Noordclub', team: 'Ploeg Noord', article: 'Lang', notes: 'Brengt materiaal mee', status: 'READY', createdAt: '', updatedAt: '' },
    { id: 'one', firstName: 'Ana', lastName: 'De Smet', categoryId: 'youth', raceProfileId: '', waveId: 'wave-1', bibNumber: 10, club: 'Zuidclub', status: 'READY', createdAt: '', updatedAt: '' },
    { id: 'unassigned', firstName: 'Bram', lastName: 'Claes', categoryId: 'adult', raceProfileId: '', status: 'READY', createdAt: '', updatedAt: '' },
  ],
};

test('startlijst gebruikt alleen gekozen kolommen en sorteert toegewezen waves eerst', () => {
  const table = buildStartListTable(data, {
    columns: ['waveName', 'startTime', 'bibNumber'],
    sortBy: 'wave',
    sortDirection: 'asc',
  });
  assert.deepEqual(table.headers, ['Startgroep (wave)', 'Starttijd', 'Borstnummer']);
  assert.deepEqual(table.rows, [
    ['Eerste wave', '10:00:00', 10],
    ['Tweede wave', '10:15:00', 20],
    ['', '', ''],
  ]);
});

test('zoeken controleert alle deelnemersvelden, ook wanneer die kolom niet wordt gedeeld', () => {
  const table = buildStartListTable(data, {
    columns: ['bibNumber', 'firstName', 'lastName'],
    search: 'ploeg noord',
    sortBy: 'name',
  });
  assert.equal(table.rows.length, 1);
  assert.deepEqual(table.rows[0], [20, 'Zoë', 'Peeters']);
});

test('aflopend sorteren houdt ontbrekende borstnummers onderaan', () => {
  const table = buildStartListTable(data, {
    columns: ['bibNumber'],
    sortBy: 'bibNumber',
    sortDirection: 'desc',
  });
  assert.deepEqual(table.rows, [[20], [10], ['']]);
});

test('Excel-startlijst bevat informatie, deelbare rijen en filters', () => {
  const book = buildStartListWorkbook(data, {
    columns: ['waveNumber', 'startTime', 'bibNumber', 'lastName'],
    search: 'club',
    sortBy: 'startTime',
    sortDirection: 'asc',
  });
  assert.deepEqual(book.SheetNames, ['Info', 'Startlijst']);
  const rows = XLSX.utils.sheet_to_json<any[]>(book.Sheets.Startlijst, { header: 1, defval: '' });
  assert.deepEqual(rows, [
    ['Wave nr.', 'Starttijd', 'Borstnummer', 'Achternaam'],
    [1, '10:00:00', 10, 'De Smet'],
    [2, '10:15:00', 20, 'Peeters'],
  ]);
  assert.equal(book.Sheets.Startlijst['!autofilter']?.ref, 'A1:D3');
  assert.throws(() => buildStartListWorkbook(data, { columns: [] }), /minstens één kolom/);
});
