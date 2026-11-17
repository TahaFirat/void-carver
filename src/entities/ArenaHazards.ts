import { PALETTE } from '../core/Config';
import { pointInPolygonStrict, projectPointToPolygon } from '../geometry/PolygonMath';
import { Point } from '../geometry/Types';
import {
  getFrostTrailSprite,
  getMagmaPoolSprite,
  getProximityMineSprite,
  getWebZoneSprite
} from '../rendering/BestiarySprites';
import { blitArenaPixelSprite } from '../rendering/PixelArtEngine';

export interface MagmaPoolHazard {
  x: number;
  y: number;
  radius: number;
  lifeSec: number;
  maxLifeSec: number;
}

export interface FrostZoneHazard {
  x: number;
  y: number;
  radius: number;
  lifeSec: number;
  maxLifeSec: number;
}

export interface WebZoneHazard {
  x: number;
  y: number;
  radius: number;
  lifeSec: number;
  maxLifeSec: number;
}

export interface SpaceMineHazard {
  x: number;
  y: number;
  radius: number;
  lifeSec: number;
  maxLifeSec: number;
}

export interface StaticBorderArcHazard {
  p1: Point;
  p2: Point;
  lifeSec: number;
  maxLifeSec: number;
}

export class ArenaHazardManager {
  public magmaPools: MagmaPoolHazard[] = [];
  public frostZones: FrostZoneHazard[] = [];
  public webZones: WebZoneHazard[] = [];
  public spaceMines: SpaceMineHazard[] = [];
  public staticArcs: StaticBorderArcHazard[] = [];
  private seekerRespawnTimers: number[] = [];

  public clear(): void {
    this.magmaPools = [];
    this.frostZones = [];
    this.webZones = [];
    this.spaceMines = [];
    this.staticArcs = [];
    this.seekerRespawnTimers = [];
  }

  public spawnFrostZone(pos: Point, durationSec = 2.5, radius = 26): void {
    if (this.frostZones.some((f) => Math.hypot(f.x - pos.x, f.y - pos.y) < 26)) {
      return;
    }
    if (this.frostZones.length >= 10) {
      this.frostZones.shift();
    }
    this.frostZones.push({
      x: pos.x,
      y: pos.y,
      radius,
      lifeSec: durationSec,
      maxLifeSec: durationSec
    });
  }

  public isPointInFrostZone(pos: Point): boolean {
    for (const f of this.frostZones) {
      if (Math.hypot(pos.x - f.x, pos.y - f.y) <= f.radius) {
        return true;
      }
    }
    return false;
  }

  public spawnMagmaPool(pos: Point, durationSec = 3.0, radius = 22): void {
    // Avoid stacking pools right on top of each other
    if (this.magmaPools.some((p) => Math.hypot(p.x - pos.x, p.y - pos.y) < 28)) {
      return;
    }
    if (this.magmaPools.length >= 10) {
      this.magmaPools.shift();
    }
    this.magmaPools.push({
      x: pos.x,
      y: pos.y,
      radius,
      lifeSec: durationSec,
      maxLifeSec: durationSec
    });
  }

  public spawnWebZone(pos: Point, durationSec = 5.0, radius = 38): void {
    if (this.webZones.length >= 4) {
      this.webZones.shift();
    }
    this.webZones.push({
      x: pos.x,
      y: pos.y,
      radius,
      lifeSec: durationSec,
      maxLifeSec: durationSec
    });
  }

  public spawnSpaceMine(pos: Point, durationSec = 5.5, radius = 13): void {
    if (this.spaceMines.length >= 8) {
      this.spaceMines.shift();
    }
    this.spaceMines.push({
      x: pos.x,
      y: pos.y,
      radius,
      lifeSec: durationSec,
      maxLifeSec: durationSec
    });
  }

  public spawnStaticBorderArc(p1: Point, p2: Point, durationSec = 2.5): void {
    if (this.staticArcs.length >= 4) {
      this.staticArcs.shift();
    }
    this.staticArcs.push({
      p1: { x: p1.x, y: p1.y },
      p2: { x: p2.x, y: p2.y },
      lifeSec: durationSec,
      maxLifeSec: durationSec
    });
  }

  public queueSeekerRespawn(delaySec = 5.0): void {
    if (this.seekerRespawnTimers.length < 4) {
      this.seekerRespawnTimers.push(delaySec);
    }
  }

  public isPointInWebZone(pos: Point): boolean {
    for (const w of this.webZones) {
      if (Math.hypot(pos.x - w.x, pos.y - w.y) <= w.radius) {
        return true;
      }
    }
    return false;
  }

  public pruneOutsidePolygon(activePolygon: readonly Point[]): void {
    this.magmaPools = this.magmaPools.filter((p) => pointInPolygonStrict(p, activePolygon));
    this.frostZones = this.frostZones.filter((f) => pointInPolygonStrict(f, activePolygon));
    this.webZones = this.webZones.filter((w) => pointInPolygonStrict(w, activePolygon));
    this.spaceMines = this.spaceMines.filter((m) => pointInPolygonStrict(m, activePolygon));
    this.staticArcs = this.staticArcs.filter((a) => {
      const mid = { x: (a.p1.x + a.p2.x) * 0.5, y: (a.p1.y + a.p2.y) * 0.5 };
      const proj = projectPointToPolygon(mid, activePolygon);
      return proj.distance <= 8;
    });
  }

  /**
   * Advances hazard timers and returns the count of HomingSeekers ready to respawn near the Boss.
   */
  public update(dt: number): number {
    for (const p of this.magmaPools) p.lifeSec -= dt;
    this.magmaPools = this.magmaPools.filter((p) => p.lifeSec > 0);

    for (const f of this.frostZones) f.lifeSec -= dt;
    this.frostZones = this.frostZones.filter((f) => f.lifeSec > 0);

    for (const w of this.webZones) w.lifeSec -= dt;
    this.webZones = this.webZones.filter((w) => w.lifeSec > 0);

    for (const m of this.spaceMines) m.lifeSec -= dt;
    this.spaceMines = this.spaceMines.filter((m) => m.lifeSec > 0);

    for (const a of this.staticArcs) a.lifeSec -= dt;
    this.staticArcs = this.staticArcs.filter((a) => a.lifeSec > 0);

    let readySeekers = 0;
    const remainingTimers: number[] = [];
    for (const t of this.seekerRespawnTimers) {
      const next = t - dt;
      if (next <= 0) {
        readySeekers++;
      } else {
        remainingTimers.push(next);
      }
    }
    this.seekerRespawnTimers = remainingTimers;
    return readySeekers;
  }

  public render(ctx: CanvasRenderingContext2D, timeSeconds: number): void {
    const f2: 0 | 1 = Math.floor(timeSeconds * 8) % 2 === 0 ? 0 : 1;

    // 1. Cyber Silk Web Zones (`MechaTarantula`)
    for (const w of this.webZones) {
      const fade = w.lifeSec < 0.7 ? Math.max(0.25, w.lifeSec / 0.7) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      const sprite = getWebZoneSprite(f2);
      blitArenaPixelSprite(ctx, sprite, w.x, w.y, (w.radius * 2) / (36 * 3.125));
      ctx.restore();
    }

    // 1B. Non-Lethal Frost Crystal Wake Zones (`FrostLeviathan` — slows cutting speed!)
    for (const f of this.frostZones) {
      const fade = f.lifeSec < 0.6 ? Math.max(0.25, f.lifeSec / 0.6) : 0.92;
      ctx.save();
      ctx.globalAlpha = fade;
      const sprite = getFrostTrailSprite(f2);
      blitArenaPixelSprite(ctx, sprite, f.x, f.y, 0.95);
      ctx.restore();
    }

    // 2. Burning Pixel Magma Pools (`MagmaSerpent` / `MAGMA_WAKE`)
    for (const p of this.magmaPools) {
      const fade = p.lifeSec < 0.6 ? Math.max(0.25, p.lifeSec / 0.6) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      const sprite = getMagmaPoolSprite(f2);
      blitArenaPixelSprite(ctx, sprite, p.x, p.y, 0.92);
      ctx.restore();
    }

    // 3. Spiked Proximity Space Mines (`MineLayerDrone`)
    for (const m of this.spaceMines) {
      const fastBlink = m.lifeSec < 1.5 ? 16 : 7;
      const blinkRed = Math.floor(timeSeconds * fastBlink) % 2 === 0;
      const sprite = getProximityMineSprite(blinkRed);
      blitArenaPixelSprite(ctx, sprite, m.x, m.y, 1.0);
    }

    // 4. Electrified Border Segments (`ElectricMedusa`)
    for (const a of this.staticArcs) {
      ctx.save();
      const alt = Math.floor(timeSeconds * 22) % 2 === 0;
      ctx.strokeStyle = PALETTE.PIXEL_BLACK;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(Math.round(a.p1.x), Math.round(a.p1.y));
      ctx.lineTo(Math.round(a.p2.x), Math.round(a.p2.y));
      ctx.stroke();

      ctx.strokeStyle = alt ? '#58F8FF' : '#C868FF';
      ctx.lineWidth = 5;
      ctx.beginPath();
      const steps = 6;
      ctx.moveTo(Math.round(a.p1.x), Math.round(a.p1.y));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const jitter = ((i + (alt ? 1 : 0)) % 2 === 0 ? 1 : -1) * 4;
        const dx = a.p2.x - a.p1.x;
        const dy = a.p2.y - a.p1.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        ctx.lineTo(
          Math.round(a.p1.x + dx * t + nx * jitter),
          Math.round(a.p1.y + dy * t + ny * jitter)
        );
      }
      ctx.lineTo(Math.round(a.p2.x), Math.round(a.p2.y));
      ctx.stroke();
      ctx.restore();
    }
  }
}
