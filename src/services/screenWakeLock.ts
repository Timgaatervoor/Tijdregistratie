export type ScreenAwakeStatus = 'requesting' | 'active' | 'inactive' | 'unavailable' | 'https-required';

// One session per mounted mobile station. Never retain a lock after leaving it.
export function keepScreenAwake(
  page: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>,
  wakeLock: Pick<WakeLock, 'request'> | undefined,
  secure: boolean,
  onStatus: (status: ScreenAwakeStatus) => void,
) {
  let stopped = false;
  let pending = false;
  let lock: WakeLockSentinel | undefined;
  const release = (sentinel: WakeLockSentinel) => { void sentinel.release().catch(() => {}); };
  const request = async () => {
    if (stopped || pending || (lock && !lock.released)) return;
    if (!secure) { onStatus('https-required'); return; }
    if (!wakeLock) { onStatus('unavailable'); return; }
    if (page.visibilityState !== 'visible') return;
    pending = true;
    onStatus('requesting');
    try {
      const acquired = await wakeLock.request('screen');
      if (stopped || page.visibilityState !== 'visible') { release(acquired); return; }
      lock = acquired;
      acquired.addEventListener('release', () => {
        if (lock !== acquired) return;
        lock = undefined;
        if (!stopped) onStatus('inactive');
      }, { once: true });
      onStatus(acquired.released ? 'inactive' : 'active');
    } catch {
      if (!stopped) onStatus('inactive');
    } finally {
      pending = false;
    }
  };
  const onVisibility = () => {
    if (page.visibilityState === 'visible') void request();
    else {
      const previous = lock;
      lock = undefined;
      if (previous) release(previous);
      onStatus('inactive');
    }
  };
  page.addEventListener('visibilitychange', onVisibility);
  page.addEventListener('fullscreenchange', request);
  page.addEventListener('pointerdown', request);
  void request();
  return {
    request,
    stop() {
      stopped = true;
      page.removeEventListener('visibilitychange', onVisibility);
      page.removeEventListener('fullscreenchange', request);
      page.removeEventListener('pointerdown', request);
      if (lock) release(lock);
      lock = undefined;
    },
  };
}
