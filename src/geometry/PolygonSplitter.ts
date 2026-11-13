import {
  computeArea,
  dedupeVertices,
  ensureClockwise,
  extractBoundaryPathCW,
  pointInPolygon,
  pointsEqual,
  pointToArcLength,
  projectPointToPolygon,
  simplifyOrthogonalPolygon,
  snapPoint
} from './PolygonMath';
import { ClassifiedSplit, Point, SplitResult } from './Types';

export class PolygonSplitter {
  /**
   * Splits a simple CW orthogonal polygon along a non-self-intersecting orthogonal chord `trail`
   * whose endpoints `trail[0]` (`P_start`) and `trail[trail.length - 1]` (`P_end`) lie on the
   * perimeter of `activePolygon`.
   *
   * Handles:
   * - Corner-to-corner and edge-to-edge straight cuts
   * - Same-edge U-cuts in EITHER direction (`s_start < s_end` or `s_start > s_end`)
   * - Sequential cuts inside deeply concave L / U / spiral polygons
   * - Vertex-to-vertex cuts (zero duplicate vertices)
   * - Collinear T-junction vertex cleanup
   */
  public static split(activePolygon: readonly Point[], rawTrail: readonly Point[]): SplitResult | null {
    const cleanPoly = simplifyOrthogonalPolygon(activePolygon);
    if (cleanPoly.length < 4) {
      return null;
    }

    const trail = this.sanitizeTrail(rawTrail);
    if (trail.length < 2) {
      return null;
    }

    const pStart = trail[0];
    const pEnd = trail[trail.length - 1];

    if (pointsEqual(pStart, pEnd)) {
      return null;
    }

    const sStart = pointToArcLength(pStart, cleanPoly);
    const sEnd = pointToArcLength(pEnd, cleanPoly);

    if (sStart === null || sEnd === null || Math.abs(sStart - sEnd) < 0.01) {
      return null;
    }

    const interiorVertices = trail.slice(1, -1);
    const interiorReversed = [...interiorVertices].reverse();

    // Path 1: CW along perimeter from P_start -> P_end, closed by reversed interior of trail
    const cwStartToEnd = extractBoundaryPathCW(cleanPoly, sStart, sEnd);
    const rawPolyA = [...cwStartToEnd, ...interiorReversed];

    // Path 2: CW along perimeter from P_end -> P_start, closed by forward interior of trail
    const cwEndToStart = extractBoundaryPathCW(cleanPoly, sEnd, sStart);
    const rawPolyB = [...cwEndToStart, ...interiorVertices];

    const polyA = ensureClockwise(simplifyOrthogonalPolygon(rawPolyA));
    const polyB = ensureClockwise(simplifyOrthogonalPolygon(rawPolyB));

    if (polyA.length < 4 || polyB.length < 4) {
      return null;
    }

    const areaA = computeArea(polyA);
    const areaB = computeArea(polyB);

    if (areaA <= 0 || areaB <= 0) {
      return null;
    }

    return {
      polyA,
      polyB,
      areaA,
      areaB
    };
  }

  /**
   * Determines which sub-polygon becomes the new `activePolygon` ("Outer") and which becomes
   * `claimedPolygon` ("Inner / Captured"), supporting both Single-Boss and Dual-Boss (`TwinNexus`) rules!
   */
  public static classifySplit(
    splitResult: SplitResult,
    bossPositions: readonly Point[]
  ): ClassifiedSplit {
    const { polyA, polyB, areaA, areaB } = splitResult;

    if (bossPositions.length === 0) {
      // Fallback if no boss present: larger area remains active
      const aIsLarger = areaA >= areaB;
      return {
        outcome: 'NORMAL',
        activePolygon: aIsLarger ? polyA : polyB,
        claimedPolygon: aIsLarger ? polyB : polyA,
        activeArea: aIsLarger ? areaA : areaB,
        claimedArea: aIsLarger ? areaB : areaA
      };
    }

    const bossSides = bossPositions.map((pos) => this.pickContainingSide(pos, polyA, polyB));

    // Dual-Boss Special Win Rule (e.g., Sector 6 & Sector 14 TwinNexus):
    // If at least one boss is in polyA and at least one boss is in polyB, the player split them apart!
    const hasA = bossSides.includes('A');
    const hasB = bossSides.includes('B');

    if (hasA && hasB) {
      const aIsLarger = areaA >= areaB;
      return {
        outcome: 'TWIN_BOSS_SEPARATED',
        activePolygon: aIsLarger ? polyA : polyB,
        claimedPolygon: aIsLarger ? polyB : polyA,
        activeArea: aIsLarger ? areaA : areaB,
        claimedArea: aIsLarger ? areaB : areaA
      };
    }

    const primarySide = bossSides[0];
    if (primarySide === 'A') {
      return {
        outcome: 'NORMAL',
        activePolygon: polyA,
        claimedPolygon: polyB,
        activeArea: areaA,
        claimedArea: areaB
      };
    }

    return {
      outcome: 'NORMAL',
      activePolygon: polyB,
      claimedPolygon: polyA,
      activeArea: areaB,
      claimedArea: areaA
    };
  }

  private static pickContainingSide(
    pos: Point,
    polyA: readonly Point[],
    polyB: readonly Point[]
  ): 'A' | 'B' {
    const inA = pointInPolygon(pos, polyA);
    const inB = pointInPolygon(pos, polyB);

    if (inA && !inB) return 'A';
    if (inB && !inA) return 'B';

    // Tie-break if boss center lies right on the freshly drawn cut line:
    const distA = projectPointToPolygon(pos, polyA).distance;
    const distB = projectPointToPolygon(pos, polyB).distance;
    if (Math.abs(distA - distB) > 0.01) {
      return distA >= distB ? 'A' : 'B';
    }
    return computeArea(polyA) >= computeArea(polyB) ? 'A' : 'B';
  }

  private static sanitizeTrail(rawTrail: readonly Point[]): Point[] {
    const deduped = dedupeVertices(rawTrail.map(snapPoint));
    if (deduped.length <= 2) return deduped;

    // Merge collinear intermediate points along the open polyline
    const cleaned: Point[] = [deduped[0]];
    for (let i = 1; i < deduped.length - 1; i++) {
      const prev = cleaned[cleaned.length - 1];
      const curr = deduped[i];
      const next = deduped[i + 1];
      const sameX = prev.x === curr.x && curr.x === next.x;
      const sameY = prev.y === curr.y && curr.y === next.y;
      if (!sameX && !sameY) {
        cleaned.push(curr);
      }
    }
    cleaned.push(deduped[deduped.length - 1]);
    return cleaned;
  }
}
