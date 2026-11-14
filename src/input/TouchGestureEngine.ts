export type CardinalDir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type ControlScheme = 'CLASSIC_ARCADE' | 'JOYSTICK_KES' | 'SINGLE_HAND_DRAG';
export type ControlAnchorSide = 'LEFT' | 'CENTER' | 'RIGHT';

export interface TouchEngineConfig {
  scheme: ControlScheme;
  anchorSide: ControlAnchorSide;
  /** Neutral brake pocket radius in CSS pixels (default 7 CSS px) */
  deadzonePx: number;
  /** Maximum visual knob throw radius in CSS pixels (default 40 CSS px) */
  maxKnobThrowPx: number;
  /** Minimum physical CSS pixels to trigger a single-hand drag stroke (~1.3mm) */
  swipeImpulsePx: number;
  /** Trailing leash distance in CSS pixels for single-hand drag reversals */
  trailingLeashPx: number;
  /** Axis dominance ratio (>1.0) for single-hand drag strokes */
  axisDominanceRatio: number;
}

export interface TouchVisualState {
  active: boolean;
  scheme: ControlScheme;
  direction: CardinalDir | null;
  secondaryDirection: CardinalDir | null;
  cutPressed: boolean;
  /** Clamped safe visual center (CSS px) that NEVER overlaps the arena or status HUD bar */
  padCenterX: number;
  padCenterY: number;
  knobX: number;
  knobY: number;
  cutBtnCenterX: number;
  cutBtnCenterY: number;
}

const SINGLE_HAND_STOP_IDLE_MS = 95;
const CUT_TAP_LATCH_MS = 360;
const JOYSTICK_FOLLOW_LEASH_PX = 26;
const MAGNETIC_HYSTERESIS_RATIO = 1.3;

export class TouchGestureEngine {
  private config: TouchEngineConfig = {
    scheme: 'JOYSTICK_KES',
    anchorSide: 'LEFT',
    deadzonePx: 7,
    maxKnobThrowPx: 40,
    swipeImpulsePx: 8,
    trailingLeashPx: 16,
    axisDominanceRatio: 1.2
  };

  private moveTouchId: number | null = null;
  private cutTouchId: number | null = null;

  private pivotX = 0;
  private pivotY = 0;
  private prevX = 0;
  private prevY = 0;
  private rawDx = 0;
  private rawDy = 0;
  private strokeDx = 0;
  private strokeDy = 0;
  private lastDragMotionMs = 0;
  private cutTapLatchUntilMs = 0;
  private currentDir: CardinalDir | null = null;
  private secondaryDir: CardinalDir | null = null;
  private cutHeld = false;

  // Layout bounds in CSS pixels
  private viewportW = 390;
  private viewportH = 844;
  private minSafeControlY = 620;
  private landscapeLeftWingMaxX: number | null = null;
  private landscapeRightWingMinX: number | null = null;

  public configure(
    partialOrScheme: Partial<TouchEngineConfig> | ControlScheme,
    anchorSide?: ControlAnchorSide
  ): void {
    const prevScheme = this.config.scheme;
    if (typeof partialOrScheme === 'string') {
      this.config = {
        ...this.config,
        scheme: partialOrScheme,
        ...(anchorSide ? { anchorSide } : {})
      };
    } else {
      this.config = { ...this.config, ...partialOrScheme };
    }
    if (prevScheme !== this.config.scheme) {
      this.resetAll();
    }
  }

  public getConfig(): Readonly<TouchEngineConfig> {
    return this.config;
  }

  public updateViewportBounds(
    viewportW: number,
    viewportH: number,
    statusStripBottomCssY: number,
    landscapeLeftWingMaxX: number | null = null,
    landscapeRightWingMinX: number | null = null
  ): void {
    this.viewportW = Math.max(240, viewportW);
    this.viewportH = Math.max(320, viewportH);
    this.minSafeControlY = Math.min(this.viewportH - 96, Math.max(0, statusStripBottomCssY));
    this.landscapeLeftWingMaxX = landscapeLeftWingMaxX;
    this.landscapeRightWingMinX = landscapeRightWingMinX;
  }

  public resetAll(): void {
    this.moveTouchId = null;
    this.cutTouchId = null;
    this.currentDir = null;
    this.secondaryDir = null;
    this.cutHeld = false;
    this.cutTapLatchUntilMs = 0;
    this.rawDx = 0;
    this.rawDy = 0;
    this.strokeDx = 0;
    this.strokeDy = 0;
    this.lastDragMotionMs = 0;
  }

  public getFixedPadCenter(): { dpadX: number; dpadY: number; cutX: number; cutY: number } {
    const availDeckCssH = Math.max(116, this.viewportH - this.minSafeControlY);
    const deckMidY = Math.max(
      this.minSafeControlY + 66,
      Math.min(this.viewportH - 76, this.minSafeControlY + availDeckCssH * 0.45)
    );

    if (
      this.landscapeLeftWingMaxX !== null &&
      this.landscapeRightWingMinX !== null &&
      this.viewportW > this.viewportH * 1.12
    ) {
      const leftMidX = Math.max(68, this.landscapeLeftWingMaxX * 0.5);
      const rightMidX = Math.min(
        this.viewportW - 68,
        (this.landscapeRightWingMinX + this.viewportW) * 0.5
      );
      if (this.config.scheme === 'SINGLE_HAND_DRAG') {
        const x = this.config.anchorSide === 'LEFT' ? leftMidX : rightMidX;
        return { dpadX: x, dpadY: deckMidY, cutX: -999, cutY: -999 };
      }
      const leftSidePad = this.config.anchorSide !== 'RIGHT';
      return {
        dpadX: leftSidePad ? leftMidX : rightMidX,
        dpadY: deckMidY,
        cutX: leftSidePad ? rightMidX : leftMidX,
        cutY: deckMidY
      };
    }

    if (this.config.scheme === 'SINGLE_HAND_DRAG') {
      const x =
        this.config.anchorSide === 'LEFT'
          ? this.viewportW * 0.26
          : this.config.anchorSide === 'RIGHT'
            ? this.viewportW * 0.74
            : this.viewportW * 0.5;
      return { dpadX: x, dpadY: deckMidY, cutX: -999, cutY: -999 };
    }

    const leftSidePad = this.config.anchorSide !== 'RIGHT';
    return {
      dpadX: leftSidePad
        ? Math.max(84, this.viewportW * 0.25)
        : Math.min(this.viewportW - 84, this.viewportW * 0.75),
      dpadY: deckMidY,
      cutX: leftSidePad
        ? Math.min(this.viewportW - 78, this.viewportW * 0.77)
        : Math.max(78, this.viewportW * 0.23),
      cutY: deckMidY
    };
  }

  public handleTouchStart(touchId: number, clientX: number, clientY: number, nowMs = 0): void {
    const centers = this.getFixedPadCenter();
    const isLandscape =
      this.landscapeLeftWingMaxX !== null &&
      this.landscapeRightWingMinX !== null &&
      this.viewportW > this.viewportH * 1.12;
    const leftSidePad = this.config.anchorSide !== 'RIGHT';

    // 1. Dedicated crimson `KES` button (= Mobile `SPACE` key!):
    //    Captures direct hits (`<= 88px`) AND blind thumb taps in the `KES` half of the control deck!
    if (this.config.scheme !== 'SINGLE_HAND_DRAG' && this.cutTouchId === null) {
      const distToCut = Math.hypot(clientX - centers.cutX, clientY - centers.cutY);
      const inCutHalfOfDeck =
        !isLandscape &&
        clientY >= this.minSafeControlY - 10 &&
        (leftSidePad ? clientX >= this.viewportW * 0.54 : clientX <= this.viewportW * 0.46);
      const inCutLandscapeWing =
        isLandscape &&
        (leftSidePad
          ? clientX >= (this.landscapeRightWingMinX ?? this.viewportW * 0.75)
          : clientX <= (this.landscapeLeftWingMaxX ?? this.viewportW * 0.25));

      if (distToCut <= 88 || inCutHalfOfDeck || inCutLandscapeWing) {
        this.cutTouchId = touchId;
        this.cutHeld = true;
        if (nowMs > 0) {
          this.cutTapLatchUntilMs = nowMs + CUT_TAP_LATCH_MS;
        }
        return;
      }
    }

    if (this.moveTouchId !== null) return;
    this.moveTouchId = touchId;
    this.prevX = clientX;
    this.prevY = clientY;
    this.strokeDx = 0;
    this.strokeDy = 0;
    this.lastDragMotionMs = nowMs;

    if (this.config.scheme === 'CLASSIC_ARCADE') {
      this.pivotX = centers.dpadX;
      this.pivotY = centers.dpadY;
      this.updateFixedPadDeflection(clientX - this.pivotX, clientY - this.pivotY);
      return;
    }

    // `JOYSTICK_KES` (Mastered Magnetic Circle+Ball) & `SINGLE_HAND_DRAG`:
    // Touch-Origin Centering (`0px` initial jump — moves strictly in the direction your thumb slides!)
    this.pivotX = clientX;
    this.pivotY = clientY;
    this.rawDx = 0;
    this.rawDy = 0;
    this.currentDir = null;
    this.secondaryDir = null;
  }

  public handleTouchMove(touchId: number, clientX: number, clientY: number, nowMs = 0): void {
    if (touchId !== this.moveTouchId) return;

    const stepDx = clientX - this.prevX;
    const stepDy = clientY - this.prevY;
    this.prevX = clientX;
    this.prevY = clientY;

    if (this.config.scheme === 'CLASSIC_ARCADE') {
      this.updateFixedPadDeflection(clientX - this.pivotX, clientY - this.pivotY);
      return;
    }

    if (this.config.scheme === 'JOYSTICK_KES') {
      // Dynamic Follow Leash (`26 CSS px`): outer circle follows right behind the thumb so
      // 90° turns & 180° backtracks trigger with ZERO dead travel!
      let dx = clientX - this.pivotX;
      let dy = clientY - this.pivotY;
      const dist = Math.hypot(dx, dy);
      if (dist > JOYSTICK_FOLLOW_LEASH_PX && dist > 0) {
        const s = JOYSTICK_FOLLOW_LEASH_PX / dist;
        this.pivotX = clientX - dx * s;
        this.pivotY = clientY - dy * s;
        dx = clientX - this.pivotX;
        dy = clientY - this.pivotY;
      }
      this.rawDx = dx;
      this.rawDy = dy;
      this.currentDir = this.resolveMagnetic4Way(
        dx,
        dy,
        this.currentDir,
        this.config.deadzonePx
      );
      this.secondaryDir = this.resolveSecondaryAxis(dx, dy, this.currentDir, 8);
      return;
    }

    // `SINGLE_HAND_DRAG`: 1:1 stroke direction, zero inertia when finger stops!
    if (Math.hypot(stepDx, stepDy) >= 1.0 && nowMs > 0) {
      this.lastDragMotionMs = nowMs;
    }

    const leash = this.config.trailingLeashPx;
    if (stepDx !== 0) {
      this.strokeDx =
        stepDx * this.strokeDx < 0
          ? stepDx
          : Math.max(-leash, Math.min(leash, this.strokeDx + stepDx));
    }
    if (stepDy !== 0) {
      this.strokeDy =
        stepDy * this.strokeDy < 0
          ? stepDy
          : Math.max(-leash, Math.min(leash, this.strokeDy + stepDy));
    }

    if (Math.abs(stepDy) > Math.abs(stepDx) * 1.2) {
      this.strokeDx *= Math.max(0, 1 - Math.abs(stepDy) / this.config.swipeImpulsePx);
    } else if (Math.abs(stepDx) > Math.abs(stepDy) * 1.2) {
      this.strokeDy *= Math.max(0, 1 - Math.abs(stepDx) / this.config.swipeImpulsePx);
    }

    const candidate = this.classifyDominantAxis(
      this.strokeDx,
      this.strokeDy,
      this.config.swipeImpulsePx
    );
    if (candidate && candidate !== this.currentDir) {
      this.currentDir = candidate;
      this.secondaryDir = null;
      this.snapPivotBehindDirection(clientX, clientY, candidate, leash);
      const v = this.dirToVector(candidate);
      this.strokeDx = v.x * this.config.swipeImpulsePx;
      this.strokeDy = v.y * this.config.swipeImpulsePx;
      return;
    }

    const ldx = clientX - this.pivotX;
    const ldy = clientY - this.pivotY;
    const ldist = Math.hypot(ldx, ldy);
    if (ldist > leash) {
      const s = leash / ldist;
      this.pivotX = clientX - ldx * s;
      this.pivotY = clientY - ldy * s;
    }
  }

  /**
   * Enforces V7 Zero-Inertia Stop on `SINGLE_HAND_DRAG` when the finger stops moving on screen,
   * and expires transient `KES` tap-latches cleanly.
   */
  public tick(nowMs: number): void {
    if (
      this.config.scheme === 'SINGLE_HAND_DRAG' &&
      this.moveTouchId !== null &&
      this.lastDragMotionMs > 0 &&
      nowMs - this.lastDragMotionMs > SINGLE_HAND_STOP_IDLE_MS
    ) {
      this.currentDir = null;
      this.secondaryDir = null;
      this.strokeDx = 0;
      this.strokeDy = 0;
      this.pivotX = this.prevX;
      this.pivotY = this.prevY;
    }
  }

  public handleTouchEnd(touchId: number): void {
    if (touchId === this.cutTouchId) {
      this.cutTouchId = null;
      this.cutHeld = false;
      return;
    }
    if (touchId === this.moveTouchId) {
      // V7 Law 1: Lifting the finger stops movement in 0ms (`direction = null`)!
      this.moveTouchId = null;
      this.currentDir = null;
      this.secondaryDir = null;
      this.rawDx = 0;
      this.rawDy = 0;
      this.strokeDx = 0;
      this.strokeDy = 0;
      this.lastDragMotionMs = 0;
    }
  }

  public getDirection(): CardinalDir | null {
    return this.currentDir;
  }

  public getSecondaryDirection(): CardinalDir | null {
    return this.secondaryDir;
  }

  public isCutAllowed(nowMs = 0): boolean {
    if (this.config.scheme === 'SINGLE_HAND_DRAG') {
      return this.currentDir !== null;
    }
    return this.cutHeld || (nowMs > 0 && nowMs <= this.cutTapLatchUntilMs);
  }

  public getVisualState(nowMs = 0): TouchVisualState {
    const centers = this.getFixedPadCenter();
    const padRadius = 60;
    let padX = centers.dpadX;
    let padY = centers.dpadY;

    const isLandscape =
      this.landscapeLeftWingMaxX !== null &&
      this.landscapeRightWingMinX !== null &&
      this.viewportW > this.viewportH * 1.12;

    if (
      (this.config.scheme === 'SINGLE_HAND_DRAG' || this.config.scheme === 'JOYSTICK_KES') &&
      this.moveTouchId !== null
    ) {
      if (isLandscape) {
        const onLeft =
          this.config.scheme === 'JOYSTICK_KES'
            ? this.config.anchorSide !== 'RIGHT'
            : this.pivotX < this.viewportW * 0.5;
        const minX = onLeft ? padRadius + 8 : (this.landscapeRightWingMinX ?? 0) + padRadius + 8;
        const maxX = onLeft
          ? Math.max(minX, (this.landscapeLeftWingMaxX ?? this.viewportW) - padRadius - 8)
          : this.viewportW - padRadius - 8;
        padX = Math.max(minX, Math.min(maxX, this.pivotX));
      } else if (this.config.scheme === 'JOYSTICK_KES') {
        const leftSidePad = this.config.anchorSide !== 'RIGHT';
        const minX = leftSidePad ? padRadius + 12 : this.viewportW * 0.52 + padRadius * 0.5;
        const maxX = leftSidePad
          ? this.viewportW * 0.48 - padRadius * 0.35
          : this.viewportW - padRadius - 12;
        padX = Math.max(minX, Math.min(Math.max(minX, maxX), this.pivotX));
      } else {
        padX = Math.max(padRadius + 12, Math.min(this.viewportW - padRadius - 12, this.pivotX));
      }
      padY = Math.max(
        this.minSafeControlY + padRadius + 8,
        Math.min(this.viewportH - padRadius - 12, this.pivotY)
      );
    }

    const dirVec = this.dirToVector(this.currentDir);
    let knobX = padX;
    let knobY = padY;

    if (this.moveTouchId !== null && this.config.scheme === 'JOYSTICK_KES') {
      // Blend 62% raw thumb offset + 38% magnetic 4-way slot snap so the inner ball
      // visibly clicks into the active cardinal groove!
      const rawScale = 36 / JOYSTICK_FOLLOW_LEASH_PX;
      const rx = this.rawDx * rawScale;
      const ry = this.rawDy * rawScale;
      const mx = dirVec.x * (this.currentDir ? 34 : 0);
      const my = dirVec.y * (this.currentDir ? 34 : 0);
      knobX = padX + rx * 0.62 + mx * 0.38;
      knobY = padY + ry * 0.62 + my * 0.38;
    } else if (this.moveTouchId !== null && this.config.scheme === 'CLASSIC_ARCADE') {
      knobX = padX + this.rawDx;
      knobY = padY + this.rawDy;
    } else {
      knobX = padX + dirVec.x * (this.currentDir ? 28 : 0);
      knobY = padY + dirVec.y * (this.currentDir ? 28 : 0);
    }

    return {
      active: this.moveTouchId !== null,
      scheme: this.config.scheme,
      direction: this.currentDir,
      secondaryDirection: this.secondaryDir,
      cutPressed: this.isCutAllowed(nowMs),
      padCenterX: padX,
      padCenterY: padY,
      knobX,
      knobY,
      cutBtnCenterX: centers.cutX,
      cutBtnCenterY: centers.cutY
    };
  }

  private updateFixedPadDeflection(dx: number, dy: number): void {
    const maxThrow = this.config.maxKnobThrowPx;
    const dist = Math.hypot(dx, dy);
    if (dist > maxThrow && dist > 0) {
      const scale = maxThrow / dist;
      this.rawDx = dx * scale;
      this.rawDy = dy * scale;
    } else {
      this.rawDx = dx;
      this.rawDy = dy;
    }
    this.currentDir = this.resolveMagnetic4Way(dx, dy, this.currentDir, this.config.deadzonePx);
    this.secondaryDir = this.resolveSecondaryAxis(dx, dy, this.currentDir, 10);
  }

  /**
   * Sanwa 4-Way Magnetic Gate with Hysteresis:
   * - Enters Neutral Brake Pocket (`null`) immediately when inside `deadzone` (`7px`).
   * - Reverses 180° immediately when crossing center along the active axis.
   * - Requires `1.30x` perpendicular dominance (`~52.4°`) to switch 90°, eliminating accidental
   *   thumb-angle wobble near 45°!
   */
  private resolveMagnetic4Way(
    dx: number,
    dy: number,
    prev: CardinalDir | null,
    deadzone: number
  ): CardinalDir | null {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.hypot(dx, dy) < deadzone) return null;

    if (!prev) {
      if (ay >= ax) return dy < 0 ? 'UP' : 'DOWN';
      return dx < 0 ? 'LEFT' : 'RIGHT';
    }

    if (prev === 'LEFT' || prev === 'RIGHT') {
      if (ay > ax * MAGNETIC_HYSTERESIS_RATIO && ay >= deadzone) {
        return dy < 0 ? 'UP' : 'DOWN';
      }
      if (prev === 'LEFT' && dx >= deadzone * 0.75) return 'RIGHT';
      if (prev === 'RIGHT' && dx <= -deadzone * 0.75) return 'LEFT';
      return prev;
    }

    if (ax > ay * MAGNETIC_HYSTERESIS_RATIO && ax >= deadzone) {
      return dx < 0 ? 'LEFT' : 'RIGHT';
    }
    if (prev === 'UP' && dy >= deadzone * 0.75) return 'DOWN';
    if (prev === 'DOWN' && dy <= -deadzone * 0.75) return 'UP';
    return prev;
  }

  private resolveSecondaryAxis(
    dx: number,
    dy: number,
    primary: CardinalDir | null,
    minSecondaryPx: number
  ): CardinalDir | null {
    if (!primary) return null;
    if (primary === 'LEFT' || primary === 'RIGHT') {
      if (Math.abs(dy) >= minSecondaryPx) return dy < 0 ? 'UP' : 'DOWN';
      return null;
    }
    if (Math.abs(dx) >= minSecondaryPx) return dx < 0 ? 'LEFT' : 'RIGHT';
    return null;
  }

  private classifyDominantAxis(dx: number, dy: number, minThreshold: number): CardinalDir | null {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < minThreshold) return null;

    const ratio = this.config.axisDominanceRatio;
    if (ay >= ax * ratio) {
      return dy < 0 ? 'UP' : 'DOWN';
    }
    if (ax >= ay * ratio) {
      return dx < 0 ? 'LEFT' : 'RIGHT';
    }
    return null;
  }

  private snapPivotBehindDirection(fx: number, fy: number, dir: CardinalDir, dist: number): void {
    const v = this.dirToVector(dir);
    this.pivotX = fx - v.x * dist;
    this.pivotY = fy - v.y * dist;
  }

  private dirToVector(dir: CardinalDir | null): { x: number; y: number } {
    switch (dir) {
      case 'UP':
        return { x: 0, y: -1 };
      case 'DOWN':
        return { x: 0, y: 1 };
      case 'LEFT':
        return { x: -1, y: 0 };
      case 'RIGHT':
        return { x: 1, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  }
}
