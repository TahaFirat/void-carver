import { Point } from './Types';

/**
 * Solid "wall" power-up blocks (V5): axis-aligned square obstacles that can never be
 * crossed by the cutting ship, minions, bosses or projectiles.
 *
 * Logical arena space is 900x1200 (= 540x720 design world x 5/3), so the spec's
 * `44px` box becomes `68` logical units (`half = 34`) and the `2px` clearance becomes `2`.
 */
export const SOLID_BOX_HALF = 34;
export const SOLID_BOX_CLEARANCE = 2;
export const SHIP_BLOCK_HALF = SOLID_BOX_HALF + SOLID_BOX_CLEARANCE; // 36 (even grid value)

/** Minimum distance between box centers and the outer arena frame (`56` design px + half). */
export const BOX_BORDER_MARGIN = 130;
/** Minimum Chebyshev distance between two box centers (edge gap >= 92 logical units). */
export const BOX_MIN_CENTER_GAP = 160;

export interface SolidRect {
  readonly x: number;
  readonly y: number;
  readonly half: number;
}

/**
 * True when `p` lies strictly inside any box expanded by `extraHalf - box.half`.
 * Points exactly on the expanded edge are allowed, so the ship can slide along a wall.
 */
export function isPointBlockedBySolidBoxes(
  p: Point,
  boxes: readonly SolidRect[],
  shipHalf = SHIP_BLOCK_HALF
): boolean {
  for (const b of boxes) {
    const h = shipHalf + (b.half - SOLID_BOX_HALF);
    if (Math.abs(p.x - b.x) < h && Math.abs(p.y - b.y) < h) {
      return true;
    }
  }
  return false;
}

export interface BouncingBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Circle vs AABB elastic bounce. Pushes the body fully outside the box along the
 * contact normal and reflects the velocity component pointing into the box.
 * Returns true when a collision was resolved.
 */
export function bounceCircleOffSolidBoxes(
  body: BouncingBody,
  radius: number,
  boxes: readonly SolidRect[]
): boolean {
  let hit = false;
  for (const b of boxes) {
    const cx = Math.max(b.x - b.half, Math.min(b.x + b.half, body.x));
    const cy = Math.max(b.y - b.half, Math.min(b.y + b.half, body.y));
    let dx = body.x - cx;
    let dy = body.y - cy;
    let dist = Math.hypot(dx, dy);

    if (dist >= radius) continue;

    let nx: number;
    let ny: number;
    if (dist < 1e-6) {
      // Center is inside the box: push out along the axis of least penetration
      const penL = body.x - (b.x - b.half);
      const penR = b.x + b.half - body.x;
      const penT = body.y - (b.y - b.half);
      const penB = b.y + b.half - body.y;
      const minPen = Math.min(penL, penR, penT, penB);
      if (minPen === penL) {
        nx = -1;
        ny = 0;
        dist = -penL;
      } else if (minPen === penR) {
        nx = 1;
        ny = 0;
        dist = -penR;
      } else if (minPen === penT) {
        nx = 0;
        ny = -1;
        dist = -penT;
      } else {
        nx = 0;
        ny = 1;
        dist = -penB;
      }
      dx = nx;
      dy = ny;
    } else {
      nx = dx / dist;
      ny = dy / dist;
    }

    const push = radius - dist + 0.5;
    body.x += nx * push;
    body.y += ny * push;

    const dot = body.vx * nx + body.vy * ny;
    if (dot < 0) {
      body.vx -= 2 * dot * nx;
      body.vy -= 2 * dot * ny;
    }
    hit = true;
  }
  return hit;
}

/** True when a circle overlaps any box (used for projectile impacts). */
export function circleHitsSolidBox(
  x: number,
  y: number,
  radius: number,
  boxes: readonly SolidRect[]
): SolidRect | null {
  for (const b of boxes) {
    const cx = Math.max(b.x - b.half, Math.min(b.x + b.half, x));
    const cy = Math.max(b.y - b.half, Math.min(b.y + b.half, y));
    if (Math.hypot(x - cx, y - cy) < radius) {
      return b;
    }
  }
  return null;
}
