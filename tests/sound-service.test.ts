import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SoundService } from '../src/services/soundService';

const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

const restoreBrowserGlobals = () => {
  if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
  else Reflect.deleteProperty(globalThis, 'window');
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else Reflect.deleteProperty(globalThis, 'localStorage');
};

test('sound preferences retain the old enabled setting and persist volume', async () => {
  const values = new Map<string, string>([
    ['biathlon_sound_enabled', 'false'],
    ['biathlon_sound_volume', '0.35'],
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });

  try {
    const service = new SoundService();
    assert.equal(service.getSoundEnabled(), false);
    assert.equal(service.getVolume(), 0.35);
    service.setMuted(false);
    service.setVolume(0.65);
    assert.equal(values.get('biathlon_sound_enabled'), 'true');
    assert.equal(values.get('biathlon_sound_volume'), '0.65');
    service.setVolume(0);
    await assert.rejects(service.testSound(), /0%/);
  } finally {
    restoreBrowserGlobals();
  }
});

test('unsupported or blocked audio never throws from race feedback', async () => {
  class BlockedAudioContext {
    constructor() {
      throw new Error('blocked');
    }
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { AudioContext: BlockedAudioContext },
  });

  try {
    const service = new SoundService();
    assert.doesNotThrow(() => {
      service.playCountdownPip();
      service.playGoFanfare();
      service.playFinishChord();
      service.playHit();
      service.playMiss();
      service.playWarning();
      service.playError();
    });
    assert.equal(await service.resume(), false);
  } finally {
    restoreBrowserGlobals();
  }
});

test('duplicate calls for one signal inside the guard window play once', () => {
  let starts = 0;
  const audioParam = {
    setValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
  };
  class FakeAudioContext {
    state: AudioContextState = 'running';
    currentTime = 0;
    destination = {};
    createGain() {
      return { gain: audioParam, connect: () => undefined };
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: audioParam,
        connect: () => undefined,
        start: () => { starts += 1; },
        stop: () => undefined,
      };
    }
    resume() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { AudioContext: FakeAudioContext },
  });

  try {
    let now = 1000;
    const service = new SoundService(() => now);
    service.playSuccess();
    service.playSuccess();
    assert.equal(starts, 1);
    now += 100;
    service.playSuccess();
    assert.equal(starts, 2);
  } finally {
    restoreBrowserGlobals();
  }
});
