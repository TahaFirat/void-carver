import { ENRAGE_CLAIM_PERCENT } from '../../core/Config';
import {
  computeArea,
  pointInPolygonStrict,
  projectPointToSegment,
  resolvePolygonPenetration
} from '../../geometry/PolygonMath';
import { Point } from '../../geometry/Types';
import { InteriorMinion } from '../enemies/BaseMinion';
import { ProjectileManager } from '../Projectiles';

export type BossArchetype =
  | 'CENTIPEDE'
  | 'LOBSTER_MECHA'
  | 'BIO_WHEEL'
  | 'MANTIS'
  | 'CRUISER_CORE'
  | 'TWIN_SPLIT'
  | 'MORPHING_CELL'
  | 'CYBER_SKULL'
  | 'OPTIC_NERVE'
  | 'ALIEN_BRAIN'
  | 'TITAN_CORE'
  | 'TWIN_NEXUS';

export interface BossUpdateContext {
  dt: number;
  timeSeconds: number;
  activePolygon: readonly Point[];
  claimedPercent: number;
  playerPos: Point;
  playerState: 'ON_BORDER' | 'CUTTING';
  activeTrail: readonly Point[];
  speedScale: number;
  projectiles: ProjectileManager;
  summonMinion: (minion: InteriorMinion) => void;
  currentMinionCount: number;
}

export interface HitCircle {
  x: number;
  y: number;
  radius: number;
}

export abstract class BaseBoss {
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public vx: number;
  public vy: number;
  public readonly baseRadius: number;
  public boundingRadius: number;
  public renderScale = 1.0;
  public readonly maxHp: number;
  public hp: number;
  public enraged = false;
  public hitFlash = 0;
  public alive = true;
  public crushedInPocket = false;
  /** V5 double-boss stages: escorts never decide the stage outcome. */
  public isEscort = false;
  public abstract readonly archetype: BossArchetype;
  public abstract readonly displayName: string;

  // Smooth 3-frame anti-stuck slide target when polygon shrinks close to hull
  private antiStuckTarget: Point | null = null;
  private antiStuckFramesLeft = 0;
  private pocketCrushTimer = 0;

  constructor(spawn: Point, boundingRadius: number, maxHp = 6, initVx = 160, initVy = 140) {
    this.x = spawn.x;
    this.y = spawn.y;
    this.prevX = spawn.x;
    this.prevY = spawn.y;
    this.vx = initVx;
    this.vy = initVy;
    this.baseRadius = boundingRadius;
    this.boundingRadius = boundingRadius;
    this.maxHp = maxHp;
    this.hp = maxHp;
  }

  public get position(): Point {
    return { x: this.x, y: this.y };
  }

  public getRenderPos(alpha: number): Point {
    return {
      x: this.prevX + (this.x - this.prevX) * alpha,
      y: this.prevY + (this.y - this.prevY) * alpha
    };
  }

  public takeCannonHit(): boolean {
    if (!this.alive) return false;
    this.hp = Math.max(0, this.hp - 1);
    this.hitFlash = 0.09;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  public onPolygonShrunk(activePolygon: readonly Point[]): void {
    this.updateCorridorScale(activePolygon, 1.0);

    const solved = resolvePolygonPenetration(
      { x: this.x, y: this.y },
      this.boundingRadius,
      activePolygon
    );

    if (!pointInPolygonStrict({ x: this.x, y: this.y }, activePolygon)) {
      this.x = solved.position.x;
      this.y = solved.position.y;
      this.prevX = this.x;
      this.prevY = this.y;
      return;
    }

    const dist = Math.hypot(solved.position.x - this.x, solved.position.y - this.y);
    if (dist > 0.5) {
      this.antiStuckTarget = solved.position;
      this.antiStuckFramesLeft = 3;
    }
  }

  public getHitCircles(): HitCircle[] {
    return [{ x: this.x, y: this.y, radius: this.boundingRadius * 0.88 }];
  }

  /**
   * Dynamic Narrow-Corridor Shrinking (down to `0.62x`) so large pixel bosses
   * glide smoothly through tight carved corridors without jittering, plus `1.8s`
   * Pocket Crush detection when trapped in a micro-pocket!
   */
  private updateCorridorScale(activePolygon: readonly Point[], blend: number): number {
    const n = activePolygon.length;
    if (n < 3) return Infinity;

    let minDist = Infinity;
    let secondMinOppositeDist = Infinity;
    let minNormalX = 0;
    let minNormalY = 0;

    for (let i = 0; i < n; i++) {
      const a = activePolygon[i];
      const b = activePolygon[(i + 1) % n];
      const res = projectPointToSegment({ x: this.x, y: this.y }, a, b);
      if (res.distance < minDist) {
        minDist = res.distance;
        const dx = this.x - res.point.x;
        const dy = this.y - res.point.y;
        const len = Math.hypot(dx, dy) || 1;
        minNormalX = dx / len;
        minNormalY = dy / len;
      }
    }

    for (let i = 0; i < n; i++) {
      const a = activePolygon[i];
      const b = activePolygon[(i + 1) % n];
      const res = projectPointToSegment({ x: this.x, y: this.y }, a, b);
      const dx = this.x - res.point.x;
      const dy = this.y - res.point.y;
      const len = Math.hypot(dx, dy) || 1;
      const dot = (dx / len) * minNormalX + (dy / len) * minNormalY;
      // Opposing wall has normal pointing roughly opposite (`dot < -0.35`)
      if (dot < -0.35 && res.distance < secondMinOppositeDist) {
        secondMinOppositeDist = res.distance;
      }
    }

    const corridorWidth =
      secondMinOppositeDist < Infinity ? minDist + secondMinOppositeDist : Infinity;
    let targetScale = 1.0;
    if (corridorWidth < this.baseRadius * 2.3) {
      targetScale = Math.max(0.62, Math.min(1.0, corridorWidth / (this.baseRadius * 2.3)));
    }

    this.renderScale += (targetScale - this.renderScale) * blend;
    this.boundingRadius = this.baseRadius * this.renderScale;
    return corridorWidth;
  }

  public update(bctx: BossUpdateContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    this.enraged = bctx.claimedPercent >= ENRAGE_CLAIM_PERCENT;
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - bctx.dt);
    }

    const corridorWidth = this.updateCorridorScale(
      bctx.activePolygon,
      Math.min(1, bctx.dt * 10)
    );

    if (this.antiStuckTarget && this.antiStuckFramesLeft > 0) {
      const t = 1 / this.antiStuckFramesLeft;
      const nx = this.x + (this.antiStuckTarget.x - this.x) * t;
      const ny = this.y + (this.antiStuckTarget.y - this.y) * t;
      if (pointInPolygonStrict({ x: nx, y: ny }, bctx.activePolygon)) {
        this.x = nx;
        this.y = ny;
      }
      this.antiStuckFramesLeft--;
      if (this.antiStuckFramesLeft <= 0) {
        this.antiStuckTarget = null;
      }
    }

    const effectiveSpeedScale = bctx.speedScale * (this.enraged ? 1.12 : 1.0);
    this.updateBehavior(bctx, effectiveSpeedScale);
    this.enforceWallBounce(bctx.activePolygon);

    // 1.8s Pocket Crush check (only when time is NOT frozen and boss is wedged in a tiny pocket!)
    if (bctx.speedScale > 0.05) {
      const moved = Math.hypot(this.x - this.prevX, this.y - this.prevY);
      const polyArea = computeArea(bctx.activePolygon);
      const pocketAreaThreshold = Math.PI * this.baseRadius * this.baseRadius * 2.6;
      const wedgedTight =
        (corridorWidth < this.baseRadius * 1.32 && moved < 1.5) ||
        (polyArea < pocketAreaThreshold && moved < 2.2);

      if (wedgedTight) {
        this.pocketCrushTimer += bctx.dt;
        if (this.pocketCrushTimer >= 1.8) {
          this.crushedInPocket = true;
          this.alive = false;
        }
      } else {
        this.pocketCrushTimer = Math.max(0, this.pocketCrushTimer - bctx.dt * 2);
      }
    }
  }

  protected enforceWallBounce(activePolygon: readonly Point[]): void {
    const solved = resolvePolygonPenetration(
      { x: this.x, y: this.y },
      this.boundingRadius,
      activePolygon
    );
    this.x = solved.position.x;
    this.y = solved.position.y;

    if (solved.collidedNormal) {
      const nx = solved.collidedNormal.x;
      const ny = solved.collidedNormal.y;
      const dot = this.vx * nx + this.vy * ny;
      if (dot < 0) {
        this.vx -= 2 * dot * nx;
        this.vy -= 2 * dot * ny;
      }
    }
  }

  protected renderHitPixelFlash(ctx: CanvasRenderingContext2D, px: number, py: number, radius: number): void {
    if (this.hitFlash <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#FFF8B8';
    const r = Math.round(radius);
    ctx.fillRect(Math.round(px - r * 0.75), Math.round(py - r * 0.75), Math.round(r * 1.5), Math.round(r * 1.5));
    ctx.restore();
  }

  /**
   * Crisp 16-Bit Pixel Segmented Boss Energy Bar right above Boss when damaged or `★` Super Shot armed.
   */
  protected renderHealthBar(
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    forceVisible = false
  ): void {
    if (this.hp >= this.maxHp && !forceVisible) return;
    const barW = 66;
    const barH = 9;
    const bx = Math.round(rx - barW * 0.5);
    const by = Math.round(ry - this.boundingRadius - 18);

    ctx.save();
    ctx.fillStyle = '#080810';
    ctx.fillRect(bx - 3, by - 3, barW + 6, barH + 6);
    ctx.strokeStyle = '#E8F0FC';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);

    const segGap = 2;
    const segW = (barW - segGap * (this.maxHp - 1)) / this.maxHp;
    const ratio = this.hp / this.maxHp;
    const fillCol = ratio > 0.5 ? '#28E038' : ratio > 0.25 ? '#FFD030' : '#FF3020';
    ctx.fillStyle = fillCol;
    for (let i = 0; i < this.hp; i++) {
      ctx.fillRect(Math.round(bx + i * (segW + segGap)), by, Math.max(1, Math.round(segW)), barH);
    }
    ctx.restore();
  }

  protected abstract updateBehavior(bctx: BossUpdateContext, speedScale: number): void;
  public abstract render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed?: boolean
  ): void;
}
