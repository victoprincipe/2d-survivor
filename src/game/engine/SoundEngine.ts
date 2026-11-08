import type { MapId } from '../types';

const BGM_TRACK_URL = '/audio/job-23-audio-1.mp3';
const AMAZON_BGM_TRACK_URL = '/audio/amazon-carajas.mp3';

const PLAYER_HURT_VARIANTS = [
  { pitch: 185, endPitch: 68, duration: 0.16, filter: 1250, wave: 'triangle' },
  { pitch: 145, endPitch: 52, duration: 0.20, filter: 850, wave: 'sine' },
  { pitch: 225, endPitch: 82, duration: 0.14, filter: 1750, wave: 'triangle' },
  { pitch: 165, endPitch: 60, duration: 0.22, filter: 1050, wave: 'triangle' },
] as const;

export class SoundEngine {
  private lastPlayerHurtVariant = -1;
  private playerHurtNoise: AudioBuffer | null = null;
  private amazonHurtBuffer: AudioBuffer | null = null;
  private deathBuffer: Promise<AudioBuffer | null> | null = null;
  private jaguarBuffer: Promise<AudioBuffer | null> | null = null;

  playJaguarCharge(): void {
    if (!this.initCtx() || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const gain = this.sfxGain;
    void this.jaguarBuffer?.then(buffer => {
      if (!buffer || ctx.state === 'closed') return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const roarGain = ctx.createGain();
      roarGain.gain.value = 1.3;
      source.connect(roarGain);
      roarGain.connect(gain);
      source.onended = () => {
        source.disconnect();
        roarGain.disconnect();
      };
      source.start();
    });
  }

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
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientLfo: OscillatorNode | null = null;

  constructor() {
    // Lazy init AudioContext on first user interaction
  }

  private initCtx(): boolean {
    if (typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      const ctx = this.ctx;
      this.deathBuffer = fetch('/audio/player-death-laugh.mp3')
        .then(response => { if (!response.ok) throw new Error('Death audio unavailable'); return response.arrayBuffer(); })
        .then(data => ctx.decodeAudioData(data))
        .catch(() => null);
      // Decode at audio initialization so hits never wait for a network request.
      void fetch('/audio/amazon-player-hurt.mp3')
        .then(response => { if (!response.ok) throw new Error('Amazon hurt audio unavailable'); return response.arrayBuffer(); })
        .then(data => ctx.decodeAudioData(data))
        .then(buffer => { if (this.ctx === ctx && ctx.state !== 'closed') this.amazonHurtBuffer = buffer; })
        .catch(() => {});
      this.jaguarBuffer = fetch('/audio/jaguar-charge.mp3')
        .then(response => { if (!response.ok) throw new Error('Jaguar audio unavailable'); return response.arrayBuffer(); })
        .then(data => ctx.decodeAudioData(data))
        .catch(() => null);

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

  /** Procedural white-noise buffer used by the water and ambient effects. */
  private createNoiseBuffer(duration: number): AudioBuffer | null {
    if (!this.ctx) return null;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Short filtered noise burst: water footsteps and splashes. */
  playWaterStep(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('waterStep', 80)) return;

    const buffer = this.createNoiseBuffer(0.18);
    if (!buffer) return;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800 + Math.random() * 700, now);
    filter.Q.value = 0.7;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16 + Math.random() * 0.08, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    source.start(now);
    source.stop(now + 0.19);
  }

  /** Soft two-note pluck when a fruit tree is harvested. */
  playFruitCollect(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('fruitCollect', 100)) return;

    const now = this.ctx.currentTime;
    const notes = [659.25, 987.77];
    notes.forEach((freq, index) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const start = now + index * 0.055;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.04, start + 0.12);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + 0.17);
    });
  }

  /** Light click + confirmation chime for claiming a mission reward. */
  playMissionClaim(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('missionClaim', 120)) return;

    const now = this.ctx.currentTime;
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(1200, now);
    click.frequency.exponentialRampToValueAtTime(600, now + 0.035);
    clickGain.gain.setValueAtTime(0.09, now);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    click.connect(clickGain);
    clickGain.connect(this.sfxGain);
    click.start(now);
    click.stop(now + 0.05);

    const chime = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    const chimeStart = now + 0.04;
    chime.type = 'sine';
    chime.frequency.setValueAtTime(880, chimeStart);
    chime.frequency.setValueAtTime(1318.51, chimeStart + 0.05);
    chimeGain.gain.setValueAtTime(0.0001, chimeStart);
    chimeGain.gain.linearRampToValueAtTime(0.12, chimeStart + 0.01);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, chimeStart + 0.2);
    chime.connect(chimeGain);
    chimeGain.connect(this.sfxGain);
    chime.start(chimeStart);
    chime.stop(chimeStart + 0.21);
  }

  /** Deep folklore boss roar: a low sweep plus a short rumble. */
  playBossRoar(): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(88, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.85);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.98);

    const buffer = this.createNoiseBuffer(0.9);
    if (!buffer) return;
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.85);
    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, now);
    rumbleGain.gain.linearRampToValueAtTime(0.14, now + 0.08);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    rumble.connect(filter);
    filter.connect(rumbleGain);
    rumbleGain.connect(this.sfxGain);
    rumble.start(now);
    rumble.stop(now + 0.92);
  }

  /** Gentle looping forest/rain bed for the Amazon map, routed through BGM volume. */
  startAmazonAmbient(): void {
    if (this.ambientSource || !this.initCtx() || !this.ctx || !this.bgmGain) return;

    const buffer = this.createNoiseBuffer(2);
    if (!buffer) return;

    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.055, now);

    // Slow swell makes the rain breathe instead of sounding like static.
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.11, now);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.018, now);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);

    source.start(now);
    lfo.start(now);
    this.ambientSource = source;
    this.ambientGain = gain;
    this.ambientLfo = lfo;
  }

  stopAmazonAmbient(): void {
    try {
      this.ambientSource?.stop();
    } catch {
      // Source may already be stopped after the context closed.
    }
    this.ambientSource?.disconnect();
    this.ambientGain?.disconnect();
    try {
      this.ambientLfo?.stop();
    } catch {
      // Same as above.
    }
    this.ambientLfo?.disconnect();
    this.ambientSource = null;
    this.ambientGain = null;
    this.ambientLfo = null;
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

  playPlayerHurt(mapId: MapId = 'night_plain'): void {
    if (this.muted || !this.initCtx() || !this.ctx || !this.sfxGain) return;
    if (this.shouldRateLimit('playerHurt', 200)) return;

    if (mapId === 'amazon_forest') {
      if (!this.amazonHurtBuffer) return;
      const source = this.ctx.createBufferSource();
      source.buffer = this.amazonHurtBuffer;
      source.connect(this.sfxGain);
      source.onended = () => source.disconnect();
      source.start();
      return;
    }

    // Pick a different impact on each accepted hit, with subtle pitch variation.
    const count = PLAYER_HURT_VARIANTS.length;
    let index = Math.floor(Math.random() * (this.lastPlayerHurtVariant < 0 ? count : count - 1));
    if (this.lastPlayerHurtVariant >= 0 && index >= this.lastPlayerHurtVariant) index++;
    this.lastPlayerHurtVariant = index;
    const variant = PLAYER_HURT_VARIANTS[index];
    const pitchScale = 0.96 + Math.random() * 0.08;
    const now = this.ctx.currentTime;
    const end = now + variant.duration;

    // A low falling tone gives the hit weight without the old harsh buzz.
    const osc = this.ctx.createOscillator();
    const toneGain = this.ctx.createGain();
    osc.type = variant.wave;
    osc.frequency.setValueAtTime(variant.pitch * pitchScale, now);
    osc.frequency.exponentialRampToValueAtTime(variant.endPitch * pitchScale, end);
    toneGain.gain.setValueAtTime(0, now);
    toneGain.gain.linearRampToValueAtTime(0.26, now + 0.004);
    toneGain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(toneGain);
    toneGain.connect(this.sfxGain);
    osc.onended = () => {
      osc.disconnect();
      toneGain.disconnect();
    };
    osc.start(now);
    osc.stop(end);

    // A filtered noise transient adds a distinct physical impact to each timbre.
    this.playerHurtNoise ??= this.createNoiseBuffer(0.22);
    if (!this.playerHurtNoise) return;
    const noise = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const noiseGain = this.ctx.createGain();
    noise.buffer = this.playerHurtNoise;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(variant.filter, now);
    filter.frequency.exponentialRampToValueAtTime(350, end);
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.16, now + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, end);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      noiseGain.disconnect();
    };
    noise.start(now);
    noise.stop(end);
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
    const ctx = this.ctx;
    const gain = this.sfxGain;
    void this.deathBuffer?.then(buffer => {
      if (!buffer || this.ctx !== ctx || ctx.state === 'closed' || this.muted) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.onended = () => source.disconnect();
      source.start();
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

  startBgm(mapId: MapId = 'night_plain'): void {
    if (this.isBgmPlaying) return;
    this.isBgmPlaying = true;
    if (!this.initCtx() || !this.ctx || !this.bgmGain) return;

    // Route the soundtrack through bgmGain so mute and volume controls apply.
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio(mapId === 'amazon_forest' ? AMAZON_BGM_TRACK_URL : BGM_TRACK_URL);
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
    this.deathBuffer = null;
    this.amazonHurtBuffer = null;
    this.stopBgm();
    this.stopAmazonAmbient();
    this.bgmAudio = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
