import {
  BACKTRACK_SPEED_MULTIPLIER,
  BASE_BORDER_SPEED,
  BASE_CUT_SPEED,
  CORNER_BUFFER_DIST,
  CORNER_BUFFER_TIME,
  GRID_STEP,
  MAX_SPEED_MULTIPLIER,
  MIN_SEGMENT_LEN,
  PALETTE,
  SHIELD_ZERO_GRACE_SECONDS,
  ShipSkinConfig,
  SPEED_BOOSTED_CUT_SPEED,
  SPEED_UP_STEP
} from '../core/Config';
import {
  castOrthogonalRayToPolygon,
  getPolylineLength,
  isPointOnBarrier,
  isPointOnPolygonBoundary,
  manhattanDist,
  pointInPolygonStrict,
  pointsEqual,
  projectPointToPolygon,
  projectPointToSegment,
  snapPoint
} from '../geometry/PolygonMath';
import { Barrier, Direction, DIR_VECTORS, OPPOSITE_DIR, Point } from '../geometry/Types';
import { isPointBlockedBySolidBoxes, SolidRect } from '../geometry/SolidBoxes';
import { InputState } from '../input/InputManager';
import { NativeBridge } from '../native/NativeBridge';
import { blitArenaPixelSprite } from '../rendering/PixelArtEngine';
import { getCircularShieldSprite, getPlayerShipSprite } from '../rendering/VolfiedSprites';

export type ShipState = 'ON_BORDER' | 'CUTTING';

export interface CompletedCutEvent {
  readonly trail: Point[];
}

export class PlayerShip {
  public x = 450;
  public y = 1200;
  public prevX = 450;
  public prevY = 1200;

  public state: ShipState = 'ON_BORDER';
  public facing: Direction = 'UP';
  public cutDirection: Direction = 'UP';
  public isBacktracking = false;

  public cutStartPoint: Point = { x: 450, y: 1200 };
  private trailCorners: Point[] = [];

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

  /** V5 solid wall blocks the cutting ship can never pass through (set by the engine every frame). */
  public solidBoxes: readonly SolidRect[] = [];
  /** True when the ship was stopped by a solid wall block during the latest update. */
  public boxContactThisStep = false;
  private moveRemainder = 0;
  private turnBufferDir: Direction | null = null;
  private turnBufferTimer = 0;
  private backtrackCornerLatchDir: Direction | null = null;
  private postExitAutoCutCooldown = 0;
  private postExitLatchDir: Direction | null = null;
  private fireCooldown = 0;

  public initForLevel(
    spawnPoint: Point,
    shieldDuration: number,
    initialShieldUnits = 950
  ): void {
    const snapped = snapPoint(spawnPoint);
    this.x = snapped.x;
    this.y = snapped.y;
    this.prevX = snapped.x;
    this.prevY = snapped.y;
    this.state = 'ON_BORDER';
    this.facing = 'UP';
    this.cutDirection = 'UP';
    this.isBacktracking = false;
    this.cutStartPoint = { ...snapped };
    this.trailCorners = [];
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
    this.moveRemainder = 0;
    this.turnBufferDir = null;
    this.turnBufferTimer = 0;
    this.backtrackCornerLatchDir = null;
    this.postExitAutoCutCooldown = 0;
    this.postExitLatchDir = null;
    this.fireCooldown = 0;
  }

  public respawnAtCutStart(activePolygon: readonly Point[]): void {
    let target = snapPoint(this.cutStartPoint);
    if (!isPointOnPolygonBoundary(target, activePolygon, 0.5)) {
      target = snapPoint(projectPointToPolygon(target, activePolygon).point);
    }
    this.x = target.x;
    this.y = target.y;
    this.prevX = target.x;
    this.prevY = target.y;
    this.state = 'ON_BORDER';
    this.isBacktracking = false;
    this.trailCorners = [];
    this.speedMultiplier = 1.0;
    this.laserTimer = 0;
    this.bossCannonTimer = 0;
    this.invulnerableTimer = 2.8;
    if (this.shieldTimer <= 0 && this.shieldGraceTimer <= 0) {
      this.shieldGraceTimer = SHIELD_ZERO_GRACE_SECONDS;
    }
    this.moveRemainder = 0;
    this.turnBufferDir = null;
    this.turnBufferTimer = 0;
    this.backtrackCornerLatchDir = null;
    this.postExitAutoCutCooldown = 0.32;
    this.postExitLatchDir = null;
  }

  public snapOntoUpdatedPolygon(activePolygon: readonly Point[]): void {
    if (!isPointOnPolygonBoundary({ x: this.x, y: this.y }, activePolygon, 0.5)) {
      const proj = snapPoint(projectPointToPolygon({ x: this.x, y: this.y }, activePolygon).point);
      this.x = proj.x;
      this.y = proj.y;
      this.prevX = proj.x;
      this.prevY = proj.y;
    }
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
    const last = this.trailCorners[this.trailCorners.length - 1];
    if (last && last.x === this.x && last.y === this.y) {
      return [...this.trailCorners];
    }
    return [...this.trailCorners, { x: this.x, y: this.y }];
  }

  public getActiveTrailLength(): number {
    if (this.state !== 'CUTTING') return 0;
    return getPolylineLength(this.getActiveTrail());
  }

  public getRenderPosition(alpha: number): Point {
    return {
      x: this.prevX + (this.x - this.prevX) * alpha,
      y: this.prevY + (this.y - this.prevY) * alpha
    };
  }

  /**
   * Computes all valid inward entry directions from the current border position
   * (supports concave vertices where 2 directions point into `activePolygon`).
   */
  public getInwardBorderDirections(
    activePolygon: readonly Point[],
    activeBarriers?: readonly Barrier[]
  ): Direction[] {
    if (activeBarriers && isPointOnBarrier({ x: this.x, y: this.y }, activeBarriers, 0.5)) {
      return [];
    }
    const validBorder = this.getValidBorderDirections({ x: this.x, y: this.y }, activePolygon);
    const out: Direction[] = [];
    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    for (const d of dirs) {
      if (validBorder.includes(d)) continue;
      const { dx, dy } = DIR_VECTORS[d];
      const probe1 = { x: this.x + dx * 1, y: this.y + dy * 1 };
      const probe2 = { x: this.x + dx * GRID_STEP, y: this.y + dy * GRID_STEP };
      if (
        pointInPolygonStrict(probe1, activePolygon) &&
        !isPointBlockedBySolidBoxes(probe2, this.solidBoxes)
      ) {
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
        if (pointInPolygonStrict({ x: this.x + dx * 2, y: this.y + dy * 2 }, activePolygon)) {
          return d;
        }
      }
      return null;
    }
    if (dirs.includes(this.facing)) return this.facing;
    return dirs[0];
  }

  /**
   * Returns true if `dir` walks directly along the safe border OR approaches an upcoming
   * border corner within `CORNER_BUFFER_DIST` (prevents auto-cut from freezing corner turns!).
   */
  public canMoveOrApproachOnBorder(dir: Direction, activePolygon: readonly Point[]): boolean {
    const pos = { x: this.x, y: this.y };
    const validBorderDirs = this.getValidBorderDirections(pos, activePolygon);
    if (validBorderDirs.includes(dir)) return true;
    return (
      this.findCornerApproachDirection(pos, dir, validBorderDirs, activePolygon) !== null
    );
  }

  /**
   * Prevents accidental bounce re-entry right after completing a cut or 180° backtrack.
   */
  public isAutoCutSuppressedAfterExit(heldDir: Direction | null): boolean {
    if (this.postExitAutoCutCooldown > 0) return true;
    if (heldDir !== null && this.postExitLatchDir !== null && heldDir === this.postExitLatchDir) {
      return true;
    }
    return false;
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
    if (this.shieldLockTimer > 0) {
      this.shieldLockTimer = Math.max(0, this.shieldLockTimer - dt);
    } else if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    } else if (this.shieldGraceTimer > 0) {
      this.shieldGraceTimer = Math.max(0, this.shieldGraceTimer - dt);
    }

    if (this.turnBufferTimer > 0) {
      this.turnBufferTimer = Math.max(0, this.turnBufferTimer - dt);
      if (this.turnBufferTimer <= 0) {
        this.turnBufferDir = null;
      }
    }

    if (this.backtrackCornerLatchDir && input.direction !== this.backtrackCornerLatchDir) {
      this.backtrackCornerLatchDir = null;
    }
    if (this.postExitAutoCutCooldown > 0) {
      this.postExitAutoCutCooldown = Math.max(0, this.postExitAutoCutCooldown - dt);
    }
    if (this.postExitLatchDir && input.direction !== this.postExitLatchDir) {
      this.postExitLatchDir = null;
    }

    // Buffer perpendicular direction inputs for crisp 90-degree cornering (`140ms`)
    if (input.direction) {
      if (this.state === 'CUTTING') {
        if (
          input.direction !== this.cutDirection &&
          input.direction !== OPPOSITE_DIR[this.cutDirection] &&
          input.direction !== this.backtrackCornerLatchDir
        ) {
          this.turnBufferDir = input.direction;
          this.turnBufferTimer = CORNER_BUFFER_TIME;
        }
      } else {
        this.turnBufferDir = input.direction;
        this.turnBufferTimer = CORNER_BUFFER_TIME;
      }
    }

    const wantsBacktrack =
      this.state === 'CUTTING' && input.direction === OPPOSITE_DIR[this.cutDirection];
    this.isBacktracking = wantsBacktrack;

    const baseSpd =
      (this.state === 'CUTTING' ? BASE_CUT_SPEED : BASE_BORDER_SPEED) * this.speedMultiplier;
    const speed = wantsBacktrack ? baseSpd * BACKTRACK_SPEED_MULTIPLIER : baseSpd;

    const totalPixels = speed * dt + this.moveRemainder;
    const gridSteps = Math.floor(totalPixels / GRID_STEP);
    this.moveRemainder = totalPixels - gridSteps * GRID_STEP;

    if (gridSteps === 0 && this.state === 'ON_BORDER' && input.direction) {
      const carveRequested = input.carveHeld || input.autoCarveSwipe;
      if (carveRequested && this.tryLaunchCut(input.direction, activePolygon, activeBarriers)) {
        return null;
      }
    }

    for (let s = 0; s < gridSteps; s++) {
      if (this.state === 'ON_BORDER') {
        this.stepOnBorder(input, activePolygon, activeBarriers);
      } else {
        const completed = this.stepCutting(input, activePolygon, activeBarriers);
        if (completed) {
          this.isBacktracking = false;
          return completed;
        }
        // If a 180° backtrack safely docked back onto ON_BORDER, stop remaining sub-steps
        // so the player rests cleanly on their border anchor!
        if ((this.state as 'ON_BORDER' | 'CUTTING') === 'ON_BORDER') {
          this.isBacktracking = false;
          this.moveRemainder = 0;
          return null;
        }
      }
    }

    return null;
  }

  private stepOnBorder(
    input: InputState,
    activePolygon: readonly Point[],
    activeBarriers: readonly Barrier[]
  ): void {
    const pos = { x: this.x, y: this.y };
    const validBorderDirs = this.getValidBorderDirections(pos, activePolygon);
    const carveRequested = input.carveHeld || input.autoCarveSwipe;

    // 1. Launch cut if player presses into polygon interior while Carve (`KES` or swipe) is active
    const candidateLaunchDir = input.direction ?? this.turnBufferDir;
    if (
      carveRequested &&
      candidateLaunchDir &&
      !validBorderDirs.includes(candidateLaunchDir) &&
      this.tryLaunchCut(candidateLaunchDir, activePolygon, activeBarriers)
    ) {
      this.stepCutting(input, activePolygon, activeBarriers);
      return;
    }

    // 2. Execute buffered corner turn if now at a vertex where turnBufferDir is valid
    if (this.turnBufferDir && validBorderDirs.includes(this.turnBufferDir)) {
      const chosen = this.turnBufferDir;
      if (this.facing !== chosen) {
        this.turnedCornerThisStep = true;
        NativeBridge.hapticCornerTurn();
      }
      this.facing = chosen;
      this.turnBufferDir = null;
      this.turnBufferTimer = 0;
      this.x += DIR_VECTORS[chosen].dx * GRID_STEP;
      this.y += DIR_VECTORS[chosen].dy * GRID_STEP;
      return;
    }

    // 3. Direct movement along border
    if (input.direction && validBorderDirs.includes(input.direction)) {
      if (this.facing !== input.direction) {
        this.turnedCornerThisStep = true;
        NativeBridge.hapticCornerTurn();
      }
      this.facing = input.direction;
      this.x += DIR_VECTORS[input.direction].dx * GRID_STEP;
      this.y += DIR_VECTORS[input.direction].dy * GRID_STEP;
      return;
    }

    // 4. Corner Turn Magnet / Buffering Assist within `CORNER_BUFFER_DIST` of corner
    const desiredTurn = input.direction ?? this.turnBufferDir;
    if (desiredTurn && !validBorderDirs.includes(desiredTurn)) {
      const approachDir = this.findCornerApproachDirection(
        pos,
        desiredTurn,
        validBorderDirs,
        activePolygon
      );
      if (approachDir) {
        this.facing = approachDir;
        this.x += DIR_VECTORS[approachDir].dx * GRID_STEP;
        this.y += DIR_VECTORS[approachDir].dy * GRID_STEP;
        return;
      }
    }

    // 5. Diagonal Outer-Wall Glide: if primary direction points outside the arena (not an inward
    // cut entry), glide along any valid secondary border axis so exits & corners never stall!
    const secDir = input.secondaryDirection ?? null;
    if (
      secDir &&
      validBorderDirs.includes(secDir) &&
      input.direction &&
      !this.getInwardBorderDirections(activePolygon, activeBarriers).includes(input.direction)
    ) {
      if (this.facing !== secDir) {
        this.turnedCornerThisStep = true;
        NativeBridge.hapticCornerTurn();
      }
      this.facing = secDir;
      this.x += DIR_VECTORS[secDir].dx * GRID_STEP;
      this.y += DIR_VECTORS[secDir].dy * GRID_STEP;
    }
  }

  private tryLaunchCut(
    dir: Direction,
    activePolygon: readonly Point[],
    activeBarriers: readonly Barrier[]
  ): boolean {
    const pos = { x: this.x, y: this.y };

    if (isPointOnBarrier(pos, activeBarriers, 0.5)) {
      return false;
    }

    const { dx, dy } = DIR_VECTORS[dir];
    const probe = { x: pos.x + dx * 1, y: pos.y + dy * 1 };
    if (!pointInPolygonStrict(probe, activePolygon)) {
      return false;
    }

    const ray = castOrthogonalRayToPolygon(pos, dir, activePolygon);
    if (!ray || ray.distance < MIN_SEGMENT_LEN) {
      return false;
    }
    if (ray.distance === MIN_SEGMENT_LEN && isPointOnBarrier(ray.hitPoint, activeBarriers, 0.5)) {
      return false;
    }

    // V5: never start a cut straight into a solid wall block hugging the border
    const firstStep = { x: pos.x + dx * GRID_STEP, y: pos.y + dy * GRID_STEP };
    if (isPointBlockedBySolidBoxes(firstStep, this.solidBoxes)) {
      this.boxContactThisStep = true;
      return false;
    }

    this.state = 'CUTTING';
    this.cutDirection = dir;
    this.facing = dir;
    this.isBacktracking = false;
    this.cutStartPoint = { ...pos };
    this.trailCorners = [{ ...pos }];
    this.turnBufferDir = null;
    this.turnBufferTimer = 0;
    this.backtrackCornerLatchDir = null;
    this.turnedCornerThisStep = true;
    NativeBridge.hapticCornerTurn();
    return true;
  }

  /**
   * Steps 2px backward along `trailCorners` when player pulls `180°` opposite to `cutDirection`!
   * Safely rewinds corners and docks back onto `ON_BORDER` upon reaching `cutStartPoint`.
   */
  private stepBacktrack(heldDir: Direction): void {
    const lastCorner = this.trailCorners[this.trailCorners.length - 1];
    if (!lastCorner) {
      this.state = 'ON_BORDER';
      return;
    }

    const backDir = OPPOSITE_DIR[this.cutDirection];
    if (heldDir !== backDir) return;

    const { dx, dy } = DIR_VECTORS[backDir];
    this.x += dx * GRID_STEP;
    this.y += dy * GRID_STEP;
    this.facing = this.cutDirection;
    this.isBacktracking = true;

    if (pointsEqual({ x: this.x, y: this.y }, lastCorner)) {
      if (this.trailCorners.length <= 1) {
        // Reached `cutStartPoint` on safe green border -> retreat complete!
        this.state = 'ON_BORDER';
        this.trailCorners = [];
        this.isBacktracking = false;
        this.turnBufferDir = null;
        this.turnBufferTimer = 0;
        this.postExitAutoCutCooldown = 0.28;
        this.postExitLatchDir = heldDir;
        NativeBridge.hapticCornerTurn();
        return;
      }

      // Pop the corner we just unwound back onto and restore previous segment direction!
      this.trailCorners.pop();
      const prevCorner = this.trailCorners[this.trailCorners.length - 1];
      const segDx = this.x - prevCorner.x;
      const segDy = this.y - prevCorner.y;
      if (Math.abs(segDx) >= Math.abs(segDy)) {
        this.cutDirection = segDx >= 0 ? 'RIGHT' : 'LEFT';
      } else {
        this.cutDirection = segDy >= 0 ? 'DOWN' : 'UP';
      }
      this.facing = this.cutDirection;
      // Hold cleanly at popped corner while thumb continues holding `heldDir` until changed/released!
      this.backtrackCornerLatchDir = heldDir;
      this.turnBufferDir = null;
      this.turnBufferTimer = 0;
      NativeBridge.hapticCornerTurn();
    }
  }

  private stepCutting(
    input: InputState,
    activePolygon: readonly Point[],
    activeBarriers: readonly Barrier[]
  ): CompletedCutEvent | null {
    // 1. Authentic 180-Degree Line Backtrack / Retreat!
    if (input.direction && input.direction === OPPOSITE_DIR[this.cutDirection]) {
      this.stepBacktrack(input.direction);
      return null;
    }

    this.isBacktracking = false;

    // If holding the latched post-backtrack direction right at a popped corner, pause briefly
    // until player releases or steers a new direction
    if (input.direction && input.direction === this.backtrackCornerLatchDir) {
      return null;
    }

    // 2. Continuous Cruise While Cutting + 90-degree orthogonal turn (with generous Border Exit Magnet!)
    // Once CUTTING, the ship glides forward automatically along `cutDirection` even if the thumb
    // lifts or crosses center deadzone, eliminating mid-exit stalls inside the danger zone.
    const canGoStraight = this.canAdvanceInCutDirection(
      this.cutDirection,
      activePolygon,
      activeBarriers
    );
    const lastCornerForExit = this.trailCorners[this.trailCorners.length - 1];
    const currentSegForExit = lastCornerForExit
      ? manhattanDist(lastCornerForExit, { x: this.x, y: this.y })
      : 0;
    const exitMagnetDist = currentSegForExit >= 36 ? 34 : 16;
    const nearSafeExit =
      canGoStraight &&
      this.isSafeCutExitAhead(this.cutDirection, exitMagnetDist, activePolygon, activeBarriers);

    const requestedDir = input.direction ?? this.turnBufferDir;
    if (
      requestedDir &&
      requestedDir !== this.cutDirection &&
      requestedDir !== OPPOSITE_DIR[this.cutDirection]
    ) {
      if (nearSafeExit) {
        // Player tilted thumb anticipating border movement right before exiting:
        // remember their desired border direction and finish snapping onto the safe border!
        this.turnBufferDir = requestedDir;
        this.turnBufferTimer = CORNER_BUFFER_TIME;
      } else {
        const lastCorner = this.trailCorners[this.trailCorners.length - 1];
        const currentSegLen = manhattanDist(lastCorner, { x: this.x, y: this.y });
        const immediateExitInTurnDir = this.isDirectSafeExitStep(
          requestedDir,
          activePolygon,
          activeBarriers
        );
        if (
          currentSegLen >= MIN_SEGMENT_LEN ||
          (currentSegLen >= GRID_STEP && (!canGoStraight || immediateExitInTurnDir))
        ) {
          if (this.canAdvanceInCutDirection(requestedDir, activePolygon, activeBarriers)) {
            this.trailCorners.push({ x: this.x, y: this.y });
            this.cutDirection = requestedDir;
            this.facing = requestedDir;
            this.turnBufferDir = null;
            this.turnBufferTimer = 0;
            this.turnedCornerThisStep = true;
            NativeBridge.hapticCornerTurn();
          }
        }
      }
    }

    // Advance along `cutDirection` if unobstructed
    if (!this.canAdvanceInCutDirection(this.cutDirection, activePolygon, activeBarriers)) {
      return null;
    }

    const { dx, dy } = DIR_VECTORS[this.cutDirection];
    const nextPos = {
      x: this.x + dx * GRID_STEP,
      y: this.y + dy * GRID_STEP
    };

    this.x = nextPos.x;
    this.y = nextPos.y;
    this.facing = this.cutDirection;

    if (
      !pointsEqual(nextPos, this.cutStartPoint) &&
      isPointOnPolygonBoundary(nextPos, activePolygon, 0.05)
    ) {
      const completedTrail = [...this.trailCorners, { ...nextPos }];
      const pendingPerp =
        this.turnBufferDir &&
        this.turnBufferDir !== this.cutDirection &&
        this.turnBufferDir !== OPPOSITE_DIR[this.cutDirection]
          ? this.turnBufferDir
          : null;
      this.state = 'ON_BORDER';
      this.trailCorners = [];
      this.moveRemainder = 0;
      this.turnBufferDir = pendingPerp;
      this.turnBufferTimer = pendingPerp ? CORNER_BUFFER_TIME : 0;
      this.postExitAutoCutCooldown = 0.28;
      this.postExitLatchDir = input.direction;
      return { trail: completedTrail };
    }

    return null;
  }

  /**
   * Checks if continuing straight along `dir` reaches a clean, safe completion boundary
   * within `maxDist` pixels (no solid box, own trail, barrier, or cutStartPoint in the way).
   */
  private isSafeCutExitAhead(
    dir: Direction,
    maxDist: number,
    activePolygon: readonly Point[],
    activeBarriers: readonly Barrier[]
  ): boolean {
    const { dx, dy } = DIR_VECTORS[dir];
    for (let dist = GRID_STEP; dist <= maxDist; dist += GRID_STEP) {
      const mid = { x: this.x + dx * (dist - 1), y: this.y + dy * (dist - 1) };
      const pt = { x: this.x + dx * dist, y: this.y + dy * dist };
      if (!pointInPolygonStrict(mid, activePolygon)) return false;
      if (isPointBlockedBySolidBoxes(pt, this.solidBoxes)) return false;
      if (this.wouldCollideWithOwnTrail(pt, dir)) return false;
      if (isPointOnPolygonBoundary(pt, activePolygon, 0.05)) {
        if (pointsEqual(pt, this.cutStartPoint)) return false;
        if (isPointOnBarrier(pt, activeBarriers, 0.5)) return false;
        return true;
      }
    }
    return false;
  }

  private isDirectSafeExitStep(
    dir: Direction,
    activePolygon: readonly Point[],
    activeBarriers: readonly Barrier[]
  ): boolean {
    const { dx, dy } = DIR_VECTORS[dir];
    const mid = { x: this.x + dx * 1, y: this.y + dy * 1 };
    const nextPos = { x: this.x + dx * GRID_STEP, y: this.y + dy * GRID_STEP };
    if (!pointInPolygonStrict(mid, activePolygon)) return false;
    if (!isPointOnPolygonBoundary(nextPos, activePolygon, 0.05)) return false;
    if (pointsEqual(nextPos, this.cutStartPoint)) return false;
    if (isPointOnBarrier(nextPos, activeBarriers, 0.5)) return false;
    return true;
  }

  private canAdvanceInCutDirection(
    dir: Direction,
    activePolygon: readonly Point[],
    activeBarriers: readonly Barrier[]
  ): boolean {
    const { dx, dy } = DIR_VECTORS[dir];
    const nextPos = {
      x: this.x + dx * GRID_STEP,
      y: this.y + dy * GRID_STEP
    };
    const midPos = {
      x: this.x + dx * 1,
      y: this.y + dy * 1
    };

    if (!pointInPolygonStrict(midPos, activePolygon)) {
      return false;
    }

    // V5 Solid Wall Blocks: the ship stops flush against the wall (no death, cut stays open)
    if (isPointBlockedBySolidBoxes(nextPos, this.solidBoxes)) {
      this.boxContactThisStep = true;
      return false;
    }
    if (this.wouldCollideWithOwnTrail(nextPos, dir)) {
      return false;
    }

    if (isPointOnPolygonBoundary(nextPos, activePolygon, 0.05)) {
      if (pointsEqual(nextPos, this.cutStartPoint)) {
        return false;
      }
      if (isPointOnBarrier(nextPos, activeBarriers, 0.5)) {
        return false;
      }
      return true;
    }

    const ahead4 = {
      x: this.x + dx * MIN_SEGMENT_LEN,
      y: this.y + dy * MIN_SEGMENT_LEN
    };
    if (
      isPointOnPolygonBoundary(ahead4, activePolygon, 0.05) &&
      (isPointOnBarrier(ahead4, activeBarriers, 0.5) || pointsEqual(ahead4, this.cutStartPoint))
    ) {
      return false;
    }

    return true;
  }

  private wouldCollideWithOwnTrail(nextPos: Point, dir: Direction): boolean {
    const corners = this.trailCorners;
    if (corners.length < 2) return false;

    const { dx, dy } = DIR_VECTORS[dir];
    const probeAhead = {
      x: this.x + dx * MIN_SEGMENT_LEN,
      y: this.y + dy * MIN_SEGMENT_LEN
    };

    for (let i = 0; i <= corners.length - 3; i++) {
      const a = corners[i];
      const b = corners[i + 1];
      const dNext = projectPointToSegment(nextPos, a, b).distance;
      const dAhead = projectPointToSegment(probeAhead, a, b).distance;
      if (dNext < GRID_STEP || dAhead < GRID_STEP) {
        return true;
      }
    }
    return false;
  }

  private getValidBorderDirections(pos: Point, poly: readonly Point[]): Direction[] {
    const valid: Direction[] = [];
    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    for (const d of dirs) {
      const { dx, dy } = DIR_VECTORS[d];
      const mid = { x: pos.x + dx * 1, y: pos.y + dy * 1 };
      if (isPointOnPolygonBoundary(mid, poly, 0.05)) {
        valid.push(d);
      }
    }
    return valid;
  }

  private findCornerApproachDirection(
    pos: Point,
    desiredTurn: Direction,
    validBorderDirs: readonly Direction[],
    poly: readonly Point[]
  ): Direction | null {
    for (const walkDir of validBorderDirs) {
      const { dx, dy } = DIR_VECTORS[walkDir];
      for (let dist = GRID_STEP; dist <= CORNER_BUFFER_DIST; dist += GRID_STEP) {
        const checkPt = { x: pos.x + dx * dist, y: pos.y + dy * dist };
        if (!isPointOnPolygonBoundary(checkPt, poly, 0.05)) break;
        const dirsAtCorner = this.getValidBorderDirections(checkPt, poly);
        if (dirsAtCorner.includes(desiredTurn)) {
          return walkDir;
        }
      }
    }
    return null;
  }

  /**
   * Renders:
   * 1. Crisp 90-degree 16-bit Pixel Orange Cutting Line (`#FF7810` + `#FFF0A0` core + `#080810` border)
   * 2. Mobile Clarity Aid: Pulsing Pixel Entry Arrow pointing inward when `KES` is armed on safe border!
   * 3. 2-Frame Circular Pixel Green/Red Forcefield (`getCircularShieldSprite`) matching `01-hedef-oynanis.jpg`
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

    // 1. 16-Bit Pixel Orange Cutting Trail (`01-hedef-oynanis.jpg`!)
    if (this.state === 'CUTTING' && this.trailCorners.length > 0) {
      ctx.save();
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';

      ctx.beginPath();
      ctx.moveTo(Math.round(this.trailCorners[0].x), Math.round(this.trailCorners[0].y));
      for (let i = 1; i < this.trailCorners.length; i++) {
        ctx.lineTo(Math.round(this.trailCorners[i].x), Math.round(this.trailCorners[i].y));
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
      for (const c of this.trailCorners) {
        const cx = Math.round(c.x);
        const cy = Math.round(c.y);
        ctx.fillStyle = PALETTE.PIXEL_BLACK;
        ctx.fillRect(cx - 5, cy - 5, 10, 10);
        ctx.fillStyle = PALETTE.CUT_ORANGE;
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
        ctx.fillStyle = PALETTE.CUT_CORE;
        ctx.fillRect(cx - 2, cy - 2, 4, 4);
      }
      ctx.restore();
    }

    // 2. Mobile Clarity Aid (V5 Inward Direction Hint): a small pixel arrow always shows which
    // direction enters the uncut field; it grows into a pulsing 3-step chevron when `KES` is armed.
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
        ctx.globalAlpha = carveArmed ? 1 : 0.85;
        // Pixel arrow chevron pointing into the uncut territory
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

    // 4. 2-Frame Circular Pixel Green/Red Forcefield (`ON_BORDER` while shield or 3s grace active!)
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
