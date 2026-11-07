const BGM_TRACK_URL = '/audio/job-23-audio-1.mp3';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private masterGain: GainNode | null = null;

  public muted: boolean = false;
  public sfxVolume: number = 0.5;
  public bgmVolume: number = 0.3;

  private lastPlayedTimestamps: Record<string, number> = {};
  private bgmAudio: HTMLAudioElement | null = null;
  private isBgmPlaying: boolean = false;

  constructor() {
    // Lazy init AudioContext on first user interaction
  }

  private initCtx(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.bgmVolume;
      this.bgmGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return true;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
  }

  public setBgmVolume(vol: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmGain) {
      this.bgmGain.gain.value = this.bgmVolume;
    }
  }

  private shouldRateLimit(type: string, minIntervalMs: number): boolean {
    const now = performance.now();
    const last = this.lastPlayedTimestamps[type] || 0;
    if (now - last < minIntervalMs) return true;
    this.lastPlayedTimestamps[type] = now;
    return false;
  }

  playShoot(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('shoot', 60)) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';

    const now = this.ctx.currentTime;
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playWhip(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('whip', 100)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.18);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  playKnife(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('knife', 50)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playHit(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('hit', 70)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  playPlayerHurt(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('playerHurt', 200)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(90, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playGemPickup(streak: number = 0): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('gem', 30)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const pitchOffset = Math.min(streak * 25, 400);
    const baseFreq = 587.33 + pitchOffset; // D5 + streak
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.09);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  playThunder(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('thunder', 120)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playGarlicPulse(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('garlic', 250)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.12);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playLevelUp(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;

    const notes = [440, 554.37, 659.25, 880]; // A major arpeggio
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  playChestOpen(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C major fanfare
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.07;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  playBossWarning(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.6);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.6);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  playGameOver(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;

    const notes = [330, 311.13, 293.66, 261.63]; // Descending mournful tones
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.2;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  playVictory(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1174.66, 1318.51];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  startBgm(): void {
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    if (!this.initCtx() || !this.ctx || !this.bgmGain) return;

    // Route the soundtrack through bgmGain so mute and volume controls apply.
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio(BGM_TRACK_URL);
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = 'auto';
      const source = this.ctx.createMediaElementSource(this.bgmAudio);
      source.connect(this.bgmGain);
    }

    this.bgmAudio.play().catch(() => {
      // Autoplay may be denied before the first user gesture; retry on next start.
      this.isBgmPlaying = false;
    });
  }

  stopBgm(): void {
    this.isBgmPlaying = false;
    this.bgmAudio?.pause();
  }

  destroy(): void {
    this.stopBgm();
    this.bgmAudio = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
