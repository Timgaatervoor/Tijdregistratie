import React, { createContext, useContext, useEffect, useState } from 'react';

type Station = 'start' | 'shooting' | 'finish';
type Modes = Record<Station, boolean>;
const key = 'station_mobile_modes';
const defaults: Modes = { start: false, shooting: false, finish: false };

function readModes(): Modes {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    return saved ? {
      start: saved.start === true, shooting: saved.shooting === true, finish: saved.finish === true,
    } : { ...defaults, shooting: localStorage.getItem('shooting_simple_mode') === 'true' };
  } catch { return defaults; }
}

const MobileModeContext = createContext({
  modes: defaults,
  setStation: (_station: Station, _enabled: boolean) => {},
  setAll: (_enabled: boolean) => {},
});

export function MobileModeProvider({ children }: { children: React.ReactNode }) {
  const [modes, setModes] = useState(readModes);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(modes)); } catch { /* Still usable without storage. */ }
  }, [modes]);
  return <MobileModeContext.Provider value={{
    modes,
    setStation: (station, enabled) => setModes(current => ({ ...current, [station]: enabled })),
    setAll: enabled => setModes({ start: enabled, shooting: enabled, finish: enabled }),
  }}>{children}</MobileModeContext.Provider>;
}

export function useMobileMode() { return useContext(MobileModeContext); }

export function useStationMobileMode(station: Station) {
  const { modes, setStation } = useMobileMode();
  const enabled = modes[station];
  useEffect(() => {
    if (!enabled) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [enabled]);
  return [enabled, () => setStation(station, !enabled)] as const;
}
