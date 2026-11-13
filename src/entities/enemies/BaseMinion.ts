import { ProjectileManager } from '../Projectiles';
import { resolvePolygonPenetration } from '../../geometry/PolygonMath';
import { Point } from '../../geometry/Types';

export interface MinionContext {
  dt: number;
  activePolygon: readonly Point[];
  playerState: 'ON_BORDER' | 'CUTTING';
  playerPos: Point;
  activeTrail: readonly Point[];
  speedScale: number;
  projectiles: ProjectileManager;
  spawnChildMinion: (child: InteriorMinion) => void;
  currentMinionCount: number;
}

export abstract class InteriorMinion {
  public x: number;
  public y: number;
  public prevX: number;
  public prevY: number;
  public vx: number;
  public vy: number;
  public readonly radius: number;
  public alive = true;
  public abstract readonly kind: 'DRONE' | 'HUNTER' | 'PRISM' | 'SHARD';

  constructor(pos: Point, vx: number, vy: number, radius: number) {
    this.x = pos.x;
    this.y = pos.y;
    this.prevX = pos.x;
    this.prevY = pos.y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
  }

  public get position(): Point {
    return { x: this.x, y: this.y };
  }

  public getRenderPos(alpha: number): Point {
    return {
      x: this.prevX + (this.x - this.prevX) * alpha,
      y: this.prevY + (this.y - this.prevY) * alpha
    };
  }

  public enforcePolygonBounds(activePolygon: readonly Point[]): void {
    const solved = resolvePolygonPenetration({ x: this.x, y: this.y }, this.radius, activePolygon);
    this.x = solved.position.x;
    this.y = solved.position.y;

    if (solved.collidedNormal) {
      const nx = solved.collidedNormal.x;
      const ny = solved.collidedNormal.y;
      const dot = this.vx * nx + this.vy * ny;
      if (dot < 0) {
        this.vx -= 2 * dot * nx;
        this.vy -= 2 * dot * ny;
      }
    }
  }

  public abstract update(ctx: MinionContext): void;
  public abstract render(
    ctx: CanvasRenderingContext2D,
    alpha: number,
    timeSeconds: number
  ): void;
}
