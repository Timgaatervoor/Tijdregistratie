import React, { useEffect, useMemo, useState } from 'react';
import { Laptop, MessageSquare, Send, Wifi, WifiOff, X } from 'lucide-react';
import type { DeviceConfig } from '../types';
import { syncService } from '../services/syncService';
import { syncStyles as ui } from './syncSettingsStyles';

const roleLabels: Record<DeviceConfig['role'], string> = {
  ADMIN: 'Beheerder', RACE_DIRECTOR: 'Wedstrijdleider', REGISTRATION: 'Inschrijving',
  START_OPERATOR: 'Start', SHOOTING_OPERATOR: 'Schieten', FINISH_OPERATOR: 'Finish', VIEWER: 'Scorebord',
};

export function DeviceCommunicationModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [devices, setDevices] = useState(syncService.getOnlineDevices());
  const [messages, setMessages] = useState(syncService.getDeviceMessages());
  const [target, setTarget] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const health = syncService.getSyncHealth();
  const configured = syncService.getConfig().enabled;

  useEffect(() => {
    if (!isOpen) return;
    const update = () => { setDevices(syncService.getOnlineDevices()); setMessages(syncService.getDeviceMessages()); };
    update();
    const unsubscribe = syncService.subscribe(update);
    void syncService.syncNow().then(() => syncService.refreshPresence());
    return unsubscribe;
  }, [isOpen]);

  const deviceNames = useMemo(() => new Map(devices.map(device => [device.installationId, device.deviceId])), [devices]);
  if (!isOpen) return null;

  const send = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setStatus('');
    try {
      await syncService.sendDeviceMessage(text, target || undefined);
      setText(''); setStatus('Bericht verzonden naar de momenteel online ontvanger(s).');
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center overflow-y-auto bg-slate-950/85 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="device-communication-title">
    <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6 text-slate-200 shadow-2xl space-y-5 my-6">
      <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
        <div><h2 id="device-communication-title" className="flex items-center gap-2 text-lg font-bold text-white"><MessageSquare className="w-5 h-5 text-amber-400" />Toestellen & berichten</h2><p className="mt-1 text-xs text-slate-400">Actieve wedstrijdposten via de bestaande Supabase Realtime-verbinding.</p></div>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"><X className="w-4 h-4" /></button>
      </div>

      {!configured ? <p className="rounded-xl border border-amber-700/50 bg-amber-950/40 p-4 text-sm text-amber-300"><WifiOff className="inline w-4 h-4 mr-2" />Stel eerst Supabase in via Instellingen → Supabase.</p> : health.realtime !== 'connected' ? <p className="rounded-xl border border-amber-700/50 bg-amber-950/40 p-4 text-sm text-amber-300"><WifiOff className="inline w-4 h-4 mr-2" />Realtime maakt nog geen verbinding. Controleer Systeemstatus of probeer opnieuw te synchroniseren.</p> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-white">Online toestellen</h3><span className="text-xs text-emerald-400"><Wifi className="inline w-3.5 h-3.5 mr-1" />{devices.length} online</span></div>
        {devices.length ? <div className="grid gap-2 sm:grid-cols-2">{devices.map(device => <div key={device.installationId} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
          <span className="relative"><Laptop className="w-5 h-5 text-slate-300" /><span className="absolute -right-1 -bottom-1 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" /></span>
          <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{device.deviceId}</p><p className="truncate text-xs text-slate-400">{roleLabels[device.role]}{device.operatorName ? ` · ${device.operatorName}` : ''}{device.stationName ? ` · ${device.stationName}` : ''}</p></div>
        </div>)}</div> : <p className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-400">Nog geen toestellen zichtbaar. De lijst verschijnt zodra Realtime verbonden is.</p>}
      </section>

      <form onSubmit={send} className="space-y-3 border-t border-slate-800 pt-5">
        <h3 className="text-sm font-bold text-white">Bericht sturen</h3>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <label className="font-semibold">Ontvanger<select value={target} onChange={event => setTarget(event.target.value)} className={`${ui.input} mt-1.5`}><option value="">Alle online toestellen</option>{devices.map(device => <option key={device.installationId} value={device.installationId}>{device.deviceId}{device.operatorName ? ` — ${device.operatorName}` : ''}</option>)}</select></label>
          <label className="font-semibold">Bericht<input value={text} onChange={event => setText(event.target.value)} maxLength={500} placeholder="Kort bericht voor de wedstrijdpost" className={`${ui.input} mt-1.5`} /></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-slate-500">Berichten worden niet in de database opgeslagen en bereiken alleen toestellen die nu online zijn.</p><button type="submit" disabled={busy || !text.trim() || health.realtime !== 'connected'} className={ui.primary}><Send className="w-4 h-4" />{busy ? 'Verzenden…' : 'Versturen'}</button></div>
        {status && <p role="status" className="text-xs text-amber-300">{status}</p>}
      </form>

      <section className="space-y-3 border-t border-slate-800 pt-5"><h3 className="text-sm font-bold text-white">Berichten tijdens deze sessie</h3>{messages.length ? <div className="max-h-56 space-y-2 overflow-y-auto pr-1">{[...messages].reverse().map(message => <article key={message.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="flex flex-wrap justify-between gap-2 text-[11px] text-slate-400"><strong className="text-amber-300">{message.senderDeviceId} · {message.senderName}</strong><span>{new Date(message.sentAt).toLocaleTimeString('nl-BE')}</span></div><p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-white">{message.text}</p>{message.targetInstallationId && <p className="mt-1 text-[10px] text-slate-500">Privé naar {deviceNames.get(message.targetInstallationId) || 'gekozen toestel'}</p>}</article>)}</div> : <p className="text-xs text-slate-500">Nog geen berichten ontvangen of verzonden.</p>}</section>
    </div>
  </div>;
}
