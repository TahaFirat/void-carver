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
import { TouchGestureEngine, TouchVisualState } from './TouchGestureEngine';

export interface TouchSnapshot {
  direction: Direction | null;
  secondaryDirection: Direction | null;
  /** True when the active scheme permits launching into the arena (`KES` pressed or `SINGLE_HAND_DRAG` active). */
  cutAllowed: boolean;
}

/**
 * V7 1:1 Zero-Inertia Mobile & Tablet Control Deck:
 * 1. `CLASSIC_ARCADE` (Default — "KLASİK ATARİ: YÖN + KES"):
 *    - Fixed-center 4-Way Arcade D-Pad (`deadzone = 8 CSS px`, `0ms` stop on release)
 *    - Opposite-side large crimson-gold `KES` action button
 * 2. `JOYSTICK_KES` ("ATARİ KOLU + KES"):
 *    - Fixed-center short-throw arcade stick (`deadzone = 8 CSS px`, max throw `44 CSS px`, `0ms` stop) + `KES`
 * 3. `SINGLE_HAND_DRAG` ("TEK EL SÜRÜKLE"):
 *    - Optional 1-handed drag pad that stops immediately (`0ms`) when the finger stops moving or lifts!
 */
export class TouchControls {
  public readonly gesture = new TouchGestureEngine();
  private controlMode: ControlMode = 'JOYSTICK_KES';
  private joystickSide: JoystickSide = 'LEFT';
  private onSwapSideCallback: (() => void) | null = null;
  private onGearTapCallback: (() => void) | null = null;

  public setOnSwapSide(cb: () => void): void {
    this.onSwapSideCallback = cb;
  }

  public setOnGearTap(cb: () => void): void {
    this.onGearTapCallback = cb;
  }

  public syncViewportFromLayout(layout: GameLayout = getLayout()): void {
    this.gesture.updateViewportBounds(
      layout.cssWidth,
      layout.cssHeight,
      layout.statusStripBottomCssY,
      layout.landscapeLeftWingMaxCssX,
      layout.landscapeRightWingMinCssX
    );
  }

  public configure(mode: ControlMode, side: JoystickSide = this.joystickSide): void {
    this.controlMode = mode;
    const normalizedSide: JoystickSide =
      mode !== 'SINGLE_HAND_DRAG' && side === 'CENTER' ? 'LEFT' : side;
    this.joystickSide = normalizedSide;
    const layout = setPreferredJoystickSide(normalizedSide);
    this.syncViewportFromLayout(layout);
    this.gesture.configure({
      scheme: mode,
      anchorSide: normalizedSide
    });
  }

  public getControlMode(): ControlMode {
    return this.controlMode;
  }

  public getJoystickSide(): JoystickSide {
    return this.joystickSide;
  }

  public reset(): void {
    this.gesture.resetAll();
  }

  public handleTouchDownCss(
    pointerId: number,
    cssX: number,
    cssY: number,
    vx: number,
    vy: number,
    gameplayActive: boolean
  ): boolean {
    if (!gameplayActive) return false;
    const layout = getLayout();
    this.syncViewportFromLayout(layout);

    // 1. Minimal bottom-left `⚙` Gear icon -> opens Pause / Control Settings
    if (pointInRect(vx, vy, layout.gearButton, 8)) {
      this.reset();
      this.onGearTapCallback?.();
      return true;
    }

    // 2. Minimal bottom-right `✋` Hand icon -> swaps Left/Right (or Left/Center/Right in Single-Hand mode)
    if (pointInRect(vx, vy, layout.swapSideButton, 8)) {
      this.reset();
      this.onSwapSideCallback?.();
      return true;
    }

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prevDir = this.gesture.getDirection();
    this.gesture.handleTouchStart(pointerId, cssX, cssY, nowMs);
    const nextDir = this.gesture.getDirection();
    if (nextDir && nextDir !== prevDir) {
      NativeBridge.hapticCornerTurn();
    }
    return true;
  }

  public handleTouchMoveCss(pointerId: number, cssX: number, cssY: number): void {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const prevDir = this.gesture.getDirection();
    this.gesture.handleTouchMove(pointerId, cssX, cssY, nowMs);
    const nextDir = this.gesture.getDirection();
    if (nextDir && nextDir !== prevDir) {
      NativeBridge.hapticCornerTurn();
    }
  }

  public handlePointerDown(
    pointerId: number,
    vx: number,
    vy: number,
    gameplayActive: boolean
  ): boolean {
    const s = getLayout().cssScale || 1;
    return this.handleTouchDownCss(pointerId, vx * s, vy * s, vx, vy, gameplayActive);
  }

  public handlePointerMove(pointerId: number, vx: number, vy: number): void {
    const s = getLayout().cssScale || 1;
    this.handleTouchMoveCss(pointerId, vx * s, vy * s);
  }

  public handlePointerUp(pointerId: number): void {
    this.gesture.handleTouchEnd(pointerId);
  }

  public isCarveVisuallyPressed(): boolean {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return this.gesture.isCutAllowed(nowMs);
  }

  public getSnapshot(): TouchSnapshot {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.gesture.tick(nowMs);
    return {
      direction: this.gesture.getDirection(),
      secondaryDirection: this.gesture.getSecondaryDirection(),
      cutAllowed: this.gesture.isCutAllowed(nowMs)
    };
  }

  // ---------------------------------------------------------------------------
  // Rendering (16-Bit Arcade D-Pad + Crimson `KES` Button)
  // ---------------------------------------------------------------------------
  public renderControls(
    ctx: CanvasRenderingContext2D,
    shipCutting: boolean,
    shipBacktracking = false
  ): void {
    const layout = getLayout();
    this.syncViewportFromLayout(layout);
    const s = layout.cssScale || 1;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const vis = this.gesture.getVisualState(nowMs);

    const litColor = shipBacktracking
      ? '#50F0FF'
      : shipCutting
        ? PALETTE.CUT_ORANGE
        : '#D8F028';

    ctx.save();
    if (layout.deckRect) {
      const d = layout.deckRect;
      ctx.fillStyle = '#050811';
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }

    if (this.controlMode === 'CLASSIC_ARCADE') {
      this.drawCrossDpad(ctx, vis, s, litColor);
      this.drawKesActionButton(ctx, vis, s, shipCutting);
    } else if (this.controlMode === 'JOYSTICK_KES') {
      this.getArcadeJoystickSprite(ctx, vis, s, litColor);
      this.drawKesActionButton(ctx, vis, s, shipCutting);
    } else {
      this.drawSingleHandDragPad(ctx, vis, s, litColor);
    }

    this.drawGearButton(ctx, layout);
    this.drawSwapSideButton(ctx, layout);
    ctx.restore();
  }

  private drawSingleHandDragPad(
    ctx: CanvasRenderingContext2D,
    vis: TouchVisualState,
    cssScale: number,
    litColor: string
  ): void {
    const cx = Math.round(vis.padCenterX / cssScale);
    const cy = Math.round(vis.padCenterY / cssScale);
    const radius = Math.round(54 / cssScale);

    ctx.beginPath();
    ctx.arc(cx, cy, radius + 8, 0, Math.PI * 2);
    ctx.fillStyle = '#03050B';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0A0F1C';
    ctx.fill();
    ctx.strokeStyle = vis.active ? '#4E6284' : '#2C3952';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, Math.round(radius * 0.88), 0, Math.PI * 2);
    ctx.strokeStyle = '#182236';
    ctx.lineWidth = 3;
    ctx.stroke();

    const offset = Math.round(radius * 0.56);
    const arrowUnit = Math.max(4, Math.round(radius * 0.052));
    this.drawPixelBlockArrow(ctx, cx, cy - offset, 'UP', vis.direction === 'UP', arrowUnit, litColor);
    this.drawPixelBlockArrow(ctx, cx, cy + offset, 'DOWN', vis.direction === 'DOWN', arrowUnit, litColor);
    this.drawPixelBlockArrow(ctx, cx - offset, cy, 'LEFT', vis.direction === 'LEFT', arrowUnit, litColor);
    this.drawPixelBlockArrow(ctx, cx + offset, cy, 'RIGHT', vis.direction === 'RIGHT', arrowUnit, litColor);
  }

  private drawPixelBlockArrow(
    ctx: CanvasRenderingContext2D,
    ax: number,
    ay: number,
    dir: Direction,
    active: boolean,
    u: number,
    litColor: string
  ): void {
    ctx.save();
    ctx.translate(Math.round(ax), Math.round(ay));
    if (dir === 'DOWN') ctx.rotate(Math.PI);
    else if (dir === 'LEFT') ctx.rotate(-Math.PI * 0.5);
    else if (dir === 'RIGHT') ctx.rotate(Math.PI * 0.5);

    if (active) {
      ctx.shadowColor = litColor;
      ctx.shadowBlur = u * 3.2;
    }

    const fill = active ? litColor : '#667694';
    ctx.fillStyle = '#03050A';
    ctx.fillRect(-u * 1.5 - 2, -u * 4.5 - 2, u * 3 + 4, u * 9 + 4);

    ctx.fillStyle = fill;
    ctx.fillRect(-u * 0.5, -u * 4.5, u, u);
    ctx.fillRect(-u * 1.5, -u * 3.5, u * 3, u);
    ctx.fillRect(-u * 2.5, -u * 2.5, u * 5, u);
    ctx.fillRect(-u * 3.5, -u * 1.5, u * 7, u * 1.2);
    ctx.fillRect(-u * 1.3, -u * 0.3, u * 2.6, u * 4.5);

    if (active) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFF4B8';
      ctx.fillRect(-u * 0.5, -u * 3.5, u, u * 6.2);
    }
    ctx.restore();
  }

  private getArcadeJoystickSprite(
    ctx: CanvasRenderingContext2D,
    vis: TouchVisualState,
    cssScale: number,
    litColor: string
  ): void {
    const cx = Math.round(vis.padCenterX / cssScale);
    const cy = Math.round(vis.padCenterY / cssScale);
    const radius = Math.round(60 / cssScale);
    const thumbX = Math.round(vis.knobX / cssScale);
    const thumbY = Math.round(vis.knobY / cssScale);

    // 1. Deep outer housing ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 9, 0, Math.PI * 2);
    ctx.fillStyle = '#03050B';
    ctx.fill();
    ctx.strokeStyle = vis.active ? '#5874A2' : '#30405C';
    ctx.lineWidth = 4;
    ctx.stroke();

    // 2. Main 4-way magnetic track circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0B1322';
    ctx.fill();

    // 3. Illuminated 90° active quadrant arc (`Sanwa 4-Way Gate` visual feedback)
    if (vis.direction) {
      let midAngle = 0;
      if (vis.direction === 'UP') midAngle = -Math.PI * 0.5;
      else if (vis.direction === 'DOWN') midAngle = Math.PI * 0.5;
      else if (vis.direction === 'LEFT') midAngle = Math.PI;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius - 3, midAngle - Math.PI * 0.23, midAngle + Math.PI * 0.23);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 224, 104, 0.16)';
      ctx.fill();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = vis.direction ? litColor : '#6C84A8';
    ctx.lineWidth = 4.5;
    ctx.stroke();

    // 4. Four cardinal notch arrows on outer ring (`▲ ▼ ◄ ►`)
    const arrowOffset = Math.round(radius * 0.72);
    const arrowU = Math.max(3, Math.round(radius * 0.036));
    this.drawPixelBlockArrow(ctx, cx, cy - arrowOffset, 'UP', vis.direction === 'UP', arrowU, litColor);
    this.drawPixelBlockArrow(ctx, cx, cy + arrowOffset, 'DOWN', vis.direction === 'DOWN', arrowU, litColor);
    this.drawPixelBlockArrow(ctx, cx - arrowOffset, cy, 'LEFT', vis.direction === 'LEFT', arrowU, litColor);
    this.drawPixelBlockArrow(ctx, cx + arrowOffset, cy, 'RIGHT', vis.direction === 'RIGHT', arrowU, litColor);

    // 5. Center Neutral Brake Pocket (`0px` stop pocket)
    const brakeR = Math.max(14, Math.round(radius * 0.24));
    ctx.beginPath();
    ctx.arc(cx, cy, brakeR, 0, Math.PI * 2);
    ctx.fillStyle = '#060A14';
    ctx.fill();
    ctx.strokeStyle = vis.active && !vis.direction ? '#50F0FF' : '#263650';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 6. 3D Tactile Inner Ball (`Thumb Knob`)
    const knobRadius = Math.round(radius * 0.36);
    ctx.beginPath();
    ctx.arc(thumbX, thumbY + 5, knobRadius + 3, 0, Math.PI * 2);
    ctx.fillStyle = '#03050A';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(thumbX, thumbY, knobRadius, 0, Math.PI * 2);
    ctx.fillStyle = vis.direction ? litColor : vis.active ? '#7E96BA' : '#586E90';
    ctx.fill();
    ctx.strokeStyle = '#F4F8FF';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Specular highlight arc on inner ball
    ctx.beginPath();
    ctx.arc(thumbX, thumbY, Math.max(4, knobRadius - 6), -Math.PI * 0.78, -Math.PI * 0.22);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  private drawCrossDpad(
    ctx: CanvasRenderingContext2D,
    vis: TouchVisualState,
    cssScale: number,
    litColor: string
  ): void {
    const cx = Math.round(vis.padCenterX / cssScale);
    const cy = Math.round(vis.padCenterY / cssScale);
    const radius = Math.round(52 / cssScale);
    const armLen = radius + 6;
    const armHalf = Math.round(Math.max(30, radius * 0.36));

    ctx.beginPath();
    ctx.arc(cx, cy, armLen + 10, 0, Math.PI * 2);
    ctx.fillStyle = '#04060B';
    ctx.fill();
    ctx.strokeStyle = vis.active ? '#4E668E' : '#324462';
    ctx.lineWidth = 4;
    ctx.stroke();

    const buttons: Array<{ dir: Direction; bx: number; by: number; bw: number; bh: number }> = [
      { dir: 'UP', bx: cx - armHalf, by: cy - armLen, bw: armHalf * 2, bh: armLen - armHalf * 0.5 },
      { dir: 'DOWN', bx: cx - armHalf, by: cy + armHalf * 0.5, bw: armHalf * 2, bh: armLen - armHalf * 0.5 },
      { dir: 'LEFT', bx: cx - armLen, by: cy - armHalf, bw: armLen - armHalf * 0.5, bh: armHalf * 2 },
      { dir: 'RIGHT', bx: cx + armHalf * 0.5, by: cy - armHalf, bw: armLen - armHalf * 0.5, bh: armHalf * 2 }
    ];

    ctx.fillStyle = '#101A2C';
    ctx.fillRect(cx - armHalf, cy - armHalf, armHalf * 2, armHalf * 2);

    const arrowU = Math.max(3, Math.round(radius * 0.042));
    for (const b of buttons) {
      const active = vis.direction === b.dir;
      const rx = Math.round(b.bx);
      const ry = Math.round(b.by);
      const rw = Math.round(b.bw);
      const rh = Math.round(b.bh);

      ctx.fillStyle = '#03050A';
      ctx.fillRect(rx - 3, ry - 3, rw + 6, rh + 6);
      ctx.fillStyle = active ? '#1F304E' : '#15223A';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = active ? litColor : '#667E9E';
      ctx.lineWidth = active ? 4 : 3;
      ctx.strokeRect(rx + 1.5, ry + 1.5, rw - 3, rh - 3);

      this.drawPixelBlockArrow(
        ctx,
        rx + rw * 0.5,
        ry + rh * 0.5,
        b.dir,
        active,
        arrowU,
        litColor
      );
    }
  }

  private drawKesActionButton(
    ctx: CanvasRenderingContext2D,
    vis: TouchVisualState,
    cssScale: number,
    shipCutting: boolean
  ): void {
    if (vis.cutBtnCenterX < 0) return;
    const cx = Math.round(vis.cutBtnCenterX / cssScale);
    const cy = Math.round(vis.cutBtnCenterY / cssScale);
    const r = Math.round(52 / cssScale);
    const pressed = vis.cutPressed || shipCutting;

    ctx.beginPath();
    ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
    ctx.fillStyle = '#04060C';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = pressed ? '#F2321E' : '#A81822';
    ctx.fill();
    ctx.strokeStyle = pressed ? '#FFF498' : '#F4B632';
    ctx.lineWidth = 5.5;
    ctx.stroke();

    // Crisp arcade highlight arc
    ctx.beginPath();
    ctx.arc(cx, cy, r - 7, -Math.PI * 0.78, -Math.PI * 0.22);
    ctx.strokeStyle = 'rgba(255, 236, 196, 0.52)';
    ctx.lineWidth = 4;
    ctx.stroke();

    drawPixelText(ctx, 'KES', cx, cy, {
      scale: 4.1,
      tone: 'white',
      align: 'center'
    });
  }

  private drawGearButton(ctx: CanvasRenderingContext2D, layout: GameLayout): void {
    const r = layout.gearButton;
    const cx = Math.round(r.x + r.w * 0.5);
    const cy = Math.round(r.y + r.h * 0.5);
    const u = 4;

    ctx.save();
    ctx.fillStyle = '#6A7894';
    ctx.fillRect(cx - u * 1.5, cy - u * 6, u * 3, u * 12);
    ctx.fillRect(cx - u * 6, cy - u * 1.5, u * 12, u * 3);
    ctx.fillRect(cx - u * 4.5, cy - u * 4.5, u * 9, u * 9);
    ctx.fillStyle = '#7E8CA8';
    ctx.fillRect(cx - u * 4, cy - u * 4, u * 8, u * 8);
    ctx.fillStyle = '#050811';
    ctx.fillRect(cx - u * 2, cy - u * 2, u * 4, u * 4);
    ctx.restore();
  }

  private drawSwapSideButton(ctx: CanvasRenderingContext2D, layout: GameLayout): void {
    const r = layout.swapSideButton;
    const cx = Math.round(r.x + r.w * 0.5);
    const cy = Math.round(r.y + r.h * 0.5);
    const u = 4;

    ctx.save();
    ctx.fillStyle = '#7A88A4';
    ctx.fillRect(cx - u * 4.5, cy - u * 5, u * 1.6, u * 5);
    ctx.fillRect(cx - u * 2.0, cy - u * 6, u * 1.6, u * 6);
    ctx.fillRect(cx + u * 0.5, cy - u * 5.5, u * 1.6, u * 5.5);
    ctx.fillRect(cx + u * 3.0, cy - u * 4, u * 1.6, u * 4.5);
    ctx.fillRect(cx - u * 6.5, cy - u * 1, u * 2.2, u * 3.2);
    ctx.fillRect(cx - u * 4.5, cy - u * 0.5, u * 9.2, u * 4.5);
    ctx.fillRect(cx - u * 3.2, cy + u * 4, u * 6.6, u * 2);
    ctx.restore();
  }
}
