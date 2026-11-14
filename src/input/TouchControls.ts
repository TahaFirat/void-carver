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
  /** True while the dedicated `KES` button is held for instant 0ms cut launch. */
  carveActive: boolean;
  /** True while one-finger joystick/arena drag is steering and eligible for smart auto-cut. */
  autoCarveSwipe: boolean;
}

const HYSTERESIS = 1.15;

/**
 * Ergonomic Dual-Handed / One-Handed Mobile Control Deck:
 * - Configurable `SAĞ` (Right) or `SOL` (Left) Dynamic-Follow Virtual Joystick.
 * - Origin anchors at finger-down and follows behind the thumb (`maxTravel`), so off-center
 *   touches never invert direction and 90° turns / 180° backtracks respond immediately.
 * - Opposite side provides an optional instant `KES` hold button + 1-tap `⇄ SOL EL / SAĞ EL` switch.
 * - Direct arena drag uses the same smooth dynamic-follow 4-way steering.
 */
export class TouchControls {
  private controlMode: ControlMode = 'DPAD';
  private joystickSide: JoystickSide = 'RIGHT';
  private onSwapSideCallback: (() => void) | null = null;

  private joystickPointerId: number | null = null;
  private joystickDirection: Direction | null = null;
  private joystickOriginX = 0;
  private joystickOriginY = 0;
  private joystickThumbX = 0;
  private joystickThumbY = 0;
  private cutArmProgress = 0;

  private cutPointerId: number | null = null;

  private swipePointerId: number | null = null;
  private swipeOriginX = 0;
  private swipeOriginY = 0;
  private swipeCurrentX = 0;
  private swipeCurrentY = 0;
  private swipeDirection: Direction | null = null;

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

  public getJoystickSide(): JoystickSide {
    return this.joystickSide;
  }

  public reset(): void {
    this.joystickPointerId = null;
    this.joystickDirection = null;
    this.joystickOriginX = 0;
    this.joystickOriginY = 0;
    this.joystickThumbX = 0;
    this.joystickThumbY = 0;
    this.cutArmProgress = 0;
    this.cutPointerId = null;
    this.swipePointerId = null;
    this.swipeDirection = null;
  }

  public handlePointerDown(
    pointerId: number,
    vx: number,
    vy: number,
    gameplayActive: boolean
  ): boolean {
    if (!gameplayActive) return false;
    const layout = getLayout();

    // 1. Quick 1-tap Left <-> Right hand swap button on the secondary deck side
    if (pointInRect(vx, vy, layout.swapSideButton, 10)) {
      this.reset();
      this.onSwapSideCallback?.();
      return true;
    }

    // 2. Dedicated `KES` instant-cut hold button (multi-touch friendly alongside joystick!)
    const cutBtn = layout.cutButton;
    if (
      this.cutPointerId === null &&
      Math.hypot(vx - cutBtn.cx, vy - cutBtn.cy) <= cutBtn.radius * 1.28
    ) {
      this.cutPointerId = pointerId;
      NativeBridge.hapticCornerTurn();
      return true;
    }

    // 3. Generous Joystick / Drag Zone on the chosen side (`SAĞ` or `SOL`)
    const stick = layout.joystick;
    const inStickCircle = Math.hypot(vx - stick.cx, vy - stick.cy) <= stick.radius * 1.55;
    const inStickZone = pointInRect(vx, vy, layout.joystickZone, 8);

    if (this.joystickPointerId === null && (inStickCircle || inStickZone)) {
      this.joystickPointerId = pointerId;
      this.joystickOriginX = vx;
      this.joystickOriginY = vy;
      this.joystickDirection = null;
      this.joystickThumbX = 0;
      this.joystickThumbY = 0;
      return true;
    }

    // 4. Direct arena or free-space drag steering (uses the same smooth dynamic-follow physics)
    const inArena = pointInRect(vx, vy, layout.arenaFrame, 12);
    const inDeck = layout.deckRect ? pointInRect(vx, vy, layout.deckRect, 4) : false;
    if ((inArena || inDeck || this.controlMode === 'SWIPE') && this.swipePointerId === null) {
      this.swipePointerId = pointerId;
      this.swipeOriginX = vx;
      this.swipeOriginY = vy;
      this.swipeCurrentX = vx;
      this.swipeCurrentY = vy;
      this.swipeDirection = null;
      return true;
    }

    return false;
  }

  public handlePointerMove(pointerId: number, vx: number, vy: number): void {
    if (pointerId === this.joystickPointerId) {
      this.updateDynamicJoystick(vx, vy, getLayout());
      return;
    }

    if (pointerId === this.swipePointerId) {
      this.swipeCurrentX = vx;
      this.swipeCurrentY = vy;
      let dx = vx - this.swipeOriginX;
      let dy = vy - this.swipeOriginY;
      const dist = Math.hypot(dx, dy);
      const followRadius = 24;
      if (dist > followRadius) {
        const pull = (dist - followRadius) / dist;
        this.swipeOriginX += dx * pull;
        this.swipeOriginY += dy * pull;
        dx = vx - this.swipeOriginX;
        dy = vy - this.swipeOriginY;
      }
      if (Math.hypot(dx, dy) < 9) {
        return;
      }
      const next = this.resolveDirection(dx, dy, this.swipeDirection);
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
      this.joystickThumbX = 0;
      this.joystickThumbY = 0;
      this.cutArmProgress = 0;
    }

    if (pointerId === this.cutPointerId) {
      this.cutPointerId = null;
    }

    if (pointerId === this.swipePointerId) {
      this.swipePointerId = null;
      this.swipeDirection = null;
    }
  }

  public isCarveVisuallyPressed(): boolean {
    return (
      this.cutPointerId !== null ||
      this.joystickDirection !== null ||
      this.swipeDirection !== null
    );
  }

  public setCutArmProgress(progress: number): void {
    this.cutArmProgress = Math.max(0, Math.min(1, progress));
  }

  public getSnapshot(): TouchSnapshot {
    const direction = this.joystickDirection ?? this.swipeDirection;
    const cutHeld = this.cutPointerId !== null;
    return {
      direction,
      carveActive: cutHeld,
      autoCarveSwipe:
        !cutHeld &&
        ((this.joystickPointerId !== null && this.joystickDirection !== null) ||
          (this.swipePointerId !== null && this.swipeDirection !== null))
    };
  }

  private updateDynamicJoystick(vx: number, vy: number, layout: GameLayout): void {
    const { radius } = layout.joystick;
    let dx = vx - this.joystickOriginX;
    let dy = vy - this.joystickOriginY;
    const rawDist = Math.hypot(dx, dy);

    // Tight 24px (~1cm) logical follow-thumb tether so 90° turns & 180° reversals are instant,
    // mapped onto full visual knob travel (`radius * 0.46`) for tactile visual feedback!
    const followRadius = 24;
    if (rawDist > followRadius) {
      const pull = (rawDist - followRadius) / rawDist;
      this.joystickOriginX += dx * pull;
      this.joystickOriginY += dy * pull;
      dx = vx - this.joystickOriginX;
      dy = vy - this.joystickOriginY;
    }

    const clampedDist = Math.hypot(dx, dy);
    const visualTravel = Math.max(36, radius * 0.46);
    const visualScale = visualTravel / followRadius;
    this.joystickThumbX = dx * visualScale;
    this.joystickThumbY = dy * visualScale;

    const deadzone = 9;
    if (clampedDist < deadzone) {
      this.joystickDirection = null;
      return;
    }

    const next = this.resolveDirection(dx, dy, this.joystickDirection);
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

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  public renderControls(ctx: CanvasRenderingContext2D, shipCutting: boolean): void {
    const layout = getLayout();
    const litColor = shipCutting ? PALETTE.CUT_ORANGE : PALETTE.SAFE_GREEN;

    ctx.save();
    if (layout.deckRect) {
      const d = layout.deckRect;
      ctx.fillStyle = '#090D16';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#222E46';
      ctx.fillRect(d.x, d.y, d.w, 3);

      // Subtle center divider separating Joystick zone and Auxiliary KES/Swap zone
      ctx.fillStyle = '#182236';
      ctx.fillRect(Math.round(d.x + d.w * 0.5) - 1, d.y + 14, 2, Math.max(0, d.h - 28));
    }

    this.getArcadeJoystickSprite(ctx, layout, litColor);
    this.drawCutButton(ctx, layout, shipCutting);
    this.drawSwapSideButton(ctx, layout);

    // Floating guide ring when player drags directly inside the arena
    if (this.swipePointerId !== null) {
      const ox = Math.round(this.swipeOriginX);
      const oy = Math.round(this.swipeOriginY);
      const sx = Math.round(this.swipeCurrentX);
      const sy = Math.round(this.swipeCurrentY);
      if (pointInRect(sx, sy, layout.arenaFrame, 20)) {
        ctx.beginPath();
        ctx.arc(ox, oy, 36, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, 13, 0, Math.PI * 2);
        ctx.fillStyle = litColor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private getArcadeJoystickSprite(
    ctx: CanvasRenderingContext2D,
    layout: GameLayout,
    litColor: string
  ): void {
    const { cx, cy, radius } = layout.joystick;

    // Outer recessed arcade well
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#05070C';
    ctx.fill();
    ctx.strokeStyle = '#384A68';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Active joystick plate
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#121C2E';
    ctx.fill();
    ctx.strokeStyle = this.joystickDirection ? litColor : '#788CA8';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // Inner guide ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = '#2A3A54';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Smooth gold inward auto-cut progress ring
    if (this.cutArmProgress > 0) {
      ctx.beginPath();
      ctx.arc(
        cx,
        cy,
        radius + 17,
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
    ctx.fillStyle = this.joystickDirection ? litColor : '#5E7290';
    ctx.fill();
    ctx.strokeStyle = '#E6F0FF';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(
      thumbX - knobRadius * 0.18,
      thumbY - knobRadius * 0.2,
      knobRadius * 0.6,
      Math.PI * 1.08,
      Math.PI * 1.92
    );
    ctx.strokeStyle = 'rgba(255,255,255,0.62)';
    ctx.lineWidth = 5;
    ctx.stroke();

    const sideLabel = layout.joystickSide === 'RIGHT' ? 'SAĞ SÜRÜKLE' : 'SOL SÜRÜKLE';
    drawPixelText(ctx, sideLabel, cx, cy + radius + 26, {
      scale: Math.max(2.6, Math.min(3.1, radius / 31)),
      tone: this.joystickDirection ? 'green' : 'silver',
      align: 'center'
    });
  }

  private drawCutButton(
    ctx: CanvasRenderingContext2D,
    layout: GameLayout,
    shipCutting: boolean
  ): void {
    const { cx, cy, radius } = layout.cutButton;
    const pressed = this.cutPointerId !== null;
    const activeCut = pressed || shipCutting;

    // Status callout right above the KES button
    const statusText =
      this.cutArmProgress > 0
        ? 'KESİME HAZIR'
        : shipCutting
          ? 'KESİMDE!'
          : 'OTO / HIZLI KES';
    const statusTone = this.cutArmProgress > 0 ? 'gold' : shipCutting ? 'orange' : 'green';
    drawPixelText(ctx, statusText, cx, cy - radius - 18, {
      scale: Math.max(2.4, Math.min(2.9, radius / 26)),
      tone: statusTone,
      align: 'center'
    });

    // Outer recessed bezel
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
    ctx.fillStyle = '#05070C';
    ctx.fill();
    ctx.strokeStyle = activeCut ? '#FFB848' : '#3C4E6C';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Crimson/Orange arcade push button
    ctx.beginPath();
    ctx.arc(cx, cy + (pressed ? 3 : 0), radius, 0, Math.PI * 2);
    ctx.fillStyle = activeCut ? '#D84E14' : '#5E181C';
    ctx.fill();
    ctx.strokeStyle = activeCut ? '#FFF098' : '#E08878';
    ctx.lineWidth = 4;
    ctx.stroke();

    drawPixelText(ctx, 'KES', cx, cy + (pressed ? 3 : 0) - 4, {
      scale: Math.max(3.2, Math.min(3.9, radius / 19)),
      tone: activeCut ? 'gold' : 'white',
      align: 'center'
    });
    drawPixelText(ctx, 'BASILI TUT', cx, cy + (pressed ? 3 : 0) + radius * 0.44, {
      scale: Math.max(2.0, Math.min(2.4, radius / 31)),
      tone: activeCut ? 'white' : 'silver',
      align: 'center'
    });
  }

  private drawSwapSideButton(ctx: CanvasRenderingContext2D, layout: GameLayout): void {
    const r = layout.swapSideButton;
    const targetLabel = layout.joystickSide === 'RIGHT' ? '⇄ SOL ELE AL' : '⇄ SAĞ ELE AL';

    ctx.fillStyle = '#04060C';
    ctx.fillRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
    ctx.fillStyle = '#162238';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#7A92B8';
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);

    drawPixelText(ctx, targetLabel, r.x + r.w * 0.5, r.y + r.h * 0.5, {
      scale: Math.max(2.3, Math.min(2.7, r.w / 92)),
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
      const s = Math.max(8, distance * 0.13);
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
      ctx.globalAlpha = active ? 1 : 0.72;
      ctx.lineWidth = active ? 6 : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
