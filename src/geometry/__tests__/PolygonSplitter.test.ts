import { describe, expect, it } from 'vitest';
import { INITIAL_ARENA_AREA } from '../../core/Config';
import {
  computeArea,
  computeSignedArea,
  createInitialArenaPolygon,
  pointInPolygonStrict,
  resolvePolygonPenetration
} from '../PolygonMath';
import { PolygonSplitter } from '../PolygonSplitter';
import { Point } from '../Types';

function assertValidOrthogonalCWPolygon(poly: readonly Point[]): void {
  expect(poly.length).toBeGreaterThanOrEqual(4);
  // CW in screen coords => positive signed area
  expect(computeSignedArea(poly)).toBeGreaterThan(0);

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const c = poly[(i + 2) % poly.length];

    // Grid snapped to 2px
    expect(a.x % 2).toBe(0);
    expect(a.y % 2).toBe(0);

    // Non-zero segment length
    const segLen = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    expect(segLen).toBeGreaterThanOrEqual(2);

    // Strictly orthogonal
    expect(a.x === b.x || a.y === b.y).toBe(true);

    // No collinear consecutive edges (T-junction cleaned)
    const bothVertical = a.x === b.x && b.x === c.x;
    const bothHorizontal = a.y === b.y && b.y === c.y;
    expect(bothVertical).toBe(false);
    expect(bothHorizontal).toBe(false);
  }
}

describe('PolygonSplitter & Orthogonal Geometry Invariants', () => {
  it('1. splits arena straight across from wall to wall with exact area conservation', () => {
    const arena = createInitialArenaPolygon();
    const trail: Point[] = [
      { x: 0, y: 400 },
      { x: 900, y: 400 }
    ];

    const res = PolygonSplitter.split(arena, trail);
    expect(res).not.toBeNull();
    if (!res) return;

    assertValidOrthogonalCWPolygon(res.polyA);
    assertValidOrthogonalCWPolygon(res.polyB);
    expect(res.areaA + res.areaB).toBe(INITIAL_ARENA_AREA);

    const classified = PolygonSplitter.classifySplit(res, [{ x: 450, y: 800 }]);
    expect(classified.outcome).toBe('NORMAL');
    expect(classified.claimedArea).toBe(900 * 400);
    expect(classified.activeArea).toBe(900 * 800);
  });

  it('2. handles same-edge U-shaped cuts in BOTH CW and CCW directions on all 4 walls', () => {
    const arena = createInitialArenaPolygon();

    // Forward order on top wall (200 -> 500)
    const uCutForward: Point[] = [
      { x: 200, y: 0 },
      { x: 200, y: 300 },
      { x: 500, y: 300 },
      { x: 500, y: 0 }
    ];
    const res1 = PolygonSplitter.split(arena, uCutForward);
    expect(res1).not.toBeNull();
    if (!res1) return;

    assertValidOrthogonalCWPolygon(res1.polyA);
    assertValidOrthogonalCWPolygon(res1.polyB);
    expect(res1.areaA + res1.areaB).toBe(INITIAL_ARENA_AREA);

    const c1 = PolygonSplitter.classifySplit(res1, [{ x: 450, y: 700 }]);
    expect(c1.claimedArea).toBe(300 * 300);
    expect(c1.activeArea).toBe(INITIAL_ARENA_AREA - 300 * 300);

    // Reverse order on top wall (500 -> 200)
    const uCutReverse: Point[] = [
      { x: 500, y: 0 },
      { x: 500, y: 300 },
      { x: 200, y: 300 },
      { x: 200, y: 0 }
    ];
    const res2 = PolygonSplitter.split(arena, uCutReverse);
    expect(res2).not.toBeNull();
    if (!res2) return;

    assertValidOrthogonalCWPolygon(res2.polyA);
    assertValidOrthogonalCWPolygon(res2.polyB);
    expect(res2.areaA + res2.areaB).toBe(INITIAL_ARENA_AREA);

    const c2 = PolygonSplitter.classifySplit(res2, [{ x: 450, y: 700 }]);
    expect(c2.claimedArea).toBe(300 * 300);
    expect(c2.activeArea).toBe(INITIAL_ARENA_AREA - 300 * 300);

    // Left wall U-cut crossing V_0 wrap-around neighborhood
    const leftWallUCut: Point[] = [
      { x: 0, y: 900 },
      { x: 240, y: 900 },
      { x: 240, y: 300 },
      { x: 0, y: 300 }
    ];
    const res3 = PolygonSplitter.split(arena, leftWallUCut);
    expect(res3).not.toBeNull();
    if (!res3) return;
    assertValidOrthogonalCWPolygon(res3.polyA);
    assertValidOrthogonalCWPolygon(res3.polyB);
    expect(res3.areaA + res3.areaB).toBe(INITIAL_ARENA_AREA);
  });

  it('3. handles sequential concave L-shaped, U-shaped, vertex-to-vertex, and T-junction cuts with exact area sum', () => {
    let active = createInitialArenaPolygon();
    const boss = { x: 650, y: 850 };
    let totalClaimed = 0;

    // Cut 1: L-cut carving top-left corner (0..300 x 0..400)
    const cut1: Point[] = [
      { x: 300, y: 0 },
      { x: 300, y: 400 },
      { x: 0, y: 400 }
    ];
    const s1 = PolygonSplitter.split(active, cut1)!;
    expect(s1).not.toBeNull();
    expect(s1.areaA + s1.areaB).toBe(computeArea(active));
    const c1 = PolygonSplitter.classifySplit(s1, [boss]);
    active = c1.activePolygon;
    totalClaimed += c1.claimedArea;
    assertValidOrthogonalCWPolygon(active);
    expect(c1.claimedArea).toBe(300 * 400);

    // Cut 2: Launch directly from the concave corner vertex (300, 400) downward to (300, 1200) -> T-junction cleanup!
    const cut2: Point[] = [
      { x: 300, y: 400 },
      { x: 300, y: 1200 }
    ];
    const s2 = PolygonSplitter.split(active, cut2)!;
    expect(s2).not.toBeNull();
    expect(s2.areaA + s2.areaB).toBe(computeArea(active));
    const c2 = PolygonSplitter.classifySplit(s2, [boss]);
    active = c2.activePolygon;
    totalClaimed += c2.claimedArea;
    assertValidOrthogonalCWPolygon(active);
    // Notice T-junction at (300, 400) merged (300,0)->(300,400)->(300,1200) into a clean 4-vertex rectangle!
    expect(active.length).toBe(4);
    expect(c2.claimedArea).toBe(300 * 800);

    // Cut 3: Multi-turn staircase cut inside remaining [300..900] x [0..1200]
    const cut3: Point[] = [
      { x: 300, y: 200 },
      { x: 520, y: 200 },
      { x: 520, y: 460 },
      { x: 700, y: 460 },
      { x: 700, y: 0 }
    ];
    const s3 = PolygonSplitter.split(active, cut3)!;
    expect(s3).not.toBeNull();
    expect(s3.areaA + s3.areaB).toBe(computeArea(active));
    const c3 = PolygonSplitter.classifySplit(s3, [boss]);
    active = c3.activePolygon;
    totalClaimed += c3.claimedArea;
    assertValidOrthogonalCWPolygon(active);

    // Exact global area conservation check across all sequential cuts
    expect(computeArea(active) + totalClaimed).toBe(INITIAL_ARENA_AREA);
  });

  it('4. detects Twin Boss separation (Sector 6 / 14 rule)', () => {
    const arena = createInitialArenaPolygon();
    const bossA = { x: 250, y: 600 };
    const bossB = { x: 700, y: 600 };

    const splitLine: Point[] = [
      { x: 480, y: 0 },
      { x: 480, y: 1200 }
    ];
    const res = PolygonSplitter.split(arena, splitLine)!;
    const classified = PolygonSplitter.classifySplit(res, [bossA, bossB]);
    expect(classified.outcome).toBe('TWIN_BOSS_SEPARATED');
  });

  it('5. resolves Boss circle penetration cleanly inside concave polygons', () => {
    const arena = createInitialArenaPolygon();
    const splitRes = PolygonSplitter.split(arena, [
      { x: 450, y: 0 },
      { x: 450, y: 1200 }
    ])!;
    const c = PolygonSplitter.classifySplit(splitRes, [{ x: 460, y: 600 }]);
    const solved = resolvePolygonPenetration({ x: 452, y: 600 }, 42, c.activePolygon);
    expect(pointInPolygonStrict(solved.position, c.activePolygon)).toBe(true);
    expect(solved.position.x).toBeGreaterThanOrEqual(450 + 41.9);
  });
});
