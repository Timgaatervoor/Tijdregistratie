import React, { useEffect, useState } from 'react';
import { FolderOpen, HardDriveDownload } from 'lucide-react';
import type { RaceEvent } from '../types';
import { createFullSnapshot } from '../services/backupService';
import { syncStyles as ui } from './syncSettingsStyles';

async function localRequest(action: string, body?: unknown) {
  const response = await fetch(`/api/local-backup/${action}`, {
    method: action === 'status' ? 'GET' : 'POST',
    headers: { 'X-Local-Backup': '1', 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Start de lokale programmamap om deze functie te gebruiken.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Lokale back-upactie mislukt.');
  return result;
}

export function LocalBackupPanel({ event }: { event: RaceEvent | null }) {
  const [paths, setPaths] = useState<{ directory: string; projectDirectory: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) { setChecked(true); return; }
    void localRequest('status').then(value => { if (active) setPaths(value); })
      .catch(() => {}).finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, []);
  const run = async (action: 'save' | 'open' | 'open-project') => {
    setBusy(true); setMessage('');
    try {
      if (action === 'save') {
        if (!event) throw new Error('Maak eerst een evenement aan.');
        const result = await localRequest('save', await createFullSnapshot(event));
        setMessage(`Back-up opgeslagen: ${result.path}`);
      } else {
        await localRequest(action);
        setMessage('De map is geopend in de bestandsverkenner.');
      }
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  return <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-sm text-slate-300">
    <h3 className="font-bold text-white">Lokale back-upmap</h3>
    <p>Bewaar handmatig een volledige back-up in de map backups bij het programma. Elke back-up krijgt een eigen bestand. Via de downloadknop hierboven kun je ook een kopie op USB bewaren.</p>
    {paths ? <>
      <p className="break-all">Back-upmap: <span className="font-mono">{paths.directory}</span></p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || !event} className={ui.primary} onClick={() => void run('save')}><HardDriveDownload className="w-4 h-4" />Back-up in map opslaan</button>
        <button type="button" disabled={busy} className={ui.secondary} onClick={() => void run('open')}><FolderOpen className="w-4 h-4" />Back-upmap openen</button>
        <button type="button" disabled={busy} className={ui.secondary} onClick={() => void run('open-project')}><FolderOpen className="w-4 h-4" />Programmamap openen</button>
      </div>
      <p className="text-xs">Gebruik hieronder ‘Bestand kiezen’ om een JSON-bestand uit deze map te herstellen.</p>
    </> : <p>{checked ? 'Start de app via start-windows.bat of start-mac-linux.sh en open localhost om mappen te openen en rechtstreeks op te slaan. In de online app gebruik je de downloadknop; de browser bepaalt de downloadmap.' : 'Lokale back-upmap controleren...'}</p>}
    {message && <p role="status" className="text-amber-300 break-all">{message}</p>}
  </section>;
}
