import React, { useState } from 'react';
import type { UserRole } from '../types';
import { createDeviceInvite, readDeviceInvite, joinEvent } from '../services/devicePairing';
import { RealQrCode } from './RealQrCode';
import setupSql from '../../supabase/reliability.sql?raw';

export function DevicePairingPanel({ initialLink = '', onJoined }: { initialLink?: string; onJoined: () => void }) {
  const [input, setInput] = useState(initialLink);
  const [invitation, setInvitation] = useState<{ link: string; code: string }>();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof readDeviceInvite>>>();
  const [role, setRole] = useState<UserRole>('FINISH_OPERATOR');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMessage(''); try { await fn(); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } };
  return <section className="p-4 bg-slate-900 rounded-xl border border-slate-700 text-white space-y-3">
    <h3 className="font-bold">Toestel koppelen aan evenement</h3>
    <details><summary>Eenmalige serverinstelling</summary><p className="text-sm">Voer deze SQL één keer uit in de SQL-editor van jouw Supabase-project. Daarna gebruiken alle pc’s dezelfde tijdserver en koppelcodes.</p><textarea readOnly aria-label="SQL voor centrale tijd en koppelen" className="w-full h-40 bg-slate-800 text-xs p-2" value={setupSql} /></details>
    <fieldset disabled={busy} className="space-y-3">
      <button className="bg-blue-600 rounded px-3 py-2" onClick={() => run(async () => { setInvitation(await createDeviceInvite()); })}>Koppeling voor nieuw toestel maken</button>
      {invitation && <div className="space-y-2"><RealQrCode value={invitation.link} size={240} /><p>Geldig gedurende 10 minuten, voor één nieuw toestel. Scan de QR-code of open de volledige link op de andere pc.</p><textarea readOnly aria-label="Koppellink" value={invitation.link} className="bg-slate-800 w-full p-2 text-xs" /><p className="break-all text-xs">Code voor een pc waarop dit Supabase-project al ingesteld is: {invitation.code}</p></div>}
      <label className="block">Dit toestel toevoegen<input aria-label="Koppellink of code" value={input} onChange={e => { setInput(e.target.value); setPreview(undefined); }} placeholder="Plak koppellink of code" className="block w-full bg-slate-800 rounded p-2" /></label>
      <button className="bg-slate-700 rounded px-3 py-2" disabled={!input.trim()} onClick={() => run(async () => { setPreview(await readDeviceInvite(input)); setInput(''); history.replaceState(null, '', location.pathname + location.search); })}>Evenement ophalen en bekijken</button>
      {preview && <div className="space-y-2"><p><strong>{preview.snapshot.data.event.name}</strong> · {preview.snapshot.data.event.date} · {preview.snapshot.data.participants.length} deelnemers · {preview.snapshot.data.waves.length} startgroepen.</p><label>Post<select value={role} onChange={e => setRole(e.target.value as UserRole)} className="bg-slate-800 p-2 ml-2"><option value="START_OPERATOR">Start</option><option value="SHOOTING_OPERATOR">Schieten</option><option value="FINISH_OPERATOR">Finish</option><option value="VIEWER">Scorebord</option></select></label><p className="text-amber-300 text-sm">Dit vervangt het lokale evenement. Eerst wordt automatisch een lokale back-up bewaard.</p><button className="bg-emerald-600 rounded px-3 py-2" onClick={() => run(async () => { await joinEvent(preview, role); setPreview(undefined); setMessage('Toestel gekoppeld.'); onJoined(); })}>Dit evenement gebruiken op deze pc</button></div>}
    </fieldset>
    {message && <p role="status" className="text-amber-300">{message}</p>}
  </section>;
}
