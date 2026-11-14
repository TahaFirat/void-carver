import { PALETTE } from '../core/Config';
import { getPointAlongPolyline, getPolylineLength } from '../geometry/PolygonMath';
import { Point } from '../geometry/Types';

/**
 * V7 Law 4 — 16-Bit Pixel Lightning Shock (`TrailFuse`):
 * When a bullet, minion, or boss touches `activeTrail` (or the player exceeds `stallSparkLimitSec`),
 * a crackling blue-white-crimson electric arc races along the cut line toward the ship!
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
  private cachedTrail: Point[] = [];

  constructor(initialArcDistance: number, trail: readonly Point[]) {
    this.arcDistance = Math.max(0, initialArcDistance);
    this.cachedTrail = trail.map((p) => ({ x: p.x, y: p.y }));
    const pt = getPointAlongPolyline(trail, this.arcDistance);
    const tail = getPointAlongPolyline(trail, Math.max(0, this.arcDistance - 48));
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

    this.cachedTrail = trail.map((p) => ({ x: p.x, y: p.y }));
    const totalLen = getPolylineLength(trail);
    this.arcDistance += fuseSpeed * dt;

    const pt = getPointAlongPolyline(trail, Math.min(totalLen, this.arcDistance));
    const tail = getPointAlongPolyline(trail, Math.max(0, this.arcDistance - 56));
    this.x = pt.x;
    this.y = pt.y;
    this.tailX = tail.x;
    this.tailY = tail.y;

    let playAlarmPulse = false;
    this.alarmTimer -= dt;
    if (this.alarmTimer <= 0) {
      this.alarmTimer = 0.2;
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
    const frame = Math.floor(timeSeconds * 26) % 2;

    ctx.save();

    // 1. Crackling 16-bit Blue-White-Crimson Electric Lightning Arc along the burned/shocked trail!
    if (this.cachedTrail.length >= 2 && this.arcDistance > 8) {
      const shockSpan = Math.min(this.arcDistance, 140);
      const startDist = Math.max(0, this.arcDistance - shockSpan);
      const steps = Math.max(4, Math.min(12, Math.floor(shockSpan / 12)));
      const seed = Math.floor(timeSeconds * 45);

      ctx.lineJoin = 'miter';
      ctx.lineCap = 'square';

      const arcPts: Point[] = [];
      for (let i = 0; i <= steps; i++) {
        const d = startDist + (shockSpan * i) / steps;
        const basePt = getPointAlongPolyline(this.cachedTrail, d);
        if (i === 0 || i === steps) {
          arcPts.push({ x: Math.round(basePt.x), y: Math.round(basePt.y) });
        } else {
          const hash = ((i * 73 + seed * 31) % 5) - 2;
          const jitter = hash * 4;
          arcPts.push({
            x: Math.round(basePt.x + jitter),
            y: Math.round(basePt.y - jitter)
          });
        }
      }

      ctx.beginPath();
      ctx.moveTo(arcPts[0].x, arcPts[0].y);
      for (let i = 1; i < arcPts.length; i++) {
        ctx.lineTo(arcPts[i].x, arcPts[i].y);
      }

      // Outer crimson/cyan electric corona
      ctx.strokeStyle = frame === 0 ? '#38E8FF' : '#FF2838';
      ctx.lineWidth = 7;
      ctx.stroke();

      // White-hot lightning filament
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // 2. High-voltage pixel lightning head (`#50F0FF` / `#FF2838` / `#FFFFFF`)
    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(rx - 15, ry - 4, 30, 8);
    ctx.fillRect(rx - 4, ry - 15, 8, 30);
    if (frame === 1) {
      ctx.fillRect(rx - 11, ry - 11, 22, 22);
    }

    ctx.fillStyle = frame === 0 ? '#48EAFF' : PALETTE.DANGER_RED;
    ctx.fillRect(rx - 13, ry - 3, 26, 6);
    ctx.fillRect(rx - 3, ry - 13, 6, 26);
    ctx.fillRect(rx - 8, ry - 8, 16, 16);

    ctx.fillStyle = '#FFF8A8';
    ctx.fillRect(rx - 5, ry - 5, 10, 10);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(rx - 2, ry - 2, 5, 5);
    ctx.restore();
  }
}
