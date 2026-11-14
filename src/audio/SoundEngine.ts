export type PowerUpSoundType = 'S' | 'T' | 'P' | 'L' | 'C' | 'BOSS_CANNON';

/**
 * 1989/1991 FM-Synth / YM2151 Japanese Arcade Audio Synthesizer:
 * - Rising FM electric laser tether hum while cutting (`playLaserCutLoop`).
 * - Crisp arcade corner turn tick (`playCornerClick`).
 * - Explosive arcade territory capture chord sweep + crunch (`playPolygonShatter`).
 * - Urgent high-voltage spark siren (`playFuseAlarm`).
 * - Punchy twin laser pulse (`playLaserShot`), heavy plasma torpedo, hex-shield ping & Round Clear fanfare!
 */
class SoundEngineImpl {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;

  private sfxVolume = 0.8;
  private ambientVolume = 0.45;
  private muted = false;

  private cutOsc: OscillatorNode | null = null;
  private cutModOsc: OscillatorNode | null = null;
  private cutModGain: GainNode | null = null;
  private cutGain: GainNode | null = null;

  private borderOsc: OscillatorNode | null = null;
  private borderGain: GainNode | null = null;
  private lastBorderHumAt = 0;
  private lastCornerClickAt = 0;

  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;

  public bindAutoUnlock(): void {
    const unlock = (): void => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.ctx && !this.unlocked) {
        const silent = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silent;
        src.connect(this.ctx.destination);
        src.start(0);
        this.unlocked = true;
        this.updateAmbientState();
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('touchend', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  public setVolumes(sfx: number, ambient: number, muted: boolean): void {
    this.sfxVolume = Math.max(0, Math.min(1, sfx));
    this.ambientVolume = Math.max(0, Math.min(1, ambient));
    this.muted = muted;
    this.updateAmbientState();
    if (this.muted) {
      this.stopLaserCutLoop();
      this.stopBorderHum();
    }
  }

  public suspend(): void {
    this.stopLaserCutLoop();
    this.stopBorderHum();
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public resume(): void {
    if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
      this.ctx.resume().catch(() => {});
    }
  }

  public playCornerClick(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (now - this.lastCornerClickAt < 0.03) return;
    this.lastCornerClickAt = now;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.022);
    g.gain.setValueAtTime(0.08 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.028);
  }

  public playBorderHum(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (now - this.lastBorderHumAt < 0.095) return;
    this.lastBorderHumAt = now;

    if (!this.borderOsc || !this.borderGain) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(95, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, now);
      gain.gain.setValueAtTime(0.0001, now);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      this.borderOsc = osc;
      this.borderGain = gain;
    }

    const vol = 0.035 * this.sfxVolume;
    this.borderOsc.frequency.setTargetAtTime(96 + Math.sin(now * 14) * 8, now, 0.03);
    this.borderGain.gain.cancelScheduledValues(now);
    this.borderGain.gain.setTargetAtTime(vol, now, 0.02);
    this.borderGain.gain.setTargetAtTime(0.0001, now + 0.08, 0.04);
  }

  public stopBorderHum(): void {
    if (this.borderGain && this.ctx) {
      this.borderGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * Classic FM-Synth Laser Tether Loop while drawing a cut across the arena,
   * shifting pitch smoothly downward when rewinding (`180°` Backtrack)!
   */
  public playLaserCutLoop(trailLength = 0, isBacktracking = false): void {
    if (this.muted || this.sfxVolume <= 0.01) {
      this.stopLaserCutLoop();
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (!this.cutOsc || !this.cutModOsc || !this.cutModGain || !this.cutGain) {
      const carrier = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const lp = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      carrier.type = 'sawtooth';
      mod.type = 'sine';
      mod.frequency.setValueAtTime(34, now);
      modGain.gain.setValueAtTime(28, now);

      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, now);
      gain.gain.setValueAtTime(0.0001, now);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(lp);
      lp.connect(gain);
      gain.connect(ctx.destination);

      carrier.start(now);
      mod.start(now);

      this.cutOsc = carrier;
      this.cutModOsc = mod;
      this.cutModGain = modGain;
      this.cutGain = gain;
    }

    const tension = Math.min(1, trailLength / 1300);
    const baseFreq = isBacktracking
      ? Math.max(135, 285 - tension * 125)
      : 220 + tension * 220;
    this.cutModOsc.frequency.setTargetAtTime(isBacktracking ? 20 : 34, now, 0.03);
    this.cutOsc.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.cutGain.gain.setTargetAtTime(0.075 * this.sfxVolume, now, 0.02);
  }

  public playShieldZeroWarning(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.setValueAtTime(520, now + 0.045);
    g.gain.setValueAtTime(0.065 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public stopLaserCutLoop(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.cutGain) {
      try {
        this.cutGain.gain.cancelScheduledValues(now);
        this.cutGain.gain.setTargetAtTime(0.0001, now, 0.015);
      } catch {
        // Ignore
      }
    }
    if (this.cutOsc) {
      const osc = this.cutOsc;
      this.cutOsc = null;
      setTimeout(() => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // Ignore
        }
      }, 55);
    }
    if (this.cutModOsc) {
      const mod = this.cutModOsc;
      this.cutModOsc = null;
      setTimeout(() => {
        try {
          mod.stop();
          mod.disconnect();
        } catch {
          // Ignore
        }
      }, 55);
    }
    this.cutModGain = null;
    this.cutGain = null;
  }

  /**
   * Classic 1989 Arcade Territory Capture Synth Sweep + Armor Crunch!
   */
  public playPolygonShatter(percentClaimed: number): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const scale = Math.min(1, Math.max(0.15, percentClaimed / 25));

    // Punchy FM bass impact
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(150 + scale * 40, now);
    bass.frequency.exponentialRampToValueAtTime(38, now + 0.28 + scale * 0.14);
    bassGain.gain.setValueAtTime((0.22 + scale * 0.12) * this.sfxVolume, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34 + scale * 0.15);
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.start(now);
    bass.stop(now + 0.52);

    // Bright ascending arcade capture arpeggio
    const notes =
      percentClaimed >= 15
        ? [329.63, 440.0, 554.37, 659.25, 880.0]
        : [293.66, 440.0, 587.33];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + idx * 0.032;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.095 * this.sfxVolume, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.24);
    });

    this.triggerNoiseBurst(0.16 + scale * 0.08, 780, 0.14 * this.sfxVolume, 1.1);
  }

  public playFuseAlarm(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      const start = now + i * 0.08;
      osc.frequency.setValueAtTime(880, start);
      osc.frequency.linearRampToValueAtTime(1320, start + 0.06);
      g.gain.setValueAtTime(0.085 * this.sfxVolume, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.075);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.08);
    }
  }

  public playPowerUp(type: PowerUpSoundType): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const seq =
      type === 'BOSS_CANNON'
        ? [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]
        : [329.63, 440.0, 554.37, 659.25];

    seq.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      const t0 = now + idx * 0.045;
      osc.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.085 * this.sfxVolume, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    });
  }

  public playLaserShot(heavySlug = false): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = heavySlug ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(heavySlug ? 520 : 1240, now);
    osc.frequency.exponentialRampToValueAtTime(
      heavySlug ? 92 : 240,
      now + (heavySlug ? 0.16 : 0.07)
    );
    g.gain.setValueAtTime((heavySlug ? 0.15 : 0.075) * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (heavySlug ? 0.18 : 0.08));

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (heavySlug ? 0.19 : 0.085));

    if (heavySlug) {
      this.triggerNoiseBurst(0.08, 620, 0.1 * this.sfxVolume, 1.4);
    }
  }

  public playBossHit(immune = false): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    if (immune) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1180, now);
      osc.frequency.exponentialRampToValueAtTime(1680, now + 0.045);
      g.gain.setValueAtTime(0.07 * this.sfxVolume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
      g.gain.setValueAtTime(0.24 * this.sfxVolume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);
      this.triggerNoiseBurst(0.16, 680, 0.16 * this.sfxVolume, 1.1);
    }
  }

  public playShipExplode(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    this.stopLaserCutLoop();
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    const g = ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.52);
    g.gain.setValueAtTime(0.28 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
    sub.connect(g);
    g.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.58);

    this.triggerNoiseBurst(0.42, 540, 0.24 * this.sfxVolume, 0.9);
  }

  public playShieldDeflect(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.08);
    g.gain.setValueAtTime(0.09 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playUiClick(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.028);
    g.gain.setValueAtTime(0.07 * this.sfxVolume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playExtraLife(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const notes = [329.63, 392.0, 659.25, 523.25, 587.33, 783.99];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      const t0 = now + i * 0.065;
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.095 * this.sfxVolume, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    });
  }

  public playLevelClear(): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    this.stopLaserCutLoop();
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];

    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + i * 0.078;
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.12 * this.sfxVolume, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    });
  }

  private updateAmbientState(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const shouldPlay = !this.muted && this.ambientVolume > 0.01 && this.unlocked;
    if (!shouldPlay) {
      if (this.ambientGain) {
        this.ambientGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      }
      return;
    }

    if (!this.ambientOsc1 || !this.ambientOsc2 || !this.ambientGain) {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(55, ctx.currentTime);
      osc2.frequency.setValueAtTime(110.2, ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(175, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      this.ambientOsc1 = osc1;
      this.ambientOsc2 = osc2;
      this.ambientGain = gain;
    }

    this.ambientGain.gain.setTargetAtTime(0.035 * this.ambientVolume, ctx.currentTime, 0.25);
  }

  private triggerNoiseBurst(
    duration: number,
    cutoffFreq: number,
    volume: number,
    q = 1.2
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoffFreq, now);
    filter.Q.setValueAtTime(q, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(volume, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;

    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;

    this.ctx = new AudioCtor();

    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleRate; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return this.ctx;
  }
}

export const SoundEngine = new SoundEngineImpl();
