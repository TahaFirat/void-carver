import { ARENA_VIEW_SCALE, PIXEL_SCALE } from '../core/Config';

export const ARENA_PIXEL_SCALE = PIXEL_SCALE / ARENA_VIEW_SCALE;

export interface PixelSurface {
  readonly width: number;
  readonly height: number;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly imageData: ImageData;
  readonly u32: Uint32Array;
}

const COLOR_U32_CACHE = new Map<string, number>();

// Classic 2x2 and 4x4 Bayer ordered dithering matrices (normalized [0..1))
const BAYER_2X2 = [
  [0.0, 0.5],
  [0.75, 0.25]
];

const BAYER_4X4 = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16]
];

export function disableSmoothing(ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = false;
}

export function hexToU32(hex: string, alpha = 255): number {
  const key = alpha === 255 ? hex : `${hex}:${alpha}`;
  const cached = COLOR_U32_CACHE.get(key);
  if (cached !== undefined) return cached;

  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16) & 0xff;
  const g = parseInt(clean.slice(2, 4), 16) & 0xff;
  const b = parseInt(clean.slice(4, 6), 16) & 0xff;
  const a = alpha & 0xff;
  const packed = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  COLOR_U32_CACHE.set(key, packed);
  return packed;
}

export function darkenU32(u32: number, factor: number): number {
  const a = (u32 >>> 24) & 0xff;
  if (a === 0) return 0;
  const b = Math.max(0, Math.min(255, Math.round(((u32 >>> 16) & 0xff) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((u32 >>> 8) & 0xff) * factor)));
  const r = Math.max(0, Math.min(255, Math.round((u32 & 0xff) * factor)));
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function createPixelSurface(width: number, height: number): PixelSurface {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const imageData = ctx.createImageData(width, height);
  const u32 = new Uint32Array(imageData.data.buffer);
  return { width, height, canvas, ctx, imageData, u32 };
}

export function clearPixelSurface(s: PixelSurface, fillU32 = 0): void {
  s.u32.fill(fillU32);
}

export function setPx(s: PixelSurface, x: number, y: number, colU32: number): void {
  const ix = x | 0;
  const iy = y | 0;
  if (ix < 0 || iy < 0 || ix >= s.width || iy >= s.height) return;
  s.u32[iy * s.width + ix] = colU32;
}

export function getPx(s: PixelSurface, x: number, y: number): number {
  const ix = x | 0;
  const iy = y | 0;
  if (ix < 0 || iy < 0 || ix >= s.width || iy >= s.height) return 0;
  return s.u32[iy * s.width + ix];
}

export function bayerDitherColor(
  px: number,
  py: number,
  t: number,
  rampU32: readonly number[],
  use4x4 = false
): number {
  const clamped = Math.max(0, Math.min(0.9999, t));
  const scaled = clamped * (rampU32.length - 1);
  const idx = Math.floor(scaled);
  const frac = scaled - idx;
  if (idx >= rampU32.length - 1) return rampU32[rampU32.length - 1];

  const threshold = use4x4
    ? BAYER_4X4[((py % 4) + 4) % 4][((px % 4) + 4) % 4]
    : BAYER_2X2[((py % 2) + 2) % 2][((px % 2) + 2) % 2];
  return frac > threshold ? rampU32[idx + 1] : rampU32[idx];
}

export function fillRectPx(
  s: PixelSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  colU32: number
): void {
  const x0 = Math.max(0, x | 0);
  const y0 = Math.max(0, y | 0);
  const x1 = Math.min(s.width, (x + w) | 0);
  const y1 = Math.min(s.height, (y + h) | 0);
  for (let py = y0; py < y1; py++) {
    const row = py * s.width;
    for (let px = x0; px < x1; px++) {
      s.u32[row + px] = colU32;
    }
  }
}

export function strokeRectPx(
  s: PixelSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  colU32: number
): void {
  fillRectPx(s, x, y, w, 1, colU32);
  fillRectPx(s, x, y + h - 1, w, 1, colU32);
  fillRectPx(s, x, y, 1, h, colU32);
  fillRectPx(s, x + w - 1, y, 1, h, colU32);
}

export function drawLinePx(
  s: PixelSurface,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colU32: number,
  thickness = 1
): void {
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);

  const dx = Math.abs(ix1 - ix0);
  const sx = ix0 < ix1 ? 1 : -1;
  const dy = -Math.abs(iy1 - iy0);
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx + dy;
  const half = Math.floor((thickness - 1) / 2);

  while (true) {
    if (thickness <= 1) {
      setPx(s, ix0, iy0, colU32);
    } else {
      fillRectPx(s, ix0 - half, iy0 - half, thickness, thickness, colU32);
    }
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      ix0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

export function fillEllipseDitheredPx(
  s: PixelSurface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rampU32: readonly number[],
  lightOffsetX = -0.32,
  lightOffsetY = -0.35
): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(s.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(s.height - 1, Math.ceil(cy + ry));

  for (let py = y0; py <= y1; py++) {
    const ny = (py - cy) / Math.max(0.5, ry);
    for (let px = x0; px <= x1; px++) {
      const nx = (px - cx) / Math.max(0.5, rx);
      if (nx * nx + ny * ny <= 1.0) {
        const distLight = Math.hypot(nx - lightOffsetX, ny - lightOffsetY) / 1.45;
        const col = bayerDitherColor(px, py, distLight, rampU32, true);
        s.u32[py * s.width + px] = col;
      }
    }
  }
}

/**
 * Stamps a crisp 1px dark arcade contour (`#080810`) around every opaque sprite pixel.
 */
export function applyArcadeOutline(s: PixelSurface, outlineHex = '#080810'): void {
  const outlineU32 = hexToU32(outlineHex);
  const w = s.width;
  const h = s.height;
  const copy = new Uint32Array(s.u32);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if ((copy[row + x] >>> 24) !== 0) continue;
      const hasOpaqueNeighbor =
        (x > 0 && (copy[row + x - 1] >>> 24) !== 0) ||
        (x + 1 < w && (copy[row + x + 1] >>> 24) !== 0) ||
        (y > 0 && (copy[row - w + x] >>> 24) !== 0) ||
        (y + 1 < h && (copy[row + w + x] >>> 24) !== 0);
      if (hasOpaqueNeighbor) {
        s.u32[row + x] = outlineU32;
      }
    }
  }
}

export function commitPixelSurface(s: PixelSurface): HTMLCanvasElement {
  s.ctx.imageSmoothingEnabled = false;
  s.ctx.putImageData(s.imageData, 0, 0);
  return s.canvas;
}

/**
 * Blits a low-resolution arcade sprite canvas onto the main 900x1600 canvas at integer pixel coordinates
 * with `imageSmoothingEnabled = false` so every arcade pixel stays razor-sharp.
 */
export function blitPixelSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  screenCx: number,
  screenCy: number,
  scale = PIXEL_SCALE,
  rotationRad = 0
): void {
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  const drawW = Math.round(sprite.width * scale);
  const drawH = Math.round(sprite.height * scale);

  if (Math.abs(rotationRad) < 0.001) {
    const dx = Math.round((screenCx - drawW * 0.5) / PIXEL_SCALE) * PIXEL_SCALE;
    const dy = Math.round((screenCy - drawH * 0.5) / PIXEL_SCALE) * PIXEL_SCALE;
    ctx.drawImage(sprite, dx, dy, drawW, drawH);
  } else {
    ctx.save();
    const sx = Math.round(screenCx / PIXEL_SCALE) * PIXEL_SCALE;
    const sy = Math.round(screenCy / PIXEL_SCALE) * PIXEL_SCALE;
    ctx.translate(sx, sy);
    ctx.rotate(rotationRad);
    ctx.drawImage(sprite, -Math.round(drawW * 0.5), -Math.round(drawH * 0.5), drawW, drawH);
    ctx.restore();
  }

  ctx.imageSmoothingEnabled = prevSmooth;
}

/**
 * Blits an arcade pixel sprite inside the logical 900x1200 arena transform (`scale = ARENA_VIEW_SCALE = 0.9`)
 * so that each sprite pixel maps to an exact 3x3 block on the 900x1600 canvas.
 */
export function blitArenaPixelSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  arenaCx: number,
  arenaCy: number,
  scaleMultiplier = 1,
  rotationRad = 0
): void {
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  const logicalScale = ARENA_PIXEL_SCALE * scaleMultiplier;
  const drawW = sprite.width * logicalScale;
  const drawH = sprite.height * logicalScale;

  // Snap to 1 arcade pixel (= 10/3 logical units = 3 screen pixels)
  const snapUnit = ARENA_PIXEL_SCALE;
  const sx = Math.round(arenaCx / snapUnit) * snapUnit;
  const sy = Math.round(arenaCy / snapUnit) * snapUnit;

  if (Math.abs(rotationRad) < 0.001) {
    ctx.drawImage(sprite, sx - drawW * 0.5, sy - drawH * 0.5, drawW, drawH);
  } else {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rotationRad);
    ctx.drawImage(sprite, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
    ctx.restore();
  }

  ctx.imageSmoothingEnabled = prevSmooth;
}

// ============================================================================
// 16-BIT ARCADE PIXEL BITMAP FONT ENGINE (FULL TURKISH + SYMBOLS)
// ============================================================================
export type PixelFontTone =
  | 'white'
  | 'gold'
  | 'green'
  | 'crimson'
  | 'red'
  | 'orange'
  | 'cyan'
  | 'silver'
  | 'muted';

export type PixelTextTone = PixelFontTone;

const FONT_TONES: Record<PixelFontTone, readonly [string, string, string]> = {
  white: ['#FFFFFF', '#DCE6F8', '#92A6C8'],
  gold: ['#FFF6A8', '#F8C830', '#B87810'],
  green: ['#B8FF88', '#38E848', '#149028'],
  crimson: ['#FF9880', '#F03824', '#98140C'],
  red: ['#FF9880', '#F03824', '#98140C'],
  orange: ['#FFF098', '#FF8418', '#B83C08'],
  cyan: ['#C8F8FF', '#48D0FF', '#1878B8'],
  silver: ['#F0F6FF', '#B0BED4', '#6E7C96'],
  muted: ['#B0BCD4', '#7E8CA8', '#4E5A74']
};

// 6x7 full-height uppercase arcade pixel bitmaps (diacritics rendered above/below cap-height!)
const GLYPHS_6X7: Record<string, readonly string[]> = {
  A: ['.####.', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  B: ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '#####.'],
  C: ['.####.', '##..##', '##....', '##....', '##....', '##..##', '.####.'],
  Ç: ['.####.', '##..##', '##....', '##....', '##....', '##..##', '.####.'],
  D: ['#####.', '##..##', '##..##', '##..##', '##..##', '##..##', '#####.'],
  E: ['######', '##....', '##....', '#####.', '##....', '##....', '######'],
  F: ['######', '##....', '##....', '#####.', '##....', '##....', '##....'],
  G: ['.####.', '##..##', '##....', '##.###', '##..##', '##..##', '.#####'],
  Ğ: ['.####.', '##..##', '##....', '##.###', '##..##', '##..##', '.#####'],
  H: ['##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##'],
  I: ['.####.', '..##..', '..##..', '..##..', '..##..', '..##..', '.####.'],
  İ: ['.####.', '..##..', '..##..', '..##..', '..##..', '..##..', '.####.'],
  J: ['..####', '...##.', '...##.', '...##.', '##.##.', '##.##.', '.###..'],
  K: ['##..##', '##.##.', '####..', '###...', '####..', '##.##.', '##..##'],
  L: ['##....', '##....', '##....', '##....', '##....', '##....', '######'],
  M: ['##..##', '######', '######', '##..##', '##..##', '##..##', '##..##'],
  N: ['##..##', '###.##', '######', '##.###', '##..##', '##..##', '##..##'],
  O: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  Ö: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  P: ['#####.', '##..##', '##..##', '#####.', '##....', '##....', '##....'],
  Q: ['.####.', '##..##', '##..##', '##..##', '##.###', '##..##', '.###.#'],
  R: ['#####.', '##..##', '##..##', '#####.', '####..', '##.##.', '##..##'],
  S: ['.#####', '##....', '##....', '.####.', '....##', '....##', '#####.'],
  Ş: ['.#####', '##....', '##....', '.####.', '....##', '....##', '#####.'],
  T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  Ü: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  V: ['##..##', '##..##', '##..##', '##..##', '.####.', '.####.', '..##..'],
  W: ['##..##', '##..##', '##..##', '##..##', '######', '######', '##..##'],
  X: ['##..##', '##..##', '.####.', '..##..', '.####.', '##..##', '##..##'],
  Y: ['##..##', '##..##', '.####.', '..##..', '..##..', '..##..', '..##..'],
  Z: ['######', '....##', '...##.', '..##..', '.##...', '##....', '######'],
  '0': ['.####.', '##.###', '######', '######', '###.##', '##..##', '.####.'],
  '1': ['..##..', '.###..', '..##..', '..##..', '..##..', '..##..', '.####.'],
  '2': ['.####.', '##..##', '....##', '..###.', '.##...', '##....', '######'],
  '3': ['#####.', '....##', '....##', '.####.', '....##', '....##', '#####.'],
  '4': ['...###', '..####', '.##.##', '##..##', '######', '....##', '....##'],
  '5': ['######', '##....', '#####.', '....##', '....##', '##..##', '.####.'],
  '6': ['.####.', '##....', '#####.', '##..##', '##..##', '##..##', '.####.'],
  '7': ['######', '....##', '...##.', '..##..', '.##...', '.##...', '.##...'],
  '8': ['.####.', '##..##', '##..##', '.####.', '##..##', '##..##', '.####.'],
  '9': ['.####.', '##..##', '##..##', '.#####', '....##', '....##', '.####.'],
  '.': ['......', '......', '......', '......', '......', '..##..', '..##..'],
  ':': ['......', '..##..', '..##..', '......', '..##..', '..##..', '......'],
  '%': ['##..##', '##.##.', '...##.', '..##..', '.##...', '.##.##', '##..##'],
  '/': ['....##', '...##.', '...##.', '..##..', '.##...', '.##...', '##....'],
  '+': ['......', '..##..', '..##..', '######', '..##..', '..##..', '......'],
  '-': ['......', '......', '......', '######', '......', '......', '......'],
  '•': ['......', '......', '..##..', '.####.', '..##..', '......', '......'],
  '!': ['..##..', '..##..', '..##..', '..##..', '..##..', '......', '..##..'],
  '?': ['.####.', '##..##', '....##', '..###.', '..##..', '......', '..##..'],
  '(': ['...##.', '..##..', '.##...', '.##...', '.##...', '..##..', '...##.'],
  ')': ['.##...', '..##..', '...##.', '...##.', '...##.', '..##..', '.##...'],
  '[': ['.####.', '.##...', '.##...', '.##...', '.##...', '.##...', '.####.'],
  ']': ['.####.', '...##.', '...##.', '...##.', '...##.', '...##.', '.####.'],
  '|': ['..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  '✔': ['......', '.....#', '....##', '#..##.', '####..', '.##...', '......'],
  '★': ['..##..', '..##..', '######', '.####.', '.####.', '##..##', '#....#'],
  '❚': ['.####.', '.####.', '.####.', '.####.', '.####.', '.####.', '.####.']
};

const TOP_DIACRITIC_ROW: Record<string, string> = {
  Ö: '.#..#.',
  Ü: '.#..#.',
  İ: '..##..',
  Ğ: '.####.'
};

const BOTTOM_CEDILLA_ROW: Record<string, string> = {
  Ç: '..##..',
  Ş: '..##..'
};

const GLYPH_CANVAS_CACHE = new Map<string, HTMLCanvasElement>();

function getGlyphCanvas(ch: string, tone: PixelFontTone): HTMLCanvasElement | null {
  const upper = ch.toLocaleUpperCase('tr-TR');
  const rows = GLYPHS_6X7[upper] ?? GLYPHS_6X7[ch];
  if (!rows) return null;

  const key = `${upper}:${tone}`;
  const cached = GLYPH_CANVAS_CACHE.get(key);
  if (cached) return cached;

  // 8x13 surface: ry = 1 top diacritic, ry = 3..9 full 7px uppercase body, ry = 10 cedilla
  const surf = createPixelSurface(8, 13);
  const [topHex, midHex, botHex] = FONT_TONES[tone];
  const cTop = hexToU32(topHex);
  const cMid = hexToU32(midHex);
  const cBot = hexToU32(botHex);
  const cShadow = hexToU32('#050710');

  const topMark = TOP_DIACRITIC_ROW[upper];
  if (topMark) {
    for (let rx = 0; rx < 6; rx++) {
      if (topMark[rx] === '#') {
        setPx(surf, rx + 1, 1, cTop);
      }
    }
  }

  for (let ry = 0; ry < 7; ry++) {
    const rowStr = rows[ry];
    const col = ry <= 1 ? cTop : ry <= 4 ? cMid : cBot;
    for (let rx = 0; rx < 6; rx++) {
      if (rowStr[rx] === '#') {
        setPx(surf, rx + 1, ry + 3, col);
      }
    }
  }

  const botMark = BOTTOM_CEDILLA_ROW[upper];
  if (botMark) {
    for (let rx = 0; rx < 6; rx++) {
      if (botMark[rx] === '#') {
        setPx(surf, rx + 1, 10, cBot);
      }
    }
  }

  applyArcadeOutline(surf, '#060812');

  // Extra 1px vertical arcade drop shadow
  for (let ry = 12; ry >= 1; ry--) {
    for (let rx = 0; rx < 8; rx++) {
      if (getPx(surf, rx, ry) === 0 && getPx(surf, rx, ry - 1) !== 0) {
        setPx(surf, rx, ry, cShadow);
      }
    }
  }

  const canvas = commitPixelSurface(surf);
  GLYPH_CANVAS_CACHE.set(key, canvas);
  return canvas;
}

export function measurePixelText(text: string, pixelScale = 3, letterGapPx = 1): number {
  if (!text) return 0;
  const chars = Array.from(text);
  const advance = (6 + letterGapPx) * pixelScale;
  return chars.length * advance - letterGapPx * pixelScale + 2 * pixelScale;
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    scale?: number;
    tone?: PixelFontTone;
    align?: 'left' | 'center' | 'right';
    letterGap?: number;
  } = {}
): void {
  if (!text) return;
  const scale = options.scale ?? 3;
  const tone = options.tone ?? 'white';
  const align = options.align ?? 'left';
  const letterGap = options.letterGap ?? 1;

  const totalW = measurePixelText(text, scale, letterGap);
  let cursorX = x;
  if (align === 'center') cursorX = x - totalW * 0.5;
  else if (align === 'right') cursorX = x - totalW;

  cursorX = Math.round(cursorX);
  const drawY = Math.round(y - 6.5 * scale);

  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;

  const step = (6 + letterGap) * scale;
  for (const ch of Array.from(text)) {
    if (ch !== ' ') {
      const glyph = getGlyphCanvas(ch, tone);
      if (glyph) {
        ctx.drawImage(glyph, cursorX, drawY, 8 * scale, 13 * scale);
      }
    }
    cursorX += step;
  }

  ctx.imageSmoothingEnabled = prevSmooth;
}
