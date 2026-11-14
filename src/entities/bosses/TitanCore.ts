import { PALETTE } from '../../core/Config';
import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { getCruiserCoreSprite } from '../../rendering/VolfiedSprites';
import { BaseBoss, BossUpdateContext } from './BaseBoss';

/**
 * 16-Bit Pixel-Art Octagonal Battleship Core (`CruiserCore` / `TitanCore` / `DREADNOUGHT_CORE`).
 * Phase 2 (`ORBITING_SHIELD_BLADES`): Deploys 4 wide-orbiting shield blades + spiral salvos!
 */
export class TitanCore extends BaseBoss {
  public readonly archetype = 'CRUISER_CORE' as const;
  public readonly displayName = 'DREADNOUGHT CORE';
  private fireTimer = 2.3;
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
    const tempo = this.fastVariant ? 1.15 : 1.0;
    const baseSpd = 170 * speedScale * tempo;
    const cur = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / cur) * baseSpd;
    this.vy = (this.vy / cur) * baseSpd;

    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.fireTimer -= bctx.dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = this.phaseBehavior?.fireIntervalSec ?? (this.fastVariant ? 2.1 : 2.5);
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
    this.renderPhaseAuraAndWings(ctx, pos.x, pos.y, timeSeconds);

    const frame: 0 | 1 = Math.floor(timeSeconds * 6) % 2 === 0 ? 0 : 1;
    const rot = timeSeconds * (this.combatPhase >= 2 ? 2.1 : this.fastVariant ? 1.4 : 0.85);

    const sprite = getCruiserCoreSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.35, rot);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.9);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}
