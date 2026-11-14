import { BACKTRACK_SPEED_MULTIPLIER } from '../core/Config';
import { CardinalDir } from '../input/TouchGestureEngine';

export interface GridPoint {
  x: number;
  y: number;
}

export interface SolidBoxObstacle {
  id: string;
  x: number;
  y: number;
  halfSize: number;
  active: boolean;
}

export interface BarrierRange {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type ShipMode = 'ON_BORDER' | 'CUTTING';

export interface StepOutcome {
  mode: ShipMode;
  pos: GridPoint;
  facing: CardinalDir;
  trail: GridPoint[];
  completedCut: boolean;
  reconnectedAt?: GridPoint;
  hitSolidBox?: boolean;
  turnedCorner?: boolean;
}

const GRID = 2;
const CORNER_ASSIST_PX = 12;
const MIN_TURN_SEGMENT_PX = 4;
const CUT_LAUNCH_PROBE_PX = 6;
const EXIT_SNAP_CLEARANCE_PX = 18;
const SELF_TRAIL_CUSHION_PX = 6;

export function snapGrid(v: number): number {
  return Math.round(v / GRID) * GRID;
}

export function dirVector(dir: CardinalDir): GridPoint {
  switch (dir) {
    case 'UP':
      return { x: 0, y: -1 };
    case 'DOWN':
      return { x: 0, y: 1 };
    case 'LEFT':
      return { x: -1, y: 0 };
    case 'RIGHT':
      return { x: 1, y: 0 };
  }
}

export function oppositeDir(dir: CardinalDir): CardinalDir {
  switch (dir) {
    case 'UP':
      return 'DOWN';
    case 'DOWN':
      return 'UP';
    case 'LEFT':
      return 'RIGHT';
    case 'RIGHT':
      return 'LEFT';
  }
}

export function pointOnSegment(p: GridPoint, a: GridPoint, b: GridPoint, eps = 0.5): boolean {
  const minX = Math.min(a.x, b.x) - eps;
  const maxX = Math.max(a.x, b.x) + eps;
  const minY = Math.min(a.y, b.y) - eps;
  const maxY = Math.max(a.y, b.y) + eps;
  if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) return false;
  const cross = Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x));
  return cross <= eps * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
}

export function pointOnPolygonBoundary(p: GridPoint, poly: readonly GridPoint[], eps = 0.5): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (pointOnSegment(p, a, b, eps)) return true;
  }
  return false;
}

/** Strictly inside activePolygon (excludes boundary!) */
export function pointStrictlyInsidePolygon(p: GridPoint, poly: readonly GridPoint[]): boolean {
  if (pointOnPolygonBoundary(p, poly, 0.5)) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x,
      yi = poly[i].y;
    const xj = poly[j].x,
      yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export class BorderAndCutNavigator {
  public mode: ShipMode = 'ON_BORDER';
  public pos: GridPoint;
  public facing: CardinalDir = 'UP';
  public cutDir: CardinalDir = 'UP';
  public trail: GridPoint[] = [];
  private queuedTurn: CardinalDir | null = null;
  private rewindHoldLatchDir: CardinalDir | null = null;

  constructor(startPos: GridPoint) {
    this.pos = { x: snapGrid(startPos.x), y: snapGrid(startPos.y) };
  }

  public resetToBorder(pos: GridPoint): void {
    this.mode = 'ON_BORDER';
    this.pos = { x: snapGrid(pos.x), y: snapGrid(pos.y) };
    this.trail = [];
    this.queuedTurn = null;
    this.rewindHoldLatchDir = null;
  }

  public step(
    dt: number,
    speedPxPerSec: number,
    desiredDir: CardinalDir | null,
    cutAllowed: boolean,
    activePolygon: readonly GridPoint[],
    solidBoxes: readonly SolidBoxObstacle[],
    barriers: readonly BarrierRange[],
    secondaryDir: CardinalDir | null = null
  ): StepOutcome {
    const stepDist = Math.max(GRID, snapGrid(speedPxPerSec * dt));

    if (this.mode === 'ON_BORDER') {
      return this.stepOnBorder(
        stepDist,
        desiredDir,
        secondaryDir,
        cutAllowed,
        activePolygon,
        solidBoxes,
        barriers
      );
    }
    return this.stepCutting(stepDist, desiredDir, activePolygon, solidBoxes, barriers);
  }

  private stepOnBorder(
    stepDist: number,
    desiredDir: CardinalDir | null,
    secondaryDir: CardinalDir | null,
    cutAllowed: boolean,
    poly: readonly GridPoint[],
    boxes: readonly SolidBoxObstacle[],
    barriers: readonly BarrierRange[]
  ): StepOutcome {
    // V7 Law 1: Zero-Inertia 1:1 Stop (`moveDir === null` -> `0px` movement!)
    if (!desiredDir) {
      return {
        mode: 'ON_BORDER',
        pos: { ...this.pos },
        facing: this.facing,
        trail: [],
        completedCut: false
      };
    }

    const prevFacing = this.facing;
    this.facing = desiredDir;

    // PRIORITY 1: Explicit Cut Launch (`cutIntent === true` AND `pos + moveDir * 6` enters `activePolygon`)
    if (cutAllowed && this.canLaunchCutFrom(this.pos, desiredDir, poly, boxes, barriers)) {
      return this.beginCutFrom(this.pos, desiredDir, stepDist, poly, boxes, barriers);
    }

    // PRIORITY 2: Safe Border Walk along `desiredDir`
    const directMove = this.advanceAlongMatchingBorderEdge(this.pos, desiredDir, stepDist, poly);
    if (directMove.moved) {
      this.pos = directMove.newPos;
      if (directMove.hitVertex) {
        const leftover = Math.max(0, stepDist - directMove.travelled);
        if (cutAllowed && this.canLaunchCutFrom(this.pos, desiredDir, poly, boxes, barriers)) {
          return this.beginCutFrom(
            this.pos,
            desiredDir,
            Math.max(GRID, leftover),
            poly,
            boxes,
            barriers
          );
        }
        // PC Diagonal Safe-Border Corner Rounding (`UP + RIGHT` with `cutIntent === false`):
        // Rounds onto the held perpendicular border edge without EVER entering `activePolygon`!
        if (
          !cutAllowed &&
          leftover > 0 &&
          secondaryDir &&
          secondaryDir !== desiredDir &&
          secondaryDir !== oppositeDir(desiredDir)
        ) {
          const diagTurn = this.advanceAlongMatchingBorderEdge(this.pos, secondaryDir, leftover, poly);
          if (diagTurn.moved) {
            this.pos = diagTurn.newPos;
            this.facing = secondaryDir;
            return {
              mode: 'ON_BORDER',
              pos: { ...this.pos },
              facing: this.facing,
              trail: [],
              completedCut: false,
              turnedCorner: true
            };
          }
        }
      }
      return {
        mode: 'ON_BORDER',
        pos: { ...this.pos },
        facing: this.facing,
        trail: [],
        completedCut: false,
        turnedCorner: prevFacing !== this.facing
      };
    }

    // PRIORITY 3: Near-Corner Snap (`<= 8px`) for `cutIntent + moveDir` OR crisp corner turn
    const nearVertex = this.findNearbyValidTurnVertex(
      this.pos,
      desiredDir,
      cutAllowed,
      poly,
      boxes,
      barriers
    );
    if (nearVertex) {
      const dx = nearVertex.x - this.pos.x;
      const dy = nearVertex.y - this.pos.y;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist <= stepDist) {
        this.pos = { ...nearVertex };
        const leftover = Math.max(GRID, stepDist - dist);
        if (cutAllowed && this.canLaunchCutFrom(this.pos, desiredDir, poly, boxes, barriers)) {
          return this.beginCutFrom(this.pos, desiredDir, leftover, poly, boxes, barriers);
        }
        const afterSnap = this.advanceAlongMatchingBorderEdge(this.pos, desiredDir, leftover, poly);
        if (afterSnap.moved) {
          this.pos = afterSnap.newPos;
        }
        return {
          mode: 'ON_BORDER',
          pos: { ...this.pos },
          facing: this.facing,
          trail: [],
          completedCut: false,
          turnedCorner: true
        };
      }
      this.pos = {
        x: snapGrid(this.pos.x + Math.sign(dx) * stepDist),
        y: snapGrid(this.pos.y + Math.sign(dy) * stepDist)
      };
      return {
        mode: 'ON_BORDER',
        pos: { ...this.pos },
        facing: this.facing,
        trail: [],
        completedCut: false
      };
    }

    // PRIORITY 4: PC Diagonal Safe-Border Glide when `desiredDir` awaits the upcoming corner
    // while `secondaryDir` runs along the current border edge (`UP` held first, then `RIGHT` added!)
    if (
      !cutAllowed &&
      secondaryDir &&
      secondaryDir !== desiredDir &&
      secondaryDir !== oppositeDir(desiredDir)
    ) {
      const secMove = this.advanceAlongMatchingBorderEdge(this.pos, secondaryDir, stepDist, poly);
      if (secMove.moved) {
        this.pos = secMove.newPos;
        this.facing = secondaryDir;
        if (secMove.hitVertex) {
          const leftover = Math.max(0, stepDist - secMove.travelled);
          if (leftover > 0) {
            const roundCorner = this.advanceAlongMatchingBorderEdge(
              this.pos,
              desiredDir,
              leftover,
              poly
            );
            if (roundCorner.moved) {
              this.pos = roundCorner.newPos;
              this.facing = desiredDir;
            }
          }
        }
        return {
          mode: 'ON_BORDER',
          pos: { ...this.pos },
          facing: this.facing,
          trail: [],
          completedCut: false,
          turnedCorner: prevFacing !== this.facing
        };
      }
    }

    // Single key held at an outer corner stops cleanly (`0px` ping-pong guaranteed!)
    return {
      mode: 'ON_BORDER',
      pos: { ...this.pos },
      facing: this.facing,
      trail: [],
      completedCut: false
    };
  }

  public canLaunchCutFrom(
    origin: GridPoint,
    dir: CardinalDir,
    poly: readonly GridPoint[],
    boxes: readonly SolidBoxObstacle[],
    barriers: readonly BarrierRange[]
  ): boolean {
    if (this.isPointBlockedByBarrier(origin, barriers)) return false;
    const v = dirVector(dir);
    const probeNear = { x: origin.x + v.x * GRID, y: origin.y + v.y * GRID };
    const probeSix = {
      x: origin.x + v.x * CUT_LAUNCH_PROBE_PX,
      y: origin.y + v.y * CUT_LAUNCH_PROBE_PX
    };
    if (!pointStrictlyInsidePolygon(probeNear, poly)) return false;
    if (!pointStrictlyInsidePolygon(probeSix, poly)) return false;
    if (
      this.isPointInsideSolidBox(probeNear, boxes, 4) ||
      this.isPointInsideSolidBox(probeSix, boxes, 4)
    ) {
      return false;
    }
    return true;
  }

  private beginCutFrom(
    origin: GridPoint,
    dir: CardinalDir,
    initialStep: number,
    poly: readonly GridPoint[],
    boxes: readonly SolidBoxObstacle[],
    barriers: readonly BarrierRange[]
  ): StepOutcome {
    this.mode = 'CUTTING';
    this.cutDir = dir;
    this.facing = dir;
    this.queuedTurn = null;
    this.rewindHoldLatchDir = null;
    this.trail = [
      { x: origin.x, y: origin.y },
      { x: origin.x, y: origin.y }
    ];
    const res = this.stepCutting(initialStep, dir, poly, boxes, barriers);
    res.turnedCorner = true;
    return res;
  }

  private isNearValidBorderExit(
    poly: readonly GridPoint[],
    barriers: readonly BarrierRange[]
  ): boolean {
    const v = dirVector(this.cutDir);
    for (let d = GRID; d <= EXIT_SNAP_CLEARANCE_PX; d += GRID) {
      const ahead = { x: this.pos.x + v.x * d, y: this.pos.y + v.y * d };
      if (pointOnPolygonBoundary(ahead, poly, 0.5)) {
        if (this.isPointBlockedByBarrier(ahead, barriers)) return false;
        if (this.trail.length > 0 && ahead.x === this.trail[0].x && ahead.y === this.trail[0].y) {
          return false;
        }
        return true;
      }
    }
    return false;
  }

  private stepCutting(
    stepDist: number,
    desiredDir: CardinalDir | null,
    poly: readonly GridPoint[],
    boxes: readonly SolidBoxObstacle[],
    barriers: readonly BarrierRange[]
  ): StepOutcome {
    // V7 Law 1: Zero-Inertia 1:1 Stop!
    // Releasing directional input (`desiredDir === null`) stops the ship on the exact pixel (`0px` drift!).
    // Releasing `SPACE`/`KES` does NOT cancel `CUTTING` — the ship remains in `CUTTING` at its exact pixel!
    if (!desiredDir) {
      this.rewindHoldLatchDir = null;
      this.queuedTurn = null;
      return {
        mode: 'CUTTING',
        pos: { ...this.pos },
        facing: this.facing,
        trail: this.trail.map((p) => ({ ...p })),
        completedCut: false
      };
    }

    if (this.rewindHoldLatchDir) {
      if (desiredDir === this.rewindHoldLatchDir) {
        return {
          mode: 'CUTTING',
          pos: { ...this.pos },
          facing: this.facing,
          trail: this.trail.map((p) => ({ ...p })),
          completedCut: false
        };
      }
      this.rewindHoldLatchDir = null;
    }

    // 1) Authentic 1989 Arcade 180° Line Backtrack / Rewind (`1.2x` speed!)
    if (desiredDir === oppositeDir(this.cutDir)) {
      this.queuedTurn = null;
      return this.rewindTrail(
        Math.max(GRID, snapGrid(stepDist * BACKTRACK_SPEED_MULTIPLIER)),
        desiredDir
      );
    }

    // 2) Queue perpendicular 90° turns cleanly
    if (desiredDir !== this.cutDir && desiredDir !== oppositeDir(this.cutDir)) {
      this.queuedTurn = desiredDir;
    } else {
      this.queuedTurn = null;
    }

    let turned = false;
    if (this.queuedTurn && !this.isNearValidBorderExit(poly, barriers)) {
      const prevCorner = this.trail[this.trail.length - 2];
      const segLen = Math.abs(this.pos.x - prevCorner.x) + Math.abs(this.pos.y - prevCorner.y);
      const fwd = dirVector(this.cutDir);
      const nextFwd = { x: this.pos.x + fwd.x * GRID, y: this.pos.y + fwd.y * GRID };
      const blockedForward =
        this.isPointInsideSolidBox(nextFwd, boxes, 4) ||
        this.hitsOwnTrail(this.pos, nextFwd) ||
        (pointOnPolygonBoundary(nextFwd, poly, 0.5) && this.isPointBlockedByBarrier(nextFwd, barriers));

      if (segLen >= MIN_TURN_SEGMENT_PX || (segLen >= GRID && blockedForward)) {
        const tv = dirVector(this.queuedTurn);
        const firstStep = { x: this.pos.x + tv.x * GRID, y: this.pos.y + tv.y * GRID };
        const turnProbe = { x: this.pos.x + tv.x * 4, y: this.pos.y + tv.y * 4 };
        const stepStaysValid =
          pointStrictlyInsidePolygon(firstStep, poly) ||
          (pointOnPolygonBoundary(firstStep, poly, 0.5) &&
            !this.isPointBlockedByBarrier(firstStep, barriers) &&
            !(firstStep.x === this.trail[0].x && firstStep.y === this.trail[0].y));
        const probeBlockedByBox =
          this.isPointInsideSolidBox(firstStep, boxes, 4) ||
          (pointStrictlyInsidePolygon(turnProbe, poly) &&
            this.isPointInsideSolidBox(turnProbe, boxes, 4));
        if (stepStaysValid && !probeBlockedByBox && !this.hitsOwnTrail(this.pos, firstStep)) {
          this.cutDir = this.queuedTurn;
          this.facing = this.queuedTurn;
          this.queuedTurn = null;
          this.trail[this.trail.length - 1] = { ...this.pos };
          this.trail.push({ ...this.pos });
          turned = true;
        }
      }
    }

    // 3) Advance strictly while directional input is held (`desiredDir !== null`)
    const v = dirVector(this.cutDir);
    let remaining = stepDist;
    let hitSolidBox = false;

    while (remaining > 0) {
      const step = Math.min(GRID, remaining);
      const next: GridPoint = { x: this.pos.x + v.x * step, y: this.pos.y + v.y * step };
      const ahead4: GridPoint = { x: this.pos.x + v.x * 4, y: this.pos.y + v.y * 4 };

      // Check reconnection with activePolygon perimeter!
      if (pointOnPolygonBoundary(next, poly, 0.5)) {
        if (
          this.isPointBlockedByBarrier(next, barriers) ||
          (this.trail.length > 0 && next.x === this.trail[0].x && next.y === this.trail[0].y)
        ) {
          break;
        }
        this.pos = next;
        this.trail[this.trail.length - 1] = { ...this.pos };
        const finishedTrail = this.trail.map((p) => ({ ...p }));
        this.mode = 'ON_BORDER';
        this.trail = [];
        this.queuedTurn = null;
        return {
          mode: 'ON_BORDER',
          pos: { ...this.pos },
          facing: this.facing,
          trail: finishedTrail,
          completedCut: true,
          reconnectedAt: { ...this.pos },
          turnedCorner: turned
        };
      }

      if (
        pointOnPolygonBoundary(ahead4, poly, 0.5) &&
        this.isPointBlockedByBarrier(ahead4, barriers)
      ) {
        break;
      }

      if (this.isPointInsideSolidBox(next, boxes, 4)) {
        hitSolidBox = true;
        break;
      }

      if (this.hitsOwnTrail(this.pos, next)) {
        break;
      }

      this.pos = next;
      this.trail[this.trail.length - 1] = { ...this.pos };
      remaining -= step;
    }

    return {
      mode: 'CUTTING',
      pos: { ...this.pos },
      facing: this.facing,
      trail: this.trail.map((p) => ({ ...p })),
      completedCut: false,
      hitSolidBox,
      turnedCorner: turned
    };
  }

  private rewindTrail(rewindDist: number, rewindDir: CardinalDir): StepOutcome {
    let rem = rewindDist;
    while (rem > 0 && this.trail.length >= 2) {
      const headIdx = this.trail.length - 1;
      const prev = this.trail[headIdx - 1];
      const dx = prev.x - this.pos.x;
      const dy = prev.y - this.pos.y;
      const segDist = Math.abs(dx) + Math.abs(dy);

      if (segDist <= rem) {
        this.pos = { ...prev };
        rem -= segDist;
        if (this.trail.length > 2) {
          this.trail.pop();
          this.trail[this.trail.length - 1] = { ...this.pos };
          const newPrev = this.trail[this.trail.length - 2];
          const ndx = this.pos.x - newPrev.x;
          const ndy = this.pos.y - newPrev.y;
          if (Math.abs(ndx) > 0) this.cutDir = ndx > 0 ? 'RIGHT' : 'LEFT';
          else if (Math.abs(ndy) > 0) this.cutDir = ndy > 0 ? 'DOWN' : 'UP';
          this.rewindHoldLatchDir = rewindDir;
          rem = 0;
        } else {
          // Reached P_start on safe border!
          this.mode = 'ON_BORDER';
          this.trail = [];
          this.rewindHoldLatchDir = null;
          return {
            mode: 'ON_BORDER',
            pos: { ...this.pos },
            facing: this.facing,
            trail: [],
            completedCut: false,
            turnedCorner: true
          };
        }
      } else {
        this.pos = {
          x: snapGrid(this.pos.x + Math.sign(dx) * rem),
          y: snapGrid(this.pos.y + Math.sign(dy) * rem)
        };
        this.trail[headIdx] = { ...this.pos };
        rem = 0;
      }
    }
    this.facing = oppositeDir(this.cutDir);
    return {
      mode: 'CUTTING',
      pos: { ...this.pos },
      facing: this.facing,
      trail: this.trail.map((p) => ({ ...p })),
      completedCut: false
    };
  }

  private advanceAlongMatchingBorderEdge(
    p: GridPoint,
    dir: CardinalDir,
    dist: number,
    poly: readonly GridPoint[]
  ): { moved: boolean; newPos: GridPoint; travelled: number; hitVertex: boolean } {
    const v = dirVector(dir);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (!pointOnSegment(p, a, b, 0.5)) continue;

      for (const target of [a, b]) {
        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const avail = dx * v.x + dy * v.y;
        const perp = Math.abs(dx * v.y) + Math.abs(dy * v.x);
        if (perp <= 0.5 && avail > 0) {
          if (avail <= dist) {
            return { moved: true, newPos: { ...target }, travelled: avail, hitVertex: true };
          }
          return {
            moved: true,
            newPos: { x: snapGrid(p.x + v.x * dist), y: snapGrid(p.y + v.y * dist) },
            travelled: dist,
            hitVertex: false
          };
        }
      }
    }
    return { moved: false, newPos: p, travelled: 0, hitVertex: false };
  }

  private findNearbyValidTurnVertex(
    p: GridPoint,
    desiredDir: CardinalDir,
    cutAllowed: boolean,
    poly: readonly GridPoint[],
    boxes: readonly SolidBoxObstacle[],
    barriers: readonly BarrierRange[]
  ): GridPoint | null {
    let best: GridPoint | null = null;
    let bestDist = CORNER_ASSIST_PX + 1;
    for (const vtx of poly) {
      const d = Math.abs(vtx.x - p.x) + Math.abs(vtx.y - p.y);
      if (d === 0 || d > CORNER_ASSIST_PX || d >= bestDist) continue;
      if (!this.areConnectedAlongSingleEdge(p, vtx, poly)) continue;

      const canWalk = this.advanceAlongMatchingBorderEdge(vtx, desiredDir, GRID, poly).moved;
      const canCut = cutAllowed && this.canLaunchCutFrom(vtx, desiredDir, poly, boxes, barriers);
      if (canWalk || canCut) {
        best = vtx;
        bestDist = d;
      }
    }
    return best;
  }

  private areConnectedAlongSingleEdge(
    p: GridPoint,
    vtx: GridPoint,
    poly: readonly GridPoint[]
  ): boolean {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if ((a.x === vtx.x && a.y === vtx.y) || (b.x === vtx.x && b.y === vtx.y)) {
        if (pointOnSegment(p, a, b, 0.5)) return true;
      }
    }
    return false;
  }

  private isPointInsideSolidBox(
    p: GridPoint,
    boxes: readonly SolidBoxObstacle[],
    pad: number
  ): boolean {
    for (const box of boxes) {
      if (!box.active) continue;
      const h = box.halfSize + pad;
      if (p.x >= box.x - h && p.x <= box.x + h && p.y >= box.y - h && p.y <= box.y + h) {
        return true;
      }
    }
    return false;
  }

  private isPointBlockedByBarrier(p: GridPoint, barriers: readonly BarrierRange[]): boolean {
    for (const br of barriers) {
      if (pointOnSegment(p, { x: br.x1, y: br.y1 }, { x: br.x2, y: br.y2 }, 1.0)) {
        return true;
      }
    }
    return false;
  }

  private hitsOwnTrail(curr: GridPoint, next: GridPoint): boolean {
    if (this.trail.length <= 3) return false;
    for (let i = 0; i < this.trail.length - 3; i++) {
      const a = this.trail[i];
      const b = this.trail[i + 1];
      const minX = Math.min(a.x, b.x) - SELF_TRAIL_CUSHION_PX;
      const maxX = Math.max(a.x, b.x) + SELF_TRAIL_CUSHION_PX;
      const minY = Math.min(a.y, b.y) - SELF_TRAIL_CUSHION_PX;
      const maxY = Math.max(a.y, b.y) + SELF_TRAIL_CUSHION_PX;
      if (next.x >= minX && next.x <= maxX && next.y >= minY && next.y <= maxY) {
        const prevDist = this.distToSegment(curr, a, b);
        const nextDist = this.distToSegment(next, a, b);
        if (nextDist < prevDist) return true;
      }
    }
    return false;
  }

  private distToSegment(p: GridPoint, a: GridPoint, b: GridPoint): number {
    const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)
    );
    return Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)));
  }
}
