import { CANVAS_HEIGHT, CANVAS_WIDTH } from './Config';

/**
 * V5 Universal Responsive Engine.
 *
 * Game physics always run in the fixed `900x1200` (3:4) logical arena, so stage layouts,
 * wall spacing and boss speeds are 100% fair on every device. Only the *screen shell*
 * around it adapts:
 *
 * - `PHONE_PORTRAIT`  (vw/vh < 0.72): legacy 900-wide column, extra height absorbed by
 *   safe areas and a taller control deck (zero letterboxing on tall/notched phones).
 * - `TABLET_PORTRAIT` (0.72..1.12): arena column centered; D-Pad and `KES` docked to the
 *   bottom-left / bottom-right corners for natural thumb reach.
 * - `LANDSCAPE_SPLIT` (> 1.12): 3-column arcade cabinet (left wing: stage + lives + D-Pad,
 *   center: full-height arena, right wing: score/target/shield/pause + `KES` + `[OTOMATİK]`).
 *
 * All values are expressed in *virtual canvas units*; the canvas backing store is sized to
 * `virtualWidth x virtualHeight` times the device pixel ratio.
 */
export type LayoutMode = 'PHONE_PORTRAIT' | 'TABLET_PORTRAIT' | 'LANDSCAPE_SPLIT';

export interface SafeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ColumnTransform {
  /** Translation + uniform scale mapping legacy `900x1600` column coords to virtual coords. */
  tx: number;
  ty: number;
  s: number;
}

export interface GameLayout {
  mode: LayoutMode;
  /** Virtual canvas size. */
  width: number;
  height: number;
  /** CSS pixels per virtual unit. */
  cssScale: number;
  /** Safe-area insets in virtual units. */
  safe: SafeInsets;

  /** Translation applied to the legacy arena block (gold frame at y 92..1220, x 21..879). */
  arenaOffsetX: number;
  arenaOffsetY: number;
  /** Visible arena frame rect (virtual units) including the gold bezel. */
  arenaFrame: Rect;

  /** Portrait only: translation for the legacy top score bar (`y 0..86`). */
  topBarOffset: { x: number; y: number } | null;
  /** Portrait only: translation for the legacy single-line status strip (`y 1230..1288`). */
  statusOffset: { x: number; y: number } | null;
  /** Portrait only: control deck background rect. */
  deckRect: Rect | null;
  /** Landscape only: side wing panels. */
  leftWing: Rect | null;
  rightWing: Rect | null;

  dpad: { cx: number; cy: number; button: number; gap: number };
  cutButton: Rect;
  autoToggle: Rect;
  pauseButton: Rect;

  /** Single-column transform for menus & modals. */
  menuColumn: ColumnTransform;
  /** Landscape main menu: hero (logo + continue) and selector (tabs + grid) halves. */
  menuHero: ColumnTransform | null;
  menuSelector: ColumnTransform | null;
}

const LEGACY_W = CANVAS_WIDTH; // 900
const LEGACY_H = CANVAS_HEIGHT; // 1600
const FRAME_TOP = 92;
const FRAME_BOTTOM = 1220;
const FRAME_LEFT = 21;
const FRAME_RIGHT = 879;
const STATUS_BOTTOM = 1290;

export function classifyLayoutMode(cssW: number, cssH: number): LayoutMode {
  const aspect = cssW / Math.max(1, cssH);
  if (aspect > 1.12) return 'LANDSCAPE_SPLIT';
  if (aspect >= 0.72) return 'TABLET_PORTRAIT';
  return 'PHONE_PORTRAIT';
}

/**
 * Picks the virtual canvas size so that `requiredW x requiredH` content (+ safe insets)
 * always fits while exactly matching the device aspect ratio (no letterboxing).
 */
function fitVirtualCanvas(
  cssW: number,
  cssH: number,
  insetsCss: SafeInsets,
  requiredW: number,
  requiredH: number
): { width: number; height: number; cssScale: number; safe: SafeInsets } {
  let width = requiredW;
  let height = requiredH;
  let cssScale = 1;
  let safe: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

  // Two refinement passes: insets are in CSS px and depend on the resulting scale
  for (let pass = 0; pass < 3; pass++) {
    const innerCssW = Math.max(60, cssW - insetsCss.left - insetsCss.right);
    const innerCssH = Math.max(60, cssH - insetsCss.top - insetsCss.bottom);
    cssScale = Math.min(innerCssW / requiredW, innerCssH / requiredH);
    width = cssW / cssScale;
    height = cssH / cssScale;
    safe = {
      top: insetsCss.top / cssScale,
      right: insetsCss.right / cssScale,
      bottom: insetsCss.bottom / cssScale,
      left: insetsCss.left / cssScale
    };
  }
  return { width, height, cssScale, safe };
}

export function computeLayout(cssW: number, cssH: number, insetsCss: SafeInsets): GameLayout {
  const mode = classifyLayoutMode(cssW, cssH);

  if (mode === 'LANDSCAPE_SPLIT') {
    const frameH = FRAME_BOTTOM - FRAME_TOP; // 1128
    const requiredH = frameH + 40;
    const requiredW = LEGACY_W + 2 * 300;
    const fit = fitVirtualCanvas(cssW, cssH, insetsCss, requiredW, requiredH);
    const { width, height, safe } = fit;

    const innerTop = safe.top;
    const innerH = height - safe.top - safe.bottom;
    const frameTop = innerTop + (innerH - frameH) * 0.5;
    const arenaOffsetX = (width - LEGACY_W) * 0.5;
    const arenaOffsetY = frameTop - FRAME_TOP;

    const frameLeft = arenaOffsetX + FRAME_LEFT;
    const frameRight = arenaOffsetX + FRAME_RIGHT;
    const wingPad = 16;
    const leftWing: Rect = {
      x: safe.left + wingPad,
      y: innerTop + wingPad,
      w: Math.max(120, frameLeft - wingPad * 2 - safe.left),
      h: innerH - wingPad * 2
    };
    const rightWing: Rect = {
      x: frameRight + wingPad,
      y: innerTop + wingPad,
      w: Math.max(120, width - safe.right - frameRight - wingPad * 2),
      h: innerH - wingPad * 2
    };

    const ctrlScale = Math.max(0.62, Math.min(1.25, Math.min(leftWing.w, rightWing.w) / 330));
    const button = Math.round(96 * ctrlScale);
    const gap = Math.round(8 * ctrlScale);
    const dpadSpan = button * 3 + gap * 2;
    const dpad = {
      cx: leftWing.x + leftWing.w * 0.5,
      cy: leftWing.y + leftWing.h - dpadSpan * 0.5 - 10,
      button,
      gap
    };

    const cutW = Math.round(Math.min(rightWing.w - 20, 260 * ctrlScale));
    const cutH = Math.round(cutW * 0.62);
    const cutButton: Rect = {
      x: rightWing.x + (rightWing.w - cutW) * 0.5,
      y: rightWing.y + rightWing.h - cutH - 30,
      w: cutW,
      h: cutH
    };
    const toggleW = Math.round(Math.min(rightWing.w - 20, 250 * ctrlScale));
    const toggleH = Math.round(54 * ctrlScale);
    const autoToggle: Rect = {
      x: rightWing.x + (rightWing.w - toggleW) * 0.5,
      y: cutButton.y - toggleH - 26,
      w: toggleW,
      h: toggleH
    };
    const pauseSize = Math.round(84 * ctrlScale);
    const pauseButton: Rect = {
      x: rightWing.x + rightWing.w - pauseSize,
      y: rightWing.y,
      w: pauseSize,
      h: pauseSize
    };

    const colS = Math.min(width / LEGACY_W, (height - safe.top - safe.bottom) / LEGACY_H);
    const menuColumn: ColumnTransform = {
      tx: (width - LEGACY_W * colS) * 0.5,
      ty: safe.top + (height - safe.top - safe.bottom - LEGACY_H * colS) * 0.5,
      s: colS
    };

    // Landscape main menu: hero (legacy y 0..610) left, selector (legacy y 610..1440) right
    const halfW = (width - safe.left - safe.right) * 0.5;
    const availH = height - safe.top - safe.bottom;
    const heroS = Math.min(halfW / LEGACY_W, (availH * 0.92) / 610);
    const selS = Math.min(halfW / LEGACY_W, (availH * 0.96) / 830);
    const menuHero: ColumnTransform = {
      tx: safe.left + (halfW - LEGACY_W * heroS) * 0.5,
      ty: safe.top + (availH - 610 * heroS) * 0.5,
      s: heroS
    };
    const menuSelector: ColumnTransform = {
      tx: safe.left + halfW + (halfW - LEGACY_W * selS) * 0.5,
      ty: safe.top + (availH - 830 * selS) * 0.5 - 610 * selS,
      s: selS
    };

    return {
      mode,
      width,
      height,
      cssScale: fit.cssScale,
      safe,
      arenaOffsetX,
      arenaOffsetY,
      arenaFrame: { x: frameLeft, y: frameTop, w: FRAME_RIGHT - FRAME_LEFT, h: frameH },
      topBarOffset: null,
      statusOffset: null,
      deckRect: null,
      leftWing,
      rightWing,
      dpad,
      cutButton,
      autoToggle,
      pauseButton,
      menuColumn,
      menuHero,
      menuSelector
    };
  }

  // ---------------- Portrait (phone & tablet) ----------------
  const fit = fitVirtualCanvas(cssW, cssH, insetsCss, LEGACY_W, LEGACY_H);
  const { width, height, safe } = fit;
  const innerH = height - safe.top - safe.bottom;
  const extraH = Math.max(0, innerH - LEGACY_H);
  const columnX = (width - LEGACY_W) * 0.5;
  // Push the arena slightly down on very tall phones; the rest goes to a taller control deck
  const topShift = safe.top + Math.min(extraH * 0.25, 60);
  const deckTop = topShift + STATUS_BOTTOM;
  const deckBottom = height - safe.bottom;
  const deckRect: Rect = { x: 0, y: deckTop, w: width, h: height - deckTop };

  const isTablet = mode === 'TABLET_PORTRAIT' || width > LEGACY_W + 120;
  const deckH = deckBottom - deckTop;
  const button = Math.round(Math.min(104, Math.max(80, deckH * 0.3)));
  const gap = 8;
  const dpadSpan = button * 3 + gap * 2;
  const dpadCy = deckTop + Math.max(dpadSpan * 0.5 + 8, deckH * 0.5);

  const dpadCx = isTablet
    ? safe.left + 28 + dpadSpan * 0.5
    : columnX + Math.max(dpadSpan * 0.5 + 18, 170);

  const cutW = 290;
  const cutH = 150;
  const cutCx = isTablet ? width - safe.right - 28 - cutW * 0.5 : columnX + LEGACY_W - 40 - cutW * 0.5;
  const cutButton: Rect = {
    x: cutCx - cutW * 0.5,
    y: dpadCy - cutH * 0.5 - 30,
    w: cutW,
    h: cutH
  };
  const autoToggle: Rect = {
    x: cutButton.x + cutButton.w - 250,
    y: cutButton.y + cutButton.h + 22,
    w: 250,
    h: 54
  };

  const pauseButton: Rect = { x: columnX + LEGACY_W - 120, y: topShift, w: 120, h: 86 };

  const menuColumn: ColumnTransform = {
    tx: columnX,
    ty: safe.top + extraH * 0.5,
    s: 1
  };

  return {
    mode,
    width,
    height,
    cssScale: fit.cssScale,
    safe,
    arenaOffsetX: columnX,
    arenaOffsetY: topShift,
    arenaFrame: {
      x: columnX + FRAME_LEFT,
      y: topShift + FRAME_TOP,
      w: FRAME_RIGHT - FRAME_LEFT,
      h: FRAME_BOTTOM - FRAME_TOP
    },
    topBarOffset: { x: columnX, y: topShift },
    statusOffset: { x: columnX, y: topShift },
    deckRect,
    leftWing: null,
    rightWing: null,
    dpad: { cx: dpadCx, cy: dpadCy, button, gap },
    cutButton,
    autoToggle,
    pauseButton,
    menuColumn,
    menuHero: null,
    menuSelector: null
  };
}

export function pointInRect(x: number, y: number, r: Rect, pad = 0): boolean {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

/** Measures `env(safe-area-inset-*)` via the hidden `#safe-area-probe` element (CSS px). */
export function readSafeAreaInsets(): SafeInsets {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const probe = document.getElementById('safe-area-probe');
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const r = probe.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clamp = (v: number): number => (Number.isFinite(v) ? Math.max(0, Math.min(80, v)) : 0);
  return {
    top: clamp(r.top),
    left: clamp(r.left),
    right: clamp(vw - r.right),
    bottom: clamp(vh - r.bottom)
  };
}

let currentLayout: GameLayout = computeLayout(LEGACY_W / 2, LEGACY_H / 2, {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
});

export function getLayout(): GameLayout {
  return currentLayout;
}

export function setLayout(layout: GameLayout): void {
  currentLayout = layout;
}
