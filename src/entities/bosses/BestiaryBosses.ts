import {
  arcLengthToPoint,
  getPolygonEdges,
  getTotalPerimeter,
  pointInPolygonStrict,
  pointToArcLength,
  projectPointToPolygon,
  projectPointToSegment,
  resolvePolygonPenetration
} from '../../geometry/PolygonMath';
import { bounceCircleOffSolidBoxes, SolidRect } from '../../geometry/SolidBoxes';
import { Point } from '../../geometry/Types';
import {
  getChronoSphinxSprite,
  getElectricMedusaSprite,
  getGravityGolemCoreSprite,
  getGravityShardSprite,
  getHiveCarrierSprite,
  getHydraBodySprite,
  getHydraHeadSprite,
  getHydraNeckNodeSprite,
  getIronCrustaceanSprite,
  getMagmaSerpentHeadSprite,
  getMagmaSerpentSegmentSprite,
  getMechaTarantulaSprite,
  getMirrorPrismSprite,
  getSawbladeJuggernautSprite,
  getSniperScarabSprite,
  getSpiralNautilusSprite
} from '../../rendering/BestiarySprites';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { getMantisSprite } from '../../rendering/VolfiedSprites';
import { KamikazeSporeMinion, WaspSwarmerMinion } from '../enemies/BestiaryMinions';
import { BaseBoss, BossUpdateContext, HitCircle } from './BaseBoss';

/**
 * #2 IronCrustacean (Hidrolik Yengeç):
 * Never moves diagonally — performs orthogonal X/Y Crab Strafes and fires crossing twin pincer bolts!
 */
export class IronCrustaceanBoss extends BaseBoss {
  public readonly archetype = 'IRON_CRUSTACEAN' as const;
  public readonly displayName = 'HIDROLIK YENGEC';
  private axisHorizontal = true;
  private strafeTimer = 1.45;
  private scissorTimer = 2.05;
  public shellDropped = false;
  public canEvolveShellDrop: boolean;

  constructor(spawn: Point, maxHp = 8, canEvolveShellDrop = false) {
    super(spawn, 42, maxHp, 210, 0);
    this.speciesId = 'IRON_CRUSTACEAN';
    this.canEvolveShellDrop = canEvolveShellDrop;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    if (
      !this.shellDropped &&
      this.canEvolveShellDrop &&
      (bctx.claimedPercent >= 65 || this.hp <= this.maxHp * 0.5)
    ) {
      this.shellDropped = true;
      this.combatPhase = 2;
      bctx.spawnSolidObstacle?.({ x: this.x, y: this.y });
    }

    this.strafeTimer -= bctx.dt;
    const strafeSpd = (this.shellDropped ? 255 : 205) * speedScale;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1.25 + ((Math.round(this.x + this.y) % 5) * 0.14);
      this.axisHorizontal = !this.axisHorizontal;
      if (this.axisHorizontal) {
        const sign = bctx.playerPos.x >= this.x ? 1 : -1;
        this.vx = sign * strafeSpd;
        this.vy = 0;
      } else {
        const sign = bctx.playerPos.y >= this.y ? 1 : -1;
        this.vx = 0;
        this.vy = sign * strafeSpd;
      }
    } else if (this.axisHorizontal) {
      this.vx = (this.vx >= 0 ? 1 : -1) * strafeSpd;
      this.vy = 0;
    } else {
      this.vx = 0;
      this.vy = (this.vy >= 0 ? 1 : -1) * strafeSpd;
    }

    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.scissorTimer -= bctx.dt;
    if (this.scissorTimer <= 0) {
      this.scissorTimer = this.shellDropped ? 1.55 : 2.15;
      const dist = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (dist >= 95 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const aim = this.resolveDifficultyAimAngle(bctx, 255 * speedScale);
        const perp = aim + Math.PI * 0.5;
        const bSpd = 250 * Math.min(1.38, speedScale);
        const over = this.eliteMutation === 'SNIPER_OVERCLOCK' ? 1.28 : 1.0;
        // Twin pincers fire crossing scissor vectors!
        for (const side of [-1, 1]) {
          const ox = this.x + Math.cos(perp) * side * 18 * this.renderScale;
          const oy = this.y + Math.sin(perp) * side * 18 * this.renderScale;
          const crossAng = aim - side * 0.22;
          bctx.projectiles.spawnEnemyBullet(
            { x: ox, y: oy },
            Math.cos(crossAng) * bSpd * over,
            Math.sin(crossAng) * bSpd * over,
            '#FF7838',
            5.8,
            0,
            -1,
            true
          );
        }
      }
    }
  }

  protected override enforceWallBounce(activePolygon: readonly Point[]): void {
    const prevVx = this.vx;
    const prevVy = this.vy;
    super.enforceWallBounce(activePolygon);
    // Keep strict orthogonal X/Y motion even after slanted polygon bounces!
    if (Math.abs(prevVx) > Math.abs(prevVy)) {
      this.vy = 0;
      if (Math.abs(this.vx) < 10) this.vx = -prevVx;
    } else {
      this.vx = 0;
      if (Math.abs(this.vy) < 10) this.vy = -prevVy;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 8) % 2 === 0 ? 0 : 1;
    const sprite = getIronCrustaceanSprite(frame, this.shellDropped);
    blitArenaPixelSprite(
      ctx,
      sprite,
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.28,
      0
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #4 SniperScarab (Zırhlı Altın Bokböceği):
 * 70% armor while elytra closed; opens wings every 2.8s to fire a 3-round sniper burst at exact player pos!
 */
export class SniperScarabBoss extends BaseBoss {
  public readonly archetype = 'SNIPER_SCARAB' as const;
  public readonly displayName = 'ALTIN BOKBOCEGI';
  private cycleTimer = 1.6;
  private burstRemaining = 0;
  private burstInterval = 0;
  private lockedAim = 0;

  constructor(spawn: Point, maxHp = 8) {
    super(spawn, 38, maxHp, 152, 138);
    this.speciesId = 'SNIPER_SCARAB';
    this.armorDamageReduction = 0.7;
  }

  public get wingsOpen(): boolean {
    return this.burstRemaining > 0 || this.cycleTimer >= 2.15;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.armorDamageReduction = this.wingsOpen ? 0 : 0.7;

    const spd = (this.wingsOpen ? 58 : 154) * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    if (this.burstRemaining > 0) {
      this.burstInterval -= bctx.dt;
      if (this.burstInterval <= 0) {
        this.burstInterval = 0.14;
        this.burstRemaining -= 1;
        if (pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
          const snipeSpd = 340 * Math.min(1.4, speedScale);
          this.spawnBossBullet(
            bctx,
            Math.cos(this.lockedAim) * snipeSpd,
            Math.sin(this.lockedAim) * snipeSpd,
            '#FFF058',
            5.8
          );
        }
      }
      return;
    }

    this.cycleTimer += bctx.dt;
    if (this.cycleTimer >= 2.8) {
      this.cycleTimer = 0;
      const d = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (d >= 95) {
        this.lockedAim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
        this.burstRemaining = 3;
        this.burstInterval = 0;
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
    const frame: 0 | 1 = Math.floor(timeSeconds * (this.wingsOpen ? 18 : 7)) % 2 === 0 ? 0 : 1;
    const rot = this.wingsOpen
      ? this.lockedAim + Math.PI * 0.5
      : Math.atan2(this.vy, this.vx) + Math.PI * 0.5;
    blitArenaPixelSprite(
      ctx,
      getSniperScarabSprite(this.wingsOpen, frame),
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.28,
      rot
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #5 PhantomMantis (Çelik Peygamberdevesi):
 * Locks a 0.40s crimson laser sight when player is CUTTING, then slashes across the arena at extreme speed!
 */
export class PhantomMantisBoss extends BaseBoss {
  public readonly archetype = 'MANTIS' as const;
  public readonly displayName = 'CELIK PEYGAMBERDEVESI';
  private lockTimer = 0;
  private dashTimer = 0;
  private dashCooldown = 2.2;
  private lockedAim = 0;

  constructor(spawn: Point, maxHp = 9) {
    super(spawn, 40, maxHp, 176, -162);
    this.speciesId = 'PHANTOM_MANTIS';
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    if (this.lockTimer > 0) {
      this.lockTimer = Math.max(0, this.lockTimer - bctx.dt);
      this.vx *= 0.85;
      this.vy *= 0.85;
      if (this.lockTimer <= 0) {
        this.dashTimer = 0.62;
        const dashSpd = 430 * speedScale;
        this.vx = Math.cos(this.lockedAim) * dashSpd;
        this.vy = Math.sin(this.lockedAim) * dashSpd;
      }
      return;
    }

    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - bctx.dt);
      const dashSpd = 430 * speedScale;
      const n = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / n) * dashSpd;
      this.vy = (this.vy / n) * dashSpd;
      this.x += this.vx * bctx.dt;
      this.y += this.vy * bctx.dt;
      return;
    }

    this.dashCooldown -= bctx.dt * (bctx.playerState === 'CUTTING' ? 1.85 : 1.0);
    if (this.dashCooldown <= 0) {
      this.dashCooldown = 2.6;
      this.lockTimer = 0.4;
      this.lockedAim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      return;
    }

    const spd = 172 * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    if (this.lockTimer > 0) {
      ctx.save();
      ctx.strokeStyle = Math.floor(timeSeconds * 28) % 2 === 0 ? '#FF2030' : '#FFF498';
      ctx.lineWidth = 4;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + Math.cos(this.lockedAim) * 520, pos.y + Math.sin(this.lockedAim) * 520);
      ctx.stroke();
      ctx.restore();
    }

    const angle = this.lockTimer > 0 ? this.lockedAim : Math.atan2(this.vy, this.vx);
    const frame: 0 | 1 =
      this.lockTimer > 0 || this.dashTimer > 0 || Math.floor(timeSeconds * 7) % 2 === 1 ? 1 : 0;
    blitArenaPixelSprite(
      ctx,
      getMantisSprite(frame),
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.34,
      angle
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #7 SpiralNautilus (Zırhlı Ammonit Kabuğu):
 * Swims slowly for 7s, then retracts tentacles and spins like a pinball at 2.4x speed for 3.0s!
 */
export class SpiralNautilusBoss extends BaseBoss {
  public readonly archetype = 'SPIRAL_NAUTILUS' as const;
  public readonly displayName = 'ZIRHLI NAUTILUS';
  private cycleTimer = 0;
  private pearlTimer = 2.3;
  private spinAngle = 0;

  constructor(spawn: Point, maxHp = 10) {
    super(spawn, 40, maxHp, 124, -118);
    this.speciesId = 'SPIRAL_NAUTILUS';
  }

  public get isRetractedSpin(): boolean {
    return this.cycleTimer >= 7.0;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.cycleTimer += bctx.dt;
    if (this.cycleTimer >= 10.0) {
      this.cycleTimer = 0;
    }

    const baseSwim = 126;
    const spd = (this.isRetractedSpin ? baseSwim * 2.4 : baseSwim) * speedScale;
    if (this.isRetractedSpin) {
      this.spinAngle += bctx.dt * 14;
      if (Math.abs(this.vx) < spd * 0.25) this.vx = (this.vx >= 0 ? 1 : -1) * spd * 0.55;
      if (Math.abs(this.vy) < spd * 0.25) this.vy = (this.vy >= 0 ? 1 : -1) * spd * 0.55;
    } else {
      this.pearlTimer -= bctx.dt;
      if (this.pearlTimer <= 0) {
        this.pearlTimer = 2.35;
        this.firePhasePattern(bctx, speedScale, '#68D4FF');
      }
    }

    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * (this.isRetractedSpin ? 18 : 6)) % 2 === 0 ? 0 : 1;
    const rot = this.isRetractedSpin ? this.spinAngle : Math.atan2(this.vy, this.vx);
    blitArenaPixelSprite(
      ctx,
      getSpiralNautilusSprite(this.isRetractedSpin, frame),
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.28,
      rot
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #8 MagmaSerpent (Magma Ejderi):
 * Basalt-lava articulated dragon-wyrm leaving 3.0s burning `MagmaPools` behind it that ignite cuts!
 */
export class MagmaSerpentBoss extends BaseBoss {
  public readonly archetype = 'MAGMA_SERPENT' as const;
  public readonly displayName = 'MAGMA EJDERI';
  private readonly segments: { x: number; y: number; vx: number; vy: number; angle: number }[] = [];
  private slitherPhase = 0;
  private poolDropTimer = 0.85;
  private breathTimer = 2.5;

  constructor(spawn: Point, maxHp = 10) {
    super(spawn, 36, maxHp, 174, -150);
    this.speciesId = 'MAGMA_SERPENT';
    for (let i = 0; i < 7; i++) {
      this.segments.push({
        x: spawn.x - (i + 1) * 20,
        y: spawn.y - (i + 1) * 12,
        vx: 0,
        vy: 0,
        angle: 0
      });
    }
  }

  public bounceSegmentsOffBoxes(boxes: readonly SolidRect[], activePolygon: readonly Point[]): void {
    if (boxes.length === 0) return;
    const r = 16 * this.renderScale * this.cloneVisualScale;
    for (const seg of this.segments) {
      if (bounceCircleOffSolidBoxes(seg, r, boxes)) {
        const solved = resolvePolygonPenetration(seg, r + 2, activePolygon);
        seg.x = solved.position.x;
        seg.y = solved.position.y;
      }
    }
  }

  public override onPolygonShrunk(activePolygon: readonly Point[]): void {
    super.onPolygonShrunk(activePolygon);
    for (const seg of this.segments) {
      if (!pointInPolygonStrict(seg, activePolygon)) {
        const solved = resolvePolygonPenetration(seg, 17 * this.renderScale, activePolygon);
        seg.x = solved.position.x;
        seg.y = solved.position.y;
      }
    }
  }

  public override getHitCircles(): HitCircle[] {
    const out: HitCircle[] = [{ x: this.x, y: this.y, radius: this.boundingRadius * 0.86 }];
    const sr = 15 * this.renderScale * this.cloneVisualScale;
    for (const seg of this.segments) {
      out.push({ x: seg.x, y: seg.y, radius: sr });
    }
    return out;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.slitherPhase += bctx.dt * 3.4 * speedScale;
    const spd = 176 * speedScale;
    const heading = Math.atan2(this.vy, this.vx) + Math.sin(this.slitherPhase) * 1.45 * bctx.dt;
    this.vx = Math.cos(heading) * spd;
    this.vy = Math.sin(heading) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    const spacing = 22 * this.renderScale * this.cloneVisualScale;
    let lx = this.x;
    let ly = this.y;
    for (const seg of this.segments) {
      const dx = lx - seg.x;
      const dy = ly - seg.y;
      const d = Math.hypot(dx, dy) || 0.001;
      seg.angle = Math.atan2(dy, dx);
      if (d > spacing) {
        seg.x = lx - (dx / d) * spacing;
        seg.y = ly - (dy / d) * spacing;
      }
      const solved = resolvePolygonPenetration(seg, 17 * this.renderScale, bctx.activePolygon);
      seg.x = solved.position.x;
      seg.y = solved.position.y;
      lx = seg.x;
      ly = seg.y;
    }

    this.poolDropTimer -= bctx.dt;
    if (this.poolDropTimer <= 0) {
      this.poolDropTimer = 0.95;
      const tail = this.segments[this.segments.length - 1];
      const dPlayer = Math.hypot(bctx.playerPos.x - tail.x, bctx.playerPos.y - tail.y);
      if (dPlayer >= 85 && pointInPolygonStrict(tail, bctx.activePolygon)) {
        bctx.hazards?.spawnMagmaPool({ x: tail.x, y: tail.y }, 3.0, 22);
      }
    }

    this.breathTimer -= bctx.dt;
    if (this.breathTimer <= 0) {
      this.breathTimer = 2.45;
      this.firePhasePattern(bctx, speedScale, '#FF6818');
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const sc = this.renderScale * this.cloneVisualScale;

    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      const f: 0 | 1 = Math.floor(timeSeconds * 8 + i) % 2 === 0 ? 0 : 1;
      const taper = Math.max(0.7, 1 - i * 0.04);
      blitArenaPixelSprite(
        ctx,
        getMagmaSerpentSegmentSprite(f, i === this.segments.length - 1),
        seg.x,
        seg.y,
        sc * 1.22 * taper,
        seg.angle
      );
    }

    const jaw: 0 | 1 = Math.floor(timeSeconds * 7) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(
      ctx,
      getMagmaSerpentHeadSprite(jaw),
      pos.x,
      pos.y,
      sc * 1.26,
      Math.atan2(this.vy, this.vx)
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #9 MechaTarantula (8-Bacaklı Ağ Örümceği):
 * Deploys 5.0s electric `WebZone` (`r = 38px`) into open arena that slows player cuts by 45%!
 */
export class MechaTarantulaBoss extends BaseBoss {
  public readonly archetype = 'MECHA_TARANTULA' as const;
  public readonly displayName = 'MEKANIK TARANTULA';
  private webTimer = 2.4;
  private fangTimer = 2.2;

  constructor(spawn: Point, maxHp = 10) {
    super(spawn, 44, maxHp, 162, 148);
    this.speciesId = 'MECHA_TARANTULA';
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const spd = 162 * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.webTimer -= bctx.dt;
    if (this.webTimer <= 0) {
      this.webTimer = 4.1;
      // Lob web halfway toward player's open lane (clamped safely inside activePolygon)
      const target = {
        x: this.x + (bctx.playerPos.x - this.x) * 0.52,
        y: this.y + (bctx.playerPos.y - this.y) * 0.52
      };
      const clamped = resolvePolygonPenetration(target, 44, bctx.activePolygon).position;
      if (pointInPolygonStrict(clamped, bctx.activePolygon)) {
        bctx.hazards?.spawnWebZone(clamped, 5.0, 38);
      }
    }

    this.fangTimer -= bctx.dt;
    if (this.fangTimer <= 0) {
      this.fangTimer = 2.25;
      this.firePhasePattern(bctx, speedScale, '#FFD038');
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const legFrame = (Math.floor(timeSeconds * 12) % 4) as 0 | 1 | 2 | 3;
    const rot = Math.atan2(this.vy, this.vx) + Math.PI * 0.5;
    blitArenaPixelSprite(
      ctx,
      getMechaTarantulaSprite(legFrame),
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.28,
      rot
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #10 HiveCarrier (Ana Kovan Gemisi):
 * Opens hazard bay doors every 5.5s to launch 2 live `KamikazeSpore` / `WaspSwarmer` minions (cap 8)!
 */
export class HiveCarrierBoss extends BaseBoss {
  public readonly archetype = 'HIVE_CARRIER' as const;
  public readonly displayName = 'ANA KOVAN GEMISI';
  private bayCycleTimer = 3.2;
  private launchedThisOpen = false;
  private spawnToggle = false;

  constructor(spawn: Point, maxHp = 12) {
    super(spawn, 48, maxHp, 134, 120);
    this.speciesId = 'HIVE_CARRIER';
  }

  public get bayOpen(): boolean {
    return this.bayCycleTimer >= 4.35;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.bayCycleTimer += bctx.dt;
    const spd = (this.bayOpen ? 68 : 134) * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    if (this.bayOpen && !this.launchedThisOpen) {
      this.launchedThisOpen = true;
      if (pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const room = Math.max(0, 8 - bctx.currentMinionCount);
        const count = Math.min(2, room);
        for (let i = 0; i < count; i++) {
          const sx = this.x + (i === 0 ? -18 : 18);
          const sy = this.y + 12;
          const m = this.spawnToggle
            ? new WaspSwarmerMinion({ x: sx, y: sy }, 198, i + 1)
            : new KamikazeSporeMinion({ x: sx, y: sy }, 218, i + 1);
          m.enforcePolygonBounds(bctx.activePolygon);
          bctx.summonMinion(m);
        }
        this.spawnToggle = !this.spawnToggle;
      }
    }

    if (this.bayCycleTimer >= 5.5) {
      this.bayCycleTimer = 0;
      this.launchedThisOpen = false;
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 6) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(
      ctx,
      getHiveCarrierSprite(this.bayOpen, frame),
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.28,
      Math.sin(timeSeconds * 1.6) * 0.08
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #11 MirrorPrism (Yansıtıcı Kristal Piramit):
 * Fires crystal laser bolts (`bouncesLeft = 1`) that reflect mirror-like off arena walls once!
 */
export class MirrorPrismBoss extends BaseBoss {
  public readonly archetype = 'MIRROR_PRISM' as const;
  public readonly displayName = 'KRISTAL PRIZMA';
  private laserTimer = 2.0;
  private prismSpin = 0;

  constructor(spawn: Point, maxHp = 11) {
    super(spawn, 42, maxHp, 168, -156);
    this.speciesId = 'MIRROR_PRISM';
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.prismSpin += bctx.dt * 2.2;
    const spd = 168 * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.laserTimer -= bctx.dt;
    if (this.laserTimer <= 0) {
      this.laserTimer = 2.15;
      const d = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (d >= 95 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const bSpd = 268 * Math.min(1.38, speedScale);
        const aim = this.resolveDifficultyAimAngle(bctx, bSpd);
        for (const off of [-0.36, 0, 0.36]) {
          const a = aim + off;
          this.spawnBossBullet(
            bctx,
            Math.cos(a) * bSpd,
            Math.sin(a) * bSpd,
            '#68F8FF',
            5.8,
            0,
            -1,
            1
          );
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
    const rotStep = (Math.floor(timeSeconds * 6) % 4) as 0 | 1 | 2 | 3;
    blitArenaPixelSprite(
      ctx,
      getMirrorPrismSprite(rotStep),
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.3,
      this.prismSpin
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #12 ElectricMedusa (Biyo-Elektrik Denizanası):
 * Swims in jellyfish pulses; electrifies nearby safe border segments with a 2.5s static charge!
 */
export class ElectricMedusaBoss extends BaseBoss {
  public readonly archetype = 'ELECTRIC_MEDUSA' as const;
  public readonly displayName = 'ELEKTRIK DENIZANASI';
  private pulsePhase = 0;
  private borderArcCooldown = 1.6;
  private shockVolleyTimer = 2.4;

  constructor(spawn: Point, maxHp = 11) {
    super(spawn, 42, maxHp, 158, -148);
    this.speciesId = 'ELECTRIC_MEDUSA';
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.pulsePhase += bctx.dt * 4.2;
    const pulseBoost = 0.65 + Math.max(0, Math.sin(this.pulsePhase)) * 0.75;
    const spd = 164 * speedScale * pulseBoost;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    if (this.borderArcCooldown > 0) {
      this.borderArcCooldown = Math.max(0, this.borderArcCooldown - bctx.dt);
    } else {
      // Find closest activePolygon border edge and deposit a 2.5s static charge span!
      const poly = bctx.activePolygon;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const proj = projectPointToSegment({ x: this.x, y: this.y }, a, b);
        if (proj.distance <= this.boundingRadius + 24) {
          const edx = b.x - a.x;
          const edy = b.y - a.y;
          const elen = Math.hypot(edx, edy) || 1;
          const ux = edx / elen;
          const uy = edy / elen;
          const halfSpan = Math.min(58, elen * 0.45);
          const s1 = projectPointToSegment(
            { x: proj.point.x - ux * halfSpan, y: proj.point.y - uy * halfSpan },
            a,
            b
          ).point;
          const s2 = projectPointToSegment(
            { x: proj.point.x + ux * halfSpan, y: proj.point.y + uy * halfSpan },
            a,
            b
          ).point;
          bctx.hazards?.spawnStaticBorderArc(s1, s2, 2.5);
          this.borderArcCooldown = 2.7;
          break;
        }
      }
    }

    this.shockVolleyTimer -= bctx.dt;
    if (this.shockVolleyTimer <= 0) {
      this.shockVolleyTimer = 2.45;
      this.firePhasePattern(bctx, speedScale, '#58F4FF');
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const pulseFrame = (Math.floor(timeSeconds * 6) % 3) as 0 | 1 | 2;
    blitArenaPixelSprite(
      ctx,
      getElectricMedusaSprite(pulseFrame),
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.28,
      Math.sin(timeSeconds * 2.2) * 0.14
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #13 GravityGolem (Manyetik Çekim Monoliti):
 * 3 orbiting shards; every 6s opens a 1.5s magnetic singularity ring that curves bullets & flings shards!
 */
export class GravityGolemBoss extends BaseBoss {
  public readonly archetype = 'GRAVITY_GOLEM' as const;
  public readonly displayName = 'MANYETIK MONOLIT';
  private cycleTimer = 0;
  private shardAngle = 0;
  private fireTimer = 2.1;
  private shardPositions: Point[] = [];

  constructor(spawn: Point, maxHp = 12) {
    super(spawn, 42, maxHp, 146, 132);
    this.speciesId = 'GRAVITY_GOLEM';
  }

  public get isMagneticPulseActive(): boolean {
    return this.cycleTimer >= 6.0;
  }

  private getCurrentShardOrbitRadius(): number {
    if (!this.isMagneticPulseActive) return 68 * this.renderScale * this.cloneVisualScale;
    const t = (this.cycleTimer - 6.0) / 1.5;
    const expand = Math.sin(t * Math.PI);
    return (68 + expand * 74) * this.renderScale * this.cloneVisualScale;
  }

  public override getHitCircles(): HitCircle[] {
    const out: HitCircle[] = [{ x: this.x, y: this.y, radius: this.boundingRadius * 0.88 }];
    const sr = 12 * this.renderScale * this.cloneVisualScale;
    for (const sp of this.shardPositions) {
      out.push({ x: sp.x, y: sp.y, radius: sr });
    }
    return out;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.cycleTimer += bctx.dt;
    if (this.cycleTimer >= 7.5) {
      this.cycleTimer = 0;
    }

    const spd = (this.isMagneticPulseActive ? 88 : 148) * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.shardAngle += bctx.dt * (this.isMagneticPulseActive ? 5.2 : 2.6);
    const orbitR = this.getCurrentShardOrbitRadius();
    this.shardPositions = [];
    for (let i = 0; i < 3; i++) {
      const a = this.shardAngle + (i * Math.PI * 2) / 3;
      const sx = this.x + Math.cos(a) * orbitR;
      const sy = this.y + Math.sin(a) * orbitR;
      if (pointInPolygonStrict({ x: sx, y: sy }, bctx.activePolygon)) {
        this.shardPositions.push({ x: sx, y: sy });
      }
    }

    if (this.isMagneticPulseActive) {
      bctx.projectiles.applyGravityCurve({ x: this.x, y: this.y }, 360, bctx.dt);
    }

    this.fireTimer -= bctx.dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.isMagneticPulseActive ? 0.95 : 2.2;
      this.firePhasePattern(bctx, speedScale, '#C868FF');
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 10) % 2 === 0 ? 0 : 1;
    const sc = this.renderScale * this.cloneVisualScale;

    if (this.isMagneticPulseActive) {
      ctx.save();
      const ringR = Math.round(this.getCurrentShardOrbitRadius() * 1.08);
      ctx.strokeStyle = frame === 0 ? 'rgba(104, 240, 255, 0.78)' : 'rgba(216, 104, 255, 0.78)';
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(Math.round(pos.x), Math.round(pos.y), ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    blitArenaPixelSprite(
      ctx,
      getGravityGolemCoreSprite(this.isMagneticPulseActive, frame),
      pos.x,
      pos.y,
      sc * 1.3,
      0
    );

    const shardSprite = getGravityShardSprite(frame);
    for (const sp of this.shardPositions) {
      blitArenaPixelSprite(ctx, shardSprite, sp.x, sp.y, sc * 1.15, this.shardAngle * 1.5);
    }

    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Detached Crimson Serpent Head spawned by `HydraBioHeadBoss` when >= 60% of the arena is claimed!
 */
export class DetachedHydraSerpentBoss extends BaseBoss {
  public readonly archetype = 'HYDRA_BIO_HEAD' as const;
  public readonly displayName = 'KOPMUS HIDRA BASI';
  private readonly neckTrail: { x: number; y: number }[] = [];
  private spitTimer = 1.65;
  private wavePhase = 0;

  constructor(spawn: Point, maxHp = 5) {
    super(spawn, 26, maxHp, 245, -215);
    this.isEscort = true;
    this.speciesId = 'HYDRA_BIO_HEAD';
    for (let i = 0; i < 4; i++) {
      this.neckTrail.push({ x: spawn.x - i * 14, y: spawn.y });
    }
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.wavePhase += bctx.dt * 5.2;
    const spd = 255 * speedScale;
    const heading = Math.atan2(this.vy, this.vx) + Math.sin(this.wavePhase) * 1.8 * bctx.dt;
    this.vx = Math.cos(heading) * spd;
    this.vy = Math.sin(heading) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    let lx = this.x;
    let ly = this.y;
    for (const node of this.neckTrail) {
      const dx = lx - node.x;
      const dy = ly - node.y;
      const d = Math.hypot(dx, dy) || 1;
      node.x = lx - (dx / d) * 14 * this.renderScale;
      node.y = ly - (dy / d) * 14 * this.renderScale;
      const solved = resolvePolygonPenetration(node, 10, bctx.activePolygon);
      node.x = solved.position.x;
      node.y = solved.position.y;
      lx = node.x;
      ly = node.y;
    }

    this.spitTimer -= bctx.dt;
    if (this.spitTimer <= 0) {
      this.spitTimer = 1.75;
      const d = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (d >= 90 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const aim = this.resolveDifficultyAimAngle(bctx, 260);
        this.spawnBossBullet(bctx, Math.cos(aim) * 260, Math.sin(aim) * 260, '#FF4830', 5.5);
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
    const nodeSprite = getHydraNeckNodeSprite(true);
    for (let i = this.neckTrail.length - 1; i >= 0; i--) {
      blitArenaPixelSprite(ctx, nodeSprite, this.neckTrail[i].x, this.neckTrail[i].y, this.renderScale);
    }
    const jaw = Math.floor(timeSeconds * 10) % 2 === 0;
    blitArenaPixelSprite(
      ctx,
      getHydraHeadSprite(jaw, true),
      pos.x,
      pos.y,
      this.renderScale * 1.2,
      Math.atan2(this.vy, this.vx)
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #15 HydraBioHead (Üç Başlı Biyo-Hidra):
 * 3 articulated dragon heads firing at distinct angles; at >= 60% claimed area, 1 head detaches as a fast serpent Boss!
 */
export class HydraBioHeadBoss extends BaseBoss {
  public readonly archetype = 'HYDRA_BIO_HEAD' as const;
  public readonly displayName = 'UC BASLI HIDRA';
  public headDetached = false;
  private swayPhase = 0;
  private salvoTimer = 2.05;
  private headPositions: { x: number; y: number; angle: number }[] = [];

  constructor(spawn: Point, maxHp = 14) {
    super(spawn, 44, maxHp, 154, 142);
    this.speciesId = 'HYDRA_BIO_HEAD';
  }

  public override getHitCircles(): HitCircle[] {
    const out: HitCircle[] = [{ x: this.x, y: this.y, radius: this.boundingRadius * 0.88 }];
    const hr = 16 * this.renderScale * this.cloneVisualScale;
    for (const h of this.headPositions) {
      out.push({ x: h.x, y: h.y, radius: hr });
    }
    return out;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.swayPhase += bctx.dt * 3.2;
    const spd = 156 * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    if (!this.headDetached && bctx.claimedPercent >= 60 && !this.isEscort) {
      this.headDetached = true;
      this.combatPhase = 2;
      const spawnPt = resolvePolygonPenetration(
        { x: this.x + 42, y: this.y - 36 },
        28,
        bctx.activePolygon
      ).position;
      const serpent = new DetachedHydraSerpentBoss(spawnPt, Math.max(4, Math.round(this.maxHp * 0.35)));
      bctx.spawnEscortBoss?.(serpent);
    }

    const baseAim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
    const activeHeadOffsets = this.headDetached ? [-0.52, 0.52] : [-0.62, 0, 0.62];
    const neckLen = 46 * this.renderScale * this.cloneVisualScale;
    this.headPositions = [];

    for (let i = 0; i < activeHeadOffsets.length; i++) {
      const sway = Math.sin(this.swayPhase + i * 1.7) * 0.24;
      const a = baseAim + activeHeadOffsets[i] + sway;
      const rawPt = { x: this.x + Math.cos(a) * neckLen, y: this.y + Math.sin(a) * neckLen };
      const solved = resolvePolygonPenetration(rawPt, 18 * this.renderScale, bctx.activePolygon);
      this.headPositions.push({ x: solved.position.x, y: solved.position.y, angle: a });
    }

    this.salvoTimer -= bctx.dt;
    if (this.salvoTimer <= 0) {
      this.salvoTimer = 2.15;
      const d = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (d >= 95) {
        const bSpd = 248 * Math.min(1.38, speedScale);
        const over = this.eliteMutation === 'SNIPER_OVERCLOCK' ? 1.28 : 1.0;
        for (const h of this.headPositions) {
          if (pointInPolygonStrict(h, bctx.activePolygon)) {
            bctx.projectiles.spawnEnemyBullet(
              { x: h.x, y: h.y },
              Math.cos(h.angle) * bSpd * over,
              Math.sin(h.angle) * bSpd * over,
              '#88FF68',
              5.6,
              0,
              -1,
              true
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
    const sc = this.renderScale * this.cloneVisualScale;
    const frame: 0 | 1 = Math.floor(timeSeconds * 7) % 2 === 0 ? 0 : 1;

    blitArenaPixelSprite(ctx, getHydraBodySprite(frame), pos.x, pos.y, sc * 1.26, 0);

    const neckSprite = getHydraNeckNodeSprite(false);
    const jawOpen = this.salvoTimer < 0.35;
    const headSprite = getHydraHeadSprite(jawOpen, false);

    for (const h of this.headPositions) {
      for (const t of [0.35, 0.68]) {
        blitArenaPixelSprite(
          ctx,
          neckSprite,
          pos.x + (h.x - pos.x) * t,
          pos.y + (h.y - pos.y) * t,
          sc * 1.05
        );
      }
      blitArenaPixelSprite(ctx, headSprite, h.x, h.y, sc * 1.18, h.angle);
    }

    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #16 SawbladeJuggernaut (Dev Testere Tankı):
 * On hitting a wall, latches onto the green border and grinds along the perimeter for 2.5s showering sparks!
 */
export class SawbladeJuggernautBoss extends BaseBoss {
  public readonly archetype = 'SAWBLADE_JUGGERNAUT' as const;
  public readonly displayName = 'TESTERE TANKI';
  private grindTimer = 0;
  private grindCooldown = 0;
  private grindArcS = 0;
  private grindDir: 1 | -1 = 1;
  private sawSpin = 0;
  private sparkShotTimer = 1.9;

  constructor(spawn: Point, maxHp = 14) {
    super(spawn, 44, maxHp, 196, -172);
    this.speciesId = 'SAWBLADE_JUGGERNAUT';
  }

  public get isGrindingWall(): boolean {
    return this.grindTimer > 0;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.sawSpin += bctx.dt * (this.isGrindingWall ? 16 : 9);
    if (this.grindCooldown > 0) {
      this.grindCooldown = Math.max(0, this.grindCooldown - bctx.dt);
    }

    if (this.grindTimer > 0) {
      this.grindTimer -= bctx.dt;
      const edges = getPolygonEdges(bctx.activePolygon);
      const total = getTotalPerimeter(edges);
      if (total > 0 && this.grindTimer > 0) {
        const grindSpd = 248 * speedScale;
        this.grindArcS = ((this.grindArcS + this.grindDir * grindSpd * bctx.dt) % total + total) % total;
        const borderPt = arcLengthToPoint(this.grindArcS, bctx.activePolygon);
        const solved = resolvePolygonPenetration(borderPt, this.boundingRadius, bctx.activePolygon);
        this.vx = (solved.position.x - this.x) / Math.max(0.001, bctx.dt);
        this.vy = (solved.position.y - this.y) / Math.max(0.001, bctx.dt);
        this.x = solved.position.x;
        this.y = solved.position.y;
        return;
      }

      // Launch back inward toward arena interior!
      this.grindTimer = 0;
      this.grindCooldown = 1.8;
      const launchAng = Math.atan2(600 - this.y, 450 - this.x) + (this.grindDir * 0.35);
      const spd = 210 * speedScale;
      this.vx = Math.cos(launchAng) * spd;
      this.vy = Math.sin(launchAng) * spd;
    }

    const spd = 196 * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.sparkShotTimer -= bctx.dt;
    if (this.sparkShotTimer <= 0) {
      this.sparkShotTimer = 2.15;
      this.firePhasePattern(bctx, speedScale, '#FFA828');
    }
  }

  protected override enforceWallBounce(activePolygon: readonly Point[]): void {
    if (this.grindTimer > 0) return;

    const solved = resolvePolygonPenetration(
      { x: this.x, y: this.y },
      this.boundingRadius,
      activePolygon
    );
    this.x = solved.position.x;
    this.y = solved.position.y;

    if (solved.collidedNormal) {
      if (this.grindCooldown <= 0) {
        // Latch onto the green border and roll along perimeter for 2.5s!
        const proj = projectPointToPolygon({ x: this.x, y: this.y }, activePolygon);
        this.grindArcS = pointToArcLength(proj.point, activePolygon) ?? 0;
        this.grindDir = this.vx * -solved.collidedNormal.y + this.vy * solved.collidedNormal.x >= 0 ? 1 : -1;
        this.grindTimer = 2.5;
        return;
      }
      const nx = solved.collidedNormal.x;
      const ny = solved.collidedNormal.y;
      const dot = this.vx * nx + this.vy * ny;
      if (dot < 0) {
        this.vx -= 2 * dot * nx;
        this.vy -= 2 * dot * ny;
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
    const sawFrame: 0 | 1 = Math.floor(timeSeconds * 24) % 2 === 0 ? 0 : 1;
    blitArenaPixelSprite(
      ctx,
      getSawbladeJuggernautSprite(sawFrame, this.isGrindingWall),
      pos.x,
      pos.y,
      this.renderScale * this.cloneVisualScale * 1.28,
      this.sawSpin
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * #17 ChronoSphinx (Zaman Sfenksi):
 * Telegraphs destination with a 0.50s glowing target ring, blinks leaving pixel afterimages,
 * and fires a triangular 3-bolt formation!
 */
export class ChronoSphinxBoss extends BaseBoss {
  public readonly archetype = 'CHRONO_SPHINX' as const;
  public readonly displayName = 'ZAMAN SFENKSI';
  private blinkCooldown = 3.8;
  private blinkTelegraphTimer = 0;
  private blinkDest: Point | null = null;
  private afterimages: { x: number; y: number; life: number }[] = [];
  private triShotTimer = 2.1;

  constructor(spawn: Point, maxHp = 14) {
    super(spawn, 42, maxHp, 152, -142);
    this.speciesId = 'CHRONO_SPHINX';
  }

  private pickFairBlinkDestination(bctx: BossUpdateContext): Point | null {
    const margin = this.boundingRadius + 38;
    for (let attempt = 0; attempt < 24; attempt++) {
      const seedA = ((Math.round(bctx.timeSeconds * 60) + attempt * 173) % 620) + 140;
      const seedB = ((Math.round(bctx.timeSeconds * 97) + attempt * 197) % 820) + 190;
      const cand = { x: seedA, y: seedB };
      if (!pointInPolygonStrict(cand, bctx.activePolygon)) continue;
      const solved = resolvePolygonPenetration(cand, margin, bctx.activePolygon);
      if (Math.hypot(solved.position.x - cand.x, solved.position.y - cand.y) > 8) continue;
      if (Math.hypot(cand.x - bctx.playerPos.x, cand.y - bctx.playerPos.y) < 155) continue;
      if (Math.hypot(cand.x - this.x, cand.y - this.y) < 120) continue;
      return cand;
    }
    return null;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    for (const img of this.afterimages) img.life -= bctx.dt;
    this.afterimages = this.afterimages.filter((img) => img.life > 0);

    if (this.blinkTelegraphTimer > 0 && this.blinkDest) {
      this.blinkTelegraphTimer -= bctx.dt;
      if (this.blinkTelegraphTimer <= 0) {
        if (pointInPolygonStrict(this.blinkDest, bctx.activePolygon)) {
          for (const t of [0.0, 0.35, 0.7]) {
            this.afterimages.push({
              x: this.x + (this.blinkDest.x - this.x) * t,
              y: this.y + (this.blinkDest.y - this.y) * t,
              life: 0.45 - t * 0.12
            });
          }
          const safe = resolvePolygonPenetration(
            this.blinkDest,
            this.boundingRadius + 4,
            bctx.activePolygon
          ).position;
          this.x = safe.x;
          this.y = safe.y;
          this.prevX = this.x;
          this.prevY = this.y;
          this.fireTriangleFormation(bctx, speedScale);
        }
        this.blinkDest = null;
      }
      return;
    }

    const spd = 152 * speedScale;
    const n = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / n) * spd;
    this.vy = (this.vy / n) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.blinkCooldown -= bctx.dt;
    if (this.blinkCooldown <= 0) {
      this.blinkCooldown = 4.6;
      const dest = this.pickFairBlinkDestination(bctx);
      if (dest) {
        this.blinkDest = dest;
        this.blinkTelegraphTimer = 0.5;
      }
    }

    this.triShotTimer -= bctx.dt;
    if (this.triShotTimer <= 0) {
      this.triShotTimer = 2.3;
      this.fireTriangleFormation(bctx, speedScale);
    }
  }

  private fireTriangleFormation(bctx: BossUpdateContext, speedScale: number): void {
    const d = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
    if (d < 95 || !pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) return;
    const spd = 258 * Math.min(1.38, speedScale);
    const aim = this.resolveDifficultyAimAngle(bctx, spd);
    const perp = aim + Math.PI * 0.5;
    const over = this.eliteMutation === 'SNIPER_OVERCLOCK' ? 1.28 : 1.0;
    const offsets: [number, number][] = [
      [16, 0],
      [-8, -14],
      [-8, 14]
    ];
    for (const [fwd, side] of offsets) {
      const ox = this.x + Math.cos(aim) * fwd + Math.cos(perp) * side;
      const oy = this.y + Math.sin(aim) * fwd + Math.sin(perp) * side;
      if (pointInPolygonStrict({ x: ox, y: oy }, bctx.activePolygon)) {
        bctx.projectiles.spawnEnemyBullet(
          { x: ox, y: oy },
          Math.cos(aim) * spd * over,
          Math.sin(aim) * spd * over,
          '#58FF98',
          5.8,
          0,
          -1,
          true
        );
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
    const sc = this.renderScale * this.cloneVisualScale;
    const wingFrame: 0 | 1 = Math.floor(timeSeconds * 8) % 2 === 0 ? 0 : 1;

    // 1. Fair 0.50s Glowing Arrival Target Ring before Blink!
    if (this.blinkTelegraphTimer > 0 && this.blinkDest) {
      ctx.save();
      const pulse = 1 + Math.sin(timeSeconds * 28) * 0.14;
      const r = Math.round(this.boundingRadius * pulse);
      ctx.strokeStyle = wingFrame === 0 ? '#58FF98' : '#FFE868';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(Math.round(this.blinkDest.x), Math.round(this.blinkDest.y), r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.blinkDest.x - 16, this.blinkDest.y);
      ctx.lineTo(this.blinkDest.x + 16, this.blinkDest.y);
      ctx.moveTo(this.blinkDest.x, this.blinkDest.y - 16);
      ctx.lineTo(this.blinkDest.x, this.blinkDest.y + 16);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Pixel Afterimage Shadows
    const ghostSprite = getChronoSphinxSprite(wingFrame, true);
    for (const img of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.15, img.life * 1.4);
      blitArenaPixelSprite(ctx, ghostSprite, img.x, img.y, sc * 1.24, 0);
      ctx.restore();
    }

    // 3. Main Royal Chrono-Sphinx
    blitArenaPixelSprite(
      ctx,
      getChronoSphinxSprite(wingFrame, this.blinkTelegraphTimer > 0),
      pos.x,
      pos.y,
      sc * 1.28,
      Math.sin(timeSeconds * 2.4) * 0.08
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}
