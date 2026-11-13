import { PALETTE } from '../core/Config';
import { getPointAlongPolyline, getPolylineLength } from '../geometry/PolygonMath';
import { Point } from '../geometry/Types';

/**
 * 16-Bit Pixel Plasma Spark (`TrailFuse`, `380 px/s`).
 * Ignites on the incomplete cut line when an enemy touches the trail or after `3.5s` hesitation.
 * Note: If the player rewinds (`180°` Backtrack) onto the spark, `totalLen` shrinks to `<= arcDistance`
 * and triggers `caughtShip: true`; if the player reaches `ON_BORDER` BEFORE the spark arrives,
 * `GameEngine` clears `activeFuse` safely!
 */
export class TrailFuse {
  public arcDistance: number;
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public tailX: number;
  public tailY: number;
  public active = true;
  private alarmTimer = 0;

  constructor(initialArcDistance: number, trail: readonly Point[]) {
    this.arcDistance = Math.max(0, initialArcDistance);
    const pt = getPointAlongPolyline(trail, this.arcDistance);
    const tail = getPointAlongPolyline(trail, Math.max(0, this.arcDistance - 24));
    this.x = pt.x;
    this.y = pt.y;
    this.prevX = pt.x;
    this.prevY = pt.y;
    this.tailX = tail.x;
    this.tailY = tail.y;
  }

  public update(
    dt: number,
    trail: readonly Point[],
    fuseSpeed: number
  ): { caughtShip: boolean; playAlarmPulse: boolean } {
    this.prevX = this.x;
    this.prevY = this.y;

    if (!this.active || trail.length < 2) {
      return { caughtShip: false, playAlarmPulse: false };
    }

    const totalLen = getPolylineLength(trail);
    this.arcDistance += fuseSpeed * dt;

    const pt = getPointAlongPolyline(trail, Math.min(totalLen, this.arcDistance));
    const tail = getPointAlongPolyline(trail, Math.max(0, this.arcDistance - 24));
    this.x = pt.x;
    this.y = pt.y;
    this.tailX = tail.x;
    this.tailY = tail.y;

    let playAlarmPulse = false;
    this.alarmTimer -= dt;
    if (this.alarmTimer <= 0) {
      this.alarmTimer = 0.22;
      playAlarmPulse = true;
    }

    if (this.arcDistance >= totalLen - 2) {
      return { caughtShip: true, playAlarmPulse };
    }

    return { caughtShip: false, playAlarmPulse };
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    if (!this.active) return;

    const rx = Math.round(this.prevX + (this.x - this.prevX) * alpha);
    const ry = Math.round(this.prevY + (this.y - this.prevY) * alpha);
    const frame = Math.floor(timeSeconds * 20) % 2;

    ctx.save();
    // Crisp 16-bit pixel cross-star plasma spark!
    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(rx - 14, ry - 4, 28, 8);
    ctx.fillRect(rx - 4, ry - 14, 8, 28);
    if (frame === 1) {
      ctx.fillRect(rx - 10, ry - 10, 20, 20);
    }

    ctx.fillStyle = frame === 0 ? PALETTE.DANGER_RED : PALETTE.CUT_ORANGE;
    ctx.fillRect(rx - 12, ry - 3, 24, 6);
    ctx.fillRect(rx - 3, ry - 12, 6, 24);
    ctx.fillRect(rx - 7, ry - 7, 14, 14);

    ctx.fillStyle = '#FFF8A8';
    ctx.fillRect(rx - 4, ry - 4, 8, 8);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rx - 2, ry - 2, 4, 4);
    ctx.restore();
  }
}
