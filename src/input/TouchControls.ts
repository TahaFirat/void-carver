import { PALETTE } from '../core/Config';
import { GameLayout, getLayout, pointInRect } from '../core/ResponsiveLayout';
import { Direction } from '../geometry/Types';
import { NativeBridge } from '../native/NativeBridge';
import { drawPixelText } from '../rendering/PixelArtEngine';
import { ControlMode } from '../services/StorageService';

export interface TouchSnapshot {
  direction: Direction | null;
  /** Touch movement always starts a cut when the selected direction points into the arena. */
  carveActive: boolean;
  autoCarveSwipe: boolean;
}

const HYSTERESIS = 1.18;

/**
 * Mobile-first fixed virtual joystick. Dragging inward from the perimeter automatically
 * starts a cut; no separate carve button or simultaneous thumb is needed. The same
 * orthogonal steering can also be used with a direct arena swipe or keyboard/gamepad.
 */
export class TouchControls {
  private controlMode: ControlMode = 'DPAD';

  private joystickPointerId: number | null = null;
  private joystickDirection: Direction | null = null;
  private joystickThumbX = 0;
  private joystickThumbY = 0;

  private swipePointerId: number | null = null;
  private swipeAnchorX = 0;
  private swipeAnchorY = 0;
  private swipeCurrentX = 0;
  private swipeCurrentY = 0;
  private swipeDirection: Direction | null = null;
  private swipeMoved = false;

  public configure(mode: ControlMode): void {
    if (this.controlMode !== mode) this.reset();
    this.controlMode = mode;
  }

  public reset(): void {
    this.joystickPointerId = null;
    this.joystickDirection = null;
    this.joystickThumbX = 0;
    this.joystickThumbY = 0;
    this.swipePointerId = null;
    this.swipeDirection = null;
    this.swipeMoved = false;
  }

  public handlePointerDown(pointerId: number, vx: number, vy: number, gameplayActive: boolean): boolean {
    if (!gameplayActive) return false;
    const layout = getLayout();
    const stick = layout.joystick;
    const inStick = Math.hypot(vx - stick.cx, vy - stick.cy) <= stick.radius * 1.45;
    const inLeftDock = this.isInLeftDock(vx, vy, layout);

    if (this.joystickPointerId === null && (inStick || inLeftDock)) {
      this.joystickPointerId = pointerId;
      this.updateJoystickFromPointer(vx, vy, layout);
      if (this.joystickDirection) NativeBridge.hapticCornerTurn();
      return true;
    }

    // Optional one-finger arena swipe remains available alongside the joystick.
    const inArena = pointInRect(vx, vy, layout.arenaFrame, 10);
    if ((inArena || this.controlMode === 'SWIPE') && this.swipePointerId === null) {
      this.swipePointerId = pointerId;
      this.swipeAnchorX = vx;
      this.swipeAnchorY = vy;
      this.swipeCurrentX = vx;
      this.swipeCurrentY = vy;
      this.swipeMoved = false;
      if (this.controlMode !== 'SWIPE') this.swipeDirection = null;
      return true;
    }

    return false;
  }

  public handlePointerMove(pointerId: number, vx: number, vy: number): void {
    if (pointerId === this.joystickPointerId) {
      this.updateJoystickFromPointer(vx, vy, getLayout());
      return;
    }

    if (pointerId === this.swipePointerId) {
      this.swipeCurrentX = vx;
      this.swipeCurrentY = vy;
      const dx = vx - this.swipeAnchorX;
      const dy = vy - this.swipeAnchorY;
      if (Math.hypot(dx, dy) >= 15) {
        const next = this.resolveDirection(dx, dy, this.swipeDirection);
        if (next !== this.swipeDirection) {
          this.swipeDirection = next;
          NativeBridge.hapticCornerTurn();
        }
        this.swipeMoved = true;
        this.swipeAnchorX = vx;
        this.swipeAnchorY = vy;
      }
    }
  }

  public handlePointerUp(pointerId: number): void {
    if (pointerId === this.joystickPointerId) {
      this.joystickPointerId = null;
      this.joystickDirection = null;
      this.joystickThumbX = 0;
      this.joystickThumbY = 0;
    }

    if (pointerId === this.swipePointerId) {
      this.swipePointerId = null;
      if (this.controlMode !== 'SWIPE' || !this.swipeMoved) this.swipeDirection = null;
      this.swipeMoved = false;
    }
  }

  public isCarveVisuallyPressed(): boolean {
    return this.joystickDirection !== null || this.swipeDirection !== null;
  }

  public getSnapshot(): TouchSnapshot {
    const direction = this.joystickDirection ?? this.swipeDirection;
    return {
      direction,
      carveActive: direction !== null,
      autoCarveSwipe: false
    };
  }

  private isInLeftDock(x: number, y: number, layout: GameLayout): boolean {
    if (layout.deckRect && pointInRect(x, y, layout.deckRect)) {
      return x <= layout.joystick.cx + layout.joystick.radius * 0.8;
    }
    if (layout.leftWing && pointInRect(x, y, layout.leftWing)) {
      return y >= layout.leftWing.y + layout.leftWing.h * 0.35;
    }
    return false;
  }

  private updateJoystickFromPointer(vx: number, vy: number, layout: GameLayout): void {
    const { cx, cy, radius } = layout.joystick;
    const dx = vx - cx;
    const dy = vy - cy;
    const distance = Math.hypot(dx, dy);
    const travel = radius * 0.54;
    const clamp = distance > travel ? travel / distance : 1;
    this.joystickThumbX = dx * clamp;
    this.joystickThumbY = dy * clamp;

    if (distance < radius * 0.19) {
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
    const { cx, cy, radius } = layout.joystick;
    const litColor = shipCutting ? PALETTE.CUT_ORANGE : PALETTE.SAFE_GREEN;

    ctx.save();
    if (layout.deckRect) {
      const d = layout.deckRect;
      ctx.fillStyle = '#0A0D16';
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = '#1C2438';
      ctx.fillRect(d.x, d.y, d.w, 3);
    }

    // Recessed circular base and directional ticks.
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 9, 0, Math.PI * 2);
    ctx.fillStyle = '#05070C';
    ctx.fill();
    ctx.strokeStyle = '#34445F';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#111A2A';
    ctx.fill();
    ctx.strokeStyle = this.joystickDirection ? litColor : '#687993';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.73, 0, Math.PI * 2);
    ctx.strokeStyle = '#2B3A52';
    ctx.lineWidth = 3;
    ctx.stroke();

    this.drawDirectionTicks(ctx, cx, cy, radius * 0.78, litColor);

    const thumbX = cx + (this.joystickPointerId === null ? 0 : this.joystickThumbX);
    const thumbY = cy + (this.joystickPointerId === null ? 0 : this.joystickThumbY);
    const knobRadius = radius * 0.39;
    ctx.beginPath();
    ctx.arc(thumbX, thumbY + 4, knobRadius + 2, 0, Math.PI * 2);
    ctx.fillStyle = '#03050A';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = this.joystickDirection ? litColor : '#54647D';
    ctx.fill();
    ctx.strokeStyle = '#D8E5F8';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(thumbX - knobRadius * 0.18, thumbY - knobRadius * 0.2, knobRadius * 0.62, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = 'rgba(255,255,255,0.58)';
    ctx.lineWidth = 5;
    ctx.stroke();

    const hint = this.getAutoCutHint(layout, cy);
    const hintScale = hint.scale;
    drawPixelText(ctx, hint.top, hint.x, hint.y - hintScale * 7, {
      scale: hintScale,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(ctx, hint.bottom, hint.x, hint.y + hintScale * 8, {
      scale: hintScale,
      tone: 'green',
      align: 'center'
    });

    drawPixelText(ctx, 'JOYSTICK', cx, cy + radius + 25, {
      scale: Math.max(2.4, Math.min(3.2, radius / 34)),
      tone: this.joystickDirection ? 'green' : 'silver',
      align: 'center'
    });

    // Direct arena drag feedback for the optional swipe mode.
    if (this.swipePointerId !== null && this.swipeDirection !== null) {
      const sx = Math.round(this.swipeCurrentX);
      const sy = Math.round(this.swipeCurrentY);
      if (pointInRect(sx, sy, layout.arenaFrame)) {
        ctx.beginPath();
        ctx.arc(sx, sy, 11, 0, Math.PI * 2);
        ctx.fillStyle = litColor;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private getAutoCutHint(layout: GameLayout, fallbackY: number): { x: number; y: number; scale: number; top: string; bottom: string } {
    if (layout.rightWing) {
      const wing = layout.rightWing;
      return {
        x: wing.x + wing.w * 0.5,
        y: wing.y + wing.h - 105,
        scale: Math.max(1.8, Math.min(2.3, wing.w / 145)),
        top: 'İÇERİ SÜRÜKLE',
        bottom: 'KESİM OTOMATİK'
      };
    }
    const deck = layout.deckRect;
    return {
      x: deck ? deck.x + deck.w * 0.72 : layout.width * 0.72,
      y: fallbackY,
      scale: 2.7,
      top: 'İÇERİ SÜRÜKLE',
      bottom: 'KESİM OTOMATİK'
    };
  }

  private drawDirectionTicks(ctx: CanvasRenderingContext2D, cx: number, cy: number, distance: number, color: string): void {
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
      const s = Math.max(7, distance * 0.12);
      ctx.beginPath();
      if (dir === 'UP') {
        ctx.moveTo(x - s, y + s * 0.45); ctx.lineTo(x, y - s * 0.45); ctx.lineTo(x + s, y + s * 0.45);
      } else if (dir === 'DOWN') {
        ctx.moveTo(x - s, y - s * 0.45); ctx.lineTo(x, y + s * 0.45); ctx.lineTo(x + s, y - s * 0.45);
      } else if (dir === 'LEFT') {
        ctx.moveTo(x + s * 0.45, y - s); ctx.lineTo(x - s * 0.45, y); ctx.lineTo(x + s * 0.45, y + s);
      } else {
        ctx.moveTo(x - s * 0.45, y - s); ctx.lineTo(x + s * 0.45, y); ctx.lineTo(x - s * 0.45, y + s);
      }
      ctx.strokeStyle = active ? '#FFFFFF' : color;
      ctx.globalAlpha = active ? 1 : 0.7;
      ctx.lineWidth = active ? 6 : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
