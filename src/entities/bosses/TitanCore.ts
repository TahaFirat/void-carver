import { PALETTE } from '../../core/Config';
import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { getCruiserCoreSprite } from '../../rendering/VolfiedSprites';
import { BaseBoss, BossUpdateContext } from './BaseBoss';

/**
 * 16-Bit Pixel-Art Octagonal Battleship Core (`CruiserCore` / `TitanCore`, `baseRadius = 42`).
 * Featured in Stage 05 (`hp: 9`) & Stage 13 (`hp: 13`), firing rotating 4-way cross salvos!
 */
export class TitanCore extends BaseBoss {
  public readonly archetype = 'CRUISER_CORE' as const;
  public readonly displayName = 'CRUISER CORE';
  private fireTimer = 2.4;
  private burstToggle = false;
  private readonly fastVariant: boolean;

  constructor(spawn: Point, tier = 1, fastVariant = false, maxHp = 9) {
    super(
      spawn,
      42,
      maxHp,
      (fastVariant ? 190 : 158) + tier * 10,
      (fastVariant ? 168 : 138) + tier * 8
    );
    this.fastVariant = fastVariant;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    const tempo = this.fastVariant ? 1.2 : 1.0;
    const baseSpd = 172 * speedScale * tempo;
    const cur = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / cur) * baseSpd;
    this.vy = (this.vy / cur) * baseSpd;

    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.fireTimer -= bctx.dt * speedScale * tempo;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.fastVariant ? 2.15 : 2.65;
      this.burstToggle = !this.burstToggle;
      const offset = this.burstToggle ? Math.PI * 0.25 : 0;
      const orbSpd = (this.fastVariant ? 265 : 238) * speedScale;
      for (let i = 0; i < 4; i++) {
        const ang = offset + Math.PI * 0.5 * i;
        bctx.projectiles.spawnEnemyBullet(
          { x: this.x, y: this.y },
          Math.cos(ang) * orbSpd,
          Math.sin(ang) * orbSpd,
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
    const frame: 0 | 1 = Math.floor(timeSeconds * 6) % 2 === 0 ? 0 : 1;
    const rot = timeSeconds * (this.fastVariant ? 1.4 : 0.85);

    const sprite = getCruiserCoreSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.35, rot);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}
