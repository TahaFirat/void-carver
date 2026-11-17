import { PALETTE } from '../../core/Config';
import {
  arcLengthToPoint,
  getPolygonEdges,
  getTotalPerimeter,
  pointInPolygonStrict,
  pointToArcLength,
  projectPointToPolygon,
  resolvePolygonPenetration
} from '../../geometry/PolygonMath';
import { circleHitsSolidBox } from '../../geometry/SolidBoxes';
import { Point } from '../../geometry/Types';
import {
  getAnchorBarnacleSprite,
  getBorderSparkCrabSprite,
  getChargerHornSprite,
  getCometSeedSprite,
  getCosmicMantaSprite,
  getHomingSeekerSprite,
  getKamikazeSporeSprite,
  getLineLeechSprite,
  getMineLayerDroneSprite,
  getOrbitSatelliteSprite,
  getPhaseGhostSprite,
  getPodTurretSprite,
  getRicochetCrystalSprite,
  getScarabBeetleSprite,
  getShieldSapperSprite,
  getSplitterAmoebaSprite,
  getVortexDrifterSprite,
  getWaspSwarmerSprite
} from '../../rendering/BestiarySprites';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { InteriorMinion, MinionContext } from './BaseMinion';

function computePolylineMidpoint(pts: readonly Point[]): Point {
  if (pts.length === 0) return { x: 450, y: 600 };
  if (pts.length === 1) return pts[0];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  const half = total * 0.5;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (acc + seg >= half && seg > 0.001) {
      const t = (half - acc) / seg;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t
      };
    }
    acc += seg;
  }
  return pts[pts.length - 1];
}

function getInwardOffsetFromBorder(borderPt: Point, activePolygon: readonly Point[], dist = 4): Point {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 0.707, y: 0.707 },
    { x: -0.707, y: 0.707 },
    { x: 0.707, y: -0.707 },
    { x: -0.707, y: -0.707 }
  ];
  for (const d of dirs) {
    const cand = { x: borderPt.x + d.x * dist, y: borderPt.y + d.y * dist };
    if (pointInPolygonStrict(cand, activePolygon)) {
      return cand;
    }
  }
  return resolvePolygonPenetration(borderPt, dist, activePolygon).position;
}

/**
 * #1 ScarabBeetle (Zırhlı Skarabe — r = 12):
 * Diagonal bounce; gently curves toward cutting player when nearby.
 */
export class ScarabBeetleMinion extends InteriorMinion {
  public readonly kind = 'DRONE' as const;
  private readonly baseSpeed: number;

  constructor(pos: Point, speed = 176, angleRad = Math.PI * 0.25) {
    const safeAngle =
      Math.abs(Math.cos(angleRad)) < 0.25 || Math.abs(Math.sin(angleRad)) < 0.25
        ? Math.PI * 0.25
        : angleRad;
    super(pos, Math.cos(safeAngle) * speed, Math.sin(safeAngle) * speed, 12);
    this.speciesId = 'SCARAB_BEETLE';
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    const targetSpd = this.baseSpeed * mctx.speedScale;
    this.currentSpeed = targetSpd;

    const distToPlayer = Math.hypot(mctx.playerPos.x - this.x, mctx.playerPos.y - this.y);
    if (mctx.playerState === 'CUTTING' && distToPlayer < 290) {
      this.isSwarmAggro = true;
      const dx = mctx.playerPos.x - this.x;
      const dy = mctx.playerPos.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.vx += (dx / d) * targetSpd * 1.9 * mctx.dt;
      this.vy += (dy / d) * targetSpd * 1.9 * mctx.dt;
    } else {
      this.isSwarmAggro = false;
      if (Math.abs(this.vx) < targetSpd * 0.25) this.vx = (this.vx >= 0 ? 1 : -1) * targetSpd * 0.5;
      if (Math.abs(this.vy) < targetSpd * 0.25) this.vy = (this.vy >= 0 ? 1 : -1) * targetSpd * 0.5;
    }

    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * targetSpd * (this.isSwarmAggro ? 1.15 : 1.0);
    this.vy = (this.vy / norm) * targetSpd * (this.isSwarmAggro ? 1.15 : 1.0);

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * (this.isSwarmAggro ? 18 : 10)) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getScarabBeetleSprite(frame), pos.x, pos.y, 1.05);
  }
}

/**
 * #2 WaspSwarmer (Sarı Yaban Arısı — r = 11):
 * Flies figure-8 loops while player is on border; dives at 1.65x speed directly at cutting ship!
 */
export class WaspSwarmerMinion extends InteriorMinion {
  public readonly kind = 'SWARMER' as const;
  private readonly baseSpeed: number;
  private loopPhase: number;

  constructor(pos: Point, speed = 196, seed = 0) {
    super(pos, speed, 0, 11);
    this.speciesId = 'WASP_SWARMER';
    this.baseSpeed = speed;
    this.loopPhase = seed * 1.7;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (mctx.playerState === 'CUTTING') {
      this.isSwarmAggro = true;
      const diveSpd = this.baseSpeed * 1.65 * mctx.speedScale;
      this.currentSpeed = diveSpd;
      const dx = mctx.playerPos.x - this.x;
      const dy = mctx.playerPos.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const desVx = (dx / dist) * diveSpd;
      const desVy = (dy / dist) * diveSpd;
      const blend = Math.min(1, mctx.dt * 11);
      this.vx += (desVx - this.vx) * blend;
      this.vy += (desVy - this.vy) * blend;
      const n = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / n) * diveSpd;
      this.vy = (this.vy / n) * diveSpd;
    } else {
      this.isSwarmAggro = false;
      this.loopPhase += mctx.dt * 4.2 * mctx.speedScale;
      const spd = this.baseSpeed * 0.85 * mctx.speedScale;
      this.currentSpeed = spd;
      // Smooth figure-8 velocity derivative: x' = cos(t), y' = cos(2t)
      const fx = Math.cos(this.loopPhase);
      const fy = Math.cos(this.loopPhase * 2);
      const n = Math.hypot(fx, fy) || 1;
      this.vx = (fx / n) * spd;
      this.vy = (fy / n) * spd;
    }

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const wingFrame: 0 | 1 = Math.floor(timeSeconds * 24) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getWaspSwarmerSprite(wingFrame), pos.x, pos.y, 1.08);
  }
}

/**
 * #3 LineLeech (Kızıl Çizgi Sülüğü — r = 11):
 * Never chases the ship — charges straight at the exact midpoint of `activeTrail` to ignite shock!
 */
export class LineLeechMinion extends InteriorMinion {
  public readonly kind = 'HUNTER' as const;
  private readonly baseSpeed: number;
  private wavePhase: number;

  constructor(pos: Point, speed = 172, seed = 0) {
    const ang = (seed * 1.9) % (Math.PI * 2);
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 11);
    this.speciesId = 'LINE_LEECH';
    this.baseSpeed = speed;
    this.wavePhase = seed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.wavePhase += mctx.dt * 6;

    if (mctx.playerState === 'CUTTING' && mctx.activeTrail.length >= 2) {
      this.isSwarmAggro = true;
      const mid = computePolylineMidpoint(mctx.activeTrail);
      const rushSpd = this.baseSpeed * (mctx.aggroSpeedMult ?? 1.48) * mctx.speedScale;
      this.currentSpeed = rushSpd;
      const dx = mid.x - this.x;
      const dy = mid.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.vx = (dx / d) * rushSpd;
      this.vy = (dy / d) * rushSpd;
    } else {
      this.isSwarmAggro = false;
      const spd = this.baseSpeed * mctx.speedScale;
      this.currentSpeed = spd;
      const ang = Math.atan2(this.vy, this.vx) + Math.sin(this.wavePhase) * 2.1 * mctx.dt;
      this.vx = Math.cos(ang) * spd;
      this.vy = Math.sin(ang) * spd;
    }

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame = (Math.floor(timeSeconds * (this.isSwarmAggro ? 18 : 10)) % 4) as 0 | 1 | 2 | 3;
    const angle = Math.atan2(this.vy, this.vx);
    blitArenaPixelSprite(ctx, getLineLeechSprite(frame), pos.x, pos.y, 1.1, angle);
  }
}

/**
 * #4 PodTurret (Yüzen Göz Tareti — r = 13):
 * Drifts slowly for 2.5s, hovers stationary for 1.0s locking onto player, and fires 1 fast plasma needle!
 */
export class PodTurretMinion extends InteriorMinion {
  public readonly kind = 'TURRET' as const;
  private cycleTimer: number;
  private firedInCycle = false;

  constructor(pos: Point, seed = 0) {
    const ang = (seed * 2.3 + 0.6) % (Math.PI * 2);
    super(pos, Math.cos(ang) * 108, Math.sin(ang) * 108, 13);
    this.speciesId = 'POD_TURRET';
    this.cycleTimer = (seed * 0.9) % 3.5;
  }

  public get isLockedOn(): boolean {
    return this.cycleTimer >= 2.5;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.cycleTimer += mctx.dt;

    if (this.cycleTimer < 2.5) {
      this.firedInCycle = false;
      const spd = 108 * mctx.speedScale;
      this.currentSpeed = spd;
      const n = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / n) * spd;
      this.vy = (this.vy / n) * spd;
      this.x += this.vx * mctx.dt;
      this.y += this.vy * mctx.dt;
      this.enforcePolygonBounds(mctx.activePolygon);
    } else {
      // Hover stationary for 1.0s & fire 1 precision plasma needle!
      this.currentSpeed = 0;
      if (!this.firedInCycle && this.cycleTimer >= 3.35) {
        this.firedInCycle = true;
        const dist = Math.hypot(mctx.playerPos.x - this.x, mctx.playerPos.y - this.y);
        if (dist >= 85 && pointInPolygonStrict({ x: this.x, y: this.y }, mctx.activePolygon)) {
          const aim = Math.atan2(mctx.playerPos.y - this.y, mctx.playerPos.x - this.x);
          const needleSpd = 290 * Math.min(1.35, mctx.speedScale);
          mctx.projectiles.spawnEnemyBullet(
            { x: this.x, y: this.y },
            Math.cos(aim) * needleSpd,
            Math.sin(aim) * needleSpd,
            '#FF4878',
            5
          );
        }
      }
      if (this.cycleTimer >= 3.5) {
        this.cycleTimer = 0;
        const nextAng = Math.atan2(this.vy, this.vx) + 0.9;
        this.vx = Math.cos(nextAng) * 108;
        this.vy = Math.sin(nextAng) * 108;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 12) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getPodTurretSprite(this.isLockedOn, frame), pos.x, pos.y, 1.08);
  }
}

/**
 * #5 SplitterAmoeba (Bölünen Yeşil Amip — r = 15 -> 9):
 * Every 8.5s pinches into 2 fast child amoebas within total minion cap!
 */
export class SplitterAmoebaMinion extends InteriorMinion {
  public readonly kind: 'PRISM' | 'SHARD';
  public readonly isChild: boolean;
  private readonly baseSpeed: number;
  private splitTimer: number;

  constructor(pos: Point, isChild = false, speed = 136, seed = 0) {
    const ang = (seed * 2.1 + 0.4) % (Math.PI * 2);
    const spd = isChild ? speed * 1.52 : speed;
    super(pos, Math.cos(ang) * spd, Math.sin(ang) * spd, isChild ? 9 : 15);
    this.speciesId = 'SPLITTER_AMOEBA';
    this.isChild = isChild;
    this.kind = isChild ? 'SHARD' : 'PRISM';
    this.baseSpeed = spd;
    this.splitTimer = 8.5;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (!this.applySwarmAggro(mctx, this.baseSpeed)) {
      const spd = this.baseSpeed * mctx.speedScale;
      this.currentSpeed = spd;
      const n = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / n) * spd;
      this.vy = (this.vy / n) * spd;
    }

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);

    if (!this.isChild) {
      this.splitTimer -= mctx.dt;
      if (this.splitTimer <= 0) {
        this.splitTimer = 8.5;
        if (mctx.currentMinionCount < 9) {
          this.alive = false;
          const c1 = new SplitterAmoebaMinion({ x: this.x - 10, y: this.y - 6 }, true, 136, 1);
          const c2 = new SplitterAmoebaMinion({ x: this.x + 10, y: this.y + 6 }, true, 136, 3);
          c1.enforcePolygonBounds(mctx.activePolygon);
          c2.enforcePolygonBounds(mctx.activePolygon);
          mctx.spawnChildMinion(c1);
          mctx.spawnChildMinion(c2);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const fast = !this.isChild && this.splitTimer < 1.8 ? 16 : 6;
    const frame: 0 | 1 = Math.floor(timeSeconds * fast) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getSplitterAmoebaSprite(this.isChild, frame), pos.x, pos.y, 1.08);
  }
}

/**
 * #6 BorderSparkCrab (Dikenli Kenar Yengeci — r = 12):
 * Patrols interior until wave timer hits `crawlerDelaySec` (`ORTA: 38s`, `ZOR: 22s`), then latches
 * onto the green border and hunts the player along the perimeter — piercing even 999 shield!
 */
export class BorderSparkCrabMinion extends InteriorMinion {
  public readonly kind = 'SPARK_CRAB' as const;
  private arcS = 0;
  private latchedInitialized = false;
  private readonly baseSpeed: number;

  constructor(pos: Point, speed = 152, seed = 0) {
    const ang = (seed * 1.6 + 0.7) % (Math.PI * 2);
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 12);
    this.speciesId = 'BORDER_SPARK_CRAB';
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    const elapsed = mctx.waveElapsedSec ?? 0;
    const delay = mctx.crawlerDelaySec ?? 38;

    if (elapsed < delay && !this.isBorderSparkActive) {
      // Skitter inside open arena until perimeter spark phase unlocks
      const spd = this.baseSpeed * mctx.speedScale;
      this.currentSpeed = spd;
      const n = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / n) * spd;
      this.vy = (this.vy / n) * spd;
      this.x += this.vx * mctx.dt;
      this.y += this.vy * mctx.dt;
      this.enforcePolygonBounds(mctx.activePolygon);
      return;
    }

    if (!this.latchedInitialized) {
      const proj = projectPointToPolygon({ x: this.x, y: this.y }, mctx.activePolygon);
      if (proj.distance > 14) {
        // Rush toward nearest safe border wall to latch!
        const rushSpd = this.baseSpeed * 1.45 * mctx.speedScale;
        const dx = proj.point.x - this.x;
        const dy = proj.point.y - this.y;
        const d = Math.hypot(dx, dy) || 1;
        // Keep safe distance from player on initial latch so it never telefrags!
        if (Math.hypot(proj.point.x - mctx.playerPos.x, proj.point.y - mctx.playerPos.y) < 110) {
          this.vx = -(dx / d) * rushSpd;
          this.vy = -(dy / d) * rushSpd;
        } else {
          this.vx = (dx / d) * rushSpd;
          this.vy = (dy / d) * rushSpd;
        }
        this.x += this.vx * mctx.dt;
        this.y += this.vy * mctx.dt;
        this.enforcePolygonBounds(mctx.activePolygon);
        return;
      }
      this.arcS = pointToArcLength(proj.point, mctx.activePolygon) ?? 0;
      this.latchedInitialized = true;
      this.isBorderSparkActive = true;
    }

    const edges = getPolygonEdges(mctx.activePolygon);
    const total = getTotalPerimeter(edges);
    if (total <= 0) return;

    // Re-project onto current polygon so cuts smoothly update arcS
    const curProj = projectPointToPolygon({ x: this.x, y: this.y }, mctx.activePolygon);
    this.arcS = pointToArcLength(curProj.point, mctx.activePolygon) ?? this.arcS;

    const playerProj = projectPointToPolygon(mctx.playerPos, mctx.activePolygon);
    const targetS = pointToArcLength(playerProj.point, mctx.activePolygon) ?? 0;
    const cwDist = ((targetS - this.arcS) % total + total) % total;
    const ccwDist = total - cwDist;
    const dirSign = cwDist <= ccwDist ? 1 : -1;

    const crawlSpd = 142 * mctx.speedScale;
    this.currentSpeed = crawlSpd;
    this.arcS = ((this.arcS + dirSign * crawlSpd * mctx.dt) % total + total) % total;
    const borderPt = arcLengthToPoint(this.arcS, mctx.activePolygon);
    const inwardPt = getInwardOffsetFromBorder(borderPt, mctx.activePolygon, 3.5);
    this.x = inwardPt.x;
    this.y = inwardPt.y;
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * (this.isBorderSparkActive ? 18 : 9)) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(
      ctx,
      getBorderSparkCrabSprite(frame, this.isBorderSparkActive),
      pos.x,
      pos.y,
      1.08
    );
  }
}

/**
 * #7 ShieldSapper (Kalkan Emici Elektrik Paraziti — r = 12):
 * Flies to nearest green border wall, latches on, streams blue lightning & drains KALKAN 3x faster!
 */
export class ShieldSapperMinion extends InteriorMinion {
  public readonly kind = 'SHIELD_SAPPER' as const;
  private latchedBorderPt: Point | null = null;
  private readonly baseSpeed: number;

  constructor(pos: Point, speed = 168) {
    super(pos, speed, 0, 12);
    this.speciesId = 'SHIELD_SAPPER';
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    const proj = projectPointToPolygon({ x: this.x, y: this.y }, mctx.activePolygon);
    // Avoid latching right on top of the player ship
    const distFromPlayer = Math.hypot(proj.point.x - mctx.playerPos.x, proj.point.y - mctx.playerPos.y);

    if (proj.distance <= 16 && distFromPlayer > 54) {
      this.isLatchedToBorder = true;
      this.latchedBorderPt = proj.point;
      const anchor = getInwardOffsetFromBorder(proj.point, mctx.activePolygon, 4.5);
      this.x = anchor.x;
      this.y = anchor.y;
      this.vx = 0;
      this.vy = 0;
      this.currentSpeed = 0;
      return;
    }

    this.isLatchedToBorder = false;
    this.latchedBorderPt = null;
    const spd = this.baseSpeed * mctx.speedScale;
    this.currentSpeed = spd;

    const targetX = distFromPlayer <= 54 ? 450 : proj.point.x;
    const targetY = distFromPlayer <= 54 ? 600 : proj.point.y;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const d = Math.hypot(dx, dy) || 1;
    this.vx = (dx / d) * spd;
    this.vy = (dy / d) * spd;
    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 16) % 2 === 0 ? 0 : 1;

    if (this.isLatchedToBorder && this.latchedBorderPt) {
      ctx.save();
      ctx.strokeStyle = frame === 0 ? '#58F8FF' : '#FFFFFF';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(Math.round(pos.x), Math.round(pos.y));
      ctx.lineTo(Math.round(this.latchedBorderPt.x), Math.round(this.latchedBorderPt.y));
      ctx.stroke();
      ctx.restore();
    }

    const angle =
      this.isLatchedToBorder && this.latchedBorderPt
        ? Math.atan2(this.latchedBorderPt.y - pos.y, this.latchedBorderPt.x - pos.x)
        : Math.atan2(this.vy, this.vx);
    blitArenaPixelSprite(
      ctx,
      getShieldSapperSprite(this.isLatchedToBorder, frame),
      pos.x,
      pos.y,
      1.08,
      angle
    );
  }
}

/**
 * #8 MineLayerDrone (Mayın Döşeyici Dron — r = 13):
 * Drops a 5.5s blinking spiked red proximity mine every 4.5s!
 */
export class MineLayerDroneMinion extends InteriorMinion {
  public readonly kind = 'MINE_DRONE' as const;
  private readonly baseSpeed: number;
  private dropTimer: number;

  constructor(pos: Point, speed = 148, seed = 0) {
    const ang = (seed * 1.3 + 0.8) % (Math.PI * 2);
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 13);
    this.speciesId = 'MINE_LAYER_DRONE';
    this.baseSpeed = speed;
    this.dropTimer = 2.8 + (seed % 3) * 0.6;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    const spd = this.baseSpeed * mctx.speedScale;
    this.currentSpeed = spd;
    if (Math.abs(this.vx) < spd * 0.2) this.vx = (this.vx >= 0 ? 1 : -1) * spd * 0.45;
    if (Math.abs(this.vy) < spd * 0.2) this.vy = (this.vy >= 0 ? 1 : -1) * spd * 0.45;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);

    this.dropTimer -= mctx.dt;
    if (this.dropTimer <= 0) {
      this.dropTimer = 4.5;
      const distPlayer = Math.hypot(mctx.playerPos.x - this.x, mctx.playerPos.y - this.y);
      if (distPlayer >= 72 && pointInPolygonStrict({ x: this.x, y: this.y }, mctx.activePolygon)) {
        mctx.hazards?.spawnSpaceMine({ x: this.x, y: this.y }, 5.5, 13);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 8) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getMineLayerDroneSprite(frame), pos.x, pos.y, 1.08);
  }
}

/**
 * #9 ChargerHorn (Boynuzlu Gergedan Böceği — r = 14):
 * Walks slowly; when aligned on X or Y (`< 18px`) with player, telegraphs horn for 0.30s and Bull Charges at 2.6x!
 */
export class ChargerHornMinion extends InteriorMinion {
  public readonly kind = 'CHARGER' as const;
  private readonly walkSpeed = 92;
  private readonly chargeBaseSpeed = 160;
  private telegraphTimer = 0;
  private charging = false;
  private chargeDirX = 0;
  private chargeDirY = 0;
  private cooldownTimer = 0.8;

  constructor(pos: Point, seed = 0) {
    const ang = (seed * 1.7 + 0.5) % (Math.PI * 2);
    super(pos, Math.cos(ang) * 92, Math.sin(ang) * 92, 14);
    this.speciesId = 'CHARGER_HORN';
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - mctx.dt);
    }

    if (this.telegraphTimer > 0) {
      this.telegraphTimer = Math.max(0, this.telegraphTimer - mctx.dt);
      this.currentSpeed = 0;
      if (this.telegraphTimer <= 0) {
        this.charging = true;
      }
      return;
    }

    if (this.charging) {
      const rocketSpd = this.chargeBaseSpeed * 2.6 * mctx.speedScale;
      this.currentSpeed = rocketSpd;
      this.vx = this.chargeDirX * rocketSpd;
      this.vy = this.chargeDirY * rocketSpd;
      this.x += this.vx * mctx.dt;
      this.y += this.vy * mctx.dt;

      const solved = resolvePolygonPenetration({ x: this.x, y: this.y }, this.radius, mctx.activePolygon);
      this.x = solved.position.x;
      this.y = solved.position.y;
      const hitBox =
        mctx.solidBoxes && circleHitsSolidBox(this.x, this.y, this.radius + 1, mctx.solidBoxes);
      if (solved.collidedNormal || hitBox) {
        this.charging = false;
        this.cooldownTimer = 1.4;
        const bounceAng = Math.atan2(-this.chargeDirY, -this.chargeDirX) + 0.55;
        this.vx = Math.cos(bounceAng) * this.walkSpeed;
        this.vy = Math.sin(bounceAng) * this.walkSpeed;
      }
      return;
    }

    // Check cardinal corridor alignment (`|dx| < 18` or `|dy| < 18`)
    const dx = mctx.playerPos.x - this.x;
    const dy = mctx.playerPos.y - this.y;
    if (this.cooldownTimer <= 0 && Math.hypot(dx, dy) > 48) {
      if (Math.abs(dy) < 18) {
        this.chargeDirX = dx >= 0 ? 1 : -1;
        this.chargeDirY = 0;
        this.telegraphTimer = 0.3;
        return;
      }
      if (Math.abs(dx) < 18) {
        this.chargeDirX = 0;
        this.chargeDirY = dy >= 0 ? 1 : -1;
        this.telegraphTimer = 0.3;
        return;
      }
    }

    const spd = this.walkSpeed * mctx.speedScale;
    this.currentSpeed = spd;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * (this.charging ? 22 : 8)) % 2 === 0 ? 0 : 1;
    const angle =
      this.telegraphTimer > 0 || this.charging
        ? Math.atan2(this.chargeDirY, this.chargeDirX)
        : Math.atan2(this.vy, this.vx);

    if (this.telegraphTimer > 0) {
      ctx.save();
      ctx.strokeStyle = frame === 0 ? '#FFF898' : PALETTE.DANGER_RED;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + this.chargeDirX * 220, pos.y + this.chargeDirY * 220);
      ctx.stroke();
      ctx.restore();
    }

    blitArenaPixelSprite(
      ctx,
      getChargerHornSprite(this.telegraphTimer > 0 || this.charging, frame),
      pos.x,
      pos.y,
      1.08,
      angle
    );
  }
}

/**
 * #10 PhaseGhost (Hayalet Plazma — r = 12):
 * `ignoresSolidBoxes = true` — glides straight through `PowerUpBox` walls to stalk hidden players!
 */
export class PhaseGhostMinion extends InteriorMinion {
  public readonly kind = 'GHOST' as const;
  private readonly baseSpeed: number;
  private floatPhase: number;

  constructor(pos: Point, speed = 154, seed = 0) {
    super(pos, speed, 0, 12);
    this.speciesId = 'PHASE_GHOST';
    this.ignoresSolidBoxes = true;
    this.baseSpeed = speed;
    this.floatPhase = seed * 1.4;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.floatPhase += mctx.dt * 3.6;

    const cutting = mctx.playerState === 'CUTTING';
    this.isSwarmAggro = cutting;
    const spd = this.baseSpeed * (cutting ? 1.32 : 0.92) * mctx.speedScale;
    this.currentSpeed = spd;

    const dx = mctx.playerPos.x - this.x;
    const dy = mctx.playerPos.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const weaveX = -dy / d;
    const weaveY = dx / d;
    const sway = Math.sin(this.floatPhase) * (cutting ? 0.22 : 0.65);

    const vxRaw = dx / d + weaveX * sway;
    const vyRaw = dy / d + weaveY * sway;
    const n = Math.hypot(vxRaw, vyRaw) || 1;
    this.vx = (vxRaw / n) * spd;
    this.vy = (vyRaw / n) * spd;

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 7) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getPhaseGhostSprite(frame), pos.x, pos.y, 1.08);
  }
}

/**
 * #11 OrbitSatellite (Lazer Koruma Uydusu — r = 11):
 * Orbits directly around the primary Boss at 75px–110px radius!
 */
export class OrbitSatelliteMinion extends InteriorMinion {
  public readonly kind = 'SATELLITE' as const;
  private orbitAngle: number;
  private readonly orbitRadius: number;

  constructor(pos: Point, index = 0) {
    super(pos, 0, 0, 11);
    this.speciesId = 'ORBIT_SATELLITE';
    this.orbitAngle = index * ((Math.PI * 2) / 3);
    this.orbitRadius = 82 + (index % 3) * 12;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (mctx.bossCenter) {
      const angVel = (mctx.playerState === 'CUTTING' ? 2.85 : 2.15) * mctx.speedScale;
      this.orbitAngle += angVel * mctx.dt;
      const desiredX = mctx.bossCenter.x + Math.cos(this.orbitAngle) * this.orbitRadius;
      const desiredY = mctx.bossCenter.y + Math.sin(this.orbitAngle) * this.orbitRadius;
      const solved = resolvePolygonPenetration({ x: desiredX, y: desiredY }, this.radius, mctx.activePolygon);
      this.vx = (solved.position.x - this.x) / Math.max(0.001, mctx.dt);
      this.vy = (solved.position.y - this.y) / Math.max(0.001, mctx.dt);
      this.x = solved.position.x;
      this.y = solved.position.y;
      this.currentSpeed = Math.hypot(this.vx, this.vy);
    } else {
      const spd = 165 * mctx.speedScale;
      this.x += spd * mctx.dt;
      this.enforcePolygonBounds(mctx.activePolygon);
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 8) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getOrbitSatelliteSprite(frame), pos.x, pos.y, 1.08, this.orbitAngle);
  }
}

/**
 * #12 HomingSeeker (Güdümlü Biyo-Füze — r = 10):
 * Smooth `turnRate = 2.4 rad/s` homing; explodes on wall/box impact & respawns near Boss 5.0s later!
 */
export class HomingSeekerMinion extends InteriorMinion {
  public readonly kind = 'MISSILE' as const;
  private readonly baseSpeed: number;
  private armGraceTimer = 0.45;

  constructor(pos: Point, speed = 198, initialAngle = -Math.PI * 0.5) {
    super(pos, Math.cos(initialAngle) * speed, Math.sin(initialAngle) * speed, 10);
    this.speciesId = 'HOMING_SEEKER';
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    if (this.armGraceTimer > 0) {
      this.armGraceTimer = Math.max(0, this.armGraceTimer - mctx.dt);
    }

    const spd = this.baseSpeed * (mctx.playerState === 'CUTTING' ? 1.22 : 1.0) * mctx.speedScale;
    this.currentSpeed = spd;
    const curAng = Math.atan2(this.vy, this.vx);
    const desAng = Math.atan2(mctx.playerPos.y - this.y, mctx.playerPos.x - this.x);
    let diff = desAng - curAng;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxStep = 2.4 * mctx.dt;
    const nextAng = curAng + Math.max(-maxStep, Math.min(maxStep, diff));

    this.vx = Math.cos(nextAng) * spd;
    this.vy = Math.sin(nextAng) * spd;
    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;

    const hitSolidBox =
      this.armGraceTimer <= 0 &&
      mctx.solidBoxes &&
      circleHitsSolidBox(this.x, this.y, this.radius, mctx.solidBoxes);
    const outsideWall = !pointInPolygonStrict({ x: this.x, y: this.y }, mctx.activePolygon);

    if ((outsideWall && this.armGraceTimer <= 0) || hitSolidBox) {
      this.alive = false;
      this.explodedOnWall = true;
      mctx.hazards?.queueSeekerRespawn(5.0);
      return;
    }

    if (outsideWall) {
      this.enforcePolygonBounds(mctx.activePolygon);
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 20) % 2 === 0 ? 0 : 1;
    const angle = Math.atan2(this.vy, this.vx);
    blitArenaPixelSprite(ctx, getHomingSeekerSprite(frame), pos.x, pos.y, 1.08, angle);
  }
}

/**
 * #13 AnchorBarnacle (Taşlaşan Kaya Midyesi — r = 14):
 * Drifts for 4.0s, then clamps shut for 4.5s into an impassable solid stone wall block!
 */
export class AnchorBarnacleMinion extends InteriorMinion {
  public readonly kind = 'BARNACLE' as const;
  private cycleTimer: number;
  private readonly driftSpeed = 128;

  constructor(pos: Point, seed = 0) {
    const ang = (seed * 2.05 + 0.4) % (Math.PI * 2);
    super(pos, Math.cos(ang) * 128, Math.sin(ang) * 128, 14);
    this.speciesId = 'ANCHOR_BARNACLE';
    this.cycleTimer = (seed * 1.3) % 4.0;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.cycleTimer += mctx.dt;

    if (this.cycleTimer < 4.0) {
      this.isPetrifiedObstacle = false;
      const spd = this.driftSpeed * mctx.speedScale;
      this.currentSpeed = spd;
      const n = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / n) * spd;
      this.vy = (this.vy / n) * spd;
      this.x += this.vx * mctx.dt;
      this.y += this.vy * mctx.dt;
      this.enforcePolygonBounds(mctx.activePolygon);
    } else if (this.cycleTimer < 8.5) {
      // Never petrify directly on top of player or border edge so we never wedge player unfairly
      const distPlayer = Math.hypot(mctx.playerPos.x - this.x, mctx.playerPos.y - this.y);
      const borderDist = projectPointToPolygon({ x: this.x, y: this.y }, mctx.activePolygon).distance;
      if (!this.isPetrifiedObstacle && (distPlayer < 48 || borderDist < 28)) {
        this.cycleTimer = 3.2;
        return;
      }
      this.isPetrifiedObstacle = true;
      this.currentSpeed = 0;
    } else {
      this.isPetrifiedObstacle = false;
      this.cycleTimer = 0;
      const nextAng = Math.atan2(this.vy, this.vx) + 1.1;
      this.vx = Math.cos(nextAng) * this.driftSpeed;
      this.vy = Math.sin(nextAng) * this.driftSpeed;
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 6) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(
      ctx,
      getAnchorBarnacleSprite(this.isPetrifiedObstacle, frame),
      pos.x,
      pos.y,
      1.08
    );
  }
}

/**
 * #14 KamikazeSpore (Kovan Sporu — r = 8):
 * Fast zig-zagging volatile spore cluster (`HiveCarrier` & swarm encounters)!
 */
export class KamikazeSporeMinion extends InteriorMinion {
  public readonly kind = 'SPORE' as const;
  private readonly baseSpeed: number;
  private zigTimer: number;

  constructor(pos: Point, speed = 216, seed = 0) {
    const ang = (seed * 2.4 + Math.random() * 1.5) % (Math.PI * 2);
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 8);
    this.speciesId = 'KAMIKAZE_SPORE';
    this.baseSpeed = speed;
    this.zigTimer = 0.45 + (seed % 3) * 0.18;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (!this.applySwarmAggro(mctx, this.baseSpeed)) {
      const spd = this.baseSpeed * mctx.speedScale;
      this.currentSpeed = spd;
      this.zigTimer -= mctx.dt;
      if (this.zigTimer <= 0) {
        this.zigTimer = 0.52;
        const nextAng = Math.atan2(this.vy, this.vx) + (Math.floor(this.x + this.y) % 2 === 0 ? 0.85 : -0.85);
        this.vx = Math.cos(nextAng) * spd;
        this.vy = Math.sin(nextAng) * spd;
      } else {
        const n = Math.hypot(this.vx, this.vy) || 1;
        this.vx = (this.vx / n) * spd;
        this.vy = (this.vy / n) * spd;
      }
    }

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 16) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getKamikazeSporeSprite(frame), pos.x, pos.y, 1.05);
  }
}

// ============================================================================
// BUILD 12 EXPANSION: 4 NEW SMOOTH AUTONOMOUS MINIONS (TOTAL 18 SPECIES!)
// ============================================================================

/**
 * #15 CosmicManta (Kozmik Vatoz — r = 12):
 * Graceful sapphire-cyan space manta gliding in figure-8 Lissajous curves without chasing the player!
 */
export class CosmicMantaMinion extends InteriorMinion {
  public readonly kind = 'MANTA' as const;
  private glidePhase: number;
  private readonly baseSpeed: number;

  constructor(pos: Point, speed = 134, seed = 0) {
    const ang = (seed * 1.9 + 0.5) % (Math.PI * 2);
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 12);
    this.speciesId = 'COSMIC_MANTA';
    this.baseSpeed = speed;
    this.glidePhase = seed * 1.2;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.glidePhase += mctx.dt * 2.6;
    const spd = this.baseSpeed * mctx.speedScale;
    this.currentSpeed = spd;
    const heading = Math.atan2(this.vy, this.vx) + Math.sin(this.glidePhase) * 1.45 * mctx.dt;
    this.vx = Math.cos(heading) * spd;
    this.vy = Math.sin(heading) * spd;
    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 8) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(
      ctx,
      getCosmicMantaSprite(frame),
      pos.x,
      pos.y,
      1.1,
      Math.atan2(this.vy, this.vx)
    );
  }
}

/**
 * #16 RicochetCrystal (Seken Kristal Küp — r = 11):
 * Faceted prism crystal bouncing cleanly at crisp diagonal angles!
 */
export class RicochetCrystalMinion extends InteriorMinion {
  public readonly kind = 'CRYSTAL' as const;
  private readonly baseSpeed: number;
  private spinAngle = 0;

  constructor(pos: Point, speed = 148, seed = 0) {
    const ang = Math.PI * 0.25 + (seed % 4) * (Math.PI * 0.5);
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 11);
    this.speciesId = 'RICOCHET_CRYSTAL';
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.spinAngle += mctx.dt * 2.4;
    const spd = this.baseSpeed * mctx.speedScale;
    this.currentSpeed = spd;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 7) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getRicochetCrystalSprite(frame), pos.x, pos.y, 1.08, this.spinAngle * 0.35);
  }
}

/**
 * #17 VortexDrifter (Çekim Girdabı — r = 12):
 * Calm swirling nebula disc; trapping & crushing it inside a completed cut awards +5s extra Shield!
 */
export class VortexDrifterMinion extends InteriorMinion {
  public readonly kind = 'VORTEX' as const;
  private swirlAngle = 0;
  private readonly baseSpeed: number;

  constructor(pos: Point, speed = 115, seed = 0) {
    const ang = (seed * 2.3 + 0.8) % (Math.PI * 2);
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 12);
    this.speciesId = 'VORTEX_DRIFTER';
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.swirlAngle += mctx.dt * 3.6;
    const spd = this.baseSpeed * mctx.speedScale;
    this.currentSpeed = spd;
    const heading = Math.atan2(this.vy, this.vx) + Math.cos(this.swirlAngle * 0.5) * 0.9 * mctx.dt;
    this.vx = Math.cos(heading) * spd;
    this.vy = Math.sin(heading) * spd;
    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 9) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(ctx, getVortexDrifterSprite(frame), pos.x, pos.y, 1.1, this.swirlAngle);
  }
}

/**
 * #18 CometSeed (Kuyruklu Yıldız Tohumu — r = 10):
 * Fast straight-line star core leaving a clear directional spark tail!
 */
export class CometSeedMinion extends InteriorMinion {
  public readonly kind = 'COMET' as const;
  private readonly baseSpeed: number;

  constructor(pos: Point, speed = 156, seed = 0) {
    const ang = (seed * 1.65 + 0.4) % (Math.PI * 2);
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 10);
    this.speciesId = 'COMET_SEED';
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;
    const spd = this.baseSpeed * mctx.speedScale;
    this.currentSpeed = spd;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 16) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(
      ctx,
      getCometSeedSprite(frame),
      pos.x,
      pos.y,
      1.08,
      Math.atan2(this.vy, this.vx)
    );
  }
}
