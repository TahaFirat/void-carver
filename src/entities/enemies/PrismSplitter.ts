import { PALETTE } from '../../core/Config';
import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { getBlueSphereSprite } from '../../rendering/VolfiedSprites';
import { InteriorMinion, MinionContext } from './BaseMinion';

/**
 * 16-Bit Pixel-Art Faceted Blue Crystal Sphere (`18x18` -> `12x12` mini spheres when split!)
 */
export class PrismSplitter extends InteriorMinion {
  public readonly kind: 'PRISM' | 'SHARD';
  private readonly baseSpeed: number;
  private actionTimer: number;
  private readonly isShard: boolean;

  constructor(pos: Point, isShard = false, speed = 135) {
    const ang = Math.random() * Math.PI * 2;
    const finalSpeed = isShard ? speed * 1.48 : speed;
    super(pos, Math.cos(ang) * finalSpeed, Math.sin(ang) * finalSpeed, isShard ? 12 : 18);
    this.isShard = isShard;
    this.kind = isShard ? 'SHARD' : 'PRISM';
    this.baseSpeed = finalSpeed;
    this.actionTimer = 3.4 + Math.random() * 2.0;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    const targetSpd = this.baseSpeed * mctx.speedScale;
    const curSpd = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / curSpd) * targetSpd;
    this.vy = (this.vy / curSpd) * targetSpd;

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);

    if (this.isShard) return;

    this.actionTimer -= mctx.dt;
    if (this.actionTimer <= 0) {
      this.actionTimer = 4.6 + Math.random() * 1.8;

      if (mctx.currentMinionCount < 5 && Math.random() < 0.5) {
        const s1 = new PrismSplitter({ x: this.x - 8, y: this.y - 8 }, true, this.baseSpeed);
        const s2 = new PrismSplitter({ x: this.x + 8, y: this.y + 8 }, true, this.baseSpeed);
        mctx.spawnChildMinion(s1);
        mctx.spawnChildMinion(s2);
      } else {
        const bSpd = 245 * mctx.speedScale;
        mctx.projectiles.spawnEnemyBullet({ x: this.x, y: this.y }, bSpd, 0, PALETTE.SIGNAL_WARM, 6);
        mctx.projectiles.spawnEnemyBullet({ x: this.x, y: this.y }, -bSpd, 0, PALETTE.SIGNAL_WARM, 6);
        mctx.projectiles.spawnEnemyBullet({ x: this.x, y: this.y }, 0, bSpd, PALETTE.SIGNAL_WARM, 6);
        mctx.projectiles.spawnEnemyBullet({ x: this.x, y: this.y }, 0, -bSpd, PALETTE.SIGNAL_WARM, 6);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 7) % 2 === 0 ? 0 : 1;
    const sprite = getBlueSphereSprite(this.isShard, frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, 1.05);
  }
}
