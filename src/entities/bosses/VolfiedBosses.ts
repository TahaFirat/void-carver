import { PALETTE } from '../../core/Config';
import { pointInPolygonStrict, resolvePolygonPenetration } from '../../geometry/PolygonMath';
import { bounceCircleOffSolidBoxes, SolidRect } from '../../geometry/SolidBoxes';
import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import {
  getAlienBrainSprite,
  getBioWheelSprite,
  getCyberSkullSprite,
  getLobsterMechaSprite,
  getMantisSprite,
  getMorphingCellSprite,
  getOpticNerveBodySprite,
  getOpticTailNodeSprite,
  getPinballFrogSprite,
  getPincerBeetleSprite,
  getSniperLadybirdSprite
} from '../../rendering/VolfiedSprites';
import { DroneBouncer } from '../enemies/DroneBouncer';
import { HomingMissileMinion, SawBladeMinion } from '../enemies/VolfiedMinions';
import { BaseBoss, BossUpdateContext } from './BaseBoss';

/**
 * V7 Group C #2 — Hydraulic Armored Crustacean (`ArmoredCrustacean` / `LOBSTER_MECHA`):
 * - Phase 1: Heavy armored patrol + pincer plasma shots.
 * - Phase 2 (`SHELL_DROP_SCISSOR_DASH` — Wave 6+ `ORTA` / `ZOR` when `>= 65%` claimed or `<= 50%` HP):
 *   Drops its dorsal shell onto the arena as a **permanent solid wall obstacle** (`spawnSolidObstacle`)
 *   and performs lightning-fast diagonal `Scissor Dash`es toward the player's cut line!
 */
export class LobsterMechaBoss extends BaseBoss {
  public readonly archetype = 'LOBSTER_MECHA' as const;
  public readonly displayName = 'ARMORED CRUSTACEAN';
  private fireTimer = 2.4;
  private dashCooldown = 2.6;
  private windupTimer = 0;
  private dashTimer = 0;
  private lockedAim = 0;
  public shellDropped = false;
  public canEvolveShellDrop: boolean;

  constructor(spawn: Point, maxHp = 8, canEvolveShellDrop = false) {
    super(spawn, 44, maxHp, 156, -138);
    this.canEvolveShellDrop = canEvolveShellDrop;
  }

  public triggerShellDrop(bctx?: Pick<BossUpdateContext, 'spawnSolidObstacle'>): Point | null {
    if (this.shellDropped) return null;
    this.shellDropped = true;
    this.combatPhase = 2;
    const dropPos = { x: this.x, y: this.y };
    bctx?.spawnSolidObstacle?.(dropPos);
    return dropPos;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    if (
      !this.shellDropped &&
      (this.combatPhase >= 2 ||
        (this.canEvolveShellDrop && (bctx.claimedPercent >= 65 || this.hp <= this.maxHp * 0.5)))
    ) {
      this.triggerShellDrop(bctx);
    }

    if (this.shellDropped) {
      if (this.windupTimer > 0) {
        this.windupTimer = Math.max(0, this.windupTimer - bctx.dt);
        if (this.windupTimer <= 0) {
          this.dashTimer = 0.55;
          const dashSpd = 340 * speedScale;
          this.vx = Math.cos(this.lockedAim) * dashSpd;
          this.vy = Math.sin(this.lockedAim) * dashSpd;
        }
      } else if (this.dashTimer > 0) {
        this.dashTimer = Math.max(0, this.dashTimer - bctx.dt);
      } else {
        this.dashCooldown -= bctx.dt;
        if (this.dashCooldown <= 0) {
          this.dashCooldown = 2.1;
          this.windupTimer = 0.34;
          const rawAim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
          // Snap toward sharp diagonal scissor vector
          const diag = Math.round((rawAim - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
          this.lockedAim = bctx.playerState === 'CUTTING' ? rawAim : diag;
        }
      }
    }

    const desiredSpd =
      (this.windupTimer > 0 ? 48 : this.dashTimer > 0 ? 340 : this.shellDropped ? 225 : 152) *
      speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * desiredSpd;
    this.vy = (this.vy / norm) * desiredSpd;

    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.fireTimer -= bctx.dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.phaseBehavior?.fireIntervalSec ?? 2.4;
      this.firePhasePattern(bctx, speedScale, PALETTE.CUT_ORANGE);
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const angle = this.windupTimer > 0 ? this.lockedAim : Math.atan2(this.vy, this.vx);

    if (this.shellDropped) {
      this.renderPhaseAuraAndWings(ctx, pos.x, pos.y, timeSeconds);
    }

    if (this.windupTimer > 0) {
      ctx.save();
      ctx.strokeStyle = Math.floor(timeSeconds * 24) % 2 === 0 ? '#FFE066' : PALETTE.DANGER_RED;
      ctx.beginPath();
      ctx.setLineDash([12, 8]);
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(
        pos.x + Math.cos(this.lockedAim) * 300,
        pos.y + Math.sin(this.lockedAim) * 300
      );
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();
    }

    const clawFrame: 0 | 1 =
      this.windupTimer > 0 || this.dashTimer > 0 || Math.floor(timeSeconds * 6) % 2 === 0 ? 1 : 0;
    const sprite = getLobsterMechaSprite(clawFrame);
    blitArenaPixelSprite(
      ctx,
      sprite,
      pos.x,
      pos.y,
      this.renderScale * (this.shellDropped ? 1.18 : 1.34),
      angle
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * V7 Group A #2 — Original Stage 3 8-Directional Bio-Wheel (`AllDirBioWheel` / `BIO_WHEEL`):
 * Fires rhythmic **simultaneous 8-way (`360°` ring)** bullet bursts! Any bullet touching `activeTrail`
 * ignites an Electric Shock — player must time cuts between ring volleys!
 */
export class BioWheelBoss extends BaseBoss {
  public readonly archetype = 'BIO_WHEEL' as const;
  public readonly displayName = 'BIO WHEEL';
  private ringTimer = 2.3;
  private ringPhaseOffset = 0;

  constructor(spawn: Point, maxHp = 8) {
    super(spawn, 42, maxHp, 182, 168);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const pausing = this.ringTimer > 0 && this.ringTimer < 0.38;
    const spd = (pausing ? 26 : 182) * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.ringTimer -= bctx.dt;
    if (this.ringTimer <= 0) {
      this.ringTimer = this.phaseBehavior?.fireIntervalSec ?? 2.35;
      const distToPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (distToPlayer >= 95 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const bSpd = 228 * Math.min(1.38, speedScale);
        this.ringPhaseOffset = this.ringPhaseOffset === 0 ? Math.PI / 8 : 0;
        for (let i = 0; i < 8; i++) {
          const ang = this.ringPhaseOffset + (i * Math.PI) / 4;
          this.spawnBossBullet(
            bctx,
            Math.cos(ang) * bSpd,
            Math.sin(ang) * bSpd,
            i % 2 === 0 ? '#FF58D8' : '#78FF68',
            5.8
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
    const frame: 0 | 1 = Math.floor(timeSeconds * 8) % 2 === 0 ? 0 : 1;
    const sprite = getBioWheelSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.35, timeSeconds * 3.0);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * V7 Group A #3 — Original Stage 4 Scissor-Firing Beetle (`PincerBeetle` / `PINCER_BEETLE`):
 * Alternates two signature volleys in strict rhythm:
 * 1) Wide 5-bullet forward fan toward the player's border
 * 2) Simultaneous pure `UP` + pure `DOWN` vertical twin plasma scissor columns!
 */
export class PincerBeetleBoss extends BaseBoss {
  public readonly archetype = 'PINCER_BEETLE' as const;
  public readonly displayName = 'PINCER BEETLE';
  private volleyTimer = 1.9;
  private nextIsVerticalScissor = false;

  constructor(spawn: Point, maxHp = 8) {
    super(spawn, 42, maxHp, 174, -158);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const spd = 174 * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.volleyTimer -= bctx.dt;
    if (this.volleyTimer <= 0) {
      const baseInt = this.phaseBehavior?.fireIntervalSec ?? 2.2;
      this.volleyTimer = this.nextIsVerticalScissor ? baseInt * 0.85 : baseInt * 0.55;
      if (pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const bSpd = 248 * Math.min(1.38, speedScale);
        if (!this.nextIsVerticalScissor) {
          // Volley A: 5-way forward fan
          const aim = this.resolveDifficultyAimAngle(bctx, bSpd);
          for (const off of [-0.48, -0.24, 0, 0.24, 0.48]) {
            const a = aim + off;
            this.spawnBossBullet(bctx, Math.cos(a) * bSpd, Math.sin(a) * bSpd, '#FFB830', 5.8);
          }
        } else {
          // Volley B: Simultaneous UP + DOWN twin vertical plasma scissor columns!
          for (const xOff of [-12, 12]) {
            bctx.projectiles.spawnEnemyBullet(
              { x: this.x + xOff, y: this.y },
              0,
              -bSpd * 1.12,
              '#50F4FF',
              6,
              0,
              -1,
              true
            );
            bctx.projectiles.spawnEnemyBullet(
              { x: this.x + xOff, y: this.y },
              0,
              bSpd * 1.12,
              '#50F4FF',
              6,
              0,
              -1,
              true
            );
          }
        }
        this.nextIsVerticalScissor = !this.nextIsVerticalScissor;
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
    const frame: 0 | 1 = Math.floor(timeSeconds * 7) % 2 === 0 ? 0 : 1;
    const angle = Math.atan2(this.vy, this.vx);
    const sprite = getPincerBeetleSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.34, angle);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * V7 Group A #4 — Original Stage 5 Sniper Ladybird (`SniperLadybird` / `SNIPER_LADYBIRD`):
 * Drifts preferentially toward the lower corners of `activePolygon` and fires high-velocity
 * precision sniper rounds directly at the player's exact coordinate! Escorted by 4 `YellowSwarmer`s!
 */
export class SniperLadybirdBoss extends BaseBoss {
  public readonly archetype = 'SNIPER_LADYBIRD' as const;
  public readonly displayName = 'SNIPER LADYBIRD';
  private snipeTimer = 2.0;
  private cornerSwitchTimer = 4.2;
  private preferRightCorner = true;

  constructor(spawn: Point, maxHp = 8) {
    super(spawn, 38, maxHp, 168, 152);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.cornerSwitchTimer -= bctx.dt;
    if (this.cornerSwitchTimer <= 0) {
      this.cornerSwitchTimer = 4.5;
      this.preferRightCorner = !this.preferRightCorner;
    }

    // Gentle drift bias toward lower corners while bouncing naturally inside `activePolygon`
    const anchorX = this.preferRightCorner ? 720 : 180;
    const anchorY = 980;
    const dx = anchorX - this.x;
    const dy = anchorY - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.vx += (dx / dist) * 75 * bctx.dt;
    this.vy += (dy / dist) * 75 * bctx.dt;

    const spd = 168 * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.snipeTimer -= bctx.dt;
    if (this.snipeTimer <= 0) {
      this.snipeTimer = (this.phaseBehavior?.fireIntervalSec ?? 2.1) * 0.9;
      const dPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (dPlayer >= 95 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const snipeSpd = 325 * Math.min(1.4, speedScale);
        // Sniper Ladybird ALWAYS aims directly at exact coordinate (or lead-aim on ZOR)!
        const exactAim =
          bctx.aimMode === 'PREDICTIVE_LEAD_AIM'
            ? this.resolveDifficultyAimAngle(bctx, snipeSpd)
            : Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
        this.spawnBossBullet(
          bctx,
          Math.cos(exactAim) * snipeSpd,
          Math.sin(exactAim) * snipeSpd,
          '#FFF058',
          6.2
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
    const frame: 0 | 1 = Math.floor(timeSeconds * 8) % 2 === 0 ? 0 : 1;
    const aimToPlayer = Math.atan2(this.vy, this.vx) + Math.PI * 0.5;
    const sprite = getSniperLadybirdSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.32, aimToPlayer);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * V7 Group A #5 — Original Small Hyper-Agile Pinball Boss (`PinballFrogCore` / `PINBALL_FROG`):
 * Much smaller (`26px` radius!) and much faster (`315 px/s` base!) than standard Bosses — slips
 * out of narrow corridors like a pinball and deploys `HomingMissileMinion`s!
 */
export class PinballFrogBoss extends BaseBoss {
  public readonly archetype = 'PINBALL_FROG' as const;
  public readonly displayName = 'PINBALL CORE';
  private fireTimer = 2.2;
  private missileSummonTimer = 7.5;

  constructor(spawn: Point, maxHp = 7) {
    super(spawn, 26, maxHp, 245, -225);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const spd = 315 * speedScale;
    if (Math.abs(this.vx) < spd * 0.3) this.vx = (this.vx >= 0 ? 1 : -1) * spd * 0.55;
    if (Math.abs(this.vy) < spd * 0.3) this.vy = (this.vy >= 0 ? 1 : -1) * spd * 0.55;

    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.fireTimer -= bctx.dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.phaseBehavior?.fireIntervalSec ?? 2.3;
      this.firePhasePattern(bctx, speedScale, '#58FF88');
    }

    this.missileSummonTimer -= bctx.dt * speedScale;
    if (this.missileSummonTimer <= 0) {
      this.missileSummonTimer = 8.0;
      if (
        bctx.currentMinionCount < 4 &&
        pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)
      ) {
        bctx.summonMinion(new HomingMissileMinion({ x: this.x, y: this.y }, 195));
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
    const frame: 0 | 1 = Math.floor(timeSeconds * 14) % 2 === 0 ? 0 : 1;
    const sprite = getPinballFrogSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.28, timeSeconds * 5.2);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Serrated Scythe Praying Mantis (`MANTIS` — Campaign support)
 */
export class MantisBoss extends BaseBoss {
  public readonly archetype = 'MANTIS' as const;
  public readonly displayName = 'CYBER MANTIS';
  private lungeCooldown = 2.9;
  private windupTimer = 0;
  private lungeTimer = 0;
  private lockedAim = 0;
  private readonly elite: boolean;

  constructor(spawn: Point, maxHp = 8, elite = false) {
    super(spawn, 42, maxHp, 178, -164);
    this.elite = elite;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const tier = this.elite ? 1.12 : 1.0;
    if (this.windupTimer > 0) {
      this.windupTimer = Math.max(0, this.windupTimer - bctx.dt);
      if (this.windupTimer <= 0) {
        this.lungeTimer = 0.5;
        const lungeSpd = 290 * speedScale * tier;
        this.vx = Math.cos(this.lockedAim) * lungeSpd;
        this.vy = Math.sin(this.lockedAim) * lungeSpd;
        this.firePhasePattern(bctx, speedScale, '#C8FF78');
      }
    } else if (this.lungeTimer > 0) {
      this.lungeTimer = Math.max(0, this.lungeTimer - bctx.dt);
    } else {
      this.lungeCooldown -= bctx.dt;
      if (this.lungeCooldown <= 0) {
        this.lungeCooldown = this.phaseBehavior?.fireIntervalSec ?? 2.8;
        this.windupTimer = 0.42;
        this.lockedAim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      }
    }

    const spd =
      (this.windupTimer > 0 ? 50 : this.lungeTimer > 0 ? 290 : 172) * speedScale * tier;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
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
    const angle = this.windupTimer > 0 ? this.lockedAim : Math.atan2(this.vy, this.vx);
    const slashFrame: 0 | 1 =
      this.windupTimer > 0 || this.lungeTimer > 0 || Math.floor(timeSeconds * 6) % 2 === 1 ? 1 : 0;
    const sprite = getMantisSprite(slashFrame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.35, angle);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Multi-Nucleus Bio-Amoeba (`MORPHING_CELL` — Campaign support)
 */
export class MorphingCellBoss extends BaseBoss {
  public readonly archetype = 'MORPHING_CELL' as const;
  public readonly displayName = 'MORPHING CELL';
  private sporeTimer = 2.6;
  private summonTimer = 6.5;

  constructor(spawn: Point, maxHp = 10) {
    super(spawn, 42, maxHp, 170, 158);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const wobble = Math.sin(bctx.timeSeconds * 4.5) * 0.22 + 1.0;
    const spd = 172 * speedScale * wobble;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.sporeTimer -= bctx.dt;
    if (this.sporeTimer <= 0) {
      this.sporeTimer = this.phaseBehavior?.fireIntervalSec ?? 2.6;
      this.firePhasePattern(bctx, speedScale, '#38F8A8');
    }

    this.summonTimer -= bctx.dt * speedScale;
    if (this.summonTimer <= 0) {
      this.summonTimer = 7.2;
      if (
        bctx.currentMinionCount < 4 &&
        pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)
      ) {
        bctx.summonMinion(new DroneBouncer({ x: this.x, y: this.y }, 182));
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
    const frame: 0 | 1 = Math.floor(timeSeconds * 5) % 2 === 0 ? 0 : 1;
    const pulse = 1 + Math.sin(timeSeconds * 7) * 0.06;
    const sprite = getMorphingCellSprite(frame);
    blitArenaPixelSprite(
      ctx,
      sprite,
      pos.x,
      pos.y,
      this.renderScale * 1.35 * pulse,
      Math.sin(timeSeconds * 1.8) * 0.22
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * V7 Group C #3 — Cybernetic Skull (`CyberTitanSkull` / `CYBER_SKULL`):
 * **"Sahte Zafer / Son Direniş" (`False Victory / Last Stand`)**:
 * When `canEvolveLastStand === true` (Wave 10+ `ORTA` / Wave 5+ `ZOR`) and the player reaches
 * `targetPercent` (`82%` / `85%`), the wave does **NOT** end! The metal faceplate shatters,
 * exposing the mechanical brain & rotating twin eye laser beams for a **`10.0s` OR `90%` Last Stand**!
 */
export class CyberSkullBoss extends BaseBoss {
  public readonly archetype = 'CYBER_SKULL' as const;
  public readonly displayName = 'CYBER TITAN SKULL';
  private salvoTimer = 2.2;
  private jawOpenTimer = 0;
  private eyeSweepAngle = 0;
  public canEvolveLastStand: boolean;
  public inLastStand = false;
  public lastStandRemainingSec = 10.0;
  public lastStandCompleted = false;

  constructor(spawn: Point, maxHp = 12, canEvolveLastStand = false) {
    super(spawn, 46, maxHp, 178, 154);
    this.canEvolveLastStand = canEvolveLastStand;
  }

  public triggerLastStand(durationSec = 10.0): boolean {
    if (this.inLastStand || this.lastStandCompleted || !this.canEvolveLastStand) return false;
    this.inLastStand = true;
    this.lastStandRemainingSec = durationSec;
    this.combatPhase = 2;
    this.salvoTimer = 0.25;
    return true;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    if (this.jawOpenTimer > 0) {
      this.jawOpenTimer = Math.max(0, this.jawOpenTimer - bctx.dt);
    }

    if (this.inLastStand && !this.lastStandCompleted) {
      this.lastStandRemainingSec = Math.max(0, this.lastStandRemainingSec - bctx.dt);
      this.eyeSweepAngle += bctx.dt * 2.8;
      if (this.lastStandRemainingSec <= 0 || bctx.claimedPercent >= 90) {
        this.lastStandCompleted = true;
      }
    }

    const spd = (this.inLastStand ? 235 : 178) * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.salvoTimer -= bctx.dt;
    if (this.salvoTimer <= 0) {
      this.salvoTimer = this.inLastStand
        ? 0.65
        : (this.phaseBehavior?.fireIntervalSec ?? 2.3);
      this.jawOpenTimer = 0.65;

      if (this.inLastStand) {
        // Twin rotating eye laser beams!
        const bSpd = 265 * Math.min(1.4, speedScale);
        for (const eyeSign of [-1, 1]) {
          const a = this.eyeSweepAngle + (eyeSign < 0 ? 0 : Math.PI);
          bctx.projectiles.spawnEnemyBullet(
            { x: this.x + eyeSign * 12, y: this.y - 4 },
            Math.cos(a) * bSpd,
            Math.sin(a) * bSpd,
            '#FF2838',
            6.2,
            0,
            -1,
            true
          );
        }
      } else {
        this.firePhasePattern(bctx, speedScale, PALETTE.DANGER_RED);
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
    if (this.inLastStand || this.combatPhase >= 2) {
      this.renderPhaseAuraAndWings(ctx, pos.x, pos.y, timeSeconds);
    }

    const jawOpen = this.inLastStand || this.jawOpenTimer > 0 || this.salvoTimer < 0.35;
    const sprite = getCyberSkullSprite(jawOpen);
    blitArenaPixelSprite(
      ctx,
      sprite,
      pos.x,
      pos.y,
      this.renderScale * 1.28,
      Math.sin(timeSeconds * (this.inLastStand ? 6.5 : 2.4)) * 0.09
    );

    if (this.inLastStand) {
      // Exposed glowing red-cyan mechanical brain crown!
      ctx.save();
      ctx.fillStyle = Math.floor(timeSeconds * 18) % 2 === 0 ? '#FF2848' : '#50F8FF';
      ctx.fillRect(Math.round(pos.x - 14), Math.round(pos.y - 24), 28, 10);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(Math.round(pos.x - 8), Math.round(pos.y - 22), 16, 5);
      ctx.restore();
    }

    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Veined Eyeball + Whipping Nerve Tail (`OPTIC_NERVE` — Campaign support)
 */
export class OpticNerveBoss extends BaseBoss {
  public readonly archetype = 'OPTIC_NERVE' as const;
  public readonly displayName = 'OPTIC NERVE';
  private readonly tailNodes: { x: number; y: number; vx: number; vy: number }[] = [];
  private beamTimer = 2.15;
  private lookAngle = 0;

  constructor(spawn: Point, maxHp = 13) {
    super(spawn, 40, maxHp, 198, -176);
    for (let i = 0; i < 6; i++) {
      this.tailNodes.push({ x: spawn.x - (i + 1) * 18, y: spawn.y, vx: 0, vy: 0 });
    }
  }

  public bounceTailOffBoxes(boxes: readonly SolidRect[], activePolygon: readonly Point[]): void {
    if (boxes.length === 0) return;
    for (const node of this.tailNodes) {
      if (bounceCircleOffSolidBoxes(node, 10 * this.renderScale, boxes)) {
        const solved = resolvePolygonPenetration(node, 11 * this.renderScale, activePolygon);
        node.x = solved.position.x;
        node.y = solved.position.y;
      }
    }
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.lookAngle = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
    const spd = 194 * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    let lx = this.x - Math.cos(this.lookAngle) * 20 * this.renderScale;
    let ly = this.y - Math.sin(this.lookAngle) * 20 * this.renderScale;
    const nodeSpacing = 17 * this.renderScale;
    for (let i = 0; i < this.tailNodes.length; i++) {
      const node = this.tailNodes[i];
      const dx = lx - node.x;
      const dy = ly - node.y;
      const d = Math.hypot(dx, dy) || 1;
      node.x = lx - (dx / d) * nodeSpacing;
      node.y = ly - (dy / d) * nodeSpacing;
      const solved = resolvePolygonPenetration(node, 11 * this.renderScale, bctx.activePolygon);
      node.x = solved.position.x;
      node.y = solved.position.y;
      lx = node.x;
      ly = node.y;
    }

    this.beamTimer -= bctx.dt;
    if (this.beamTimer <= 0) {
      this.beamTimer = this.phaseBehavior?.fireIntervalSec ?? 2.15;
      this.firePhasePattern(bctx, speedScale, '#FF2848');
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number,
    bossCannonArmed = false
  ): void {
    const pos = this.getRenderPos(alpha);
    const nodeSprite = getOpticTailNodeSprite();
    for (let i = this.tailNodes.length - 1; i >= 0; i--) {
      const taper = Math.max(0.65, 1 - i * 0.08);
      blitArenaPixelSprite(
        ctx,
        nodeSprite,
        this.tailNodes[i].x,
        this.tailNodes[i].y,
        this.renderScale * 1.2 * taper
      );
    }

    const frame: 0 | 1 = Math.floor(timeSeconds * 6) % 2 === 0 ? 0 : 1;
    const eyeSprite = getOpticNerveBodySprite(frame);
    blitArenaPixelSprite(
      ctx,
      eyeSprite,
      pos.x,
      pos.y,
      this.renderScale * 1.32,
      this.lookAngle
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * V7 Group C #4 — Deep-Wave Secret Planet Brain (`AbyssalOvermind` / `ALIEN_BRAIN`):
 * At `>= 60%` claimed area, detaches its 4 steel armor shutters into the arena as
 * **4 independent ricocheting `SawBladeMinion`s** while opening a continuous spiral bullet curtain!
 */
export class AlienBrainBoss extends BaseBoss {
  public readonly archetype = 'ALIEN_BRAIN' as const;
  public readonly displayName = 'ABYSSAL OVERMIND';
  private phaseTimer = 0;
  private barrageTimer = 1.9;
  public canDetachPlates: boolean;
  public platesDetached = false;

  constructor(spawn: Point, maxHp = 18, canDetachPlates = true) {
    super(spawn, 50, maxHp, 184, 162);
    this.canDetachPlates = canDetachPlates;
  }

  public get shuttersOpen(): boolean {
    return this.platesDetached || this.combatPhase >= 2 || this.phaseTimer % 5.6 < 3.6;
  }

  public detachArmorSawBlades(bctx: Pick<BossUpdateContext, 'summonMinion'>): number {
    if (this.platesDetached) return 0;
    this.platesDetached = true;
    this.combatPhase = 2;
    const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
    for (const ang of angles) {
      bctx.summonMinion(
        new SawBladeMinion(
          { x: this.x + Math.cos(ang) * 28, y: this.y + Math.sin(ang) * 28 },
          ang,
          268
        )
      );
    }
    return 4;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.phaseTimer += bctx.dt * speedScale;

    if (
      !this.platesDetached &&
      (this.combatPhase >= 2 || (this.canDetachPlates && bctx.claimedPercent >= 55))
    ) {
      this.detachArmorSawBlades(bctx);
    }

    const spd = (this.platesDetached ? 210 : this.shuttersOpen ? 186 : 156) * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    if (this.shuttersOpen) {
      this.barrageTimer -= bctx.dt;
      if (this.barrageTimer <= 0) {
        this.barrageTimer = this.platesDetached
          ? 1.15
          : (this.phaseBehavior?.fireIntervalSec ?? 1.85);
        if (this.platesDetached) {
          this.spiralPhaseAngle += 0.42;
          const bSpd = 235 * Math.min(1.4, speedScale);
          for (let i = 0; i < 8; i++) {
            const a = this.spiralPhaseAngle + (i * Math.PI) / 4;
            this.spawnBossBullet(
              bctx,
              Math.cos(a) * bSpd,
              Math.sin(a) * bSpd,
              i % 2 === 0 ? '#FF48C8' : '#58F4FF',
              5.8
            );
          }
        } else {
          this.firePhasePattern(bctx, speedScale, '#FF48C8');
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
    if (this.platesDetached || this.combatPhase >= 2) {
      this.renderPhaseAuraAndWings(ctx, pos.x, pos.y, timeSeconds);
    }

    const sprite = getAlienBrainSprite(this.shuttersOpen);
    const pulse = 1 + Math.sin(timeSeconds * 6) * 0.03;
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.28 * pulse, 0);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}
