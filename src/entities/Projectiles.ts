import { PALETTE } from '../core/Config';
import {
  pointInPolygonStrict,
  projectPointToSegment,
  resolvePolygonPenetration
} from '../geometry/PolygonMath';
import { Direction, DIR_VECTORS, Point } from '../geometry/Types';

export interface PlayerBolt {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  heavyPlasma: boolean;
  radius: number;
}

export interface EnemyBullet {
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  piercesBorderCheck: boolean;
  ricochets: number;
  bouncesLeft: number;
  homingTurnRate: number;
  lifeLeftSec: number;
  /** V7 Law 4: True when fired by the Stage Boss (`ZOR` Boss bullets detonate cut lines in `0ms`!). */
  fromBoss: boolean;
}

export interface BulletGovernorCaps {
  maxActiveEnemyBullets: number;
  maxBulletSpeedPx: number;
  minDodgeGapPx: number;
}

export class ProjectileManager {
  public readonly playerBolts: PlayerBolt[] = [];
  public readonly enemyBullets: EnemyBullet[] = [];
  public governorCaps: BulletGovernorCaps | null = null;

  constructor() {
    for (let i = 0; i < 64; i++) {
      this.playerBolts.push({
        active: false,
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        heavyPlasma: false,
        radius: 6
      });
    }
    for (let i = 0; i < 128; i++) {
      this.enemyBullets.push({
        active: false,
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        radius: 6,
        color: PALETTE.CUT_ORANGE,
        piercesBorderCheck: false,
        ricochets: 0,
        bouncesLeft: 0,
        homingTurnRate: 0,
        lifeLeftSec: -1,
        fromBoss: false
      });
    }
  }

  public clearAll(): void {
    for (const b of this.playerBolts) b.active = false;
    for (const b of this.enemyBullets) b.active = false;
  }

  public clearEnemyBullets(): void {
    for (const b of this.enemyBullets) b.active = false;
  }

  public countActiveEnemyBullets(): number {
    let count = 0;
    for (const b of this.enemyBullets) {
      if (b.active) count++;
    }
    return count;
  }

  public destroyEnemyBulletsNearSegments(
    segments: ReadonlyArray<{ p1: Point; p2: Point }>,
    maxDistPx: number
  ): number {
    let cleared = 0;
    for (const eb of this.enemyBullets) {
      if (!eb.active) continue;
      for (const seg of segments) {
        const proj = projectPointToSegment({ x: eb.x, y: eb.y }, seg.p1, seg.p2);
        if (proj.distance <= eb.radius + maxDistPx) {
          eb.active = false;
          cleared++;
          break;
        }
      }
    }
    return cleared;
  }

  /**
   * Fires `L` Twin Pixel Laser (`heavyPlasma = false`) or `★` 3-Way Heavy Super Plasma Spread (`heavyPlasma = true`)!
   */
  public spawnPlayerBolt(origin: Point, dir: Direction, heavyPlasma: boolean): void {
    const { dx, dy } = DIR_VECTORS[dir];
    const baseAngle = Math.atan2(dy, dx);

    if (heavyPlasma) {
      const speed = 660;
      for (const offsetRad of [-0.28, 0, 0.28]) {
        const a = baseAngle + offsetRad;
        this.activatePlayerBolt(
          origin.x + dx * 16,
          origin.y + dy * 16,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
          true,
          10
        );
      }
      return;
    }

    const speed = 860;
    this.activatePlayerBolt(
      origin.x + dx * 14,
      origin.y + dy * 14,
      dx * speed,
      dy * speed,
      false,
      6.5
    );
  }

  private activatePlayerBolt(
    x: number,
    y: number,
    vx: number,
    vy: number,
    heavyPlasma: boolean,
    radius: number
  ): void {
    for (const b of this.playerBolts) {
      if (!b.active) {
        b.active = true;
        b.x = x;
        b.y = y;
        b.prevX = x;
        b.prevY = y;
        b.vx = vx;
        b.vy = vy;
        b.heavyPlasma = heavyPlasma;
        b.radius = radius;
        return;
      }
    }
  }

  public spawnEnemyBullet(
    origin: Point,
    vx: number,
    vy: number,
    color: string = PALETTE.CUT_ORANGE,
    radius = 6,
    homingTurnRate = 0,
    lifeLeftSec = -1,
    fromBoss = false,
    bouncesLeft = 0
  ): void {
    let finalVx = vx;
    let finalVy = vy;

    if (this.governorCaps) {
      const caps = this.governorCaps;
      if (this.countActiveEnemyBullets() >= caps.maxActiveEnemyBullets) {
        return;
      }

      const rawSpd = Math.hypot(finalVx, finalVy);
      if (rawSpd > caps.maxBulletSpeedPx && rawSpd > 0.001) {
        const ratio = caps.maxBulletSpeedPx / rawSpd;
        finalVx *= ratio;
        finalVy *= ratio;
      }

      if (caps.minDodgeGapPx > 0 && rawSpd > 1) {
        const candAng = Math.atan2(finalVy, finalVx);
        for (const active of this.enemyBullets) {
          if (!active.active) continue;
          const dist = Math.hypot(active.x - origin.x, active.y - origin.y);
          const actSpd = Math.hypot(active.vx, active.vy);
          if (dist <= 10 && actSpd > 1) {
            let angDiff = Math.abs(candAng - Math.atan2(active.vy, active.vx));
            if (angDiff > Math.PI) angDiff = Math.PI * 2 - angDiff;
            // Enforce >= minDodgeGapPx corridor width at 240px dodge range
            if (angDiff * 240 < caps.minDodgeGapPx) {
              return;
            }
          } else if (dist > 10 && dist < caps.minDodgeGapPx) {
            return;
          }
        }
      }
    }

    for (const b of this.enemyBullets) {
      if (!b.active) {
        b.active = true;
        b.x = origin.x;
        b.y = origin.y;
        b.prevX = origin.x;
        b.prevY = origin.y;
        b.vx = finalVx;
        b.vy = finalVy;
        b.color = color;
        b.radius = radius;
        b.piercesBorderCheck = false;
        b.ricochets = 0;
        b.bouncesLeft = bouncesLeft;
        b.homingTurnRate = homingTurnRate;
        b.lifeLeftSec = lifeLeftSec;
        b.fromBoss = fromBoss;
        return;
      }
    }
  }

  public applyGravityCurve(origin: Point, accel: number, dt: number): void {
    for (const eb of this.enemyBullets) {
      if (!eb.active) continue;
      const spd = Math.hypot(eb.vx, eb.vy);
      if (spd < 20) continue;
      const dx = origin.x - eb.x;
      const dy = origin.y - eb.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 48 && d < 520) {
        eb.vx += (dx / d) * accel * dt;
        eb.vy += (dy / d) * accel * dt;
        const n = Math.hypot(eb.vx, eb.vy) || 1;
        eb.vx = (eb.vx / n) * spd;
        eb.vy = (eb.vy / n) * spd;
      }
    }
  }

  public update(
    dt: number,
    activePolygon: readonly Point[],
    timeFrozen: boolean,
    playerPos?: Point
  ): void {
    for (const b of this.playerBolts) {
      if (!b.active) continue;
      b.prevX = b.x;
      b.prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (!pointInPolygonStrict({ x: b.x, y: b.y }, activePolygon)) {
        b.active = false;
      }
    }

    if (timeFrozen) return;

    for (const eb of this.enemyBullets) {
      if (!eb.active) continue;
      if (eb.lifeLeftSec > 0) {
        eb.lifeLeftSec -= dt;
        if (eb.lifeLeftSec <= 0) {
          eb.active = false;
          continue;
        }
      }
      if (eb.homingTurnRate > 0 && playerPos) {
        const spd = Math.hypot(eb.vx, eb.vy);
        if (spd > 1) {
          const curAng = Math.atan2(eb.vy, eb.vx);
          const desAng = Math.atan2(playerPos.y - eb.y, playerPos.x - eb.x);
          let diff = desAng - curAng;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const maxStep = eb.homingTurnRate * dt;
          const nextAng = curAng + Math.max(-maxStep, Math.min(maxStep, diff));
          eb.vx = Math.cos(nextAng) * spd;
          eb.vy = Math.sin(nextAng) * spd;
        }
      }
      eb.prevX = eb.x;
      eb.prevY = eb.y;
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      if (!pointInPolygonStrict({ x: eb.x, y: eb.y }, activePolygon)) {
        if (eb.bouncesLeft > 0) {
          const solved = resolvePolygonPenetration(
            { x: eb.x, y: eb.y },
            Math.max(4, eb.radius),
            activePolygon
          );
          if (solved.collidedNormal) {
            const nx = solved.collidedNormal.x;
            const ny = solved.collidedNormal.y;
            const dot = eb.vx * nx + eb.vy * ny;
            if (dot < 0) {
              eb.vx -= 2 * dot * nx;
              eb.vy -= 2 * dot * ny;
            } else {
              eb.vx = -eb.vx;
              eb.vy = -eb.vy;
            }
          } else {
            eb.vx = -eb.vx;
            eb.vy = -eb.vy;
          }
          eb.x = solved.position.x;
          eb.y = solved.position.y;
          eb.bouncesLeft -= 1;
          eb.piercesBorderCheck = false;
        } else if (eb.piercesBorderCheck) {
          eb.active = false;
        } else {
          eb.piercesBorderCheck = true;
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, alpha: number): void {
    // 1. Crisp 16-bit Pixel Player Bolts (`L` Twin Laser & `★` 3-Way Gold-Cyan Super Plasma!)
    for (const b of this.playerBolts) {
      if (!b.active) continue;
      const rx = Math.round(b.prevX + (b.x - b.prevX) * alpha);
      const ry = Math.round(b.prevY + (b.y - b.prevY) * alpha);

      if (b.heavyPlasma) {
        ctx.fillStyle = PALETTE.PIXEL_BLACK;
        ctx.fillRect(rx - 9, ry - 9, 18, 18);
        ctx.fillStyle = '#FF9820';
        ctx.fillRect(rx - 7, ry - 7, 14, 14);
        ctx.fillStyle = '#FFF488';
        ctx.fillRect(rx - 4, ry - 4, 8, 8);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(rx - 2, ry - 2, 4, 4);
      } else {
        const horiz = Math.abs(b.vx) > Math.abs(b.vy);
        ctx.fillStyle = PALETTE.PIXEL_BLACK;
        if (horiz) {
          ctx.fillRect(rx - 10, ry - 8, 20, 6);
          ctx.fillRect(rx - 10, ry + 2, 20, 6);
          ctx.fillStyle = '#FF3820';
          ctx.fillRect(rx - 9, ry - 7, 18, 4);
          ctx.fillRect(rx - 9, ry + 3, 18, 4);
          ctx.fillStyle = '#FFF8C8';
          ctx.fillRect(rx - 8, ry - 6, 16, 2);
          ctx.fillRect(rx - 8, ry + 4, 16, 2);
        } else {
          ctx.fillRect(rx - 8, ry - 10, 6, 20);
          ctx.fillRect(rx + 2, ry - 10, 6, 20);
          ctx.fillStyle = '#FF3820';
          ctx.fillRect(rx - 7, ry - 9, 4, 18);
          ctx.fillRect(rx + 3, ry - 9, 4, 18);
          ctx.fillStyle = '#FFF8C8';
          ctx.fillRect(rx - 6, ry - 8, 2, 16);
          ctx.fillRect(rx + 4, ry - 8, 2, 16);
        }
      }
    }

    // 2. Crisp 16-bit Pixel Enemy Plasma Orbs & Molten Embers
    for (const eb of this.enemyBullets) {
      if (!eb.active) continue;
      const rx = Math.round(eb.prevX + (eb.x - eb.prevX) * alpha);
      const ry = Math.round(eb.prevY + (eb.y - eb.prevY) * alpha);
      const s = Math.max(5, Math.round(eb.radius));

      ctx.fillStyle = PALETTE.PIXEL_BLACK;
      ctx.fillRect(rx - s - 2, ry - s - 2, (s + 2) * 2, (s + 2) * 2);
      ctx.fillStyle = eb.color;
      ctx.fillRect(rx - s, ry - s, s * 2, s * 2);
      ctx.fillStyle = '#FFF8C8';
      ctx.fillRect(
        rx - Math.max(2, Math.floor(s * 0.45)),
        ry - Math.max(2, Math.floor(s * 0.45)),
        Math.max(4, Math.floor(s * 0.9)),
        Math.max(4, Math.floor(s * 0.9))
      );
    }
  }
}
