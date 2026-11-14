import {
  BACKTRACK_SPEED_MULTIPLIER,
  BASE_BORDER_SPEED,
  BASE_CUT_SPEED,
  GRID_STEP,
  MAX_SPEED_MULTIPLIER,
  PALETTE,
  SHIELD_ZERO_GRACE_SECONDS,
  ShipSkinConfig,
  SPEED_BOOSTED_CUT_SPEED,
  SPEED_UP_STEP
} from '../core/Config';
import {
  getPolylineLength,
  isPointOnBarrier,
  isPointOnPolygonBoundary,
  pointInPolygonStrict,
  projectPointToPolygon,
  snapPoint
} from '../geometry/PolygonMath';
import { SOLID_BOX_HALF, SolidRect } from '../geometry/SolidBoxes';
import { Barrier, Direction, DIR_VECTORS, OPPOSITE_DIR, Point } from '../geometry/Types';
import { InputState } from '../input/InputManager';
import { NativeBridge } from '../native/NativeBridge';
import { blitArenaPixelSprite } from '../rendering/PixelArtEngine';
import { getCircularShieldSprite, getPlayerShipSprite } from '../rendering/VolfiedSprites';
import {
  BorderAndCutNavigator,
  oppositeDir,
  SolidBoxObstacle
} from './BorderAndCutNavigator';

export type ShipState = 'ON_BORDER' | 'CUTTING';

export interface CompletedCutEvent {
  readonly trail: Point[];
}

export class PlayerShip {
  public readonly navigator = new BorderAndCutNavigator({ x: 450, y: 1200 });

  public x = 450;
  public y = 1200;
  public prevX = 450;
  public prevY = 1200;
  public vx = 0;
  public vy = 0;

  public state: ShipState = 'ON_BORDER';
  public facing: Direction = 'UP';
  public cutDirection: Direction = 'UP';
  public isBacktracking = false;

  public cutStartPoint: Point = { x: 450, y: 1200 };

  // Shield & power-up state
  public maxShieldDuration = 95;
  public maxShieldUnits = 950;
  public shieldTimer = 95;
  public shieldGraceTimer = SHIELD_ZERO_GRACE_SECONDS;
  public shieldLockTimer = 0;
  public speedMultiplier = 1.0;
  public laserTimer = 0;
  public bossCannonTimer = 0;
  public invulnerableTimer = 0;
  public shieldHitFlash = 0;
  public turnedCornerThisStep = false;

  /** Solid wall blocks the cutting ship can never pass through (synced every frame). */
  public solidBoxes: readonly SolidRect[] = [];
  /** True when the ship stopped flush against a solid wall block during the latest step. */
  public boxContactThisStep = false;
  private fireCooldown = 0;

  public initForLevel(
    spawnPoint: Point,
    shieldDuration: number,
    initialShieldUnits = 950
  ): void {
    const snapped = snapPoint(spawnPoint);
    this.navigator.resetToBorder(snapped);
    this.navigator.facing = 'UP';
    this.navigator.cutDir = 'UP';

    this.x = this.navigator.pos.x;
    this.y = this.navigator.pos.y;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.state = 'ON_BORDER';
    this.facing = 'UP';
    this.cutDirection = 'UP';
    this.isBacktracking = false;
    this.cutStartPoint = { x: this.x, y: this.y };

    this.maxShieldDuration = Math.max(10, shieldDuration);
    this.maxShieldUnits = Math.max(100, Math.min(999, Math.round(initialShieldUnits)));
    this.shieldTimer = this.maxShieldDuration;
    this.shieldGraceTimer = SHIELD_ZERO_GRACE_SECONDS;
    this.shieldLockTimer = 0;
    this.speedMultiplier = 1.0;
    this.laserTimer = 0;
    this.bossCannonTimer = 0;
    this.invulnerableTimer = 2.0;
    this.shieldHitFlash = 0;
    this.turnedCornerThisStep = false;
    this.boxContactThisStep = false;
    this.fireCooldown = 0;
  }

  public respawnAtCutStart(activePolygon: readonly Point[]): void {
    let target = snapPoint(this.cutStartPoint);
    if (!isPointOnPolygonBoundary(target, activePolygon, 0.5)) {
      target = snapPoint(projectPointToPolygon(target, activePolygon).point);
    }
    this.navigator.resetToBorder(target);
    this.x = this.navigator.pos.x;
    this.y = this.navigator.pos.y;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.state = 'ON_BORDER';
    this.isBacktracking = false;
    this.speedMultiplier = 1.0;
    this.laserTimer = 0;
    this.bossCannonTimer = 0;
    this.invulnerableTimer = 2.8;
    if (this.shieldTimer <= 0 && this.shieldGraceTimer <= 0) {
      this.shieldGraceTimer = SHIELD_ZERO_GRACE_SECONDS;
    }
    this.turnedCornerThisStep = false;
    this.boxContactThisStep = false;
  }

  public snapOntoUpdatedPolygon(activePolygon: readonly Point[]): void {
    let target = { x: this.x, y: this.y };
    if (!isPointOnPolygonBoundary(target, activePolygon, 0.5)) {
      target = snapPoint(projectPointToPolygon(target, activePolygon).point);
    }
    this.navigator.resetToBorder(target);
    this.x = this.navigator.pos.x;
    this.y = this.navigator.pos.y;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.state = 'ON_BORDER';
    this.isBacktracking = false;
  }

  public getShieldUnits(): number {
    if (this.shieldTimer <= 0) return 0;
    return Math.min(
      999,
      Math.max(1, Math.ceil((this.shieldTimer / this.maxShieldDuration) * this.maxShieldUnits))
    );
  }

  public isShieldInZeroWarning(): boolean {
    return this.shieldTimer <= 0 && this.shieldGraceTimer > 0;
  }

  public isPerimeterShieldActive(): boolean {
    return this.state === 'ON_BORDER' && (this.shieldTimer > 0 || this.shieldGraceTimer > 0);
  }

  public applySpeedUp(): void {
    const minBoostRatio = Math.ceil((SPEED_BOOSTED_CUT_SPEED / BASE_CUT_SPEED) * 100) / 100;
    const next = Math.max(minBoostRatio, this.speedMultiplier + SPEED_UP_STEP);
    this.speedMultiplier = Math.min(MAX_SPEED_MULTIPLIER, Math.round(next * 100) / 100);
  }

  public applyShieldLock(): void {
    this.shieldLockTimer = 15.0;
    this.shieldGraceTimer = SHIELD_ZERO_GRACE_SECONDS;
    const bonusSeconds = (180 / this.maxShieldUnits) * this.maxShieldDuration;
    this.shieldTimer = Math.min(this.maxShieldDuration * 1.15, this.shieldTimer + bonusSeconds);
  }

  public getCurrentCutSpeed(): number {
    const base = BASE_CUT_SPEED * this.speedMultiplier;
    return this.isBacktracking ? base * BACKTRACK_SPEED_MULTIPLIER : base;
  }

  public getActiveTrail(): Point[] {
    if (this.state !== 'CUTTING') return [];
    return this.navigator.trail.map((p) => ({ x: p.x, y: p.y }));
  }

  public getActiveTrailLength(): number {
    if (this.state !== 'CUTTING') return 0;
    return getPolylineLength(this.navigator.trail);
  }

  public getRenderPosition(alpha: number): Point {
    return {
      x: this.prevX + (this.x - this.prevX) * alpha,
      y: this.prevY + (this.y - this.prevY) * alpha
    };
  }

  /**
   * Computes all valid inward entry directions from the current border position
   * (including narrow peninsula tips & concave vertices where 2 directions enter `activePolygon`).
   */
  public getInwardBorderDirections(
    activePolygon: readonly Point[],
    activeBarriers: readonly Barrier[] = []
  ): Direction[] {
    const navBoxes = this.toNavigatorBoxes();
    const out: Direction[] = [];
    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    for (const d of dirs) {
      if (this.navigator.canLaunchCutFrom({ x: this.x, y: this.y }, d, activePolygon, navBoxes, activeBarriers)) {
        out.push(d);
      }
    }
    return out;
  }

  /**
   * Computes primary inward firing / entry direction when ship is on safe perimeter.
   */
  public getInwardBorderDirection(activePolygon: readonly Point[]): Direction | null {
    const dirs = this.getInwardBorderDirections(activePolygon);
    if (dirs.length === 0) {
      const allDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      for (const d of allDirs) {
        const { dx, dy } = DIR_VECTORS[d];
        if (pointInPolygonStrict({ x: this.x + dx * GRID_STEP, y: this.y + dy * GRID_STEP }, activePolygon)) {
          return d;
        }
      }
      return null;
    }
    if (dirs.includes(this.facing)) return this.facing;
    return dirs[0];
  }

  public canFireWeapon(dt: number): 'LASER' | 'BOSS_CANNON' | null {
    if (this.fireCooldown > 0) {
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    }
    if (this.state !== 'ON_BORDER') return null;

    if (this.bossCannonTimer > 0 && this.fireCooldown <= 0) {
      this.fireCooldown = 0.28;
      return 'BOSS_CANNON';
    }
    if (this.laserTimer > 0 && this.fireCooldown <= 0) {
      this.fireCooldown = 0.15;
      return 'LASER';
    }
    return null;
  }

  private toNavigatorBoxes(): SolidBoxObstacle[] {
    const half = Math.max(4, SOLID_BOX_HALF - 4); // 30 + 4 pad = 34 (`SOLID_BOX_HALF`)
    return this.solidBoxes.map((b, idx) => ({
      id: `box_${idx}`,
      x: b.x,
      y: b.y,
      halfSize: half,
      active: true
    }));
  }

  public update(
    dt: number,
    input: InputState,
    activePolygon: readonly Point[],
    activeBarriers: readonly Barrier[]
  ): CompletedCutEvent | null {
    this.prevX = this.x;
    this.prevY = this.y;
    this.turnedCornerThisStep = false;
    this.boxContactThisStep = false;

    // Update timers
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }
    if (this.shieldHitFlash > 0) {
      this.shieldHitFlash = Math.max(0, this.shieldHitFlash - dt);
    }
    if (this.laserTimer > 0) {
      this.laserTimer = Math.max(0, this.laserTimer - dt);
    }
    if (this.bossCannonTimer > 0) {
      this.bossCannonTimer = Math.max(0, this.bossCannonTimer - dt);
    }
    // V7 Law 2: Perimeter Shield Economy!
    // Shield energy (`shieldTimer` & `shieldGraceTimer`) drains ONLY while resting on `ON_BORDER`,
    // and PAUSES completely (`0.000` drain) while unshielded in open space (`CUTTING`)!
    if (this.state === 'ON_BORDER') {
      if (this.shieldLockTimer > 0) {
        this.shieldLockTimer = Math.max(0, this.shieldLockTimer - dt);
      } else if (this.shieldTimer > 0) {
        this.shieldTimer = Math.max(0, this.shieldTimer - dt);
      } else if (this.shieldGraceTimer > 0) {
        this.shieldGraceTimer = Math.max(0, this.shieldGraceTimer - dt);
      }
    }

    const prevMode = this.state;
    const wantsBacktrack =
      prevMode === 'CUTTING' &&
      input.direction !== null &&
      input.direction === oppositeDir(this.navigator.cutDir);

    const baseSpd =
      (prevMode === 'CUTTING' ? BASE_CUT_SPEED : BASE_BORDER_SPEED) * this.speedMultiplier;
    const cutAllowed = Boolean(input.carveHeld || input.autoCarveSwipe);
    const navBoxes = this.toNavigatorBoxes();

    const outcome = this.navigator.step(
      dt,
      baseSpd,
      input.direction,
      cutAllowed,
      activePolygon,
      navBoxes,
      activeBarriers,
      input.secondaryDirection ?? null
    );

    this.x = outcome.pos.x;
    this.y = outcome.pos.y;
    this.vx = dt > 0 ? (this.x - this.prevX) / dt : 0;
    this.vy = dt > 0 ? (this.y - this.prevY) / dt : 0;
    this.state = outcome.mode;
    this.facing = outcome.facing;
    this.cutDirection = this.navigator.cutDir;
    this.isBacktracking = outcome.mode === 'CUTTING' && wantsBacktrack;
    this.boxContactThisStep = Boolean(outcome.hitSolidBox);
    this.turnedCornerThisStep = Boolean(outcome.turnedCorner);

    if (prevMode === 'ON_BORDER' && outcome.mode === 'CUTTING' && outcome.trail.length > 0) {
      this.cutStartPoint = { x: outcome.trail[0].x, y: outcome.trail[0].y };
    }

    if (this.turnedCornerThisStep) {
      NativeBridge.hapticCornerTurn();
    }

    if (outcome.completedCut) {
      this.isBacktracking = false;
      return { trail: outcome.trail };
    }

    return null;
  }

  /**
   * Renders:
   * 1. Crisp 90-degree 16-bit Pixel Orange Cutting Line (`#FF7810` + `#FFF0A0` core + `#080810` border)
   * 2. Mobile Clarity Aid: Subtle inward pixel chevron when on safe border
   * 3. 2-Frame Circular Pixel Green/Red Forcefield (`getCircularShieldSprite`)
   * 4. 16-Bit Twin-Prong Pixel Starfighter (`getPlayerShipSprite`)
   */
  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    skin: ShipSkinConfig,
    timeSeconds: number,
    activePolygon?: readonly Point[],
    carveArmed = false,
    activeBarriers?: readonly Barrier[]
  ): void {
    const renderPos = this.getRenderPosition(alpha);
    const trail = this.navigator.trail;

    // 1. 16-Bit Pixel Orange Cutting Trail (`02-hedef-faz2-boss-ve-temiz-kontrol.jpg`!)
    if (this.state === 'CUTTING' && trail.length >= 2) {
      ctx.save();
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';

      ctx.beginPath();
      ctx.moveTo(Math.round(trail[0].x), Math.round(trail[0].y));
      for (let i = 1; i < trail.length - 1; i++) {
        ctx.lineTo(Math.round(trail[i].x), Math.round(trail[i].y));
      }
      ctx.lineTo(Math.round(renderPos.x), Math.round(renderPos.y));

      // 1px black pixel casing
      ctx.strokeStyle = PALETTE.PIXEL_BLACK;
      ctx.lineWidth = 9;
      ctx.stroke();

      // Blazing arcade orange laser body (`#FF7810`, shifts cyan-gold highlight if backtracking!)
      ctx.strokeStyle = this.isBacktracking ? '#FFA828' : PALETTE.CUT_ORANGE;
      ctx.lineWidth = 5;
      ctx.stroke();

      // White-yellow pixel core
      ctx.strokeStyle = PALETTE.CUT_CORE;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Crisp 90-degree pixel corner nodes + anchor spark
      for (let i = 0; i < trail.length - 1; i++) {
        const cx = Math.round(trail[i].x);
        const cy = Math.round(trail[i].y);
        ctx.fillStyle = PALETTE.PIXEL_BLACK;
        ctx.fillRect(cx - 5, cy - 5, 10, 10);
        ctx.fillStyle = PALETTE.CUT_ORANGE;
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
        ctx.fillStyle = PALETTE.CUT_CORE;
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
      }
      ctx.restore();
    }

    // 2. Mobile Clarity Aid: small pixel chevron showing valid inward entry on safe border
    if (
      this.state === 'ON_BORDER' &&
      activePolygon &&
      (!activeBarriers || !isPointOnBarrier({ x: this.x, y: this.y }, activeBarriers, 0.5))
    ) {
      const inwardDir = this.getInwardBorderDirection(activePolygon);
      if (inwardDir) {
        const { dx, dy } = DIR_VECTORS[inwardDir];
        const bob = carveArmed ? Math.round(Math.sin(timeSeconds * 12) * 4) : 0;
        const ax = Math.round(renderPos.x + dx * (38 + bob));
        const ay = Math.round(renderPos.y + dy * (38 + bob));
        const px = -dy;
        const py = dx;
        const steps = carveArmed ? 3 : 2;

        ctx.save();
        ctx.globalAlpha = carveArmed ? 1 : 0.82;
        for (let step = 0; step < steps; step++) {
          const sx = ax - dx * step * 4;
          const sy = ay - dy * step * 4;
          const span = step * 4 + 2;
          ctx.fillStyle = PALETTE.PIXEL_BLACK;
          ctx.fillRect(
            sx - Math.abs(px) * (span + 2) - 3,
            sy - Math.abs(py) * (span + 2) - 3,
            Math.abs(px) * (span + 2) * 2 + 6,
            Math.abs(py) * (span + 2) * 2 + 6
          );
          ctx.fillStyle = step === 0 ? PALETTE.CUT_CORE : PALETTE.CUT_ORANGE;
          ctx.fillRect(
            sx - Math.abs(px) * span - 2,
            sy - Math.abs(py) * span - 2,
            Math.abs(px) * span * 2 + 4,
            Math.abs(py) * span * 2 + 4
          );
        }
        ctx.restore();
      }
    }

    // 3. Invulnerability flash without hiding the ship completely
    const invulnAlpha =
      this.invulnerableTimer > 0 && Math.floor(timeSeconds * 14) % 2 === 0 ? 0.55 : 1.0;

    ctx.save();
    ctx.globalAlpha = invulnAlpha;

    // 4. 2-Frame Circular Pixel Green/Red Forcefield (`ON_BORDER` while shield or grace active!)
    if (this.isPerimeterShieldActive()) {
      const shieldUnits = this.getShieldUnits();
      const warning = shieldUnits < 150 || this.isShieldInZeroWarning();
      const frame: 0 | 1 = Math.floor(timeSeconds * (warning ? 14 : 8)) % 2 === 0 ? 0 : 1;
      const shieldSprite = getCircularShieldSprite(frame, warning);
      blitArenaPixelSprite(ctx, shieldSprite, renderPos.x, renderPos.y, 1.05);
    }

    // 5. 16-Bit Pixel Twin-Prong Starfighter (`getPlayerShipSprite`)
    const shipSprite = getPlayerShipSprite(skin, this.facing);
    blitArenaPixelSprite(ctx, shipSprite, renderPos.x, renderPos.y, 1.08);

    // Pixel thruster spark behind ship while cutting
    if (this.state === 'CUTTING') {
      const back = DIR_VECTORS[OPPOSITE_DIR[this.facing]];
      const flicker = Math.floor(timeSeconds * 24) % 2 === 0 ? 4 : 7;
      const tx = Math.round(renderPos.x + back.dx * 22);
      const ty = Math.round(renderPos.y + back.dy * 22);
      ctx.fillStyle = this.isBacktracking ? '#50F0FF' : PALETTE.CUT_ORANGE;
      ctx.fillRect(tx - flicker, ty - flicker, flicker * 2, flicker * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(tx - 2, ty - 2, 4, 4);
    }

    ctx.restore();
  }
}
