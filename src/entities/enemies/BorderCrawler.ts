import {
  arcLengthToPoint,
  getPolygonEdges,
  getTotalPerimeter,
  pointToArcLength,
  projectPointToPolygon
} from '../../geometry/PolygonMath';
import { Point } from '../../geometry/Types';
import { blitArenaPixelSprite } from '../../rendering/PixelArtEngine';
import { getSpikeMineSprite } from '../../rendering/VolfiedSprites';

/**
 * 16-Bit Pixel-Art Spiked Perimeter Space Mine (`16x16` arcade px)
 */
export class BorderCrawler {
  public arcS: number;
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public readonly radius = 15;
  public readonly baseSpeed: number;
  public directionSign: 1 | -1 = 1;
  private repulseTimer = 0;
  public alive = true;

  constructor(activePolygon: readonly Point[], spawnArcS: number, baseSpeed = 132) {
    this.arcS = spawnArcS;
    this.baseSpeed = baseSpeed;
    const pt = arcLengthToPoint(this.arcS, activePolygon);
    this.x = pt.x;
    this.y = pt.y;
    this.prevX = pt.x;
    this.prevY = pt.y;
  }

  public snapOntoUpdatedPolygon(activePolygon: readonly Point[]): void {
    const proj = projectPointToPolygon({ x: this.x, y: this.y }, activePolygon);
    const newS = pointToArcLength(proj.point, activePolygon) ?? 0;
    this.arcS = newS;
    const pt = arcLengthToPoint(this.arcS, activePolygon);
    this.x = pt.x;
    this.y = pt.y;
    this.prevX = pt.x;
    this.prevY = pt.y;
  }

  public update(
    dt: number,
    activePolygon: readonly Point[],
    playerPos: Point,
    speedScale: number
  ): void {
    this.prevX = this.x;
    this.prevY = this.y;

    const edges = getPolygonEdges(activePolygon);
    const total = getTotalPerimeter(edges);
    if (total <= 0) return;

    const playerProj = projectPointToPolygon(playerPos, activePolygon);
    const targetS = pointToArcLength(playerProj.point, activePolygon) ?? 0;

    const cwDist = ((targetS - this.arcS) % total + total) % total;
    const ccwDist = total - cwDist;
    if (this.repulseTimer > 0) {
      this.repulseTimer = Math.max(0, this.repulseTimer - dt);
    } else {
      this.directionSign = cwDist <= ccwDist ? 1 : -1;
    }

    this.arcS =
      ((this.arcS + this.directionSign * this.baseSpeed * speedScale * dt) % total + total) % total;
    const pt = arcLengthToPoint(this.arcS, activePolygon);
    this.x = pt.x;
    this.y = pt.y;
  }

  public deflectFromShield(): void {
    this.directionSign = this.directionSign === 1 ? -1 : 1;
    this.repulseTimer = 0.65;
    this.arcS += this.directionSign * 22;
  }

  public getRenderPos(alpha: number): Point {
    return {
      x: this.prevX + (this.x - this.prevX) * alpha,
      y: this.prevY + (this.y - this.prevY) * alpha
    };
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number, timeSeconds: number): void {
    const pos = this.getRenderPos(alpha);
    const frame: 0 | 1 = Math.floor(timeSeconds * 10) % 2 === 0 ? 0 : 1;
    const sprite = getSpikeMineSprite(frame);
    blitArenaPixelSprite(ctx, sprite, pos.x, pos.y, 1.05, timeSeconds * 2.4);
  }
}
