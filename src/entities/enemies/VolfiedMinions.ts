import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import {
  getSawBladeMinionSprite,
  getSpikeMineSprite,
  getYellowSwarmerSprite
} from '../../rendering/VolfiedSprites';
import { InteriorMinion, MinionContext } from './BaseMinion';

/**
 * Wave 2+ Fast Yellow Swarmer Insect (`16px` radius):
 * Darts in snappy zig-zags while player is shielded; swarms aggressively when player cuts!
 */
export class YellowSwarmer extends InteriorMinion {
  public readonly kind = 'SWARMER' as const;
  public readonly baseSpeed: number;
  private zigTimer: number;

  constructor(pos: Point, speed = 205) {
    const ang = Math.random() * Math.PI * 2;
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 16);
    this.baseSpeed = speed;
    this.zigTimer = 0.65 + Math.random() * 0.7;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (!this.applySwarmAggro(mctx, this.baseSpeed)) {
      const targetSpd = this.baseSpeed * mctx.speedScale;
      this.currentSpeed = targetSpd;
      this.zigTimer -= mctx.dt;
      if (this.zigTimer <= 0) {
        this.zigTimer = 0.7 + Math.random() * 0.75;
        const turn = (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.55);
        const nextAng = Math.atan2(this.vy, this.vx) + turn;
        this.vx = Math.cos(nextAng) * targetSpd;
        this.vy = Math.sin(nextAng) * targetSpd;
      } else {
        const spd = Math.hypot(this.vx, this.vy) || 1;
        this.vx = (this.vx / spd) * targetSpd;
        this.vy = (this.vy / spd) * targetSpd;
      }
    }

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 20) % 2 === 0 ? 0 : 1;
    const sprite = getYellowSwarmerSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, 1.12);
  }
}

/**
 * Wave 4+ Homing Spike-Mine Creature (`17px` radius):
 *Cruises with periodic thruster locks; surges at extreme speed onto open cuts!
 */
export class HomingMissileMinion extends InteriorMinion {
  public readonly kind = 'MISSILE' as const;
  public readonly baseSpeed: number;
  private lockCooldown = 1.8;

  constructor(pos: Point, speed = 192) {
    const ang = Math.random() * Math.PI * 2;
    super(pos, Math.cos(ang) * speed, Math.sin(ang) * speed, 17);
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (!this.applySwarmAggro(mctx, this.baseSpeed)) {
      const targetSpd = this.baseSpeed * mctx.speedScale;
      this.currentSpeed = targetSpd;
      this.lockCooldown -= mctx.dt;
      if (this.lockCooldown <= 0) {
        this.lockCooldown = 1.9 + Math.random() * 0.9;
        const dx = mctx.playerPos.x - this.x;
        const dy = mctx.playerPos.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        const mix = 0.55;
        const mx = this.vx * (1 - mix) + (dx / dist) * targetSpd * mix;
        const my = this.vy * (1 - mix) + (dy / dist) * targetSpd * mix;
        const n = Math.hypot(mx, my) || 1;
        this.vx = (mx / n) * targetSpd;
        this.vy = (my / n) * targetSpd;
      } else {
        const spd = Math.hypot(this.vx, this.vy) || 1;
        this.vx = (this.vx / spd) * targetSpd;
        this.vy = (this.vy / spd) * targetSpd;
      }
    }

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * (this.isSwarmAggro ? 18 : 9)) % 2 === 0 ? 0 : 1;
    const sprite = getSpikeMineSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, 1.15);
  }
}

/**
 * AbyssalOvermind Phase 2 Detached Spinning Steel Sawblade (`20px` radius):
 * High-speed independent ricocheting plate detached from the Overmind's cortex!
 */
export class SawBladeMinion extends InteriorMinion {
  public readonly kind = 'SAWBLADE' as const;
  public readonly baseSpeed: number;

  constructor(pos: Point, angleRad: number, speed = 265) {
    super(pos, Math.cos(angleRad) * speed, Math.sin(angleRad) * speed, 20);
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (!this.applySwarmAggro(mctx, this.baseSpeed)) {
      const targetSpd = this.baseSpeed * mctx.speedScale;
      this.currentSpeed = targetSpd;
      const spd = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / spd) * targetSpd;
      this.vy = (this.vy / spd) * targetSpd;
    }

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 24) % 2 === 0 ? 0 : 1;
    const sprite = getSawBladeMinionSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, 1.2);
  }
}
