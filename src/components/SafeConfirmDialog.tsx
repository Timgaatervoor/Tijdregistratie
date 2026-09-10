import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react';
import { soundService } from '../services/soundService';
import { createActionGate, validateTypeConfirmation } from '../services/safeConfirmLogic';

interface SafeConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  requireTyping?: boolean;
  typeKeyword?: string;
}

export function SafeConfirmDialog({ isOpen, title, message, confirmLabel = 'Bevestigen', cancelLabel = 'Annuleren',
  variant = 'warning', onConfirm, onCancel, requireTyping = false, typeKeyword = 'BEVESTIG' }: SafeConfirmDialogProps) {
  const [typedValue, setTypedValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const gate = useRef(createActionGate());
  useEffect(() => { if (isOpen) { setTypedValue(''); setIsProcessing(false); gate.current.leave(); } }, [isOpen]);
  if (!isOpen) return null;
  const valid = !requireTyping || validateTypeConfirmation(typedValue, typeKeyword);
  const confirm = async () => {
    if (!valid || !gate.current.enter()) { if (!valid) soundService.playError(); return; }
    setIsProcessing(true);
    try { await onConfirm(); soundService.playSuccess(); onCancel(); }
    catch { soundService.playError(); gate.current.leave(); setIsProcessing(false); }
  };
  const Icon = variant === 'danger' ? ShieldAlert : variant === 'info' ? Info : AlertTriangle;
  const button = variant === 'danger' ? 'bg-red-600 hover:bg-red-500 text-white' : variant === 'info' ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-amber-500 hover:bg-amber-400 text-slate-950';
  return <div role="dialog" aria-modal="true" aria-labelledby="safe-confirm-title" className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
    <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3"><div className="flex items-center gap-2"><Icon className="w-5 h-5 text-amber-400" /><h3 id="safe-confirm-title" className="text-base font-black text-white">{title}</h3></div><button type="button" disabled={isProcessing} aria-label="Annuleren" onClick={onCancel} className="p-1 text-slate-400 hover:text-white disabled:opacity-40"><X className="w-4 h-4" /></button></div>
      <p className="leading-relaxed whitespace-pre-line text-slate-300">{message}</p>
      {requireTyping && <label className="block text-slate-300 font-semibold">Typ <strong className="text-red-400 font-mono">{typeKeyword}</strong> om te bevestigen:
        <input autoFocus value={typedValue} disabled={isProcessing} onChange={event => setTypedValue(event.target.value)} className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase text-center font-bold" />
      </label>}
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800"><button type="button" disabled={isProcessing} onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-800 disabled:opacity-40">{cancelLabel}</button><button type="button" disabled={!valid || isProcessing} onClick={() => void confirm()} className={`px-5 py-2 rounded-xl font-bold disabled:opacity-40 ${button}`}>{isProcessing ? 'Bezig…' : confirmLabel}</button></div>
    </div>
  </div>;
}
