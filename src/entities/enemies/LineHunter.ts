import { projectPointToPolyline } from '../../geometry/PolygonMath';
import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { getPodFighterSprite } from '../../rendering/VolfiedSprites';
import { InteriorMinion, MinionContext } from './BaseMinion';

/**
 * 16-Bit Pixel-Art White-Purple Pod Fighter (`18x18` arcade px):
 * Drifts calmly while player is on safe border; surges with Swarm Aggro onto active cut line!
 */
export class LineHunter extends InteriorMinion {
  public readonly kind = 'HUNTER' as const;
  public readonly patrolSpeed: number;
  private isHunting = false;
  private wanderTimer = 1.4;

  constructor(pos: Point, patrolSpeed = 160) {
    const ang = Math.random() * Math.PI * 2;
    super(pos, Math.cos(ang) * patrolSpeed, Math.sin(ang) * patrolSpeed, 18);
    this.patrolSpeed = patrolSpeed;
  }

  public update(mctx: MinionContext): void {
    this.prevX = this.x;
    this.prevY = this.y;

    if (this.applySwarmAggro(mctx, this.patrolSpeed)) {
      this.isHunting = true;
    } else {
      this.isHunting = mctx.playerState === 'CUTTING' && mctx.activeTrail.length >= 2;
      const targetSpeed = this.patrolSpeed * mctx.speedScale * (this.isHunting ? 1.2 : 1.0);
      this.currentSpeed = targetSpeed;

      if (this.isHunting) {
        const closest = projectPointToPolyline({ x: this.x, y: this.y }, mctx.activeTrail);
        const dx = closest.point.x - this.x;
        const dy = closest.point.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        const desiredVx = (dx / dist) * targetSpeed;
        const desiredVy = (dy / dist) * targetSpeed;
        const turnRate = Math.min(1, mctx.dt * 7.2);
        this.vx += (desiredVx - this.vx) * turnRate;
        this.vy += (desiredVy - this.vy) * turnRate;
      } else {
        this.wanderTimer -= mctx.dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 1.6 + Math.random() * 1.4;
          const jitter = (Math.random() - 0.5) * 0.9;
          const curAng = Math.atan2(this.vy, this.vx) + jitter;
          this.vx = Math.cos(curAng) * targetSpeed;
          this.vy = Math.sin(curAng) * targetSpeed;
        }
      }

      const spd = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / spd) * targetSpeed;
      this.vy = (this.vy / spd) * targetSpeed;
    }

    this.x += this.vx * mctx.dt;
    this.y += this.vy * mctx.dt;
    this.enforcePolygonBounds(mctx.activePolygon);
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 =
      Math.floor(timeSeconds * (this.isHunting || this.isSwarmAggro ? 16 : 6)) % 2 === 0 ? 0 : 1;
    const sprite = getPodFighterSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, 1.1);
  }
}
