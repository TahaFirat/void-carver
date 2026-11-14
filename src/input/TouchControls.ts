import { PALETTE } from '../core/Config';
import {
  GameLayout,
  getLayout,
  JoystickSide,
  pointInRect,
  setPreferredJoystickSide
} from '../core/ResponsiveLayout';
import { Direction } from '../geometry/Types';
import { NativeBridge } from '../native/NativeBridge';
import { drawPixelText } from '../rendering/PixelArtEngine';
import { ControlMode } from '../services/StorageService';

export interface TouchSnapshot {
  direction: Direction | null;
  /** Secondary axis when holding diagonally (used ONLY to glide along outer border walls). */
  secondaryDirection: Direction | null;
  /** Reserved for external hardware triggers; touch cutting uses smart inward auto-cut. */
  carveActive: boolean;
  /** True while one-finger touch steering is active and eligible for inward auto-cut. */
  autoCarveSwipe: boolean;
}

const HYSTERESIS = 1.14;
const JOYSTICK_THROW = 68;
const JOYSTICK_DEADZONE = 14;
const DPAD_DEADZONE = 14;
const SWIPE_THROW = 64;
const SWIPE_DEADZONE = 14;

/**
 * Native-Feel Mobile Control Deck (3 Genuinely Distinct Modes + `SAĞ` / `SOL` / `ORTA`):
 * 1. `JOYSTICK`: Visible-Anchor Ergonomic Floating Joystick (`JOYSTICK_THROW = 68` virtual px
 *    so slight thumb relaxation never flips backwards, while the visible ring moves to your
 *    thumb anchor so your eyes and thumb share the exact same center).
 * 2. `DPAD`: Fixed Giant 4-Button Arcade Cross (`▲ ▼ ◄ ►`) that fires immediately on tap
 *    and lets you roll smoothly across fixed wedges.
 * 3. `SWIPE`: Full-screen / full-deck free drag with a sleek floating vector ring under finger.
 */
export class TouchControls {
  private controlMode: ControlMode = 'JOYSTICK';
  private joystickSide: JoystickSide = 'RIGHT';
  private onSwapSideCallback: (() => void) | null = null;

  private joystickPointerId: number | null = null;
  private joystickDirection: Direction | null = null;
  private joystickSecondaryDirection: Direction | null = null;
  private joystickOriginX = 0;
  private joystickOriginY = 0;
  private joystickThumbX = 0;
  private joystickThumbY = 0;
  private cutArmProgress = 0;

  private swipePointerId: number | null = null;
  private swipeOriginX = 0;
  private swipeOriginY = 0;
  private swipeCurrentX = 0;
  private swipeCurrentY = 0;
  private swipeDirection: Direction | null = null;
  private swipeSecondaryDirection: Direction | null = null;

  public setOnSwapSide(cb: () => void): void {
    this.onSwapSideCallback = cb;
  }

  public configure(mode: ControlMode, side: JoystickSide = this.joystickSide): void {
    const changed = this.controlMode !== mode || this.joystickSide !== side;
    this.controlMode = mode;
    this.joystickSide = side;
    setPreferredJoystickSide(side);
    if (changed) {
      this.reset();
    }
  }

  public getControlMode(): ControlMode {
    return this.controlMode;
  }

  public getJoystickSide(): JoystickSide {
    return this.joystickSide;
  }

  public reset(): void {
    this.joystickPointerId = null;
    this.joystickDirection = null;
    this.joystickSecondaryDirection = null;
    this.joystickOriginX = 0;
    this.joystickOriginY = 0;
    this.joystickThumbX = 0;
    this.joystickThumbY = 0;
    this.cutArmProgress = 0;
    this.swipePointerId = null;
    this.swipeDirection = null;
    this.swipeSecondaryDirection = null;
  }

  public handlePointerDown(
    pointerId: number,
    vx: number,
    vy: number,
    gameplayActive: boolean
  ): boolean {
    if (!gameplayActive) return false;
    const layout = getLayout();

    // 1. Quick 1-tap `KONUM: SAĞ / SOL / ORTA` cycle pill
    if (pointInRect(vx, vy, layout.swapSideButton, 10)) {
      this.reset();
      this.onSwapSideCallback?.();
      return true;
    }

    // 2. Full-screen / full-deck `SWIPE` mode uses floating swipe everywhere
    if (this.controlMode === 'SWIPE') {
      if (this.swipePointerId === null) {
        this.swipePointerId = pointerId;
        this.swipeOriginX = vx;
        this.swipeOriginY = vy;
        this.swipeCurrentX = vx;
        this.swipeCurrentY = vy;
        this.swipeDirection = null;
        this.swipeSecondaryDirection = null;
        return true;
      }
      return false;
    }

    // 3. `DPAD` mode: Fixed 4-Button Cross around `layout.joystick` — responds immediately on tap!
    const stick = layout.joystick;
    const distFromStick = Math.hypot(vx - stick.cx, vy - stick.cy);
    const inStickCircle = distFromStick <= stick.radius * 1.55;
    const inStickZone = pointInRect(vx, vy, layout.joystickZone, 8);

    if (this.controlMode === 'DPAD') {
      if (this.joystickPointerId === null && (inStickCircle || inStickZone)) {
        this.joystickPointerId = pointerId;
        this.joystickOriginX = stick.cx;
        this.joystickOriginY = stick.cy;
        this.updateFixedDpad(vx, vy, layout);
        return true;
      }
    } else {
      // 4. `JOYSTICK` mode: Visible-Anchor Floating Joystick inside `joystickZone`
      if (this.joystickPointerId === null && (inStickCircle || inStickZone)) {
        this.joystickPointerId = pointerId;
        const clamped = this.clampAnchorToDeck(vx, vy, layout);
        this.joystickOriginX = clamped.x;
        this.joystickOriginY = clamped.y;
        this.joystickDirection = null;
        this.joystickSecondaryDirection = null;
        this.joystickThumbX = 0;
        this.joystickThumbY = 0;
        // If finger landed near deck edge so clamping left an initial offset, resolve it cleanly
        if (Math.hypot(vx - clamped.x, vy - clamped.y) >= JOYSTICK_DEADZONE) {
          this.updateDynamicJoystick(vx, vy, layout);
        }
        return true;
      }
    }

    // 5. Fallback direct arena / auxiliary deck drag steering
    const inArena = pointInRect(vx, vy, layout.arenaFrame, 12);
    const inDeck = layout.deckRect ? pointInRect(vx, vy, layout.deckRect, 4) : false;
    if ((inArena || inDeck) && this.swipePointerId === null) {
      this.swipePointerId = pointerId;
      this.swipeOriginX = vx;
      this.swipeOriginY = vy;
      this.swipeCurrentX = vx;
      this.swipeCurrentY = vy;
      this.swipeDirection = null;
      this.swipeSecondaryDirection = null;
      return true;
    }

    return false;
  }

  public handlePointerMove(pointerId: number, vx: number, vy: number): void {
    if (pointerId === this.joystickPointerId) {
      const layout = getLayout();
      if (this.controlMode === 'DPAD') {
        this.updateFixedDpad(vx, vy, layout);
      } else {
        this.updateDynamicJoystick(vx, vy, layout);
      }
      return;
    }

    if (pointerId === this.swipePointerId) {
      this.swipeCurrentX = vx;
      this.swipeCurrentY = vy;
      let dx = vx - this.swipeOriginX;
      let dy = vy - this.swipeOriginY;
      const dist = Math.hypot(dx, dy);
      if (dist > SWIPE_THROW) {
        const pull = (dist - SWIPE_THROW) / dist;
        this.swipeOriginX += dx * pull;
        this.swipeOriginY += dy * pull;
        dx = vx - this.swipeOriginX;
        dy = vy - this.swipeOriginY;
      }
      if (Math.hypot(dx, dy) < SWIPE_DEADZONE) {
        this.swipeDirection = null;
        this.swipeSecondaryDirection = null;
        return;
      }
      const next = this.resolveDirection(dx, dy, this.swipeDirection);
      this.swipeSecondaryDirection = this.resolveSecondaryDirection(dx, dy, next, SWIPE_DEADZONE);
      if (next !== this.swipeDirection) {
        this.swipeDirection = next;
        NativeBridge.hapticCornerTurn();
      }
    }
  }

  public handlePointerUp(pointerId: number): void {
    if (pointerId === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.joystickDirection = null;
      this.joystickSecondaryDirection = null;
      this.joystickThumbX = 0;
      this.joystickThumbY = 0;
      this.cutArmProgress = 0;
    }

    if (pointerId === this.swipePointerId) {
      this.swipePointerId = null;
      this.swipeDirection = null;
      this.swipeSecondaryDirection = null;
      this.cutArmProgress = 0;
    }
  }

  public isCarveVisuallyPressed(): boolean {
    return this.joystickDirection !== null || this.swipeDirection !== null;
  }

  public setCutArmProgress(progress: number): void {
    this.cutArmProgress = Math.max(0, Math.min(1, progress));
  }

  public getSnapshot(): TouchSnapshot {
    const useStick = this.joystickDirection !== null;
    const direction = useStick ? this.joystickDirection : this.swipeDirection;
    const secondaryDirection = useStick
      ? this.joystickSecondaryDirection
      : this.swipeSecondaryDirection;
    return {
      direction,
      secondaryDirection,
      carveActive: false,
      autoCarveSwipe: direction !== null
    };
  }

  private clampAnchorToDeck(vx: number, vy: number, layout: GameLayout): { x: number; y: number } {
    const pad = Math.min(86, layout.joystick.radius * 0.78);
    if (layout.deckRect) {
      const d = layout.deckRect;
      return {
        x: Math.max(d.x + pad, Math.min(d.x + d.w - pad, vx)),
        y: Math.max(d.y + pad * 0.85, Math.min(d.y + d.h - pad * 0.85, vy))
      };
    }
    const z = layout.joystickZone;
    return {
      x: Math.max(z.x + pad * 0.7, Math.min(z.x + z.w - pad * 0.7, vx)),
      y: Math.max(z.y + pad * 0.7, Math.min(z.y + z.h - pad * 0.7, vy))
    };
  }

  private updateFixedDpad(vx: number, vy: number, layout: GameLayout): void {
    const { cx, cy, radius } = layout.joystick;
    const dx = vx - cx;
    const dy = vy - cy;
    const dist = Math.hypot(dx, dy);
    const maxVis = radius * 0.48;
    const visScale = dist > maxVis ? maxVis / dist : 1;
    this.joystickThumbX = dx * visScale;
    this.joystickThumbY = dy * visScale;

    if (dist < DPAD_DEADZONE) {
      this.joystickDirection = null;
      this.joystickSecondaryDirection = null;
      return;
    }

    const next = this.resolveDirection(dx, dy, this.joystickDirection);
    this.joystickSecondaryDirection = this.resolveSecondaryDirection(dx, dy, next, DPAD_DEADZONE);
    if (next !== this.joystickDirection) {
      this.joystickDirection = next;
      NativeBridge.hapticCornerTurn();
    }
  }

  private updateDynamicJoystick(vx: number, vy: number, layout: GameLayout): void {
    const { radius } = layout.joystick;
    let dx = vx - this.joystickOriginX;
    let dy = vy - this.joystickOriginY;
    const rawDist = Math.hypot(dx, dy);

    // Comfortable 68 virtual px (~5mm) thumb throw: relaxing thumb slightly never flips 180°,
    // while dragging past 68px smoothly pulls the visible anchor along behind the thumb!
    if (rawDist > JOYSTICK_THROW) {
      const pull = (rawDist - JOYSTICK_THROW) / rawDist;
      const nextOx = this.joystickOriginX + dx * pull;
      const nextOy = this.joystickOriginY + dy * pull;
      const clamped = this.clampAnchorToDeck(nextOx, nextOy, layout);
      this.joystickOriginX = clamped.x;
      this.joystickOriginY = clamped.y;
      dx = vx - this.joystickOriginX;
      dy = vy - this.joystickOriginY;
    }

    const dist = Math.hypot(dx, dy);
    const visualTravel = Math.max(42, radius * 0.48);
    const clampedRatio = Math.min(1, dist / JOYSTICK_THROW);
    const ux = dist > 0.001 ? dx / dist : 0;
    const uy = dist > 0.001 ? dy / dist : 0;
    this.joystickThumbX = ux * clampedRatio * visualTravel;
    this.joystickThumbY = uy * clampedRatio * visualTravel;

    if (dist < JOYSTICK_DEADZONE) {
      this.joystickDirection = null;
      this.joystickSecondaryDirection = null;
      return;
    }

    const next = this.resolveDirection(dx, dy, this.joystickDirection);
    this.joystickSecondaryDirection = this.resolveSecondaryDirection(
      dx,
      dy,
      next,
      JOYSTICK_DEADZONE
    );
    if (next !== this.joystickDirection) {
      this.joystickDirection = next;
      NativeBridge.hapticCornerTurn();
    }
  }

  private resolveDirection(dx: number, dy: number, current: Direction | null): Direction {
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

  private resolveSecondaryDirection(
    dx: number,
    dy: number,
    primary: Direction,
    deadzone: number
  ): Direction | null {
    const minSecondary = deadzone * 1.25;
    if (primary === 'UP' || primary === 'DOWN') {
      if (Math.abs(dx) >= minSecondary) return dx > 0 ? 'RIGHT' : 'LEFT';
      return null;
    }
    if (Math.abs(dy) >= minSecondary) return dy > 0 ? 'DOWN' : 'UP';
    return null;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  public renderControls(
    ctx: CanvasRenderingContext2D,
    shipCutting: boolean,
    shipBacktracking = false
  ): void {
    const layout = getLayout();
    const litColor = shipBacktracking
      ? '#50F0FF'
      : shipCutting
        ? PALETTE.CUT_ORANGE
        : PALETTE.SAFE_GREEN;

    ctx.save();
    if (layout.deckRect) {
      const d = layout.deckRect;
      ctx.fillStyle = '#080C15';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#263450';
      ctx.fillRect(d.x, d.y, d.w, 3);
    }

    if (this.controlMode === 'DPAD') {
      this.drawCrossDpad(ctx, layout, litColor);
    } else if (this.controlMode === 'SWIPE') {
      this.drawSwipeDeckGuide(ctx, layout, litColor, shipCutting, shipBacktracking);
    } else {
      this.getArcadeJoystickSprite(ctx, layout, litColor);
    }

    this.drawAuxiliaryStatusAndSwap(ctx, layout, shipCutting, shipBacktracking);

    // Floating guide ring when dragging in `SWIPE` mode or directly inside the arena
    if (this.swipePointerId !== null) {
      const ox = Math.round(this.swipeOriginX);
      const oy = Math.round(this.swipeOriginY);
      const sx = Math.round(this.swipeCurrentX);
      const sy = Math.round(this.swipeCurrentY);
      if (this.controlMode === 'SWIPE' || pointInRect(sx, sy, layout.arenaFrame, 24)) {
        ctx.beginPath();
        ctx.arc(ox, oy, 54, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 16, 28, 0.45)';
        ctx.fill();
        ctx.strokeStyle = this.swipeDirection ? litColor : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 4;
        ctx.stroke();

        if (this.cutArmProgress > 0) {
          ctx.beginPath();
          ctx.arc(
            ox,
            oy,
            63,
            -Math.PI * 0.5,
            -Math.PI * 0.5 + Math.PI * 2 * this.cutArmProgress
          );
          ctx.strokeStyle = '#FFE066';
          ctx.lineWidth = 7;
          ctx.lineCap = 'round';
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = litColor;
        ctx.lineWidth = 4;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.fillStyle = litColor;
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  private getArcadeJoystickSprite(
    ctx: CanvasRenderingContext2D,
    layout: GameLayout,
    litColor: string
  ): void {
    const { radius } = layout.joystick;
    // Move visible joystick base right to the active thumb anchor so eyes & thumb match 1:1!
    const cx = this.joystickPointerId !== null ? this.joystickOriginX : layout.joystick.cx;
    const cy = this.joystickPointerId !== null ? this.joystickOriginY : layout.joystick.cy;

    // Outer recessed arcade well
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#04060B';
    ctx.fill();
    ctx.strokeStyle = this.joystickPointerId !== null ? '#4A6288' : '#344662';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Active joystick plate
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#111B2E';
    ctx.fill();
    ctx.strokeStyle = this.joystickDirection ? litColor : '#7C92B2';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Inner deadzone / throw guide ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = '#283852';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Smooth gold inward auto-cut progress ring
    if (this.cutArmProgress > 0) {
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius + 18,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + Math.PI * 2 * this.cutArmProgress
      );
      ctx.strokeStyle = '#FFE066';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    this.drawDirectionTicks(ctx, cx, cy, radius * 0.78, litColor);

    const thumbX = cx + (this.joystickPointerId === null ? 0 : this.joystickThumbX);
    const thumbY = cy + (this.joystickPointerId === null ? 0 : this.joystickThumbY);
    const knobRadius = radius * 0.4;

    ctx.beginPath();
    ctx.arc(thumbX, thumbY + 5, knobRadius + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#03050A';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(thumbX, thumbY, knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.joystickDirection ? litColor : '#5E7494';
    ctx.fill();
    ctx.strokeStyle = '#EAF2FF';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      thumbX - knobRadius * 0.18,
      thumbY - knobRadius * 0.2,
      knobRadius * 0.58,
      Math.PI * 1.08,
      Math.PI * 1.92
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  private drawCrossDpad(
    ctx: CanvasRenderingContext2D,
    layout: GameLayout,
    litColor: string
  ): void {
    const { cx, cy, radius } = layout.joystick;
    const armLen = Math.round(radius + 10);
    const armHalf = Math.round(Math.max(34, radius * 0.36));

    // Recessed circular housing
    ctx.beginPath();
    ctx.arc(cx, cy, armLen + 12, 0, Math.PI * 2);
    ctx.fillStyle = '#04060B';
    ctx.fill();
    ctx.strokeStyle = '#384B6A';
    ctx.lineWidth = 5;
    ctx.stroke();

    if (this.cutArmProgress > 0) {
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        armLen + 20,
        -Math.PI * 0.5,
        -Math.PI * 0.5 + Math.PI * 2 * this.cutArmProgress
      );
      ctx.strokeStyle = '#FFE066';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    const buttons: Array<{ dir: Direction; bx: number; by: number; bw: number; bh: number }> = [
      { dir: 'UP', bx: cx - armHalf, by: cy - armLen, bw: armHalf * 2, bh: armLen - armHalf * 0.5 },
      {
        dir: 'DOWN',
        bx: cx - armHalf,
        by: cy + armHalf * 0.5,
        bw: armHalf * 2,
        bh: armLen - armHalf * 0.5
      },
      {
        dir: 'LEFT',
        bx: cx - armLen,
        by: cy - armHalf,
        bw: armLen - armHalf * 0.5,
        bh: armHalf * 2
      },
      {
        dir: 'RIGHT',
        bx: cx + armHalf * 0.5,
        by: cy - armHalf,
        bw: armLen - armHalf * 0.5,
        bh: armHalf * 2
      }
    ];

    // Center hub
    ctx.fillStyle = '#121C2E';
    ctx.fillRect(cx - armHalf, cy - armHalf, armHalf * 2, armHalf * 2);

    for (const b of buttons) {
      const active = this.joystickDirection === b.dir;
      const rx = Math.round(b.bx);
      const ry = Math.round(b.by);
      const rw = Math.round(b.bw);
      const rh = Math.round(b.bh);

      ctx.fillStyle = '#03050A';
      ctx.fillRect(rx - 3, ry - 3, rw + 6, rh + 6);
      ctx.fillStyle = active ? litColor : '#1A2842';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = active ? '#FFFFFF' : '#7E96B8';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(rx + 1.5, ry + 1.5, rw - 3, rh - 3);

      const acx = rx + rw * 0.5;
      const acy = ry + rh * 0.5;
      const tri = Math.max(12, armHalf * 0.42);
      ctx.beginPath();
      if (b.dir === 'UP') {
        ctx.moveTo(acx, acy - tri);
        ctx.lineTo(acx - tri, acy + tri * 0.7);
        ctx.lineTo(acx + tri, acy + tri * 0.7);
      } else if (b.dir === 'DOWN') {
        ctx.moveTo(acx, acy + tri);
        ctx.lineTo(acx - tri, acy - tri * 0.7);
        ctx.lineTo(acx + tri, acy - tri * 0.7);
      } else if (b.dir === 'LEFT') {
        ctx.moveTo(acx - tri, acy);
        ctx.lineTo(acx + tri * 0.7, acy - tri);
        ctx.lineTo(acx + tri * 0.7, acy + tri);
      } else {
        ctx.moveTo(acx + tri, acy);
        ctx.lineTo(acx - tri * 0.7, acy - tri);
        ctx.lineTo(acx - tri * 0.7, acy + tri);
      }
      ctx.closePath();
      ctx.fillStyle = active ? '#080C14' : '#EAF2FF';
      ctx.fill();
    }

    // Center pivot dot
    ctx.beginPath();
    ctx.arc(cx, cy, armHalf * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = '#283854';
    ctx.fill();
  }

  private drawSwipeDeckGuide(
    ctx: CanvasRenderingContext2D,
    layout: GameLayout,
    litColor: string,
    shipCutting: boolean,
    shipBacktracking: boolean
  ): void {
    const { cx, cy, radius } = layout.joystick;
    const padW = Math.min(360, radius * 2.5);
    const padH = Math.min(184, radius * 1.45);
    const px = Math.round(cx - padW * 0.5);
    const py = Math.round(cy - padH * 0.5);

    ctx.fillStyle = '#0C1322';
    ctx.fillRect(px, py, padW, padH);
    ctx.strokeStyle = this.swipeDirection ? litColor : '#42587C';
    ctx.lineWidth = 3.5;
    ctx.strokeRect(px, py, padW, padH);

    const activeDir = this.swipeDirection;
    const label = shipBacktracking
      ? 'GERİ ÇEKİLİYOR'
      : shipCutting
        ? 'KESİM SÜRÜYOR'
        : activeDir
          ? `YÖN: ${activeDir === 'UP' ? 'YUKARI' : activeDir === 'DOWN' ? 'AŞAĞI' : activeDir === 'LEFT' ? 'SOL' : 'SAĞ'}`
          : 'PARMAĞINI SÜRÜKLE';
    drawPixelText(ctx, label, cx, cy - 12, {
      scale: 2.9,
      tone: shipCutting ? 'orange' : activeDir ? 'green' : 'cyan',
      align: 'center'
    });
    drawPixelText(ctx, 'EKRANIN HER YERİ AKTİF', cx, cy + 28, {
      scale: 2.3,
      tone: 'silver',
      align: 'center'
    });
  }

  private drawAuxiliaryStatusAndSwap(
    ctx: CanvasRenderingContext2D,
    layout: GameLayout,
    shipCutting: boolean,
    shipBacktracking: boolean
  ): void {
    this.drawSwapSideButton(ctx, layout);

    // Clean, readable live status badge above the swap button when docked Left or Right
    if (layout.joystickSide !== 'CENTER' && layout.deckRect) {
      const r = layout.swapSideButton;
      const statusCx = r.x + r.w * 0.5;
      const statusY = Math.max(layout.deckRect.y + 42, r.y - 46);
      const statusText = shipBacktracking
        ? 'GERİ ÇEKİL!'
        : shipCutting
          ? 'KESİMDE!'
          : this.cutArmProgress > 0
            ? 'KESİME GİRİYOR'
            : 'İÇERİ SÜR -> KES';
      const statusTone = shipBacktracking
        ? 'cyan'
        : shipCutting
          ? 'orange'
          : this.cutArmProgress > 0
            ? 'gold'
            : 'green';
      drawPixelText(ctx, statusText, statusCx, statusY, {
        scale: 2.8,
        tone: statusTone,
        align: 'center'
      });
    }
  }

  private drawSwapSideButton(ctx: CanvasRenderingContext2D, layout: GameLayout): void {
    const r = layout.swapSideButton;
    const currentPos =
      layout.joystickSide === 'RIGHT'
        ? 'SAĞ'
        : layout.joystickSide === 'LEFT'
          ? 'SOL'
          : 'ORTA';
    const targetLabel = layout.joystickSide === 'CENTER' ? `⇄ ${currentPos}` : `⇄ YER: ${currentPos}`;

    ctx.fillStyle = '#04060C';
    ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    ctx.fillStyle = '#152238';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#849EC4';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);

    drawPixelText(ctx, targetLabel, r.x + r.w * 0.5, r.y + r.h * 0.5, {
      scale: Math.max(2.5, Math.min(3.0, r.w / 78)),
      tone: 'cyan',
      align: 'center'
    });
  }

  private drawDirectionTicks(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    distance: number,
    color: string
  ): void {
    const ticks: Array<[Direction, number, number]> = [
      ['UP', 0, -1],
      ['DOWN', 0, 1],
      ['LEFT', -1, 0],
      ['RIGHT', 1, 0]
    ];
    for (const [dir, dx, dy] of ticks) {
      const x = cx + dx * distance;
      const y = cy + dy * distance;
      const active = this.joystickDirection === dir;
      const s = Math.max(9, distance * 0.14);
      ctx.beginPath();
      if (dir === 'UP') {
        ctx.moveTo(x - s, y + s * 0.45);
        ctx.lineTo(x, y - s * 0.45);
        ctx.lineTo(x + s, y + s * 0.45);
      } else if (dir === 'DOWN') {
        ctx.moveTo(x - s, y - s * 0.45);
        ctx.lineTo(x, y + s * 0.45);
        ctx.lineTo(x + s, y - s * 0.45);
      } else if (dir === 'LEFT') {
        ctx.moveTo(x + s * 0.45, y - s);
        ctx.lineTo(x - s * 0.45, y);
        ctx.lineTo(x + s * 0.45, y + s);
      } else {
        ctx.moveTo(x - s * 0.45, y - s);
        ctx.lineTo(x + s * 0.45, y);
        ctx.lineTo(x - s * 0.45, y + s);
      }
      ctx.strokeStyle = active ? '#FFFFFF' : color;
      ctx.globalAlpha = active ? 1 : 0.74;
      ctx.lineWidth = active ? 6.5 : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
