export interface Point {
  readonly x: number;
  readonly y: number;
}

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export interface DirectionVector {
  readonly dx: -1 | 0 | 1;
  readonly dy: -1 | 0 | 1;
}

export const DIR_VECTORS: Record<Direction, DirectionVector> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 }
};

export const OPPOSITE_DIR: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT'
};

export interface AxisSegment {
  readonly a: Point;
  readonly b: Point;
  readonly edgeIndex: number;
  readonly isHorizontal: boolean;
  readonly length: number;
  readonly cumulativeStart: number;
}

export interface Barrier {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface SplitResult {
  readonly polyA: Point[];
  readonly polyB: Point[];
  readonly areaA: number;
  readonly areaB: number;
}

export type SplitOutcomeType = 'NORMAL' | 'TWIN_BOSS_SEPARATED';

export interface ClassifiedSplit {
  readonly outcome: SplitOutcomeType;
  readonly activePolygon: Point[];
  readonly claimedPolygon: Point[];
  readonly activeArea: number;
  readonly claimedArea: number;
}

export interface SegmentProjection {
  readonly point: Point;
  readonly distance: number;
  readonly t: number;
  readonly edgeIndex: number;
  readonly inwardNormal: Point;
}
