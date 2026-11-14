import { SOLID_BOX_HALF, SolidRect } from '../geometry/SolidBoxes';
import { Point } from '../geometry/Types';
import { ARENA_PIXEL_SCALE, blitArenaPixelSprite, drawPixelText } from '../rendering/PixelArtEngine';
import { getCapsuleSprite, getSolidWallSprite } from '../rendering/VolfiedSprites';

/**
 * `ARMOR_PILLAR` = impassable blind steel obstacle (`+5,000` when enclosed; also dropped by ArmoredCrustacean!).
 */
export type PowerUpType = 'S' | 'T' | 'P' | 'L' | 'C' | 'BOSS_CANNON' | 'ARMOR_PILLAR';
export type CollectiblePowerUpType = Exclude<PowerUpType, 'ARMOR_PILLAR'>;

/**
 * V7 Law 6 — 3-Tier Energy Block Economy:
 * 1. `SOLID_STANDARD`: Always solid silver-grey block (`S`, `L`, `C`, `P`, `EMPTY_POINTS`, or `ENRAGE_TRAP` on `ZOR`).
 * 2. `DISAPPEARING`: Blinking grey block (`onDurationSec` visible + `offDurationSec` vanished; `0.6s` warning flicker;
 *    enclosing while vanished grants NOTHING!).
 * 3. `SPECIAL_STAGE_1_RED` -> `SPECIAL_STAGE_2_GOLD`: 2-Stage Boss Cannon (`★`) unlock!
 * 4. `ARMOR_PILLAR`: Impassable blind steel pillar (`+5,000` bonus when enclosed).
 */
export type BlockTier =
  | 'SOLID_STANDARD'
  | 'DISAPPEARING'
  | 'SPECIAL_STAGE_1_RED'
  | 'SPECIAL_STAGE_2_GOLD'
  | 'ARMOR_PILLAR';

export type BlockRewardType = PowerUpType | 'EMPTY_POINTS' | 'ENRAGE_TRAP';

export interface PowerUpBoxConfig {
  x: number;
  y: number;
  type: PowerUpType;
  blinking?: boolean;
  blockKind?: BlockTier;
  rewardType?: BlockRewardType;
  onDurationSec?: number;
  offDurationSec?: number;
  phaseOffsetSec?: number;
}

/** Logical (900x1200 arena) edge length of every solid wall block. */
export const POWERUP_BOX_SIZE = SOLID_BOX_HALF * 2;
export const ARMOR_PILLAR_BONUS = 5_000;
export const EMPTY_BLOCK_POINTS_BONUS = 5_000;

const WALL_SHADOW_DEPTH = 10;

export class PowerUpBox implements SolidRect {
  public readonly x: number;
  public readonly y: number;
  public readonly half = SOLID_BOX_HALF;
  public readonly baseType: PowerUpType;
  public readonly blockKind: BlockTier;
  public readonly rewardType: BlockRewardType;
  public readonly blinking: boolean;
  public readonly onDurationSec: number;
  public readonly offDurationSec: number;
  public readonly phaseOffsetSec: number;
  public collected = false;
  public contactFlash = 0;

  constructor(cfg: PowerUpBoxConfig) {
    this.x = Math.round(cfg.x / 2) * 2;
    this.y = Math.round(cfg.y / 2) * 2;
    this.baseType = cfg.type;
    this.blockKind =
      cfg.blockKind ??
      (cfg.type === 'ARMOR_PILLAR'
        ? 'ARMOR_PILLAR'
        : cfg.blinking
          ? 'DISAPPEARING'
          : 'SOLID_STANDARD');
    this.rewardType =
      cfg.rewardType ??
      (this.blockKind === 'SPECIAL_STAGE_2_GOLD' ? 'BOSS_CANNON' : cfg.type);
    this.blinking = this.blockKind === 'DISAPPEARING';
    this.onDurationSec = cfg.onDurationSec ?? 4.0;
    this.offDurationSec = cfg.offDurationSec ?? 2.2;
    this.phaseOffsetSec = cfg.phaseOffsetSec ?? 0;
  }

  public get center(): Point {
    return { x: this.x, y: this.y };
  }

  public get isArmorPillar(): boolean {
    return this.blockKind === 'ARMOR_PILLAR' || this.baseType === 'ARMOR_PILLAR';
  }

  /**
   * V7 Law 6: Disappearing blocks vanish completely during `offDurationSec`!
   * While vanished (`false`), they have no collision AND grant zero reward if enclosed!
   */
  public isMaterialized(timeSeconds: number): boolean {
    if (this.collected) return false;
    if (this.blockKind !== 'DISAPPEARING') return true;
    const cycle = this.onDurationSec + this.offDurationSec;
    if (cycle <= 0) return true;
    const phase = (((timeSeconds + this.phaseOffsetSec) % cycle) + cycle) % cycle;
    return phase < this.onDurationSec;
  }

  /**
   * V7 Visual Signature (`05`): Flickers for `0.6s` right before disappearing!
   */
  public isFlickeringWarning(timeSeconds: number): boolean {
    if (this.collected || this.blockKind !== 'DISAPPEARING') return false;
    const cycle = this.onDurationSec + this.offDurationSec;
    if (cycle <= 0) return false;
    const phase = (((timeSeconds + this.phaseOffsetSec) % cycle) + cycle) % cycle;
    return phase >= Math.max(0, this.onDurationSec - 0.6) && phase < this.onDurationSec;
  }

  public resolveType(_timeSeconds: number): PowerUpType {
    if (this.blockKind === 'SPECIAL_STAGE_2_GOLD') return 'BOSS_CANNON';
    if (this.blockKind === 'ARMOR_PILLAR') return 'ARMOR_PILLAR';
    return this.baseType;
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
    if (this.collected || !this.isMaterialized(timeSeconds)) return;

    const flickering = this.isFlickeringWarning(timeSeconds);
    if (flickering && Math.floor(timeSeconds * 30) % 3 === 1) {
      return;
    }

    const variant =
      this.blockKind === 'ARMOR_PILLAR'
        ? 'ARMOR'
        : this.blockKind === 'SPECIAL_STAGE_2_GOLD'
          ? 'GOLD'
          : this.blockKind === 'SPECIAL_STAGE_1_RED'
            ? 'RED_PULSE'
            : 'STEEL';

    const rate =
      this.blockKind === 'SPECIAL_STAGE_1_RED' || this.blockKind === 'SPECIAL_STAGE_2_GOLD'
        ? 9
        : 3.5;
    const gemFrame: 0 | 1 = Math.floor(timeSeconds * rate) % 2 === 0 ? 0 : 1;
    const jitterX = flickering ? ((Math.floor(timeSeconds * 36) % 2) * 2 - 1) * 2 : 0;

    const h = this.half;
    ctx.fillStyle = '#06080E';
    ctx.fillRect(
      this.x - h + WALL_SHADOW_DEPTH + jitterX,
      this.y - h + WALL_SHADOW_DEPTH,
      h * 2,
      h * 2
    );

    const sprite = getSolidWallSprite(variant, gemFrame);
    const scaleMul = (h * 2) / (sprite.width * ARENA_PIXEL_SCALE);
    blitArenaPixelSprite(ctx, sprite, this.x + jitterX, this.y, scaleMul);

    if (this.contactFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.contactFlash * 5);
      ctx.strokeStyle = '#FFF0A0';
      ctx.lineWidth = 4;
      ctx.strokeRect(this.x - h + jitterX, this.y - h, h * 2, h * 2);
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
