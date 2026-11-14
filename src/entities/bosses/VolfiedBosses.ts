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
  getOpticTailNodeSprite
} from '../../rendering/VolfiedSprites';
import { DroneBouncer } from '../enemies/DroneBouncer';
import { BaseBoss, BossUpdateContext } from './BaseBoss';

/**
 * Giant Armored Crustacean Mecha (`LOBSTER_MECHA`)
 * Features a fair `0.42s` visual wind-up telegraph before claw-dashing!
 */
export class LobsterMechaBoss extends BaseBoss {
  public readonly archetype = 'LOBSTER_MECHA' as const;
  public readonly displayName = 'LOBSTER MECHA';
  private fireTimer = 2.6;
  private dashCooldown = 3.4;
  private windupTimer = 0;
  private dashTimer = 0;
  private lockedAim = 0;
  private readonly elite: boolean;

  constructor(spawn: Point, maxHp = 7, elite = false) {
    super(spawn, 44, maxHp, elite ? 188 : 164, elite ? -166 : -144);
    this.elite = elite;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const tier = this.elite ? 1.15 : 1.0;

    if (this.windupTimer > 0) {
      this.windupTimer = Math.max(0, this.windupTimer - bctx.dt);
      if (this.windupTimer <= 0) {
        this.dashTimer = 0.58;
        const dashSpd = 268 * speedScale * tier;
        this.vx = Math.cos(this.lockedAim) * dashSpd;
        this.vy = Math.sin(this.lockedAim) * dashSpd;
      }
    } else if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - bctx.dt);
    } else {
      this.dashCooldown -= bctx.dt * speedScale * tier;
      if (this.dashCooldown <= 0 && bctx.playerState === 'CUTTING') {
        this.dashCooldown = this.elite ? 3.0 : 3.8;
        this.windupTimer = 0.42;
        this.lockedAim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      }
    }

    const desiredSpd =
      (this.windupTimer > 0 ? 58 : this.dashTimer > 0 ? 268 : 166) * speedScale * tier;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * desiredSpd;
    this.vy = (this.vy / norm) * desiredSpd;

    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.fireTimer -= bctx.dt * speedScale * tier;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.elite ? 2.2 : 2.7;
      const distToPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (distToPlayer >= 100 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
        const spd = 242 * speedScale;
        for (const off of [-0.22, 0.22]) {
          const a = aim + off;
          bctx.projectiles.spawnEnemyBullet(
            { x: this.x, y: this.y },
            Math.cos(a) * spd,
            Math.sin(a) * spd,
            PALETTE.CUT_ORANGE,
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
    const angle = this.windupTimer > 0 ? this.lockedAim : Math.atan2(this.vy, this.vx);
    if (this.windupTimer > 0) {
      ctx.save();
      ctx.strokeStyle = Math.floor(timeSeconds * 24) % 2 === 0 ? '#FFE066' : PALETTE.DANGER_RED;
      ctx.lineWidth = 4;
      ctx.strokeRect(pos.x - 46, pos.y - 46, 92, 92);
      ctx.restore();
    }
    const clawFrame: 0 | 1 =
      this.windupTimer > 0 || this.dashTimer > 0 || Math.floor(timeSeconds * 5) % 2 === 0 ? 1 : 0;
    const sprite = getLobsterMechaSprite(clawFrame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.34, angle);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Rotating Bio-Mechanical Wheel (`BIO_WHEEL`)
 */
export class BioWheelBoss extends BaseBoss {
  public readonly archetype = 'BIO_WHEEL' as const;
  public readonly displayName = 'BIO WHEEL';
  private fireTimer = 2.8;
  private ringOffset = 0;

  constructor(spawn: Point, maxHp = 8) {
    super(spawn, 42, maxHp, 188, 174);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const spd = 190 * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.fireTimer -= bctx.dt * speedScale;
    if (this.fireTimer <= 0) {
      this.fireTimer = 2.8;
      this.ringOffset += 0.35;
      if (pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const orbSpd = 228 * speedScale;
        for (let i = 0; i < 6; i++) {
          const a = this.ringOffset + (i * Math.PI) / 3;
          bctx.projectiles.spawnEnemyBullet(
            { x: this.x, y: this.y },
            Math.cos(a) * orbSpd,
            Math.sin(a) * orbSpd,
            '#FF58D8',
            5.5
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
 * Serrated Scythe Praying Mantis (`MANTIS`)
 * Telegraphs scythe lunges with a `0.42s` pause + warning flash!
 */
export class MantisBoss extends BaseBoss {
  public readonly archetype = 'MANTIS' as const;
  public readonly displayName = 'CYBER MANTIS';
  private lungeCooldown = 3.1;
  private windupTimer = 0;
  private lungeTimer = 0;
  private lockedAim = 0;
  private readonly elite: boolean;

  constructor(spawn: Point, maxHp = 8, elite = false) {
    super(spawn, 42, maxHp, 178, -164);
    this.elite = elite;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const tier = this.elite ? 1.16 : 1.0;

    if (this.windupTimer > 0) {
      this.windupTimer = Math.max(0, this.windupTimer - bctx.dt);
      if (this.windupTimer <= 0) {
        this.lungeTimer = 0.5;
        const lungeSpd = 295 * speedScale * tier;
        this.vx = Math.cos(this.lockedAim) * lungeSpd;
        this.vy = Math.sin(this.lockedAim) * lungeSpd;

        const distToPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
        if (distToPlayer >= 100 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
          const shotSpd = 258 * speedScale;
          for (const off of [-0.15, 0.15]) {
            const a = this.lockedAim + off;
            bctx.projectiles.spawnEnemyBullet(
              { x: this.x, y: this.y },
              Math.cos(a) * shotSpd,
              Math.sin(a) * shotSpd,
              '#C8FF78',
              5.5
            );
          }
        }
      }
    } else if (this.lungeTimer > 0) {
      this.lungeTimer = Math.max(0, this.lungeTimer - bctx.dt);
    } else {
      this.lungeCooldown -= bctx.dt * speedScale * tier;
      if (this.lungeCooldown <= 0) {
        this.lungeCooldown = this.elite ? 2.5 : 3.2;
        this.windupTimer = 0.42;
        this.lockedAim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      }
    }

    const spd =
      (this.windupTimer > 0 ? 52 : this.lungeTimer > 0 ? 295 : 176) * speedScale * tier;
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
    if (this.windupTimer > 0) {
      ctx.save();
      ctx.strokeStyle = Math.floor(timeSeconds * 24) % 2 === 0 ? '#C8FF78' : '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.strokeRect(pos.x - 44, pos.y - 44, 88, 88);
      ctx.restore();
    }
    const slashFrame: 0 | 1 =
      this.windupTimer > 0 || this.lungeTimer > 0 || Math.floor(timeSeconds * 6) % 2 === 1 ? 1 : 0;
    const sprite = getMantisSprite(slashFrame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.35, angle);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}

/**
 * Multi-Nucleus Bio-Amoeba (`MORPHING_CELL`)
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

    this.sporeTimer -= bctx.dt * speedScale;
    if (this.sporeTimer <= 0) {
      this.sporeTimer = 2.6;
      const distToPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (distToPlayer >= 100 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
        for (const off of [-0.3, 0, 0.3]) {
          const a = aim + off;
          bctx.projectiles.spawnEnemyBullet(
            { x: this.x, y: this.y },
            Math.cos(a) * 238 * speedScale,
            Math.sin(a) * 238 * speedScale,
            '#38F8A8',
            5.5
          );
        }
      }
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
 * Iconic Mechanical Skull (`CYBER_SKULL`)
 */
export class CyberSkullBoss extends BaseBoss {
  public readonly archetype = 'CYBER_SKULL' as const;
  public readonly displayName = 'CYBER SKULL';
  private salvoTimer = 2.5;
  private jawOpenTimer = 0;

  constructor(spawn: Point, maxHp = 12) {
    super(spawn, 46, maxHp, 178, 154);
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    if (this.jawOpenTimer > 0) {
      this.jawOpenTimer = Math.max(0, this.jawOpenTimer - bctx.dt);
    }

    const spd = 180 * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.salvoTimer -= bctx.dt * speedScale;
    if (this.salvoTimer <= 0) {
      this.salvoTimer = 2.45;
      this.jawOpenTimer = 0.65;
      const distToPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (distToPlayer >= 100 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
        const shotSpd = 264 * speedScale;
        for (const spread of [-0.26, 0, 0.26]) {
          const a = aim + spread;
          bctx.projectiles.spawnEnemyBullet(
            { x: this.x, y: this.y },
            Math.cos(a) * shotSpd,
            Math.sin(a) * shotSpd,
            PALETTE.DANGER_RED,
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
 * Veined Eyeball + Whipping Nerve Tail (`OPTIC_NERVE`)
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
    const spd = 198 * speedScale;
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
      const solved = resolvePolygonPenetration(node, 11 * this.renderScale, bctx.activePolygon);
      node.x = solved.position.x;
      node.y = solved.position.y;
      lx = node.x;
      ly = node.y;
    }

    this.beamTimer -= bctx.dt * speedScale;
    if (this.beamTimer <= 0) {
      this.beamTimer = 2.15;
      const distToPlayer = Math.hypot(bctx.playerPos.x - this.x, bctx.playerPos.y - this.y);
      if (distToPlayer >= 100 && pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
        const shotSpd = 278 * speedScale;
        bctx.projectiles.spawnEnemyBullet(
          { x: this.x, y: this.y },
          Math.cos(this.lookAngle) * shotSpd,
          Math.sin(this.lookAngle) * shotSpd,
          '#FF2848',
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
 * Tier Finale Boss: Armored Alien Brain Core (`ALIEN_BRAIN`, Stages 25, 50, 75, 100)
 */
export class AlienBrainBoss extends BaseBoss {
  public readonly archetype = 'ALIEN_BRAIN' as const;
  public readonly displayName = 'ALIEN BRAIN';
  private phaseTimer = 0;
  private barrageTimer = 2.0;
  private ringPhase = 0;

  constructor(spawn: Point, maxHp = 18) {
    super(spawn, 50, maxHp, 188, 166);
  }

  public get shuttersOpen(): boolean {
    return this.phaseTimer % 5.6 < 3.6 || this.enraged;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.phaseTimer += bctx.dt * speedScale;
    const spd = (this.shuttersOpen ? 196 : 160) * speedScale;
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * spd;
    this.vy = (this.vy / norm) * spd;
    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    if (this.shuttersOpen) {
      this.barrageTimer -= bctx.dt * speedScale;
      if (this.barrageTimer <= 0) {
        this.barrageTimer = this.enraged ? 1.65 : 2.05;
        this.ringPhase += 0.4;
        if (pointInPolygonStrict({ x: this.x, y: this.y }, bctx.activePolygon)) {
          const orbSpd = 252 * speedScale;
          for (let i = 0; i < 8; i++) {
            const a = this.ringPhase + (i * Math.PI) / 4;
            bctx.projectiles.spawnEnemyBullet(
              { x: this.x, y: this.y },
              Math.cos(a) * orbSpd,
              Math.sin(a) * orbSpd,
              i % 2 === 0 ? PALETTE.CUT_ORANGE : '#FF48C8',
              6
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
    const sprite = getAlienBrainSprite(this.shuttersOpen);
    const pulse = 1 + Math.sin(timeSeconds * 6) * 0.03;
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.28 * pulse, 0);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}
