import { PALETTE } from '../core/Config';
import { pointInPolygonStrict } from '../geometry/PolygonMath';
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
  homingTurnRate: number;
  lifeLeftSec: number;
  /** V7 Law 4: True when fired by the Stage Boss (`ZOR` Boss bullets detonate cut lines in `0ms`!). */
  fromBoss: boolean;
}

export class ProjectileManager {
  public readonly playerBolts: PlayerBolt[] = [];
  public readonly enemyBullets: EnemyBullet[] = [];

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
    fromBoss = false
  ): void {
    for (const b of this.enemyBullets) {
      if (!b.active) {
        b.active = true;
        b.x = origin.x;
        b.y = origin.y;
        b.prevX = origin.x;
        b.prevY = origin.y;
        b.vx = vx;
        b.vy = vy;
        b.color = color;
        b.radius = radius;
        b.piercesBorderCheck = false;
        b.ricochets = 0;
        b.homingTurnRate = homingTurnRate;
        b.lifeLeftSec = lifeLeftSec;
        b.fromBoss = fromBoss;
        return;
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
        if (eb.piercesBorderCheck) {
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
