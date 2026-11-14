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
 * V7 Authentic 1989 Centipede (`CentipedeWyrm` & Group C `ElderCentipede`):
 * - `CentipedeWyrm` (Wave 1+ Group A): Classic single-phase Yellow-Green S-curve centipede.
 * - `ElderCentipede` (Group C — Wave 8+ `ORTA` / Wave 4+ `ZOR`):
 *   At `>= 70%` claimed area, shatters its outer carapace (`triggerElderArmorShed`) and emerges
 *   as a **`2.0x` speed Crimson Winged Parasite Serpent**!
 */
export class CentipedeBoss extends BaseBoss {
  public readonly archetype = 'CENTIPEDE' as const;
  public readonly displayName: string;
  public readonly isElderVariant: boolean;
  private variant: CentipedeColorVariant;
  private readonly segments: SegmentState[] = [];
  private weavePhase = 0;
  private spitTimer = 2.4;
  public armorShed = false;
  public parasiteSpeedMultiplier = 1.0;

  constructor(
    spawn: Point,
    segmentCount = 9,
    variant: CentipedeColorVariant = 'YELLOW_GREEN',
    maxHp = 6,
    isElderVariant = false
  ) {
    const baseSpd = variant === 'CRIMSON' ? 196 : variant === 'GOLD' ? 178 : 162;
    super(spawn, 36, maxHp, baseSpd, -baseSpd * 0.78);
    this.variant = variant;
    this.isElderVariant = isElderVariant;
    this.displayName = isElderVariant ? 'ELDER CENTIPEDE' : 'GIANT CENTIPEDE';

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

  public get segmentCount(): number {
    return this.segments.length;
  }

  /**
   * V7 Group C Evolution (`ElderCentipede` at `>= 70%` claimed):
   * Shatters outer heavy armor plates, slims down to a sleek 5-segment Crimson Winged Parasite,
   * and surges to `2.0x` movement speed! Returns shattered armor positions for explosion VFX.
   */
  public triggerElderArmorShed(activePolygon: readonly Point[]): Point[] {
    if (this.armorShed || !this.isElderVariant) return [];
    this.armorShed = true;
    this.combatPhase = 2;
    this.variant = 'CRIMSON';
    this.parasiteSpeedMultiplier = 2.0;

    const debris: Point[] = this.segments.map((s) => ({ x: s.x, y: s.y }));
    if (this.segments.length > 5) {
      this.segments.length = 5;
    }
    this.vx *= 2.0;
    this.vy *= 2.0;
    this.onPolygonShrunk(activePolygon);
    return debris;
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

  /**
   * V7 Law 5: Every segment uses its own exact `HitCircle` (`(seg.x, seg.y, segRadius)`)!
   */
  public override getHitCircles(): HitCircle[] {
    const circles: HitCircle[] = [
      { x: this.x, y: this.y, radius: this.boundingRadius * 0.84 }
    ];
    const segRadius = 16 * this.renderScale;
    for (const seg of this.segments) {
      circles.push({ x: seg.x, y: seg.y, radius: segRadius });
    }
    return circles;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    // Auto-trigger Elder Armor Shed if `claimedPercent >= 70` during an Elder Centipede fight!
    if (
      this.isElderVariant &&
      !this.armorShed &&
      (this.combatPhase >= 2 ||
        (this.phaseBehavior?.specialMechanic === 'ELDER_PARASITE_SHED' && bctx.claimedPercent >= 70))
    ) {
      this.triggerElderArmorShed(bctx.activePolygon);
    }

    const renderVariant: CentipedeColorVariant = this.armorShed ? 'CRIMSON' : this.variant;
    // Note: if `phaseBehavior` already scaled `speedScale` by `2.0` on Phase 2, avoid double-multiplying;
    // if `triggerElderArmorShed` was called directly in unit tests without `phaseBehavior`, apply `2.0x`!
    const extraParasiteBoost =
      this.armorShed && (!this.phaseBehavior || this.phaseBehavior.phase < 2)
        ? this.parasiteSpeedMultiplier
        : 1.0;

    const effectiveSpd = 166 * speedScale * extraParasiteBoost;
    this.weavePhase += bctx.dt * (this.armorShed ? 4.8 : 2.9) * speedScale;

    let heading = Math.atan2(this.vy, this.vx);
    heading += Math.sin(this.weavePhase) * (this.armorShed ? 1.85 : 1.32) * bctx.dt;

    if (bctx.playerState === 'CUTTING' && bctx.activeTrail.length >= 2) {
      const targetPt = this.armorShed
        ? bctx.activeTrail[Math.floor(bctx.activeTrail.length * 0.5)]
        : bctx.playerPos;
      const desired = Math.atan2(targetPt.y - this.y, targetPt.x - this.x);
      let diff = desired - heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steerRate = this.armorShed ? 2.1 : renderVariant === 'YELLOW_GREEN' ? 0.55 : 1.05;
      heading += Math.max(-steerRate * bctx.dt, Math.min(steerRate * bctx.dt, diff));
    }

    this.vx = Math.cos(heading) * effectiveSpd;
    this.vy = Math.sin(heading) * effectiveSpd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    const segDist = (this.armorShed ? 20 : 23) * this.renderScale;
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

    this.spitTimer -= bctx.dt;
    if (this.spitTimer <= 0) {
      this.spitTimer = this.armorShed
        ? Math.min(1.35, this.phaseBehavior?.fireIntervalSec ?? 1.35)
        : (this.phaseBehavior?.fireIntervalSec ?? 2.6);
      this.firePhasePattern(bctx, speedScale, this.armorShed ? '#FF2848' : PALETTE.CUT_ORANGE);
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
    const jawFrame: 0 | 1 = Math.floor(timeSeconds * (this.armorShed ? 12 : 6.5)) % 2 === 0 ? 0 : 1;
    const activeVariant: CentipedeColorVariant = this.armorShed ? 'CRIMSON' : this.variant;

    if (this.armorShed || this.combatPhase >= 2) {
      this.renderPhaseAuraAndWings(ctx, pos.x, pos.y, timeSeconds);
    }

    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const legFrame: 0 | 1 = Math.floor(timeSeconds * 12 + i * 0.7) % 2 === 0 ? 0 : 1;
      const taper = Math.max(0.74, 1 - i * 0.02);
      const segSprite = getCentipedeSegmentSprite(activeVariant, legFrame);
      blitArenaPixelSprite(
        ctx,
        segSprite,
        seg.x,
        seg.y,
        this.renderScale * 1.18 * taper,
        seg.angle
      );
    }

    const headSprite = getCentipedeHeadSprite(activeVariant, jawFrame);
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
