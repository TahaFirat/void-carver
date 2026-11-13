import { ARENA_HEIGHT, ARENA_WIDTH, GRID_STEP } from '../core/Config';
import { AxisSegment, Barrier, Direction, DIR_VECTORS, Point, SegmentProjection } from './Types';

export function snapToGrid(value: number): number {
  const snapped = Math.round(value / GRID_STEP) * GRID_STEP;
  return snapped === 0 ? 0 : snapped;
}

export function snapPoint(p: Point): Point {
  return {
    x: snapToGrid(p.x),
    y: snapToGrid(p.y)
  };
}

export function createInitialArenaPolygon(): Point[] {
  return [
    { x: 0, y: 0 },
    { x: ARENA_WIDTH, y: 0 },
    { x: ARENA_WIDTH, y: ARENA_HEIGHT },
    { x: 0, y: ARENA_HEIGHT }
  ];
}

export function pointsEqual(a: Point, b: Point, eps = 0.001): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

export function manhattanDist(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function euclideanDist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Computes signed Shoelace area.
 * In Canvas screen coordinates (+x right, +y down), visually Clockwise (CW) polygons yield positive area (> 0).
 */
export function computeSignedArea(poly: readonly Point[]): number {
  const n = poly.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const curr = poly[i];
    const next = poly[(i + 1) % n];
    sum += curr.x * next.y - next.x * curr.y;
  }
  return sum * 0.5;
}

export function computeArea(poly: readonly Point[]): number {
  return Math.abs(computeSignedArea(poly));
}

export function ensureClockwise(poly: readonly Point[]): Point[] {
  if (poly.length < 3) return [...poly];
  const signed = computeSignedArea(poly);
  if (signed < 0) {
    return [...poly].reverse();
  }
  return [...poly];
}

export function dedupeVertices(poly: readonly Point[]): Point[] {
  if (poly.length === 0) return [];
  const out: Point[] = [];
  for (const pt of poly) {
    const snapped = snapPoint(pt);
    if (out.length === 0 || !pointsEqual(out[out.length - 1], snapped)) {
      out.push(snapped);
    }
  }
  while (out.length > 1 && pointsEqual(out[0], out[out.length - 1])) {
    out.pop();
  }
  return out;
}

/**
 * Cleans duplicate vertices, removes 180-degree collinear T-junction vertices & zero-area spikes,
 * and enforces Clockwise (CW) winding order on the 2px integer grid.
 */
export function simplifyOrthogonalPolygon(poly: readonly Point[]): Point[] {
  let pts = dedupeVertices(poly);
  if (pts.length < 3) return pts;

  let changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    const nextPts: Point[] = [];
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];

      const collinearX = prev.x === curr.x && curr.x === next.x;
      const collinearY = prev.y === curr.y && curr.y === next.y;
      if (collinearX || collinearY || pointsEqual(prev, next)) {
        changed = true;
      } else {
        nextPts.push(curr);
      }
    }
    pts = dedupeVertices(nextPts);
  }

  return ensureClockwise(pts);
}

export function isPointOnSegment(p: Point, a: Point, b: Point, eps = 0.001): boolean {
  const minX = Math.min(a.x, b.x) - eps;
  const maxX = Math.max(a.x, b.x) + eps;
  const minY = Math.min(a.y, b.y) - eps;
  const maxY = Math.max(a.y, b.y) + eps;

  if (p.x < minX || p.x > maxX || p.y < minY || p.y > maxY) {
    return false;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= eps * eps) {
    return euclideanDist(p, a) <= eps;
  }

  const cross = Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx);
  return cross / Math.sqrt(lenSq) <= eps;
}

export function isPointOnPolygonBoundary(p: Point, poly: readonly Point[], eps = 0.001): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    if (isPointOnSegment(p, poly[i], poly[(i + 1) % n], eps)) {
      return true;
    }
  }
  return false;
}

/**
 * Inclusive Point-in-Polygon (Ray-Casting): returns true if inside OR on boundary.
 */
export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  if (poly.length < 3) return false;
  if (isPointOnPolygonBoundary(p, poly)) return true;
  return rayCastInterior(p, poly);
}

/**
 * Strict Point-in-Polygon: returns true ONLY if strictly inside (false on boundary).
 */
export function pointInPolygonStrict(p: Point, poly: readonly Point[]): boolean {
  if (poly.length < 3) return false;
  if (isPointOnPolygonBoundary(p, poly)) return false;
  return rayCastInterior(p, poly);
}

function rayCastInterior(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;

    const intersects =
      yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function getPolygonEdges(poly: readonly Point[]): AxisSegment[] {
  const edges: AxisSegment[] = [];
  const n = poly.length;
  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const len = manhattanDist(a, b);
    edges.push({
      a,
      b,
      edgeIndex: i,
      isHorizontal: a.y === b.y,
      length: len,
      cumulativeStart: cumulative
    });
    cumulative += len;
  }
  return edges;
}

export function getTotalPerimeter(edges: readonly AxisSegment[]): number {
  if (edges.length === 0) return 0;
  const last = edges[edges.length - 1];
  return last.cumulativeStart + last.length;
}

export function pointToArcLength(p: Point, poly: readonly Point[]): number | null {
  const edges = getPolygonEdges(poly);
  const total = getTotalPerimeter(edges);
  if (total <= 0) return null;

  for (const edge of edges) {
    if (isPointOnSegment(p, edge.a, edge.b, 0.01)) {
      const offset = manhattanDist(edge.a, p);
      const raw = (edge.cumulativeStart + offset) % total;
      return raw < 0 ? raw + total : raw;
    }
  }
  return null;
}

export function arcLengthToPoint(s: number, poly: readonly Point[]): Point {
  const edges = getPolygonEdges(poly);
  const total = getTotalPerimeter(edges);
  if (edges.length === 0 || total <= 0) return { x: 0, y: 0 };

  const normS = ((s % total) + total) % total;
  for (const edge of edges) {
    if (normS <= edge.cumulativeStart + edge.length + 0.0001) {
      const local = Math.max(0, Math.min(edge.length, normS - edge.cumulativeStart));
      const t = edge.length > 0 ? local / edge.length : 0;
      return snapPoint({
        x: edge.a.x + (edge.b.x - edge.a.x) * t,
        y: edge.a.y + (edge.b.y - edge.a.y) * t
      });
    }
  }
  return snapPoint(poly[0]);
}

/**
 * Extracts CW boundary polyline from sStart to sEnd along a CW polygon.
 */
export function extractBoundaryPathCW(
  poly: readonly Point[],
  sStart: number,
  sEnd: number
): Point[] {
  const edges = getPolygonEdges(poly);
  const total = getTotalPerimeter(edges);
  const pStart = arcLengthToPoint(sStart, poly);
  const pEnd = arcLengthToPoint(sEnd, poly);

  const cwDist = (from: number, to: number): number => {
    const d = (to - from) % total;
    return d < 0 ? d + total : d;
  };

  const span = cwDist(sStart, sEnd);
  const intermediates: { dist: number; pt: Point }[] = [];

  for (const edge of edges) {
    const vDist = cwDist(sStart, edge.cumulativeStart);
    if (vDist > 0.01 && vDist < span - 0.01) {
      intermediates.push({ dist: vDist, pt: edge.a });
    }
  }

  intermediates.sort((a, b) => a.dist - b.dist);

  return [pStart, ...intermediates.map((item) => item.pt), pEnd];
}

export function projectPointToSegment(
  p: Point,
  a: Point,
  b: Point,
  edgeIndex = 0
): SegmentProjection {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) {
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  }
  const proj = {
    x: a.x + dx * t,
    y: a.y + dy * t
  };
  const len = Math.sqrt(lenSq) || 1;
  // For CW polygon in screen coords (+x right, +y down), inward normal is (-dy/len, dx/len)
  const inwardNormal = {
    x: -dy / len,
    y: dx / len
  };
  return {
    point: proj,
    distance: euclideanDist(p, proj),
    t,
    edgeIndex,
    inwardNormal
  };
}

export function projectPointToPolygon(p: Point, poly: readonly Point[]): SegmentProjection {
  const n = poly.length;
  let best: SegmentProjection | null = null;
  for (let i = 0; i < n; i++) {
    const cand = projectPointToSegment(p, poly[i], poly[(i + 1) % n], i);
    if (!best || cand.distance < best.distance) {
      best = cand;
    }
  }
  return (
    best ?? {
      point: { x: p.x, y: p.y },
      distance: 0,
      t: 0,
      edgeIndex: 0,
      inwardNormal: { x: 0, y: 1 }
    }
  );
}

export function projectPointToPolyline(
  p: Point,
  polyline: readonly Point[]
): { point: Point; distance: number; arcLength: number } {
  let bestDist = Infinity;
  let bestPoint: Point = polyline[0] ?? p;
  let bestArc = 0;
  let cumulative = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = euclideanDist(a, b);
    const proj = projectPointToSegment(p, a, b, i);
    if (proj.distance < bestDist) {
      bestDist = proj.distance;
      bestPoint = proj.point;
      bestArc = cumulative + proj.t * segLen;
    }
    cumulative += segLen;
  }

  return { point: bestPoint, distance: bestDist, arcLength: bestArc };
}

export function getPolylineLength(polyline: readonly Point[]): number {
  let len = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    len += euclideanDist(polyline[i], polyline[i + 1]);
  }
  return len;
}

export function getPointAlongPolyline(polyline: readonly Point[], targetDist: number): Point {
  if (polyline.length === 0) return { x: 0, y: 0 };
  if (polyline.length === 1 || targetDist <= 0) return { ...polyline[0] };

  let remaining = targetDist;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const segLen = euclideanDist(a, b);
    if (remaining <= segLen || i === polyline.length - 2) {
      const t = segLen > 0 ? Math.min(1, Math.max(0, remaining / segLen)) : 0;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
      };
    }
    remaining -= segLen;
  }
  return { ...polyline[polyline.length - 1] };
}

/**
 * Checks whether a point P lies on any active barrier segment (strictly or inclusively).
 */
export function isPointOnBarrier(p: Point, barriers: readonly Barrier[], eps = 0.5): boolean {
  for (const bar of barriers) {
    if (isPointOnSegment(p, { x: bar.x1, y: bar.y1 }, { x: bar.x2, y: bar.y2 }, eps)) {
      return true;
    }
  }
  return false;
}

/**
 * Clips world-space barrier definitions against the current activePolygon edges so only barriers
 * still remaining on active perimeter edges are rendered and enforced.
 */
export function getActivePerimeterBarriers(
  poly: readonly Point[],
  barriers: readonly Barrier[]
): Barrier[] {
  const active: Barrier[] = [];
  const n = poly.length;

  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const isHoriz = a.y === b.y;

    for (const bar of barriers) {
      const barHoriz = bar.y1 === bar.y2;
      if (isHoriz && barHoriz && Math.abs(a.y - bar.y1) < 0.5) {
        const start = Math.max(Math.min(a.x, b.x), Math.min(bar.x1, bar.x2));
        const end = Math.min(Math.max(a.x, b.x), Math.max(bar.x1, bar.x2));
        if (end - start >= GRID_STEP) {
          active.push({ x1: start, y1: a.y, x2: end, y2: a.y });
        }
      } else if (!isHoriz && !barHoriz && Math.abs(a.x - bar.x1) < 0.5) {
        const start = Math.max(Math.min(a.y, b.y), Math.min(bar.y1, bar.y2));
        const end = Math.min(Math.max(a.y, b.y), Math.max(bar.y1, bar.y2));
        if (end - start >= GRID_STEP) {
          active.push({ x1: a.x, y1: start, x2: a.x, y2: end });
        }
      }
    }
  }

  return active;
}

/**
 * Casts an orthogonal ray from origin inside activePolygon along `dir` and returns distance to first polygon wall hit.
 */
export function castOrthogonalRayToPolygon(
  origin: Point,
  dir: Direction,
  poly: readonly Point[]
): { distance: number; hitPoint: Point; edgeIndex: number } | null {
  const { dx, dy } = DIR_VECTORS[dir];
  const n = poly.length;
  let bestDist = Infinity;
  let bestEdge = -1;

  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];

    if (dx !== 0) {
      // Ray is horizontal along y = origin.y
      if (a.x === b.x) {
        // Vertical wall at x = a.x
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        if (origin.y >= minY && origin.y <= maxY) {
          const dist = (a.x - origin.x) * dx;
          if (dist > 0.01 && dist < bestDist) {
            bestDist = dist;
            bestEdge = i;
          }
        }
      } else if (a.y === origin.y) {
        // Collinear horizontal wall (e.g. grazing a concave corner)
        const dA = (a.x - origin.x) * dx;
        const dB = (b.x - origin.x) * dx;
        const positive = Math.min(dA > 0.01 ? dA : Infinity, dB > 0.01 ? dB : Infinity);
        if (positive < bestDist) {
          bestDist = positive;
          bestEdge = i;
        }
      }
    } else {
      // Ray is vertical along x = origin.x
      if (a.y === b.y) {
        // Horizontal wall at y = a.y
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        if (origin.x >= minX && origin.x <= maxX) {
          const dist = (a.y - origin.y) * dy;
          if (dist > 0.01 && dist < bestDist) {
            bestDist = dist;
            bestEdge = i;
          }
        }
      } else if (a.x === origin.x) {
        const dA = (a.y - origin.y) * dy;
        const dB = (b.y - origin.y) * dy;
        const positive = Math.min(dA > 0.01 ? dA : Infinity, dB > 0.01 ? dB : Infinity);
        if (positive < bestDist) {
          bestDist = positive;
          bestEdge = i;
        }
      }
    }
  }

  if (!Number.isFinite(bestDist) || bestEdge < 0) {
    return null;
  }

  return {
    distance: snapToGrid(bestDist),
    hitPoint: snapPoint({
      x: origin.x + dx * bestDist,
      y: origin.y + dy * bestDist
    }),
    edgeIndex: bestEdge
  };
}

/**
 * Anti-stuck solver for Bosses and Minions: guarantees circular body stays cleanly inside activePolygon.
 */
export function resolvePolygonPenetration(
  pos: Point,
  boundingRadius: number,
  poly: readonly Point[]
): { position: Point; collidedNormal: Point | null } {
  let curr = { x: pos.x, y: pos.y };
  let collidedNormal: Point | null = null;

  // 1. If center ever ended up on or outside boundary, pull strictly inside along inward normal
  if (!pointInPolygonStrict(curr, poly)) {
    const proj = projectPointToPolygon(curr, poly);
    for (const step of [boundingRadius, 8, 4, 2, 1]) {
      const candidate = {
        x: proj.point.x + proj.inwardNormal.x * step,
        y: proj.point.y + proj.inwardNormal.y * step
      };
      if (pointInPolygonStrict(candidate, poly)) {
        curr = candidate;
        collidedNormal = proj.inwardNormal;
        break;
      }
    }
  }

  // 2. Iteratively push away from walls closer than effectiveRadius (adapting gracefully in narrow corridors)
  let effectiveRadius = boundingRadius;
  for (let pass = 0; pass < 4; pass++) {
    let pushedX = 0;
    let pushedY = 0;
    let hitCount = 0;

    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const proj = projectPointToSegment(curr, poly[i], poly[(i + 1) % n], i);
      if (proj.distance < effectiveRadius && proj.distance > 0.0001) {
        const overlap = effectiveRadius - proj.distance;
        const nx = (curr.x - proj.point.x) / proj.distance;
        const ny = (curr.y - proj.point.y) / proj.distance;
        pushedX += nx * overlap;
        pushedY += ny * overlap;
        collidedNormal = { x: nx, y: ny };
        hitCount++;
      } else if (proj.distance <= 0.0001) {
        pushedX += proj.inwardNormal.x * effectiveRadius;
        pushedY += proj.inwardNormal.y * effectiveRadius;
        collidedNormal = proj.inwardNormal;
        hitCount++;
      }
    }

    if (hitCount === 0) break;

    const candidate = {
      x: curr.x + pushedX,
      y: curr.y + pushedY
    };

    if (pointInPolygonStrict(candidate, poly)) {
      curr = candidate;
    } else {
      // Corridor is narrower than 2 * effectiveRadius; shrink radius for this step so entity centers in corridor
      effectiveRadius *= 0.5;
    }
  }

  return { position: curr, collidedNormal };
}
