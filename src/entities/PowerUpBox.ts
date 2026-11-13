import { Point } from '../geometry/Types';
import { SOLID_BOX_HALF, SolidRect } from '../geometry/SolidBoxes';
import { ARENA_PIXEL_SCALE, blitArenaPixelSprite, drawPixelText } from '../rendering/PixelArtEngine';
import { getCapsuleSprite, getSolidWallSprite } from '../rendering/VolfiedSprites';

/**
 * `ARMOR_PILLAR` = V5 blind armor pillar: impassable, no power-up inside, `+5.000` when enclosed.
 */
export type PowerUpType = 'S' | 'T' | 'P' | 'L' | 'C' | 'BOSS_CANNON' | 'ARMOR_PILLAR';
export type CollectiblePowerUpType = Exclude<PowerUpType, 'ARMOR_PILLAR'>;

export interface PowerUpBoxConfig {
  x: number;
  y: number;
  type: PowerUpType;
  blinking?: boolean;
}

/** Logical (900x1200 arena) edge length of every solid wall block. */
export const POWERUP_BOX_SIZE = SOLID_BOX_HALF * 2;
export const ARMOR_PILLAR_BONUS = 5_000;

const CYCLE_ORDER: readonly CollectiblePowerUpType[] = ['S', 'T', 'P', 'L', 'C', 'BOSS_CANNON'];

/** 3D side/bottom wall shadow depth in logical units (`6px` design shadow). */
const WALL_SHADOW_DEPTH = 10;

/**
 * V5 Solid Wall Block: impassable riveted steel tower (`68x68` logical units) with a thick
 * black 3D side shadow. Ship, minions, bosses and projectiles can never pass through it.
 * When fully enclosed inside a conquered slice it bursts open and (unless it is an
 * `ARMOR_PILLAR`) launches a `PowerUpCapsule`.
 */
export class PowerUpBox implements SolidRect {
  public readonly x: number;
  public readonly y: number;
  public readonly half = SOLID_BOX_HALF;
  public readonly baseType: PowerUpType;
  public readonly blinking: boolean;
  public collected = false;
  public contactFlash = 0;

  constructor(cfg: PowerUpBoxConfig) {
    // Grid-locked even centers so wall faces (`x +- 36`) land on the 2px movement grid
    this.x = Math.round(cfg.x / 2) * 2;
    this.y = Math.round(cfg.y / 2) * 2;
    this.baseType = cfg.type;
    this.blinking = cfg.type !== 'ARMOR_PILLAR' && Boolean(cfg.blinking);
  }

  public get center(): Point {
    return { x: this.x, y: this.y };
  }

  public get isArmorPillar(): boolean {
    return this.baseType === 'ARMOR_PILLAR';
  }

  public resolveType(timeSeconds: number): PowerUpType {
    if (!this.blinking) return this.baseType;
    // Blinking mystery block cycles between its featured type and standard items every 1.1s
    const slot = Math.floor(timeSeconds / 1.1);
    if (slot % 2 === 0) return this.baseType;
    return CYCLE_ORDER[slot % CYCLE_ORDER.length];
  }

  public get type(): PowerUpType {
    return this.baseType;
  }

  public update(dt: number): void {
    if (this.contactFlash > 0) {
      this.contactFlash = Math.max(0, this.contactFlash - dt);
    }
  }

  public render(ctx: CanvasRenderingContext2D, timeSeconds: number): void {
    if (this.collected) return;

    const currentType = this.resolveType(timeSeconds);
    const variant =
      currentType === 'ARMOR_PILLAR' ? 'ARMOR' : currentType === 'BOSS_CANNON' ? 'GOLD' : 'STEEL';
    const gemFrame: 0 | 1 = Math.floor(timeSeconds * (this.blinking ? 7 : 3.5)) % 2 === 0 ? 0 : 1;

    // Thick 3D tower shadow (right + bottom) so it clearly reads as a solid wall
    const h = this.half;
    ctx.fillStyle = '#06080E';
    ctx.fillRect(this.x - h + WALL_SHADOW_DEPTH, this.y - h + WALL_SHADOW_DEPTH, h * 2, h * 2);

    const sprite = getSolidWallSprite(variant, gemFrame);
    const scaleMul = (h * 2) / (sprite.width * ARENA_PIXEL_SCALE);
    blitArenaPixelSprite(ctx, sprite, this.x, this.y, scaleMul);

    if (this.contactFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.contactFlash * 5);
      ctx.strokeStyle = '#FFF0A0';
      ctx.lineWidth = 4;
      ctx.strokeRect(this.x - h, this.y - h, h * 2, h * 2);
      ctx.restore();
    }
  }
}

/**
 * Collectible 16-Bit Pixel Letter Capsule (`S`, `T`, `P`, `L`, `C`, `★`) that pops out
 * of an enclosed block and homes smoothly onto the player's ship!
 */
export class PowerUpCapsule {
  public x: number;
  public y: number;
  public readonly type: CollectiblePowerUpType;
  public alive = true;
  private age = 0;

  constructor(origin: Point, type: CollectiblePowerUpType) {
    this.x = origin.x;
    this.y = origin.y;
    this.type = type;
  }

  public get label(): string {
    return this.type === 'BOSS_CANNON' ? '★' : this.type;
  }

  public update(dt: number, targetShipPos: Point): boolean {
    this.age += dt;
    // Brief pop-up hop for 0.18s, then swift magnetic homing to ship!
    if (this.age < 0.18) {
      this.y -= 90 * dt;
      return false;
    }

    const dx = targetShipPos.x - this.x;
    const dy = targetShipPos.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 28) {
      this.alive = false;
      return true;
    }

    const speed = 640 + this.age * 420;
    const step = Math.min(dist, speed * dt);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    return false;
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;
    const capSprite = getCapsuleSprite(this.label);
    blitArenaPixelSprite(ctx, capSprite, this.x, this.y, 1.15);

    drawPixelText(ctx, this.label, this.x, this.y, {
      scale: ARENA_PIXEL_SCALE * 0.85,
      tone: this.type === 'BOSS_CANNON' ? 'gold' : 'white',
      align: 'center'
    });
  }
}
