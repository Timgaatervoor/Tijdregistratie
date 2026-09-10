const SOUND_ENABLED_KEY = 'biathlon_sound_enabled';
const SOUND_VOLUME_KEY = 'biathlon_sound_volume';
const DEFAULT_VOLUME = 0.8;
const DUPLICATE_WINDOW_MS = 100;

type WebkitWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export class SoundService {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isEnabled = true;
  private volume = DEFAULT_VOLUME;
  private readonly lastPlayedAt = new Map<string, number>();

  constructor(private readonly now: () => number = () => Date.now()) {
    try {
      const savedEnabled = localStorage.getItem(SOUND_ENABLED_KEY);
      if (savedEnabled !== null) this.isEnabled = savedEnabled === 'true';

      const savedVolume = localStorage.getItem(SOUND_VOLUME_KEY);
      const parsedVolume = savedVolume === null ? Number.NaN : Number(savedVolume);
      if (Number.isFinite(parsedVolume) && parsedVolume >= 0 && parsedVolume <= 1) {
        this.volume = parsedVolume;
      }
    } catch {
      // Opslag kan in privacy- of kioskmodus niet beschikbaar zijn.
    }
  }

  public toggleSound(enabled?: boolean): boolean {
    this.isEnabled = enabled ?? !this.isEnabled;
    this.persist(SOUND_ENABLED_KEY, String(this.isEnabled));
    if (this.isEnabled) void this.resume();
    return this.isEnabled;
  }

  public getSoundEnabled(): boolean {
    return this.isEnabled;
  }

  public isMuted(): boolean {
    return !this.isEnabled;
  }

  public setMuted(muted: boolean): void {
    this.toggleSound(!muted);
  }

  public setVolume(volume: number): void {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.max(0, Math.min(1, volume));
    this.persist(SOUND_VOLUME_KEY, String(this.volume));
    try {
      this.masterGain?.gain.setValueAtTime(this.volume, this.audioCtx?.currentTime ?? 0);
    } catch {
      // Een gesloten of geblokkeerde context mag de registratie niet hinderen.
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public isAudioSupported(): boolean {
    try {
      return typeof window !== 'undefined' && !!this.getAudioContextClass();
    } catch {
      return false;
    }
  }

  public getAudioState(): string {
    if (!this.isAudioSupported()) return 'niet ondersteund';
    return this.audioCtx?.state ?? 'nog niet gestart';
  }

  public async resume(): Promise<boolean> {
    try {
      const connection = this.getConnection();
      if (!connection) return false;
      if (connection.ctx.state === 'suspended') await connection.ctx.resume();
      return connection.ctx.state === 'running';
    } catch {
      return false;
    }
  }

  public async testSound(): Promise<void> {
    if (!this.isEnabled) throw new Error('Geluid is uitgeschakeld. Schakel het eerst in.');
    if (this.volume <= 0) throw new Error('Het hoofdvolume staat op 0%.');
    if (!this.isAudioSupported()) throw new Error('Deze browser ondersteunt geen Web Audio.');
    if (!(await this.resume())) throw new Error('De browser heeft het geluid nog niet vrijgegeven.');
    this.playSuccess();
  }

  public playKeyClick(): void {
    this.playTone('key-click', 'sine', 520, 0.045, 0.07);
  }

  public playCountdownPip(): void {
    this.playTone('countdown-pip', 'square', 880, 0.12, 0.13);
  }

  public playGoFanfare(): void {
    this.playSequence('go-fanfare', [523.25, 659.25, 783.99, 1046.5], 0.1, 0.04, 0.16);
  }

  public playFinishChord(): void {
    this.playChord('finish-chord', [523.25, 659.25, 783.99], 0.42, 0.1);
  }

  public playHit(): void {
    this.playTone('hit', 'sine', 1250, 0.08, 0.12, 1780);
  }

  public playMiss(): void {
    this.playTone('miss', 'sawtooth', 220, 0.18, 0.14, 130);
  }

  public playSuccess(): void {
    this.playTone('success', 'sine', 880, 0.18, 0.15, 1760);
  }

  public playWarning(): void {
    this.playTone('warning', 'triangle', 440, 0.28, 0.2, 330);
  }

  public playError(): void {
    this.playTone('error', 'sawtooth', 180, 0.3, 0.2, 110);
  }

  public playPenaltyBuzz(): void {
    this.playSequence('penalty-buzz', [170, 125], 0.2, 0.08, 0.2, 'sawtooth');
  }

  private persist(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Opslag is optioneel; de huidige sessie blijft werken.
    }
  }

  private getAudioContextClass(): typeof AudioContext | undefined {
    if (typeof window === 'undefined') return undefined;
    return window.AudioContext || (window as WebkitWindow).webkitAudioContext;
  }

  private getConnection(): { ctx: AudioContext; destination: AudioNode } | null {
    if (!this.isEnabled || this.volume <= 0) return null;
    try {
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        const AudioContextClass = this.getAudioContextClass();
        if (!AudioContextClass) return null;
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
      if (this.audioCtx.state === 'suspended') void this.audioCtx.resume().catch(() => undefined);
      return { ctx: this.audioCtx, destination: this.masterGain ?? this.audioCtx.destination };
    } catch {
      this.audioCtx = null;
      this.masterGain = null;
      return null;
    }
  }

  private canPlay(signal: string): boolean {
    const playedAt = this.now();
    const previous = this.lastPlayedAt.get(signal);
    if (previous !== undefined && playedAt - previous < DUPLICATE_WINDOW_MS) return false;
    this.lastPlayedAt.set(signal, playedAt);
    return true;
  }

  private playTone(
    signal: string,
    type: OscillatorType,
    frequency: number,
    duration: number,
    level: number,
    endFrequency?: number,
  ): void {
    const connection = this.getConnection();
    if (!connection || !this.canPlay(signal)) return;
    try {
      const { ctx, destination } = connection;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + duration * 0.75);
      gain.gain.setValueAtTime(level, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.01);
    } catch {
      // Geluid is aanvullende feedback en mag nooit een actie onderbreken.
    }
  }

  private playSequence(
    signal: string,
    frequencies: number[],
    noteDuration: number,
    gap: number,
    level: number,
    type: OscillatorType = 'triangle',
  ): void {
    const connection = this.getConnection();
    if (!connection || !this.canPlay(signal)) return;
    try {
      frequencies.forEach((frequency, index) => {
        const start = connection.ctx.currentTime + index * (noteDuration + gap);
        const osc = connection.ctx.createOscillator();
        const gain = connection.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(level, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + noteDuration);
        osc.connect(gain);
        gain.connect(connection.destination);
        osc.start(start);
        osc.stop(start + noteDuration + 0.01);
      });
    } catch {
      // Geluid is aanvullende feedback en mag nooit een actie onderbreken.
    }
  }

  private playChord(signal: string, frequencies: number[], duration: number, level: number): void {
    const connection = this.getConnection();
    if (!connection || !this.canPlay(signal)) return;
    try {
      frequencies.forEach((frequency) => {
        const osc = connection.ctx.createOscillator();
        const gain = connection.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, connection.ctx.currentTime);
        gain.gain.setValueAtTime(level, connection.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, connection.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(connection.destination);
        osc.start(connection.ctx.currentTime);
        osc.stop(connection.ctx.currentTime + duration + 0.01);
      });
    } catch {
      // Geluid is aanvullende feedback en mag nooit een actie onderbreken.
    }
  }
}

export const soundService = new SoundService();
