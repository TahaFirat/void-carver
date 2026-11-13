import { PALETTE } from '../../core/Config';
import { resolvePolygonPenetration } from '../../geometry/PolygonMath';
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
  getOpticTailNodeSprite
} from '../../rendering/VolfiedSprites';
import { DroneBouncer } from '../enemies/DroneBouncer';
import { BaseBoss, BossUpdateContext } from './BaseBoss';

/**
 * Stage 02 & Stage 09: Giant Armored Crustacean Mecha (`LOBSTER_MECHA`)
 */
export class LobsterMechaBoss extends BaseBoss {
  public readonly archetype = 'LOBSTER_MECHA' as const;
  public readonly displayName = 'LOBSTER MECHA';
  private fireTimer = 2.4;
  private dashTimer = 0;
  private readonly elite: boolean;

  constructor(spawn: Point, maxHp = 7, elite = false) {
    super(spawn, 44, maxHp, elite ? 196 : 168, elite ? -172 : -148);
    this.elite = elite;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const tier = this.elite ? 1.18 : 1.0;
    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - bctx.dt);
    } else if (bctx.playerState === 'CUTTING' && Math.random() < bctx.dt * 0.9) {
      this.dashTimer = 0.65;
      const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      this.vx = Math.cos(aim) * 285 * speedScale * tier;
      this.vy = Math.sin(aim) * 285 * speedScale * tier;
    }

    const desiredSpd = (this.dashTimer > 0 ? 285 : 172) * speedScale * tier;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * desiredSpd;
    this.vy = (this.vy / norm) * desiredSpd;

    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.fireTimer -= bctx.dt * speedScale * tier;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.elite ? 2.0 : 2.5;
      const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      const spd = 255 * speedScale;
      for (const off of [-0.22, 0.22]) {
        const a = aim + off;
        bctx.projectiles.spawnEnemyBullet(
          { x: this.x + Math.cos(a) * 36, y: this.y + Math.sin(a) * 36 },
          Math.cos(a) * spd,
          Math.sin(a) * spd,
          PALETTE.CUT_ORANGE,
          6
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
    const angle = Math.atan2(this.vy, this.vx);
    const clawFrame: 0 | 1 =
      this.dashTimer > 0 || Math.floor(timeSeconds * 5) % 2 === 0 ? 1 : 0;
    const sprite = getLobsterMechaSprite(clawFrame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.34, angle);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Stage 03: Rotating Bio-Mechanical Wheel (`BIO_WHEEL`)
 */
export class BioWheelBoss extends BaseBoss {
  public readonly archetype = 'BIO_WHEEL' as const;
  public readonly displayName = 'BIO WHEEL';
  private fireTimer = 2.6;
  private ringOffset = 0;

  constructor(spawn: Point, maxHp = 8) {
    super(spawn, 42, maxHp, 195, 182);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const spd = 198 * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.fireTimer -= bctx.dt * speedScale;
    if (this.fireTimer <= 0) {
      this.fireTimer = 2.65;
      this.ringOffset += 0.35;
      const orbSpd = 235 * speedScale;
      for (let i = 0; i < 6; i++) {
        const a = this.ringOffset + (i * Math.PI) / 3;
        bctx.projectiles.spawnEnemyBullet(
          { x: this.x + Math.cos(a) * 34, y: this.y + Math.sin(a) * 34 },
          Math.cos(a) * orbSpd,
          Math.sin(a) * orbSpd,
          '#FF58D8',
          5.5
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
    const sprite = getBioWheelSprite(frame);
    blitArenaPixelSprite(
      ctx,
      sprite,
      pos.x,
      pos.y,
      this.renderScale * 1.35,
      timeSeconds * 2.8
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Stage 04 & Stage 11: Serrated Scythe Praying Mantis (`MANTIS`)
 */
export class MantisBoss extends BaseBoss {
  public readonly archetype = 'MANTIS' as const;
  public readonly displayName = 'CYBER MANTIS';
  private lungeCooldown = 2.8;
  private lungeTimer = 0;
  private readonly elite: boolean;

  constructor(spawn: Point, maxHp = 8, elite = false) {
    super(spawn, 42, maxHp, 185, -170);
    this.elite = elite;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const tier = this.elite ? 1.2 : 1.0;
    if (this.lungeTimer > 0) {
      this.lungeTimer = Math.max(0, this.lungeTimer - bctx.dt);
    } else {
      this.lungeCooldown -= bctx.dt * speedScale * tier;
      if (this.lungeCooldown <= 0) {
        this.lungeCooldown = this.elite ? 2.2 : 2.9;
        this.lungeTimer = 0.55;
        const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
        this.vx = Math.cos(aim) * 320 * speedScale * tier;
        this.vy = Math.sin(aim) * 320 * speedScale * tier;

        const shotSpd = 275 * speedScale;
        for (const off of [-0.14, 0.14]) {
          const a = aim + off;
          bctx.projectiles.spawnEnemyBullet(
            { x: this.x + Math.cos(a) * 34, y: this.y + Math.sin(a) * 34 },
            Math.cos(a) * shotSpd,
            Math.sin(a) * shotSpd,
            '#C8FF78',
            5.5
          );
        }
      }
    }

    const spd = (this.lungeTimer > 0 ? 320 : 182) * speedScale * tier;
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
    const angle = Math.atan2(this.vy, this.vx);
    const slashFrame: 0 | 1 =
      this.lungeTimer > 0 || Math.floor(timeSeconds * 6) % 2 === 1 ? 1 : 0;
    const sprite = getMantisSprite(slashFrame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.35, angle);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Stage 07: Multi-Nucleus Bio-Amoeba (`MORPHING_CELL`)
 */
export class MorphingCellBoss extends BaseBoss {
  public readonly archetype = 'MORPHING_CELL' as const;
  public readonly displayName = 'MORPHING CELL';
  private sporeTimer = 2.4;
  private summonTimer = 5.5;

  constructor(spawn: Point, maxHp = 10) {
    super(spawn, 42, maxHp, 174, 162);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const wobble = Math.sin(bctx.timeSeconds * 4.5) * 0.25 + 1.0;
    const spd = 176 * speedScale * wobble;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.sporeTimer -= bctx.dt * speedScale;
    if (this.sporeTimer <= 0) {
      this.sporeTimer = 2.45;
      const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      for (const off of [-0.3, 0, 0.3]) {
        const a = aim + off;
        bctx.projectiles.spawnEnemyBullet(
          { x: this.x, y: this.y },
          Math.cos(a) * 245 * speedScale,
          Math.sin(a) * 245 * speedScale,
          '#38F8A8',
          5.5
        );
      }
    }

    this.summonTimer -= bctx.dt * speedScale;
    if (this.summonTimer <= 0) {
      this.summonTimer = 6.5;
      if (bctx.currentMinionCount < 5) {
        bctx.summonMinion(new DroneBouncer({ x: this.x, y: this.y }, 195));
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
 * Stage 10: Iconic Mechanical Skull (`CYBER_SKULL`)
 */
export class CyberSkullBoss extends BaseBoss {
  public readonly archetype = 'CYBER_SKULL' as const;
  public readonly displayName = 'CYBER SKULL';
  private salvoTimer = 2.3;
  private jawOpenTimer = 0;

  constructor(spawn: Point, maxHp = 12) {
    super(spawn, 46, maxHp, 184, 158);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    if (this.jawOpenTimer > 0) {
      this.jawOpenTimer = Math.max(0, this.jawOpenTimer - bctx.dt);
    }

    const spd = 186 * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.salvoTimer -= bctx.dt * speedScale;
    if (this.salvoTimer <= 0) {
      this.salvoTimer = 2.25;
      this.jawOpenTimer = 0.65;
      const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      const shotSpd = 278 * speedScale;
      for (const spread of [-0.26, 0, 0.26]) {
        const a = aim + spread;
        bctx.projectiles.spawnEnemyBullet(
          { x: this.x, y: this.y + 24 * this.renderScale },
          Math.cos(a) * shotSpd,
          Math.sin(a) * shotSpd,
          PALETTE.DANGER_RED,
          6
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
    const jawOpen = this.jawOpenTimer > 0 || this.salvoTimer < 0.35;
    const sprite = getCyberSkullSprite(jawOpen);
    blitArenaPixelSprite(
      ctx,
      sprite,
      pos.x,
      pos.y,
      this.renderScale * 1.28,
      Math.sin(timeSeconds * 2.4) * 0.08
    );
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Stage 12: Veined Eyeball + Whipping Nerve Tail (`OPTIC_NERVE`)
 */
export class OpticNerveBoss extends BaseBoss {
  public readonly archetype = 'OPTIC_NERVE' as const;
  public readonly displayName = 'OPTIC NERVE';
  private readonly tailNodes: { x: number; y: number }[] = [];
  private beamTimer = 1.95;
  private lookAngle = 0;

  constructor(spawn: Point, maxHp = 13) {
    super(spawn, 40, maxHp, 206, -184);
    for (let i = 0; i < 6; i++) {
      this.tailNodes.push({ x: spawn.x - (i + 1) * 18, y: spawn.y });
    }
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.lookAngle = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
    const spd = 208 * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    // Update 6 whipping optic nerve tail nodes behind opposite side of iris!
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
      const solved = resolvePolygonPenetration(node, 10 * this.renderScale, bctx.activePolygon);
      node.x = solved.position.x;
      node.y = solved.position.y;
      lx = node.x;
      ly = node.y;
    }

    this.beamTimer -= bctx.dt * speedScale;
    if (this.beamTimer <= 0) {
      this.beamTimer = 1.95;
      const shotSpd = 295 * speedScale;
      bctx.projectiles.spawnEnemyBullet(
        {
          x: this.x + Math.cos(this.lookAngle) * 30 * this.renderScale,
          y: this.y + Math.sin(this.lookAngle) * 30 * this.renderScale
        },
        Math.cos(this.lookAngle) * shotSpd,
        Math.sin(this.lookAngle) * shotSpd,
        '#FF2848',
        6
      );
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
 * Stage 16 Final Boss: Armored Alien Brain Core (`ALIEN_BRAIN`, `18 HP`)
 */
export class AlienBrainBoss extends BaseBoss {
  public readonly archetype = 'ALIEN_BRAIN' as const;
  public readonly displayName = 'ALIEN BRAIN';
  private phaseTimer = 0;
  private barrageTimer = 1.8;
  private ringPhase = 0;

  constructor(spawn: Point, maxHp = 18) {
    super(spawn, 50, maxHp, 194, 172);
  }

  public get shuttersOpen(): boolean {
    return this.phaseTimer % 5.6 < 3.6 || this.enraged;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.phaseTimer += bctx.dt * speedScale;
    const spd = (this.shuttersOpen ? 204 : 165) * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    if (this.shuttersOpen) {
      this.barrageTimer -= bctx.dt * speedScale;
      if (this.barrageTimer <= 0) {
        this.barrageTimer = this.enraged ? 1.45 : 1.85;
        this.ringPhase += 0.4;
        const orbSpd = 268 * speedScale;
        for (let i = 0; i < 8; i++) {
          const a = this.ringPhase + (i * Math.PI) / 4;
          bctx.projectiles.spawnEnemyBullet(
            { x: this.x + Math.cos(a) * 40, y: this.y + Math.sin(a) * 40 },
            Math.cos(a) * orbSpd,
            Math.sin(a) * orbSpd,
            i % 2 === 0 ? PALETTE.CUT_ORANGE : '#FF48C8',
            6
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
    const sprite = getAlienBrainSprite(this.shuttersOpen);
    const pulse = 1 + Math.sin(timeSeconds * 6) * 0.03;
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.28 * pulse, 0);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}
