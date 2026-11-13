import { PALETTE } from '../core/Config';
import { Point } from '../geometry/Types';
import { ARENA_PIXEL_SCALE, drawPixelText, PixelTextTone } from '../rendering/PixelArtEngine';

interface PooledChip {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  isFireball: boolean;
}

interface PooledFloatingText {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  tone: PixelTextTone;
  scale: number;
}

interface PooledPressureRing {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

const MAX_CHIPS = 280;
const MAX_TEXTS = 36;
const MAX_RINGS = 16;

function mapHexToTone(hex: string): PixelTextTone {
  const h = hex.toUpperCase();
  if (h.includes('28E0') || h.includes('38F8') || h.includes('34F5') || h.includes('26F0')) {
    return 'green';
  }
  if (h.includes('50E8') || h.includes('38D6') || h.includes('CYAN')) {
    return 'cyan';
  }
  if (h.includes('FF30') || h.includes('FF28') || h.includes('FF3B')) {
    return 'red';
  }
  if (h.includes('FF78') || h.includes('FF88')) {
    return 'orange';
  }
  if (h.includes('FFF') || h.includes('DCE')) {
    return 'silver';
  }
  return 'gold';
}

/**
 * 16-Bit Pixel Fireball Explosion, Stepped Shockwave & Crisp Bitmap Pixel Score Callouts!
 */
export class ParticlePool {
  private readonly chips: PooledChip[] = [];
  private readonly texts: PooledFloatingText[] = [];
  private readonly rings: PooledPressureRing[] = [];

  private shakeIntensity = 0;
  private shakeTimer = 0;
  private shakeDuration = 0.001;

  constructor() {
    for (let i = 0; i < MAX_CHIPS; i++) {
      this.chips.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 0.34,
        size: 6,
        color: PALETTE.CUT_ORANGE,
        isFireball: false
      });
    }

    for (let i = 0; i < MAX_TEXTS; i++) {
      this.texts.push({
        active: false,
        x: 0,
        y: 0,
        vy: -46,
        life: 0,
        maxLife: 1.0,
        text: '',
        tone: 'gold',
        scale: ARENA_PIXEL_SCALE
      });
    }

    for (let i = 0; i < MAX_RINGS; i++) {
      this.rings.push({
        active: false,
        x: 0,
        y: 0,
        radius: 8,
        maxRadius: 64,
        life: 0,
        maxLife: 0.3,
        color: PALETTE.CUT_ORANGE
      });
    }
  }

  public clear(): void {
    for (const c of this.chips) c.active = false;
    for (const t of this.texts) t.active = false;
    for (const r of this.rings) r.active = false;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
  }

  public triggerShake(intensity: number, duration = 0.22): void {
    if (intensity >= this.shakeIntensity || this.shakeTimer <= 0) {
      this.shakeIntensity = intensity;
      this.shakeDuration = Math.max(0.01, duration);
      this.shakeTimer = duration;
    }
  }

  public getShakeOffset(): { x: number; y: number } {
    if (this.shakeTimer <= 0) return { x: 0, y: 0 };
    const ratio = this.shakeTimer / this.shakeDuration;
    const mag = this.shakeIntensity * ratio;
    return {
      x: Math.round((Math.random() * 2 - 1) * mag),
      y: Math.round((Math.random() * 2 - 1) * mag)
    };
  }

  public spawnBurst(
    x: number,
    y: number,
    count: number,
    color: string,
    speedMin = 50,
    speedMax = 220,
    size = 6,
    life = 0.34
  ): void {
    let spawned = 0;
    const warmExplosion =
      color === PALETTE.SIGNAL_PRIMARY ||
      color === PALETTE.CUT_ORANGE ||
      color === '#FF4422' ||
      color === '#383C44';

    for (let i = 0; i < MAX_CHIPS && spawned < count; i++) {
      const c = this.chips[i];
      if (c.active) continue;
      const angle = Math.random() * Math.PI * 2;
      const spd = speedMin + Math.random() * (speedMax - speedMin);
      c.active = true;
      c.x = x;
      c.y = y;
      c.vx = Math.cos(angle) * spd;
      c.vy = Math.sin(angle) * spd;
      c.life = life * (0.85 + Math.random() * 0.35);
      c.maxLife = c.life;
      c.isFireball = warmExplosion && spawned % 2 === 0;
      c.size = Math.max(4, Math.round(size * (c.isFireball ? 1.8 : 1.0)));
      c.color = warmExplosion
        ? spawned % 3 === 0
          ? '#FFF498'
          : spawned % 3 === 1
            ? '#FF7810'
            : '#D82014'
        : color;
      spawned++;
    }
  }

  public spawnPolygonShatter(poly: readonly Point[], junctionPoint?: Point): void {
    if (poly.length < 3) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let cx = 0;
    let cy = 0;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      cx += p.x;
      cy += p.y;
    }
    cx /= poly.length;
    cy /= poly.length;

    const spanX = Math.max(24, (maxX - minX) * 0.6);
    const spanY = Math.max(24, (maxY - minY) * 0.6);

    for (let i = 0; i < 16; i++) {
      const px = cx + (Math.random() - 0.5) * spanX;
      const py = cy + (Math.random() - 0.5) * spanY;
      const shade = i % 3 === 0 ? '#FFE058' : i % 3 === 1 ? '#FF7810' : '#94A8C8';
      this.spawnBurst(px, py, 1, shade, 35, 145, 6, 0.3);
    }

    const ringOrigin = junctionPoint ?? { x: cx, y: cy };
    this.spawnShockwave(ringOrigin.x, ringOrigin.y, 72, '#FFB833', 0.28);
  }

  public spawnShockwave(
    x: number,
    y: number,
    maxRadius = 180,
    color: string = PALETTE.CUT_ORANGE,
    duration = 0.32
  ): void {
    for (const r of this.rings) {
      if (!r.active) {
        r.active = true;
        r.x = x;
        r.y = y;
        r.radius = 10;
        r.maxRadius = maxRadius;
        r.life = duration;
        r.maxLife = duration;
        r.color = color;
        return;
      }
    }
  }

  public spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string = PALETTE.GOLD_LIGHT,
    fontSize = 22
  ): void {
    const clampedX = Math.max(110, Math.min(790, x));
    const clampedY = Math.max(60, Math.min(1140, y));
    for (const t of this.texts) {
      if (!t.active) {
        t.active = true;
        t.x = clampedX;
        t.y = clampedY;
        t.vy = -48;
        t.life = 1.05;
        t.maxLife = 1.05;
        t.text = text;
        t.tone = mapHexToTone(color);
        t.scale = fontSize >= 28 ? ARENA_PIXEL_SCALE * 1.15 : ARENA_PIXEL_SCALE * 0.92;
        return;
      }
    }
  }

  public update(dt: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    }

    const frameDrag = Math.pow(0.91, dt * 60);
    for (const c of this.chips) {
      if (!c.active) continue;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.vx *= frameDrag;
      c.vy *= frameDrag;
      c.life -= dt;
      if (c.life <= 0) {
        c.active = false;
      }
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      r.radius = 10 + (r.maxRadius - 10) * (1 - Math.pow(1 - progress, 2.2));
    }

    for (const t of this.texts) {
      if (!t.active) continue;
      t.y += t.vy * dt;
      t.vy *= Math.pow(0.95, dt * 60);
      t.life -= dt;
      if (t.life <= 0) {
        t.active = false;
      }
    }
  }

  public renderArenaEffects(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 1. Crisp 16-bit Pixel Stepped Shockwave Squares
    for (const r of this.rings) {
      if (!r.active) continue;
      const alpha = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      const rad = Math.round(r.radius);
      ctx.strokeRect(Math.round(r.x - rad), Math.round(r.y - rad), rad * 2, rad * 2);
    }

    // 2. 16-Bit Pixel Explosion Blocks & Debris
    for (const c of this.chips) {
      if (!c.active) continue;
      const ratio = Math.max(0, c.life / c.maxLife);
      const px = Math.round(c.x);
      const py = Math.round(c.y);
      const s = Math.max(3, Math.round(c.size * (0.45 + ratio * 0.65)));

      ctx.globalAlpha = Math.min(1, ratio * 1.3);
      ctx.fillStyle = PALETTE.PIXEL_BLACK;
      ctx.fillRect(px - s - 1, py - s - 1, s * 2 + 2, s * 2 + 2);
      ctx.fillStyle = c.isFireball
        ? ratio > 0.65
          ? '#FFF8B8'
          : ratio > 0.34
            ? '#FF7810'
            : '#B81C10'
        : c.color;
      ctx.fillRect(px - s, py - s, s * 2, s * 2);
    }

    // 3. Crisp 16-Bit Pixel Score & Power-Up Callouts!
    for (const t of this.texts) {
      if (!t.active) continue;
      const alpha = Math.min(1, (t.life / t.maxLife) * 1.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      drawPixelText(ctx, t.text, Math.round(t.x), Math.round(t.y), {
        scale: t.scale,
        tone: t.tone,
        align: 'center'
      });
      ctx.restore();
    }

    ctx.restore();
  }
}
