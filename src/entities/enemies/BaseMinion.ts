import { projectPointToPolyline, resolvePolygonPenetration } from '../../geometry/PolygonMath';
import { SolidRect } from '../../geometry/SolidBoxes';
import { Point } from '../../geometry/Types';
import type { MinionSpeciesId } from '../../levels/EncounterDeck';
import type { ArenaHazardManager } from '../ArenaHazards';
import { ProjectileManager } from '../Projectiles';

export type MinionKind =
  | 'DRONE'
  | 'HUNTER'
  | 'PRISM'
  | 'SHARD'
  | 'SWARMER'
  | 'MISSILE'
  | 'SAWBLADE'
  | 'TURRET'
  | 'SPARK_CRAB'
  | 'SHIELD_SAPPER'
  | 'MINE_DRONE'
  | 'CHARGER'
  | 'GHOST'
  | 'SATELLITE'
  | 'BARNACLE'
  | 'SPORE';

export interface MinionContext {
  dt: number;
  activePolygon: readonly Point[];
  playerState: 'ON_BORDER' | 'CUTTING';
  playerPos: Point;
  playerVel?: Point;
  activeTrail: readonly Point[];
  speedScale: number;
  /** V7 Law 3: True when player is unshielded (`CUTTING`) and this minion enters Swarm Aggro! */
  aggroActive?: boolean;
  /** V7 Law 3: `1.15` (`KOLAY`), `1.45` (`ORTA`), `1.80` (`ZOR`). */
  aggroSpeedMult?: number;
  /** V7 Law 3 (`ZOR`): Predicts player's future intercept coordinate instead of current position! */
  interceptLead?: boolean;
  projectiles: ProjectileManager;
  spawnChildMinion: (child: InteriorMinion) => void;
  currentMinionCount: number;
  bossCenter?: Point;
  hazards?: ArenaHazardManager;
  solidBoxes?: readonly SolidRect[];
  waveElapsedSec?: number;
  crawlerDelaySec?: number;
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
  public isSwarmAggro = false;
  public currentSpeed = 0;
  public speciesId?: MinionSpeciesId;
  public ignoresSolidBoxes = false;
  public isLatchedToBorder = false;
  public isBorderSparkActive = false;
  public isPetrifiedObstacle = false;
  public explodedOnWall = false;
  public abstract readonly kind: MinionKind;

  constructor(pos: Point, vx: number, vy: number, radius: number) {
    this.x = pos.x;
    this.y = pos.y;
    this.prevX = pos.x;
    this.prevY = pos.y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.currentSpeed = Math.hypot(vx, vy);
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

  /**
   * V7 Law 3 (`Unshielded Swarm Aggro`):
   * While `playerState === 'ON_BORDER'`, minions bounce calmly (`false`).
   * The instant `playerState === 'CUTTING'` and `aggroActive === true`, velocity steers directly
   * toward the unshielded ship / exposed trail (or future intercept vector on `ZOR`) and speed
   * surges by `aggroSpeedMult` (`+15%` / `+45%` / `+80%`)!
   */
  protected applySwarmAggro(mctx: MinionContext, baseSpeed: number): boolean {
    if (mctx.playerState !== 'CUTTING' || !mctx.aggroActive) {
      this.isSwarmAggro = false;
      return false;
    }

    this.isSwarmAggro = true;
    const mult = mctx.aggroSpeedMult ?? 1.45;
    const targetSpd = baseSpeed * mctx.speedScale * mult;
    this.currentSpeed = targetSpd;

    let targetX = mctx.playerPos.x;
    let targetY = mctx.playerPos.y;

    if (mctx.interceptLead && mctx.playerVel) {
      const distToShip = Math.hypot(mctx.playerPos.x - this.x, mctx.playerPos.y - this.y);
      const leadSec = Math.min(0.55, distToShip / Math.max(140, targetSpd));
      targetX += mctx.playerVel.x * leadSec;
      targetY += mctx.playerVel.y * leadSec;
    }

    if (mctx.activeTrail.length >= 2) {
      const trailClosest = projectPointToPolyline({ x: this.x, y: this.y }, mctx.activeTrail);
      const distTrail = Math.hypot(trailClosest.point.x - this.x, trailClosest.point.y - this.y);
      const distShip = Math.hypot(targetX - this.x, targetY - this.y);
      if (distTrail < distShip * 0.72) {
        targetX = trailClosest.point.x;
        targetY = trailClosest.point.y;
      }
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const desiredVx = (dx / dist) * targetSpd;
    const desiredVy = (dy / dist) * targetSpd;

    const blend = Math.min(1, Math.max(0.62, mctx.dt * (mctx.interceptLead ? 14 : 10)));
    const mx = this.vx + (desiredVx - this.vx) * blend;
    const my = this.vy + (desiredVy - this.vy) * blend;
    const norm = Math.hypot(mx, my) || 1;
    this.vx = (mx / norm) * targetSpd;
    this.vy = (my / norm) * targetSpd;
    return true;
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
