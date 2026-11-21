/**
 * VOID CARVER — BUILD 15 FINAL: END-USER POLISH, 120HZ PROMOTION FRAME-CLAMP,
 * CORNER TURN BUFFERING, AUTO-PAUSE LIFECYCLE & CLEAN ENDLESS PERKS
 * (`src/core/EndUserPolishAndControlsV15.ts`)
 *
 * 1. 120Hz ProMotion Safe Delta-Time Stepper: Prevents 2x double-speed bug on 120Hz screens!
 * 2. 115ms Corner Turn Input Buffer + 180-Degree Self-Reverse Guard: Makes touch turning effortless!
 * 3. Instant Background / Notification Auto-Pause + 1.2s Gentle Resume Countdown.
 * 4. Clean, Concise 9-Card Endless Mode Upgrade Deck (max 6 words per card — ultra readable!).
 */

export type CardinalDir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface CleanEndlessPerk {
  id: string;
  titleTr: string;
  shortDescTr: string;
  accentHex: string;
  maxStacks: number;
}

export const CLEAN_ENDLESS_PERKS_V15: CleanEndlessPerk[] = [
  { id: 'FAST_ENGINE', titleTr: 'Seri Motor', shortDescTr: 'Kesim hızını +%15 artırır.', accentHex: '#38BDF8', maxStacks: 3 },
  { id: 'SHOCK_TRAIL', titleTr: 'Şimşek İzi', shortDescTr: 'Çizgiye yaklaşan yaratıkları iter.', accentHex: '#60A5FA', maxStacks: 3 },
  { id: 'AEGIS_PULSE', titleTr: 'Çizgi Kalkanı', shortDescTr: 'Her 2 dalgada 1 darbe korur.', accentHex: '#10B981', maxStacks: 2 },
  { id: 'GHOST_CORNER', titleTr: 'Hayalet Dönüş', shortDescTr: 'Köşe dönerken 0.5 sn koruma.', accentHex: '#A855F7', maxStacks: 3 },
  { id: 'CRUSH_SLOW', titleTr: 'Şok Kapanı', shortDescTr: 'Yaratık ezmek Boss hızını düşürür.', accentHex: '#F43F5E', maxStacks: 3 },
  { id: 'EXTRA_LIFE', titleTr: 'Ekstra Gemi', shortDescTr: '+1 gemi hakkı (Maks 5).', accentHex: '#EF4444', maxStacks: 2 },
  { id: 'JETON_MAGNET', titleTr: 'Jeton Bonusu', shortDescTr: 'Dalga sonu Jeton ödülü +%25.', accentHex: '#F59E0B', maxStacks: 3 },
  { id: 'WIDE_SNAP', titleTr: 'Güçlü Mıknatıs', shortDescTr: 'Duvara kapanma mesafesini büyütür.', accentHex: '#22D3EE', maxStacks: 2 },
  { id: 'TARGET_TRIM', titleTr: 'Alan İndirimi', shortDescTr: 'Hedef yüzdesini %2 düşürür.', accentHex: '#A3E635', maxStacks: 2 }
];

const OPPOSITE_DIR: Record<CardinalDir, CardinalDir> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT'
};

export class EndUserPolishControllerV15 {
  public isPaused = false;
  public resumeCountdownSec = 0;
  public showFirstLaunchSwipeHint = true;

  private bufferedDir: CardinalDir | null = null;
  private bufferedDirExpireMs = 0;

  /**
   * Clamps raw `requestAnimationFrame` delta so 120Hz iPhone Pro displays and tab-switches
   * ALWAYS step physics accurately without double-speed bugs or teleportation!
   */
  public computeSafeFrameDeltaSec(prevTimestampMs: number, nowTimestampMs: number): number {
    if (prevTimestampMs <= 0) return 1 / 60;
    const rawSec = Math.max(0, (nowTimestampMs - prevTimestampMs) / 1000);
    return Math.min(0.033, rawSec);
  }

  /**
   * Buffers a player swipe/key turn for 115ms and blocks accidental 180-degree self-collision while cutting!
   */
  public queueDirectionInput(
    requested: CardinalDir,
    currentDir: CardinalDir | null,
    isCuttingInVoid: boolean,
    nowMs: number
  ): CardinalDir | null {
    if (isCuttingInVoid && currentDir && OPPOSITE_DIR[currentDir] === requested) {
      return currentDir;
    }
    this.bufferedDir = requested;
    this.bufferedDirExpireMs = nowMs + 115;
    this.showFirstLaunchSwipeHint = false;
    return requested;
  }

  public consumeBufferedDirection(nowMs: number): CardinalDir | null {
    if (!this.bufferedDir) return null;
    if (nowMs > this.bufferedDirExpireMs) {
      this.bufferedDir = null;
      return null;
    }
    const out = this.bufferedDir;
    this.bufferedDir = null;
    return out;
  }

  public onAppBackgroundOrBlur(): void {
    this.isPaused = true;
    this.resumeCountdownSec = 0;
  }

  public requestSmoothResume(): void {
    this.isPaused = false;
    this.resumeCountdownSec = 1.2;
  }

  public stepResumeCountdown(dtSec: number): boolean {
    if (this.isPaused) return false;
    if (this.resumeCountdownSec > 0) {
      this.resumeCountdownSec = Math.max(0, this.resumeCountdownSec - dtSec);
      return this.resumeCountdownSec === 0;
    }
    return true;
  }

  public rollThreeCleanPerks(
    ownedStacks: Map<string, number>,
    waveSeed: number,
    currentLives = 3
  ): [CleanEndlessPerk, CleanEndlessPerk, CleanEndlessPerk] {
    const pool = CLEAN_ENDLESS_PERKS_V15.filter(
      (p) =>
        (ownedStacks.get(p.id) ?? 0) < p.maxStacks &&
        !(p.id === 'EXTRA_LIFE' && currentLives >= 5)
    );
    const candidates = pool.length >= 3 ? [...pool] : [...CLEAN_ENDLESS_PERKS_V15];
    let s = (waveSeed * 1664525 + 1013904223) >>> 0;
    const out: CleanEndlessPerk[] = [];
    while (out.length < 3) {
      s = (Math.imul(s, 22695477) + 1) >>> 0;
      out.push(candidates.splice(s % candidates.length, 1)[0]!);
    }
    return [out[0]!, out[1]!, out[2]!];
  }
}
