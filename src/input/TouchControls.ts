import { PALETTE } from '../core/Config';
import { getLayout, GameLayout, pointInRect, Rect } from '../core/ResponsiveLayout';
import { Direction } from '../geometry/Types';
import { NativeBridge } from '../native/NativeBridge';
import { drawPixelText } from '../rendering/PixelArtEngine';
import { CarveButtonMode, ControlMode } from '../services/StorageService';

export interface TouchSnapshot {
  direction: Direction | null;
  carveActive: boolean;
  autoCarveSwipe: boolean;
}

const SWIPE_THRESHOLD = 15;
const DPAD_DRAG_THRESHOLD = 10;
const HYSTERESIS = 1.18;

/**
 * V5 phone & tablet controls (`01-hedef-duvar-kutu-ve-yeni-kontrol.jpg`):
 * - Left: 4 large separated pixel arrow keys (`▲ ▼ ◀ ▶`) in a `+` layout with thumb-slide
 *   support (slide from one key to another without lifting) and a center drag zone.
 *   The pressed key glows GREEN while walking the safe border and ORANGE while cutting.
 * - Right: big `KES` button (hold or toggle) + small `[OTOMATİK]` one-hand switch.
 * - Arena: direct swipe steering is always available.
 */
export class TouchControls {
  private controlMode: ControlMode = 'DPAD';
  private carveButtonMode: CarveButtonMode = 'HOLD';
  private autoCut = false;

  // D-Pad state
  private dpadPointerId: number | null = null;
  private dpadStartX = 0;
  private dpadStartY = 0;
  private dpadDirection: Direction | null = null;
  private dirHoldTime = 0;
  private lastReportedDir: Direction | null = null;

  // `KES` button state
  private carvePointerId: number | null = null;
  private carveHeld = false;
  private carveToggledOn = false;
  private carveGraceTimer = 0;

  // Direct playfield swipe
  private swipePointerId: number | null = null;
  private swipeAnchorX = 0;
  private swipeAnchorY = 0;
  private swipeCurrentX = 0;
  private swipeCurrentY = 0;
  private swipeDirection: Direction | null = null;
  private swipeMoved = false;

  /** Engine callback fired when the `[OTOMATİK]` switch is tapped. */
  public onAutoCutToggle: (() => void) | null = null;

  public configure(mode: ControlMode, carveMode: CarveButtonMode, autoCut = false): void {
    if (this.controlMode !== mode) {
      this.reset();
    }
    this.controlMode = mode;
    this.carveButtonMode = carveMode;
    this.autoCut = autoCut;
    if (carveMode === 'HOLD') {
      this.carveToggledOn = false;
    }
  }

  public reset(): void {
    this.dpadPointerId = null;
    this.dpadDirection = null;
    this.dirHoldTime = 0;
    this.lastReportedDir = null;
    this.carvePointerId = null;
    this.carveHeld = false;
    this.carveToggledOn = false;
    this.carveGraceTimer = 0;
    this.swipePointerId = null;
    this.swipeDirection = null;
    this.swipeMoved = false;
  }

  public update(dt: number): void {
    if (this.carveGraceTimer > 0) {
      this.carveGraceTimer = Math.max(0, this.carveGraceTimer - dt);
    }
    const dir = this.dpadDirection ?? this.swipeDirection;
    if (dir !== null && dir === this.lastReportedDir) {
      this.dirHoldTime += dt;
    } else {
      this.dirHoldTime = 0;
    }
    this.lastReportedDir = dir;
  }

  /** Seconds the current touch direction has been held continuously (for `[OTOMATİK]`). */
  public getDirectionHoldTime(): number {
    return this.dirHoldTime;
  }

  private dpadBounds(layout: GameLayout): Rect {
    const { cx, cy, button, gap } = layout.dpad;
    const span = button * 3 + gap * 2;
    return { x: cx - span * 0.5, y: cy - span * 0.5, w: span, h: span };
  }

  public handlePointerDown(pointerId: number, vx: number, vy: number, gameplayActive: boolean): boolean {
    if (!gameplayActive) return false;
    const layout = getLayout();

    // 1. `[OTOMATİK]` switch
    if (pointInRect(vx, vy, layout.autoToggle, 12)) {
      this.onAutoCutToggle?.();
      NativeBridge.hapticCornerTurn();
      return true;
    }

    // 2. `KES` button (generous hit area)
    const inCut = pointInRect(vx, vy, layout.cutButton, 26);
    const inRightDeck =
      layout.mode === 'LANDSCAPE_SPLIT'
        ? layout.rightWing !== null &&
          pointInRect(vx, vy, layout.rightWing) &&
          vy > layout.rightWing.y + layout.rightWing.h * 0.5
        : layout.deckRect !== null &&
          vy >= layout.deckRect.y &&
          vx > layout.dpad.cx + (layout.dpad.button * 1.5 + layout.dpad.gap) + 40;
    if (inCut || inRightDeck) {
      this.carvePointerId = pointerId;
      if (this.carveButtonMode === 'TOGGLE') {
        this.carveToggledOn = !this.carveToggledOn;
      } else {
        this.carveHeld = true;
        this.carveGraceTimer = 0.32;
      }
      NativeBridge.hapticCornerTurn();
      return true;
    }

    // 3. D-Pad (generous: whole left part of the deck / lower left wing)
    const bounds = this.dpadBounds(layout);
    const inDpad = pointInRect(vx, vy, bounds, 30);
    const inLeftDeck =
      layout.mode === 'LANDSCAPE_SPLIT'
        ? layout.leftWing !== null &&
          pointInRect(vx, vy, layout.leftWing) &&
          vy > layout.leftWing.y + layout.leftWing.h * 0.35
        : layout.deckRect !== null && vy >= layout.deckRect.y;
    if (inDpad || inLeftDeck) {
      this.dpadPointerId = pointerId;
      this.dpadStartX = vx;
      this.dpadStartY = vy;
      this.dpadDirection = this.resolveDpadDirection(vx, vy, layout, null);
      if (this.dpadDirection) NativeBridge.hapticCornerTurn();
      return true;
    }

    // 4. Direct arena swipe (or full-screen swipe in `KAYDIR` mode)
    const inArena = pointInRect(vx, vy, layout.arenaFrame, 10);
    if ((inArena || this.controlMode === 'SWIPE') && this.swipePointerId === null) {
      this.swipePointerId = pointerId;
      this.swipeAnchorX = vx;
      this.swipeAnchorY = vy;
      this.swipeCurrentX = vx;
      this.swipeCurrentY = vy;
      this.swipeMoved = false;
      if (this.controlMode !== 'SWIPE') {
        this.swipeDirection = null;
      }
      return true;
    }

    return false;
  }

  public handlePointerMove(pointerId: number, vx: number, vy: number): void {
    if (pointerId === this.dpadPointerId) {
      const next = this.resolveDpadDirection(vx, vy, getLayout(), this.dpadDirection);
      if (next !== this.dpadDirection) {
        this.dpadDirection = next;
        if (next) NativeBridge.hapticCornerTurn();
      }
      return;
    }

    if (pointerId === this.swipePointerId) {
      this.swipeCurrentX = vx;
      this.swipeCurrentY = vy;
      const dx = vx - this.swipeAnchorX;
      const dy = vy - this.swipeAnchorY;
      if (Math.hypot(dx, dy) >= SWIPE_THRESHOLD) {
        const newDir = this.resolveHysteresisDirection(dx, dy, this.swipeDirection);
        if (newDir !== this.swipeDirection) {
          this.swipeDirection = newDir;
          NativeBridge.hapticCornerTurn();
        }
        this.swipeMoved = true;
        this.swipeAnchorX = vx;
        this.swipeAnchorY = vy;
      }
    }
  }

  public handlePointerUp(pointerId: number): void {
    if (pointerId === this.dpadPointerId) {
      this.dpadPointerId = null;
      this.dpadDirection = null;
    }
    if (pointerId === this.carvePointerId) {
      this.carvePointerId = null;
      if (this.carveHeld) {
        // 0.24s grace after releasing `KES` so simultaneous thumb flicks still launch a cut
        this.carveGraceTimer = 0.24;
      }
      this.carveHeld = false;
    }
    if (pointerId === this.swipePointerId) {
      this.swipePointerId = null;
      if (this.controlMode === 'SWIPE') {
        if (!this.swipeMoved) {
          this.swipeDirection = null;
        }
      } else {
        this.swipeDirection = null;
      }
      this.swipeMoved = false;
    }
  }

  public isCarveVisuallyPressed(): boolean {
    return this.carveButtonMode === 'TOGGLE' ? this.carveToggledOn : this.carveHeld;
  }

  public getSnapshot(): TouchSnapshot {
    const carveBtnActive =
      this.carveButtonMode === 'TOGGLE'
        ? this.carveToggledOn
        : this.carveHeld || this.carveGraceTimer > 0;

    if (this.dpadDirection !== null) {
      return { direction: this.dpadDirection, carveActive: carveBtnActive, autoCarveSwipe: false };
    }
    if (this.swipeDirection !== null) {
      return { direction: this.swipeDirection, carveActive: true, autoCarveSwipe: true };
    }
    return { direction: null, carveActive: carveBtnActive, autoCarveSwipe: false };
  }

  /**
   * Thumb on a key -> that key. Thumb in the center hub -> direction of the drag vector
   * (>= 10px). Sliding between keys switches instantly; hysteresis prevents diagonal flicker.
   */
  private resolveDpadDirection(
    vx: number,
    vy: number,
    layout: GameLayout,
    current: Direction | null
  ): Direction | null {
    const { cx, cy, button } = layout.dpad;
    const dx = vx - cx;
    const dy = vy - cy;
    const hub = button * 0.5;
    if (Math.abs(dx) <= hub && Math.abs(dy) <= hub) {
      const ddx = vx - this.dpadStartX;
      const ddy = vy - this.dpadStartY;
      if (Math.hypot(ddx, ddy) < DPAD_DRAG_THRESHOLD) {
        return current;
      }
      return this.resolveHysteresisDirection(ddx, ddy, current);
    }
    return this.resolveHysteresisDirection(dx, dy, current);
  }

  private resolveHysteresisDirection(dx: number, dy: number, current: Direction | null): Direction {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (current === 'LEFT' || current === 'RIGHT') {
      if (ay > ax * HYSTERESIS) return dy > 0 ? 'DOWN' : 'UP';
      return dx > 0 ? 'RIGHT' : 'LEFT';
    }
    if (current === 'UP' || current === 'DOWN') {
      if (ax > ay * HYSTERESIS) return dx > 0 ? 'RIGHT' : 'LEFT';
      return dy > 0 ? 'DOWN' : 'UP';
    }
    return ax >= ay ? (dx > 0 ? 'RIGHT' : 'LEFT') : dy > 0 ? 'DOWN' : 'UP';
  }

  // ==========================================================================
  // RENDERING
  // ==========================================================================
  public renderControls(ctx: CanvasRenderingContext2D, shipCutting: boolean): void {
    const layout = getLayout();
    ctx.save();

    if (layout.deckRect) {
      const d = layout.deckRect;
      ctx.fillStyle = '#0A0D16';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#1C2438';
      ctx.fillRect(d.x, d.y, d.w, 3);
    }

    const activeDir = this.dpadDirection ?? this.swipeDirection;
    const litColor = shipCutting ? '#FF8818' : PALETTE.SAFE_GREEN;
    const { cx, cy, button, gap } = layout.dpad;
    const step = button + gap;

    // D-pad cross backplate
    ctx.fillStyle = '#05070C';
    const plate = button + 16;
    ctx.fillRect(cx - plate * 0.5, cy - step * 1.5 - 8 + gap * 0.5, plate, step * 3 + 16 - gap);
    ctx.fillRect(cx - step * 1.5 - 8 + gap * 0.5, cy - plate * 0.5, step * 3 + 16 - gap, plate);

    const keys: Array<[Direction, number, number]> = [
      ['UP', cx, cy - step],
      ['DOWN', cx, cy + step],
      ['LEFT', cx - step, cy],
      ['RIGHT', cx + step, cy]
    ];
    for (const [dir, kx, ky] of keys) {
      this.drawArrowKey(ctx, kx, ky, button, dir, activeDir === dir, litColor);
    }
    // Center hub
    ctx.fillStyle = '#20283A';
    ctx.fillRect(cx - button * 0.32, cy - button * 0.32, button * 0.64, button * 0.64);
    ctx.fillStyle = '#2E384E';
    ctx.fillRect(cx - button * 0.2, cy - button * 0.2, button * 0.4, button * 0.4);

    this.drawCutButton(ctx, layout.cutButton, this.isCarveVisuallyPressed());
    this.drawAutoToggle(ctx, layout.autoToggle, this.autoCut);

    // Direct arena drag feedback
    if (this.swipePointerId !== null && this.swipeDirection !== null) {
      const sx = Math.round(this.swipeCurrentX);
      const sy = Math.round(this.swipeCurrentY);
      if (pointInRect(sx, sy, layout.arenaFrame)) {
        ctx.fillStyle = PALETTE.CUT_ORANGE;
        ctx.fillRect(sx - 6, sy - 6, 12, 12);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      }
    }

    ctx.restore();
  }

  private drawArrowKey(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    dir: Direction,
    lit: boolean,
    litColor: string
  ): void {
    const x = Math.round(cx - size * 0.5);
    const y = Math.round(cy - size * 0.5);
    const s = Math.round(size);
    const bevel = Math.max(4, Math.round(s * 0.07));

    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(x - 3, y - 3, s + 6, s + 6);
    ctx.fillStyle = lit ? '#FFF2B0' : '#5A6478';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = lit ? '#8A3C08' : '#1C2230';
    ctx.fillRect(x + bevel, y + bevel, s - bevel, s - bevel);
    ctx.fillStyle = lit ? litColor : '#343C50';
    ctx.fillRect(x + bevel, y + bevel, s - bevel * 2, s - bevel * 2);

    // Pixel chevron arrow
    const u = Math.max(3, Math.round(s / 16));
    ctx.fillStyle = lit ? '#FFFFFF' : '#C8D2E4';
    for (let i = 0; i < 4; i++) {
      const len = (i * 2 + 1) * u;
      if (dir === 'UP') {
        ctx.fillRect(Math.round(cx - len * 0.5), Math.round(cy - 2 * u + i * u), len, u);
      } else if (dir === 'DOWN') {
        ctx.fillRect(Math.round(cx - len * 0.5), Math.round(cy + 2 * u - i * u - u), len, u);
      } else if (dir === 'LEFT') {
        ctx.fillRect(Math.round(cx - 2 * u + i * u), Math.round(cy - len * 0.5), u, len);
      } else {
        ctx.fillRect(Math.round(cx + 2 * u - i * u - u), Math.round(cy - len * 0.5), u, len);
      }
    }
  }

  private drawCutButton(ctx: CanvasRenderingContext2D, r: Rect, pressed: boolean): void {
    const x = Math.round(r.x);
    const y = Math.round(r.y);
    const w = Math.round(r.w);
    const h = Math.round(r.h);
    const press = pressed ? 4 : 0;

    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
    // Orange outer frame
    ctx.fillStyle = pressed ? '#C85A10' : '#FF8818';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#7A3008';
    ctx.fillRect(x + 8, y + h - 10, w - 8, 10);
    // Green inner face
    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(x + 12, y + 12 + press, w - 24, h - 26);
    ctx.fillStyle = pressed ? '#148C24' : '#22B834';
    ctx.fillRect(x + 15, y + 15 + press, w - 30, h - 32);
    ctx.fillStyle = pressed ? '#1EA830' : '#4CE05C';
    ctx.fillRect(x + 15, y + 15 + press, w - 30, 8);

    drawPixelText(ctx, 'KES', x + w * 0.5, y + h * 0.5 + press - 2, {
      scale: Math.max(3, Math.round(h / 28)),
      tone: 'gold',
      align: 'center'
    });
  }

  private drawAutoToggle(ctx: CanvasRenderingContext2D, r: Rect, on: boolean): void {
    const x = Math.round(r.x);
    const y = Math.round(r.y);
    const h = Math.round(r.h);
    const pillW = Math.round(h * 1.5);

    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(x - 2, y - 2, pillW + 4, h + 4);
    ctx.fillStyle = on ? '#1E8C2C' : '#2A3244';
    ctx.fillRect(x, y, pillW, h);
    const knob = h - 10;
    ctx.fillStyle = on ? '#B8FF98' : '#9AA4B8';
    ctx.fillRect(on ? x + pillW - knob - 5 : x + 5, y + 5, knob, knob);

    const label = '[OTOMATİK]';
    drawPixelText(ctx, label, x + pillW + 12, y + h * 0.5, {
      scale: Math.max(2, Math.round(h / 22)),
      tone: on ? 'green' : 'silver',
      align: 'left'
    });
  }
}
