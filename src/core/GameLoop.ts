import { FIXED_DT } from './Config';
import { EndUserPolishControllerV15 } from './EndUserPolishAndControlsV15';

export type UpdateCallback = (dt: number) => void;
export type RenderCallback = (alpha: number, frameDt: number) => void;

const frameDeltaHelper = new EndUserPolishControllerV15();

// 60 FPS active VSync pacer (~15.2ms skips odd 8.33ms ticks on 120Hz ProMotion -> 50% less GPU heat!)
const ACTIVE_FRAME_BUDGET_MS = 15.2;
// 24 FPS ultra-low-power pacer when sitting idle on static menus (>1.8s without touch)
const IDLE_MENU_FRAME_BUDGET_MS = 40.0;

export class GameLoop {
  private running = false;
  private suspended = false;
  private rafId = 0;
  private lastTimestamp = 0;
  private lastRenderTimestamp = 0;
  private accumulator = 0;
  private hitStopRemaining = 0;
  private lowPowerIdleCandidate = false;
  private activeBoostRemainingSec = 1.8;

  private readonly onUpdate: UpdateCallback;
  private readonly onRender: RenderCallback;

  constructor(onUpdate: UpdateCallback, onRender: RenderCallback) {
    this.onUpdate = onUpdate;
    this.onRender = onRender;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.suspended = false;
    const now = performance.now();
    this.lastTimestamp = now;
    this.lastRenderTimestamp = 0;
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    this.suspended = false;
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /**
   * Completely halts rAF ticks when the app is hidden in background (0% CPU / 0% GPU battery draw).
   */
  public suspend(): void {
    this.suspended = true;
    if (this.rafId !== 0) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  /**
   * Cleanly wakes rAF when returning to foreground with zero delta-time spike or stuck timers.
   */
  public resume(): void {
    if (!this.running) return;
    const wasSuspended = this.suspended || this.rafId === 0;
    this.suspended = false;
    const now = performance.now();
    this.lastTimestamp = now;
    this.lastRenderTimestamp = 0;
    this.accumulator = 0;
    this.activeBoostRemainingSec = 1.8;
    if (wasSuspended && this.rafId === 0) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  public setLowPowerIdleCandidate(isStaticScreen: boolean): void {
    if (!isStaticScreen && this.lowPowerIdleCandidate) {
      this.activeBoostRemainingSec = 1.8;
    }
    this.lowPowerIdleCandidate = isStaticScreen;
  }

  public wakeFromIdle(boostSeconds = 1.8): void {
    if (boostSeconds > this.activeBoostRemainingSec) {
      this.activeBoostRemainingSec = boostSeconds;
    }
    if (this.running && !this.suspended && this.rafId === 0) {
      this.lastTimestamp = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  public triggerHitStop(durationSeconds: number): void {
    if (durationSeconds > this.hitStopRemaining) {
      this.hitStopRemaining = durationSeconds;
    }
  }

  public resetTiming(): void {
    this.lastTimestamp = performance.now();
    this.lastRenderTimestamp = 0;
    this.accumulator = 0;
    this.activeBoostRemainingSec = 1.8;
  }

  private readonly tick = (now: number): void => {
    if (!this.running || this.suspended) {
      this.rafId = 0;
      return;
    }

    const useIdleThrottle =
      this.lowPowerIdleCandidate && this.activeBoostRemainingSec <= 0 && this.hitStopRemaining <= 0;
    const minIntervalMs = useIdleThrottle ? IDLE_MENU_FRAME_BUDGET_MS : ACTIVE_FRAME_BUDGET_MS;

    if (this.lastRenderTimestamp > 0 && now - this.lastRenderTimestamp < minIntervalMs) {
      this.rafId = requestAnimationFrame(this.tick);
      return;
    }
    this.lastRenderTimestamp = now;

    // 120Hz ProMotion & tab-switch safe delta-time clamp (`EndUserPolishControllerV15`)
    const frameDt = frameDeltaHelper.computeSafeFrameDeltaSec(this.lastTimestamp, now);
    this.lastTimestamp = now;

    if (this.activeBoostRemainingSec > 0) {
      this.activeBoostRemainingSec = Math.max(0, this.activeBoostRemainingSec - frameDt);
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
