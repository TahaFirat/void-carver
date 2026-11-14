import { PALETTE } from '../../core/Config';
import { pointInPolygonStrict, resolvePolygonPenetration } from '../../geometry/PolygonMath';
import { bounceCircleOffSolidBoxes, SolidRect } from '../../geometry/SolidBoxes';
import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import {
  CentipedeColorVariant,
  getCentipedeHeadSprite,
  getCentipedeSegmentSprite
} from '../../rendering/VolfiedSprites';
import { BaseBoss, BossUpdateContext, HitCircle } from './BaseBoss';

interface SegmentState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}

/**
 * 16-Bit Pixel-Art Armored Giant Centipede (`CentipedeBoss`).
 * - KOLAY: `YELLOW_GREEN`, `9` segments
 * - ORTA: `GOLD`, `11` segments + twin plasma spit
 * - ZOR / USTA: `GOLD` / `CRIMSON`, `13-15` segments + trail pressure
 */
export class CentipedeBoss extends BaseBoss {
  public readonly archetype = 'CENTIPEDE' as const;
  public readonly displayName = 'GIANT CENTIPEDE';
  private readonly variant: CentipedeColorVariant;
  private readonly segments: SegmentState[] = [];
  private weavePhase = 0;
  private spitTimer = 3.0;

  constructor(
    spawn: Point,
    segmentCount = 9,
    variant: CentipedeColorVariant = 'YELLOW_GREEN',
    maxHp = 6
  ) {
    const baseSpd = variant === 'CRIMSON' ? 205 : variant === 'GOLD' ? 185 : 162;
    super(spawn, 36, maxHp, baseSpd, -baseSpd * 0.78);
    this.variant = variant;

    const spacing = 24;
    for (let i = 0; i < segmentCount; i++) {
      this.segments.push({
        x: spawn.x - (i + 1) * spacing * 0.65,
        y: spawn.y - (i + 1) * spacing * 0.45,
        vx: 0,
        vy: 0,
        angle: 0.6
      });
    }
  }

  public override onPolygonShrunk(activePolygon: readonly Point[]): void {
    super.onPolygonShrunk(activePolygon);
    for (const seg of this.segments) {
      if (!pointInPolygonStrict({ x: seg.x, y: seg.y }, activePolygon)) {
        const solved = resolvePolygonPenetration(
          { x: seg.x, y: seg.y },
          18 * this.renderScale,
          activePolygon
        );
        seg.x = solved.position.x;
        seg.y = solved.position.y;
      }
    }
  }

  public bounceSegmentsOffBoxes(
    boxes: readonly SolidRect[],
    activePolygon: readonly Point[]
  ): void {
    if (boxes.length === 0) return;
    const segClampR = 18 * this.renderScale;
    for (const seg of this.segments) {
      if (bounceCircleOffSolidBoxes(seg, 16 * this.renderScale, boxes)) {
        const solved = resolvePolygonPenetration({ x: seg.x, y: seg.y }, segClampR, activePolygon);
        seg.x = solved.position.x;
        seg.y = solved.position.y;
      }
    }
  }

  public override getHitCircles(): HitCircle[] {
    const circles: HitCircle[] = [
      { x: this.x, y: this.y, radius: this.boundingRadius * 0.84 }
    ];
    // Hit radius (16 * scale) stays strictly inside polygon clamp radius (18 * scale)
    const segRadius = 16 * this.renderScale;
    for (const seg of this.segments) {
      circles.push({ x: seg.x, y: seg.y, radius: segRadius });
    }
    return circles;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const tierMult =
      this.variant === 'CRIMSON' ? 1.2 : this.variant === 'GOLD' ? 1.08 : 1.0;
    this.weavePhase += bctx.dt * 2.9 * speedScale * tierMult;

    const targetSpd = 170 * speedScale * tierMult;
    let heading = Math.atan2(this.vy, this.vx);

    // Organic serpentine S-curve + gentle hunting pressure when player cuts
    heading += Math.sin(this.weavePhase) * 1.35 * bctx.dt;
    if (bctx.playerState === 'CUTTING' && bctx.activeTrail.length >= 2) {
      const targetPt =
        this.variant === 'CRIMSON'
          ? bctx.activeTrail[Math.floor(bctx.activeTrail.length * 0.5)]
          : bctx.playerPos;
      const desired = Math.atan2(targetPt.y - this.y, targetPt.x - this.x);
      let diff = desired - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steerRate = this.variant === 'YELLOW_GREEN' ? 0.52 : 1.05;
      heading += Math.max(-steerRate * bctx.dt, Math.min(steerRate * bctx.dt, diff));
    }

    this.vx = Math.cos(heading) * targetSpd;
    this.vy = Math.sin(heading) * targetSpd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    // Follow-the-leader kinematic chain for all segments
    const segDist = 23 * this.renderScale;
    const segClampR = 18 * this.renderScale;
    let leaderX = this.x;
    let leaderY = this.y;
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const dx = leaderX - seg.x;
      const dy = leaderY - seg.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      seg.angle = Math.atan2(dy, dx);
      if (dist > segDist) {
        seg.x = leaderX - (dx / dist) * segDist;
        seg.y = leaderY - (dy / dist) * segDist;
      }
      const solved = resolvePolygonPenetration(
        { x: seg.x, y: seg.y },
        segClampR,
        bctx.activePolygon
      );
      seg.x = solved.position.x;
      seg.y = solved.position.y;

      leaderX = seg.x;
      leaderY = seg.y;
    }

    // Gold & Crimson Centipedes (or enraged YELLOW_GREEN) spit twin pincer plasma bolts from safe range
    if (this.variant !== 'YELLOW_GREEN' || this.enraged) {
      this.spitTimer -= bctx.dt * speedScale * tierMult;
      if (this.spitTimer <= 0) {
        this.spitTimer = this.variant === 'CRIMSON' ? 2.3 : 3.0;
        const distToPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
        if (distToPlayer >= 105 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
          const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
          const spd = 245 * speedScale;
          for (const spread of [-0.16, 0.16]) {
            const a = aim + spread;
            bctx.projectiles.spawnEnemyBullet(
              { x: this.x, y: this.y },
              Math.cos(a) * spd,
              Math.sin(a) * spd,
              PALETTE.CUT_ORANGE,
              5.5
            );
          }
        }
      }
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const headAngle = Math.atan2(this.vy, this.vx);
    const jawFrame: 0 | 1 = Math.floor(timeSeconds * 6.5) % 2 === 0 ? 0 : 1;

    // Draw tail-to-head so each forward segment overlaps cleanly over the one behind it!
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const legFrame: 0 | 1 = Math.floor(timeSeconds * 11 + i * 0.7) % 2 === 0 ? 0 : 1;
      const taper = Math.max(0.76, 1 - i * 0.015);
      const segSprite = getCentipedeSegmentSprite(this.variant, legFrame);
      blitArenaPixelSprite(
        ctx,
        segSprite,
        seg.x,
        seg.y,
        this.renderScale * 1.18 * taper,
        seg.angle
      );
    }

    const headSprite = getCentipedeHeadSprite(this.variant, jawFrame);
    blitArenaPixelSprite(
      ctx,
      headSprite,
      pos.x,
      pos.y,
      this.renderScale * 1.24,
      headAngle
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}
