import React, { useMemo, useState } from 'react';
import { ArrowDownAZ, Download, Search } from 'lucide-react';
import type { WorkbookData } from '../services/eventWorkbook';
import {
  buildStartListTable,
  DEFAULT_START_LIST_COLUMNS,
  downloadStartListWorkbook,
  START_LIST_COLUMNS,
  type StartListColumnKey,
  type StartListSortDirection,
  type StartListSortKey,
} from '../services/startListWorkbook';
import { syncStyles as ui } from './syncSettingsStyles';

const sortOptions: Array<{ value: StartListSortKey; label: string }> = [
  { value: 'wave', label: 'Wave nummer' },
  { value: 'startTime', label: 'Starttijd' },
  { value: 'bibNumber', label: 'Borstnummer' },
  { value: 'name', label: 'Naam' },
  { value: 'club', label: 'Club / school' },
];

export function StartListExportPanel({ data }: { data?: WorkbookData }) {
  const [columns, setColumns] = useState<StartListColumnKey[]>(DEFAULT_START_LIST_COLUMNS);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<StartListSortKey>('wave');
  const [sortDirection, setSortDirection] = useState<StartListSortDirection>('asc');
  const [error, setError] = useState('');
  const options = useMemo(() => ({ columns, search, sortBy, sortDirection }), [columns, search, sortBy, sortDirection]);
  const table = useMemo(() => data ? buildStartListTable(data, options) : undefined, [data, options]);

  const toggleColumn = (key: StartListColumnKey) => {
    setColumns(current => {
      const selected = new Set(current);
      if (selected.has(key)) selected.delete(key); else selected.add(key);
      return START_LIST_COLUMNS.filter(column => selected.has(column.key)).map(column => column.key);
    });
    setError('');
  };

  const exportWorkbook = () => {
    if (!data) return;
    if (!columns.length) {
      setError('Kies minstens één kolom voor de startlijst.');
      return;
    }
    setError('');
    downloadStartListWorkbook(data, options);
  };

  return <section className="space-y-4 border-t border-slate-800 pt-5" aria-labelledby="start-list-export-title">
    <div>
      <h4 id="start-list-export-title" className="font-bold text-white text-sm">Startlijst delen</h4>
      <p className="mt-1 text-slate-400">Maak een apart Excel-bestand met waves, starttijden en borstnummers. Kies zelf welke extra kolommen meegaan.</p>
    </div>

    <fieldset disabled={!data} className="space-y-4">
      <legend className="font-bold text-slate-200 mb-2">Kolommen in het bestand</legend>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {START_LIST_COLUMNS.map(column => <label key={column.key} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-200 hover:border-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 accent-amber-500"
            checked={columns.includes(column.key)}
            onChange={() => toggleColumn(column.key)}
          />
          <span>{column.label}</span>
        </label>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={ui.secondary} onClick={() => setColumns(START_LIST_COLUMNS.map(column => column.key))}>Alles aanvinken</button>
        <button type="button" className={ui.secondary} onClick={() => setColumns([])}>Alles uitvinken</button>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.5fr)_auto]">
        <label className="space-y-1">
          <span className="font-bold text-slate-200">Zoeken in deelnemers</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className={`${ui.input} pl-10`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Naam, wave, borstnummer, club..." />
          </span>
        </label>
        <label className="space-y-1">
          <span className="font-bold text-slate-200">Sorteren op</span>
          <select className={ui.input} value={sortBy} onChange={event => setSortBy(event.target.value as StartListSortKey)}>
            {sortOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="font-bold text-slate-200">Volgorde</span>
          <select className={ui.input} value={sortDirection} onChange={event => setSortDirection(event.target.value as StartListSortDirection)}>
            <option value="asc">Oplopend</option>
            <option value="desc">Aflopend</option>
          </select>
        </label>
      </div>
    </fieldset>

    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-slate-200">Voorbeeld · {table?.rows.length ?? 0} deelnemer{table?.rows.length === 1 ? '' : 's'}</p>
        <p className="text-slate-500"><ArrowDownAZ className="mr-1 inline h-4 w-4" />In Excel kan de ontvanger verder filteren en sorteren.</p>
      </div>
      {table && table.headers.length > 0 ? <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0 text-left">
          <thead><tr>{table.headers.map((header, index) => <th key={`${header}-${index}`} className="whitespace-nowrap border-b border-slate-700 px-3 py-2 text-slate-300">{header}</th>)}</tr></thead>
          <tbody>{table.rows.slice(0, 8).map((row, rowIndex) => <tr key={table.entries[rowIndex].participant.id}>{row.map((value, columnIndex) => <td key={columnIndex} className="whitespace-nowrap border-b border-slate-900 px-3 py-2 text-slate-400">{String(value)}</td>)}</tr>)}</tbody>
        </table>
        {table.rows.length > 8 && <p className="px-3 pt-2 text-slate-500">Voorbeeld toont de eerste 8 van {table.rows.length} deelnemers.</p>}
      </div> : <p className="text-amber-300">Vink minstens één kolom aan om het voorbeeld te tonen.</p>}
    </div>

    <button type="button" className={ui.primary} disabled={!data || !columns.length} onClick={exportWorkbook}>
      <Download className="h-4 w-4" />Startlijst exporteren
    </button>
    {!data && <p role="status" className="text-slate-400">De deelnemers en startgroepen worden geladen...</p>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
  </section>;
}
