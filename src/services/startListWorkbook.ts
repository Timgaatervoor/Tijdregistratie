import * as XLSX from 'xlsx';
import type { Participant, Wave } from '../types';
import type { WorkbookData } from './eventWorkbook';

export type StartListColumnKey =
  | 'waveNumber'
  | 'waveName'
  | 'startTime'
  | 'bibNumber'
  | 'firstName'
  | 'lastName'
  | 'category'
  | 'club'
  | 'team'
  | 'article'
  | 'notes';

export type StartListSortKey = 'wave' | 'startTime' | 'bibNumber' | 'name' | 'club';
export type StartListSortDirection = 'asc' | 'desc';

export interface StartListOptions {
  columns: StartListColumnKey[];
  search?: string;
  sortBy?: StartListSortKey;
  sortDirection?: StartListSortDirection;
}

export interface StartListEntry {
  participant: Participant;
  wave?: Wave;
  categoryName: string;
}

export const START_LIST_COLUMNS: ReadonlyArray<{ key: StartListColumnKey; label: string; width: number }> = [
  { key: 'waveNumber', label: 'Wave nr.', width: 12 },
  { key: 'waveName', label: 'Startgroep (wave)', width: 24 },
  { key: 'startTime', label: 'Starttijd', width: 14 },
  { key: 'bibNumber', label: 'Borstnummer', width: 14 },
  { key: 'firstName', label: 'Voornaam', width: 22 },
  { key: 'lastName', label: 'Achternaam', width: 24 },
  { key: 'category', label: 'Categorie', width: 22 },
  { key: 'club', label: 'Club / School', width: 28 },
  { key: 'team', label: 'Team / Ploeg', width: 24 },
  { key: 'article', label: 'Artikel', width: 26 },
  { key: 'notes', label: 'Notities / Opmerkingen', width: 36 },
];

export const DEFAULT_START_LIST_COLUMNS: StartListColumnKey[] = [
  'waveNumber',
  'waveName',
  'startTime',
  'bibNumber',
  'firstName',
  'lastName',
];

const collator = new Intl.Collator('nl-BE', { numeric: true, sensitivity: 'base' });
const normalized = (value: unknown) => String(value ?? '').trim();

export function displayStartTime(value: string | undefined) {
  const raw = normalized(value);
  const isoTime = raw.match(/T(\d{2}:\d{2}(?::\d{2})?)/)?.[1];
  return isoTime ?? raw;
}

function valueFor(entry: StartListEntry, key: StartListColumnKey): string | number {
  const { participant, wave, categoryName } = entry;
  switch (key) {
    case 'waveNumber': return wave?.waveNumber ?? '';
    case 'waveName': return wave?.name ?? '';
    case 'startTime': return displayStartTime(wave?.scheduledStartTime);
    case 'bibNumber': return participant.bibNumber ?? '';
    case 'firstName': return participant.firstName;
    case 'lastName': return participant.lastName;
    case 'category': return categoryName;
    case 'club': return participant.club ?? '';
    case 'team': return participant.team ?? '';
    case 'article': {
      const sourceProduct = participant.stamhoofdRegistration?.product;
      return participant.article ?? (typeof sourceProduct === 'string' ? sourceProduct : '');
    }
    case 'notes': return participant.notes ?? '';
  }
}

function compareText(a: unknown, b: unknown) {
  return collator.compare(normalized(a), normalized(b));
}

function compareOptionalNumber(a: number | undefined, b: number | undefined) {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

function compareEntries(a: StartListEntry, b: StartListEntry, sortBy: StartListSortKey) {
  let result = 0;
  if (sortBy === 'wave') {
    result = compareOptionalNumber(a.wave?.waveNumber, b.wave?.waveNumber)
      || compareText(displayStartTime(a.wave?.scheduledStartTime), displayStartTime(b.wave?.scheduledStartTime));
  } else if (sortBy === 'startTime') {
    result = compareText(displayStartTime(a.wave?.scheduledStartTime), displayStartTime(b.wave?.scheduledStartTime))
      || compareOptionalNumber(a.wave?.waveNumber, b.wave?.waveNumber);
  } else if (sortBy === 'bibNumber') {
    result = compareOptionalNumber(a.participant.bibNumber, b.participant.bibNumber);
  } else if (sortBy === 'name') {
    result = compareText(a.participant.lastName, b.participant.lastName)
      || compareText(a.participant.firstName, b.participant.firstName);
  } else {
    result = compareText(a.participant.club, b.participant.club);
  }
  return result
    || compareOptionalNumber(a.participant.bibNumber, b.participant.bibNumber)
    || compareText(a.participant.lastName, b.participant.lastName)
    || compareText(a.participant.firstName, b.participant.firstName);
}

export function selectStartListEntries(data: WorkbookData, options: StartListOptions): StartListEntry[] {
  const waves = new Map(data.waves.map(wave => [wave.id, wave]));
  const categories = new Map(data.categories.map(category => [category.id, category.name]));
  const query = normalized(options.search).toLocaleLowerCase('nl-BE');
  const entries = data.participants.map(participant => ({
    participant,
    wave: participant.waveId ? waves.get(participant.waveId) : undefined,
    categoryName: categories.get(participant.categoryId) ?? '',
  }));
  const filtered = query ? entries.filter(entry => START_LIST_COLUMNS.some(column => normalized(valueFor(entry, column.key)).toLocaleLowerCase('nl-BE').includes(query))) : entries;
  const direction = options.sortDirection === 'desc' ? -1 : 1;
  const sortBy = options.sortBy ?? 'wave';
  const missingSortValue = (entry: StartListEntry) => {
    if (sortBy === 'wave') return entry.wave?.waveNumber === undefined;
    if (sortBy === 'startTime') return !displayStartTime(entry.wave?.scheduledStartTime);
    if (sortBy === 'bibNumber') return entry.participant.bibNumber === undefined;
    if (sortBy === 'name') return !entry.participant.lastName && !entry.participant.firstName;
    return !entry.participant.club;
  };
  return filtered.sort((a, b) => {
    const aMissing = missingSortValue(a);
    const bMissing = missingSortValue(b);
    if (aMissing !== bMissing) return aMissing ? 1 : -1;
    return direction * compareEntries(a, b, sortBy);
  });
}

export function buildStartListTable(data: WorkbookData, options: StartListOptions) {
  const selected = options.columns.map(key => START_LIST_COLUMNS.find(column => column.key === key)).filter((column): column is (typeof START_LIST_COLUMNS)[number] => !!column);
  const entries = selectStartListEntries(data, options);
  return {
    headers: selected.map(column => column.label),
    rows: entries.map(entry => selected.map(column => valueFor(entry, column.key))),
    entries,
  };
}

export function buildStartListWorkbook(data: WorkbookData, options: StartListOptions) {
  const table = buildStartListTable(data, options);
  if (!table.headers.length) throw new Error('Kies minstens één kolom voor de startlijst.');
  const book = XLSX.utils.book_new();
  const info = XLSX.utils.aoa_to_sheet([
    ['Startlijst', data.event.name],
    ['Datum', data.event.date],
    ['Locatie', data.event.location ?? ''],
    ['Aantal deelnemers', table.rows.length],
    ['Aangemaakt op', new Date().toLocaleString('nl-BE')],
  ]);
  info['!cols'] = [{ wch: 22 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(book, info, 'Info');

  const startList = XLSX.utils.aoa_to_sheet([table.headers, ...table.rows]);
  startList['!cols'] = options.columns.map(key => ({ wch: START_LIST_COLUMNS.find(column => column.key === key)?.width ?? 20 }));
  startList['!autofilter'] = { ref: startList['!ref'] ?? `A1:${XLSX.utils.encode_col(table.headers.length - 1)}1` };
  startList['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0 };
  startList['!margins'] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  XLSX.utils.book_append_sheet(book, startList, 'Startlijst');
  return book;
}

export function downloadStartListWorkbook(data: WorkbookData, options: StartListOptions) {
  const date = normalized(data.event.date) || new Date().toISOString().slice(0, 10);
  XLSX.writeFile(buildStartListWorkbook(data, options), `startlijst-waves-${date}.xlsx`);
}
