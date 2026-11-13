import { PALETTE } from '../../core/Config';
import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { getTwinHalfSprite } from '../../rendering/VolfiedSprites';
import { BaseBoss, BossUpdateContext } from './BaseBoss';

/**
 * 16-Bit Pixel-Art Docking & Splitting Twin Core (`TwinNexus` / `TWIN_SPLIT`).
 * Featured in Stage 06 (`6 HP` each) & Stage 14 (`8 HP` each).
 * Periodically locks together into one unified sphere (`DOCKED`) and splits apart
 * (`SEPARATED`) so skilled players can slice between the two halves for an instant split-crush!
 */
export class TwinNexus extends BaseBoss {
  public readonly archetype = 'TWIN_SPLIT' as const;
  public readonly displayName: string;
  public readonly variant: 'ALPHA' | 'OMEGA';
  private partner: TwinNexus | null = null;
  private cycleTimer = 0;
  private pulseTimer: number;

  constructor(spawn: Point, variant: 'ALPHA' | 'OMEGA', maxHp = 6) {
    super(
      spawn,
      36,
      maxHp,
      variant === 'ALPHA' ? 192 : -186,
      variant === 'ALPHA' ? -168 : 176
    );
    this.variant = variant;
    this.displayName = variant === 'ALPHA' ? 'IKIZ CEKIRDEK A' : 'IKIZ CEKIRDEK B';
    this.pulseTimer = variant === 'ALPHA' ? 2.2 : 3.0;
  }

  public linkPartner(other: TwinNexus): void {
    this.partner = other;
  }

  public get isDocked(): boolean {
    if (!this.partner || !this.partner.alive) return false;
    // 8.0s cycle: first 2.8s DOCKED, next 5.2s SEPARATED!
    return this.cycleTimer % 8.0 < 2.8;
  }

  protected updateBehavior(bctx: BossUpdateContext, speedScale: number): void {
    this.cycleTimer += bctx.dt * speedScale;
    const targetSpd = 192 * speedScale;

    if (this.isDocked && this.partner && this.partner.alive) {
      // Gently pull toward docked side-by-side formation (`ALPHA` on left, `OMEGA` on right)
      const midX = (this.x + this.partner.x) * 0.5;
      const midY = (this.y + this.partner.y) * 0.5;
      const offset = (this.variant === 'ALPHA' ? -20 : 20) * this.renderScale;
      const desiredX = midX + offset;
      const desiredY = midY;

      this.x += (desiredX - this.x) * Math.min(1, bctx.dt * 7);
      this.y += (desiredY - this.y) * Math.min(1, bctx.dt * 7);
    } else if (this.partner && this.partner.alive) {
      // Soft repulsion right when separating so they roam opposite sides of the arena!
      const dx = this.x - this.partner.x;
      const dy = this.y - this.partner.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 150) {
        this.vx += (dx / dist) * 260 * bctx.dt;
        this.vy += (dy / dist) * 260 * bctx.dt;
      }
    }

    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * targetSpd;
    this.vy = (this.vy / norm) * targetSpd;

    this.x += this.vx * bctx.dt;
    this.y += this.vy * bctx.dt;

    this.pulseTimer -= bctx.dt * speedScale;
    if (this.pulseTimer <= 0) {
      this.pulseTimer = 2.75;
      const aim = Math.atan2(bctx.playerPos.y - this.y, bctx.playerPos.x - this.x);
      const spd = 255 * speedScale;
      bctx.projectiles.spawnEnemyBullet(
        { x: this.x, y: this.y },
        Math.cos(aim) * spd,
        Math.sin(aim) * spd,
        this.variant === 'ALPHA' ? '#FFD040' : PALETTE.CUT_ORANGE,
        5.5
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
    const pulseFrame: 0 | 1 = Math.floor(timeSeconds * 7) % 2 === 0 ? 0 : 1;
    const isRightHalf = this.variant === 'OMEGA';

    const sprite = getTwinHalfSprite(isRightHalf, pulseFrame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, this.renderScale * 1.32, 0);
    this.renderHitPixelFlash(ctx, pos.x, pos.y, this.boundingRadius * 0.85);
    this.renderHealthBar(ctx, pos.x, pos.y, bossCannonArmed);
  }
}
