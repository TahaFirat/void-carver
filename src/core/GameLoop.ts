import { FIXED_DT, MAX_ACCUMULATOR } from './Config';

export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (alpha: number, frameDt: number) => void;

export class GameLoop {
  private running = false;
  private rafId = 0;
  private lastTimestamp = 0;
  private accumulator = 0;
  private hitStopRemaining = 0;

  private readonly onUpdate: UpdateCallback;
  private readonly onRender: RenderCallback;

  constructor(onUpdate: UpdateCallback, onRender: RenderCallback) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public triggerHitStop(durationSeconds: number): void {
    if (durationSeconds > this.hitStopRemaining) {
      this.hitStopRemaining = durationSeconds;
    }
  }

  public resetTiming(): void {
    this.lastTimestamp = performance.now();
    this.accumulator = 0;
  }

  private readonly tick = (now: number): void => {
    if (!this.running) return;

    let frameDt = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;

    if (frameDt < 0) frameDt = 0;
    if (frameDt > MAX_ACCUMULATOR) {
      frameDt = MAX_ACCUMULATOR;
    }

    if (this.hitStopRemaining > 0) {
      this.hitStopRemaining = Math.max(0, this.hitStopRemaining - frameDt);
      const alpha = Math.min(1, Math.max(0, this.accumulator / FIXED_DT));
      this.onRender(alpha, frameDt);
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }

    this.accumulator += frameDt;

    let safetySteps = 0;
    while (this.accumulator >= FIXED_DT && safetySteps < 6) {
      this.onUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
      safetySteps++;
    }

    const alpha = Math.min(1, Math.max(0, this.accumulator / FIXED_DT));
    this.onRender(alpha, frameDt);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
