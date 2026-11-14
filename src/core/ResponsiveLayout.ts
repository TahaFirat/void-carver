import { CANVAS_HEIGHT, CANVAS_WIDTH, THUMB_ZONE_Y } from './Config';
import type { JoystickSide } from '../services/StorageService';

export type { JoystickSide };

/**
 * Universal Mobile-First Responsive Layout Engine (V6).
 *
 * Game physics always run in the fixed `900x1200` (3:4) logical arena, so wave layouts,
 * wall spacing and boss speeds are 100% fair on every device. Only the *screen shell*
 * around it adapts:
 *
 * - `PHONE_PORTRAIT`  (vw/vh < 0.72): 900-wide column, extra height absorbed by safe areas
 *   and a generous uncluttered control deck (`SOL`, `ORTA`, or `SAĞ`).
 * - `TABLET_PORTRAIT` (0.72..1.12): arena column centered; ergonomic controller docked to
 *   the player's chosen position (`SOL`, `ORTA`, or `SAĞ`).
 * - `LANDSCAPE_SPLIT` (> 1.12): 3-column arcade cabinet with side wings.
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
  joystickSide: JoystickSide;
  /** Physical viewport dimensions in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  /** Safe upper limit in CSS pixels below which the control pad may appear (never overlaps HUD/arena). */
  statusStripBottomCssY: number;
  /** Optional horizontal wing limits in CSS pixels for landscape split mode. */
  landscapeLeftWingMaxCssX: number | null;
  landscapeRightWingMinCssX: number | null;

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
  /** Portrait only: translation for the single-line status strip (`y 1226..1284`). */
  statusOffset: { x: number; y: number } | null;
  /** Portrait only: control deck background rect. */
  deckRect: Rect | null;
  /** Landscape only: side wing panels. */
  leftWing: Rect | null;
  rightWing: Rect | null;

  joystick: { cx: number; cy: number; radius: number };
  /** Generous touch capture region for thumb steering on the chosen side. */
  joystickZone: Rect;
  /** Minimal bottom-left pixel gear icon (`⚙`) opening Pause / Control Settings. */
  gearButton: Rect;
  /** Minimal bottom-right pixel hand icon (`✋`) cycling `SOL -> ORTA -> SAĞ`. */
  swapSideButton: Rect;
  pauseButton: Rect;

  /** Single-column transform for menus & modals. */
  menuColumn: ColumnTransform;
  /** Landscape main menu: hero (planet + ship + logo) and action/record halves. */
  menuHero: ColumnTransform | null;
  menuSelector: ColumnTransform | null;
}

const LEGACY_W = CANVAS_WIDTH; // 900
const LEGACY_H = CANVAS_HEIGHT; // 1600
const FRAME_TOP = 92;
const FRAME_BOTTOM = 1220;
const FRAME_LEFT = 21;
const FRAME_RIGHT = 879;
const STATUS_BOTTOM = THUMB_ZONE_Y; // 1290

let preferredJoystickSide: JoystickSide = 'CENTER';
let lastCssW = LEGACY_W / 2;
let lastCssH = LEGACY_H / 2;
let lastInsetsCss: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export function classifyLayoutMode(cssW: number, cssH: number): LayoutMode {
  const aspect = cssW / Math.max(1, cssH);
  if (aspect > 1.12) return 'LANDSCAPE_SPLIT';
  if (aspect >= 0.72) return 'TABLET_PORTRAIT';
  return 'PHONE_PORTRAIT';
}

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

export function computeLayout(
  cssW: number,
  cssH: number,
  insetsCss: SafeInsets,
  joystickSide: JoystickSide = preferredJoystickSide
): GameLayout {
  lastCssW = cssW;
  lastCssH = cssH;
  lastInsetsCss = insetsCss;
  preferredJoystickSide = joystickSide;

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

    const stickWing = joystickSide === 'LEFT' ? leftWing : rightWing;
    const joystickRadius = Math.round(Math.max(88, Math.min(120, stickWing.w * 0.36)));
    const joystick = {
      cx: stickWing.x + stickWing.w * 0.5,
      cy: stickWing.y + stickWing.h - joystickRadius - 96,
      radius: joystickRadius
    };
    const joystickZone: Rect = {
      x: stickWing.x,
      y: stickWing.y + stickWing.h * 0.42,
      w: stickWing.w,
      h: stickWing.h * 0.58
    };

    const iconSize = 80;
    const gearButton: Rect = {
      x: Math.round(leftWing.x + 14),
      y: Math.round(leftWing.y + leftWing.h - iconSize - 12),
      w: iconSize,
      h: iconSize
    };
    const swapSideButton: Rect = {
      x: Math.round(rightWing.x + rightWing.w - iconSize - 14),
      y: Math.round(rightWing.y + rightWing.h - iconSize - 12),
      w: iconSize,
      h: iconSize
    };

    const pauseSize = Math.round(
      Math.max(58, Math.min(86, Math.min(leftWing.w, rightWing.w) * 0.25))
    );
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

    const halfW = (width - safe.left - safe.right) * 0.5;
    const availH = height - safe.top - safe.bottom;
    const heroS = Math.min(halfW / LEGACY_W, (availH * 0.92) / 620);
    const selS = Math.min(halfW / LEGACY_W, (availH * 0.94) / 960);
    const menuHero: ColumnTransform = {
      tx: safe.left + (halfW - LEGACY_W * heroS) * 0.5,
      ty: safe.top + (availH - 620 * heroS) * 0.5,
      s: heroS
    };
    const menuSelector: ColumnTransform = {
      tx: safe.left + halfW + (halfW - LEGACY_W * selS) * 0.5,
      ty: safe.top + (availH - 960 * selS) * 0.5 - 600 * selS,
      s: selS
    };

    const statusStripBottomCssY = Math.round(
      Math.min(cssH * 0.48, (stickWing.y + stickWing.h * 0.44) * fit.cssScale)
    );

    return {
      mode,
      joystickSide,
      cssWidth: cssW,
      cssHeight: cssH,
      statusStripBottomCssY,
      landscapeLeftWingMaxCssX: (leftWing.x + leftWing.w) * fit.cssScale,
      landscapeRightWingMinCssX: rightWing.x * fit.cssScale,
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
      joystick,
      joystickZone,
      gearButton,
      swapSideButton,
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
  const topShift = safe.top + Math.min(extraH * 0.22, 54);
  const deckTop = topShift + STATUS_BOTTOM;
  const deckBottom = height - safe.bottom;
  const deckH = Math.max(270, deckBottom - deckTop);
  const deckRect: Rect = { x: 0, y: deckTop, w: width, h: deckH };

  const isTablet = mode === 'TABLET_PORTRAIT' || width > LEGACY_W + 120;
  const joystickRadius = Math.round(
    Math.max(104, Math.min(132, deckH * 0.38, deckH * 0.5 - 24))
  );

  const leftCx = isTablet
    ? safe.left + joystickRadius + 54
    : columnX + Math.max(joystickRadius + 46, 225);
  const rightCx = isTablet
    ? width - safe.right - joystickRadius - 54
    : columnX + LEGACY_W - Math.max(joystickRadius + 46, 225);
  const centerCx = width * 0.5;

  const stickCx =
    joystickSide === 'RIGHT' ? rightCx : joystickSide === 'LEFT' ? leftCx : centerCx;

  const joystick = {
    cx: stickCx,
    cy: deckTop + deckH * 0.5,
    radius: joystickRadius
  };

  const joystickZone: Rect =
    joystickSide === 'RIGHT'
      ? { x: width * 0.3, y: deckTop, w: width * 0.7, h: deckH }
      : joystickSide === 'LEFT'
        ? { x: 0, y: deckTop, w: width * 0.7, h: deckH }
        : { x: 0, y: deckTop, w: width, h: deckH };

  const cornerBtnSize = 84;
  const cornerBtnY = Math.round(Math.max(deckTop + 16, deckBottom - cornerBtnSize - 14));
  const gearButton: Rect = {
    x: Math.round(Math.max(safe.left + 16, columnX + 18)),
    y: cornerBtnY,
    w: cornerBtnSize,
    h: cornerBtnSize
  };
  const swapSideButton: Rect = {
    x: Math.round(Math.min(width - safe.right - cornerBtnSize - 16, columnX + LEGACY_W - cornerBtnSize - 18)),
    y: cornerBtnY,
    w: cornerBtnSize,
    h: cornerBtnSize
  };

  const pauseButton: Rect = { x: columnX + LEGACY_W - 128, y: topShift, w: 128, h: 88 };

  const menuColumn: ColumnTransform = {
    tx: columnX,
    ty: safe.top + extraH * 0.5,
    s: 1
  };

  const statusStripBottomCssY = Math.round(deckTop * fit.cssScale);

  return {
    mode,
    joystickSide,
    cssWidth: cssW,
    cssHeight: cssH,
    statusStripBottomCssY,
    landscapeLeftWingMaxCssX: null,
    landscapeRightWingMinCssX: null,
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
    joystick,
    joystickZone,
    gearButton,
    swapSideButton,
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

let currentLayout: GameLayout = computeLayout(
  LEGACY_W / 2,
  LEGACY_H / 2,
  { top: 0, right: 0, bottom: 0, left: 0 },
  'CENTER'
);

export function getLayout(): GameLayout {
  return currentLayout;
}

export function setLayout(layout: GameLayout): void {
  currentLayout = layout;
}

export function setPreferredJoystickSide(side: JoystickSide): GameLayout {
  preferredJoystickSide = side;
  currentLayout = computeLayout(lastCssW, lastCssH, lastInsetsCss, side);
  return currentLayout;
}

export function getPreferredJoystickSide(): JoystickSide {
  return preferredJoystickSide;
}
