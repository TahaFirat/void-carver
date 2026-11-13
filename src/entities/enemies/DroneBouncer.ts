import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { getScarabBeetleSprite } from '../../rendering/VolfiedSprites';
import { InteriorMinion, MinionContext } from './BaseMinion';

/**
 * 16-Bit Pixel-Art Amber-Emerald Scarab Beetle (`18x18` arcade px, `01-hedef-oynanis.jpg` beetles!)
 */
export class DroneBouncer extends InteriorMinion {
  public readonly kind = 'DRONE' as const;
  private readonly baseSpeed: number;

  constructor(pos: Point, speed = 178, angleRad = Math.PI * 0.25) {
    const safeAngle =
      Math.abs(Math.cos(angleRad)) < 0.25 || Math.abs(Math.sin(angleRad)) < 0.25
        ? Math.PI * 0.25
        : angleRad;
    super(pos, Math.cos(safeAngle) * speed, Math.sin(safeAngle) * speed, 18);
    this.baseSpeed = speed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    const targetSpd = this.baseSpeed * mctx.speedScale;
    const curSpd = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / curSpd) * targetSpd;
    this.vy = (this.vy / curSpd) * targetSpd;

    if (Math.abs(this.vx) < targetSpd * 0.25) {
      this.vx = (this.vx >= 0 ? 1 : -1) * targetSpd * 0.5;
    }
    if (Math.abs(this.vy) < targetSpd * 0.25) {
      this.vy = (this.vy >= 0 ? 1 : -1) * targetSpd * 0.5;
    }
    const norm = Math.hypot(this.vx, this.vy) || 1;
    this.vx = (this.vx / norm) * targetSpd;
    this.vy = (this.vy / norm) * targetSpd;

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const legFrame: 0 | 1 = Math.floor(timeSeconds * 10) % 2 === 0 ? 0 : 1;
    const sprite = getScarabBeetleSprite(legFrame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, 1.15);
  }
}
