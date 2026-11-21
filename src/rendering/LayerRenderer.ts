import {
  ARENA_HEIGHT,
  ARENA_VIEW_HEIGHT,
  ARENA_VIEW_WIDTH,
  ARENA_VIEW_X,
  ARENA_VIEW_Y,
  ARENA_WIDTH,
  CHAPTER_THEMES,
  ChapterThemeId,
  FRAME_BEZEL_PX,
  PALETTE,
  PIXEL_SCALE
} from '../core/Config';
import { Barrier, Point } from '../geometry/Types';
import {
  commitPixelSurface,
  createPixelSurface,
  disableSmoothing,
  fillRectPx,
  hexToU32,
  strokeRectPx
} from './PixelArtEngine';
import { getStageTerrainCanvas } from './VolfiedTerrains';

const HUE_TERRAIN_CACHE = new Map<string, HTMLCanvasElement>();
const TERRITORY_FILL_CACHE = new Map<string, HTMLCanvasElement>();

export function getTerritoryFillOverlayCanvas(fillId: string): HTMLCanvasElement | null {
  if (!fillId || fillId === 'FILL_DARK_GRID') return null;
  const cached = TERRITORY_FILL_CACHE.get(fillId);
  if (cached) return cached;

  const w = 270;
  const h = 360;
  const s = createPixelSurface(w, h);

  if (fillId === 'FILL_GOLD_HEX') {
    const cBg = hexToU32('#14110C');
    const cEdge = hexToU32('#CA8A04');
    const cBright = hexToU32('#FACC15');
    for (let y = 0; y < h; y++) {
      const row = Math.floor(y / 14);
      const yIn = y % 14;
      for (let x = 0; x < w; x++) {
        const xShift = (x + (row % 2 === 1 ? 12 : 0)) % 24;
        const onHex =
          (yIn === 0 && xShift >= 6 && xShift <= 17) ||
          ((yIn === 1 || yIn === 13) && (xShift === 5 || xShift === 18)) ||
          ((yIn === 2 || yIn === 12) && (xShift === 3 || xShift === 20)) ||
          (yIn >= 3 && yIn <= 11 && (xShift === 1 || xShift === 22));
        if (onHex) {
          s.u32[y * w + x] = yIn <= 2 ? cBright : cEdge;
        } else if ((x + y) % 2 === 0) {
          s.u32[y * w + x] = cBg;
        }
      }
    }
  } else if (fillId === 'FILL_CYBER_CIRCUIT') {
    const cBg = hexToU32('#03221A');
    const cTrace = hexToU32('#059669');
    const cNode = hexToU32('#34D399');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if ((x + y) % 2 === 0) s.u32[y * w + x] = cBg;
        const gx = x % 30;
        const gy = y % 30;
        const onTrace =
          (gy === 8 && gx >= 4 && gx <= 22) ||
          (gx === 22 && gy >= 8 && gy <= 24) ||
          (gy === 24 && gx >= 12 && gx <= 26);
        if (onTrace) s.u32[y * w + x] = cTrace;
        if ((gx === 4 && gy === 8) || (gx === 22 && gy === 24)) {
          fillRectPx(s, x - 1, y - 1, 3, 3, cNode);
        }
      }
    }
  } else if (fillId === 'FILL_CRYSTAL_MOSAIC') {
    const cDark = hexToU32('#062838');
    const cMid = hexToU32('#0E7490');
    const cEdge = hexToU32('#22D3EE');
    const cSpec = hexToU32('#CFFAFE');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d1 = (x + y) % 26;
        const d2 = (x - y + 720) % 26;
        if (d1 === 0 || d2 === 0) {
          s.u32[y * w + x] = d1 === 0 && d2 === 0 ? cSpec : cEdge;
        } else {
          s.u32[y * w + x] = ((Math.floor((x + y) / 26) + Math.floor((x - y + 720) / 26)) & 1) === 0 ? cDark : cMid;
        }
      }
    }
  } else if (fillId === 'FILL_CRIMSON_CARBON') {
    const cA = hexToU32('#1C070D');
    const cB = hexToU32('#3B0A18');
    const cRim = hexToU32('#E11D48');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cell = ((Math.floor(x / 6) + Math.floor(y / 6)) & 1) === 0;
        const seam = x % 18 === 0 || y % 18 === 0;
        s.u32[y * w + x] = seam ? cRim : cell ? cA : cB;
      }
    }
  } else if (fillId === 'FILL_DEEP_NEBULA') {
    const cDeep = hexToU32('#120B2E');
    const cNeb1 = hexToU32('#2E1065');
    const cNeb2 = hexToU32('#581C87');
    const cStar = hexToU32('#F5D0FE');
    const cWhite = hexToU32('#FFFFFF');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const wave = Math.sin(x * 0.055 + y * 0.03) + Math.cos(x * 0.025 - y * 0.05);
        s.u32[y * w + x] = wave > 0.75 ? cNeb2 : wave > -0.1 ? cNeb1 : cDeep;
        const hash = ((x * 7919 + y * 6151) ^ (x * y)) & 0x3ff;
        if (hash === 1) s.u32[y * w + x] = cWhite;
        else if (hash === 7 || hash === 19) s.u32[y * w + x] = cStar;
      }
    }
  } else {
    return null;
  }

  const out = commitPixelSurface(s);
  TERRITORY_FILL_CACHE.set(fillId, out);
  return out;
}

/**
 * Pixel-exact hue rotation (CSS `hue-rotate` matrix applied per pixel, no smoothing) so the
 * 16 recycled planet terrains get distinct palettes across 100 stages on every WebView.
 */
function getHueShiftedTerrain(stage: number, brightness: number, hueDeg: number): HTMLCanvasElement {
  const base = getStageTerrainCanvas(stage, brightness);
  if (hueDeg === 0) return base;
  const key = `${stage}:${brightness}:${hueDeg}`;
  const cached = HUE_TERRAIN_CACHE.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = base.width;
  canvas.height = base.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return base;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  const a = (hueDeg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const m = [
    0.213 + cos * 0.787 - sin * 0.213,
    0.715 - cos * 0.715 - sin * 0.715,
    0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143,
    0.715 + cos * 0.285 + sin * 0.14,
    0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787,
    0.715 - cos * 0.715 + sin * 0.715,
    0.072 + cos * 0.928 + sin * 0.072
  ];
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = Math.max(0, Math.min(255, r * m[0] + g * m[1] + b * m[2]));
    d[i + 1] = Math.max(0, Math.min(255, r * m[3] + g * m[4] + b * m[5]));
    d[i + 2] = Math.max(0, Math.min(255, r * m[6] + g * m[7] + b * m[8]));
  }
  ctx.putImageData(img, 0, 0);
  HUE_TERRAIN_CACHE.set(key, canvas);
  return canvas;
}

export type FloorMotifId =
  | 'architectural-miter'
  | 'parallel-slabs'
  | 'cross-axis'
  | 'frame-inlay'
  | 'twin-symmetry'
  | 'radial-compass';

export interface FloorStyleSpec {
  chapterTheme: ChapterThemeId;
  floorMotif: FloorMotifId;
  stageNumber?: number;
}

export class LayerRenderer {
  private topStageCanvas: HTMLCanvasElement | null = null;
  private underStageCanvas: HTMLCanvasElement | null = null;
  private goldFrameCanvas: HTMLCanvasElement | null = null;

  public initializeFloor(spec: FloorStyleSpec & { paletteHueShift?: number }): void {
    const theme = CHAPTER_THEMES[spec.chapterTheme];
    const stageNum = spec.stageNumber ?? theme?.stageIndex ?? 1;
    // Stage 1..15 reveals Stage N+1 at 70% brightness; Stage 16 reveals Stage 17 (Escape Hatch)!
    // V5: 100 stages recycle the 16 terrains (theme decides the art) with per-cycle hue shifts.
    const themeStage = theme?.stageIndex ?? ((stageNum - 1) % 16) + 1;
    const clampedStage = Math.max(1, Math.min(16, themeStage));
    const nextStage = clampedStage === 16 ? 17 : clampedStage + 1;
    const hue = Math.round(spec.paletteHueShift ?? 0);

    this.topStageCanvas = getHueShiftedTerrain(clampedStage, 1.0, hue);
    this.underStageCanvas = getHueShiftedTerrain(nextStage, 0.7, hue);

    if (!this.goldFrameCanvas) {
      this.goldFrameCanvas = this.buildGoldArcadeFrameCanvas();
    }
  }

  /**
   * Pre-renders the 3D Gold-Silver Pixel Arcade Frame (`286 x 376` native arcade pixels -> `858 x 1128` screen px)
   * matching `01-hedef-oynanis.jpg` with bolted corner joint blocks!
   */
  private buildGoldArcadeFrameCanvas(): HTMLCanvasElement {
    const bezelNative = Math.round(FRAME_BEZEL_PX / PIXEL_SCALE); // 8 arcade pixels
    const fw = 270 + bezelNative * 2; // 286
    const fh = 360 + bezelNative * 2; // 376
    const s = createPixelSurface(fw, fh);

    const cBlack = hexToU32('#080810');
    const cGoldLight = hexToU32('#FFF29A');
    const cGoldMid = hexToU32('#F4BE2E');
    const cGoldDark = hexToU32('#B47610');
    const cGoldDeep = hexToU32('#6E4206');
    const cSteelLight = hexToU32('#DCE6F4');
    const cSteelMid = hexToU32('#8A96AC');
    const cSteelDark = hexToU32('#485264');

    // Fill outer ring only (leave inner 270x360 transparent)
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const inHole =
          x >= bezelNative &&
          x < fw - bezelNative &&
          y >= bezelNative &&
          y < fh - bezelNative;
        if (inHole) continue;

        const distOuter = Math.min(x, y, fw - 1 - x, fh - 1 - y);
        let col = cGoldMid;
        if (distOuter === 0 || distOuter === bezelNative - 1) {
          col = cBlack;
        } else if (distOuter === 1) {
          col = cGoldDeep;
        } else if (distOuter === 2 || distOuter === 3) {
          col = cGoldLight;
        } else if (distOuter === 4 || distOuter === 5) {
          col = cGoldMid;
        } else {
          col = cGoldDark;
        }
        s.u32[y * fw + x] = col;
      }
    }

    // 4 Corner Joint Blocks (scaled cleanly to bezelNative so zero playfield pixels are covered!)
    const cSize = Math.min(12, bezelNative + 3);
    const corners = [
      [0, 0],
      [fw - cSize, 0],
      [0, fh - cSize],
      [fw - cSize, fh - cSize]
    ];
    for (const [cx, cy] of corners) {
      fillRectPx(s, cx, cy, cSize, cSize, cGoldMid);
      strokeRectPx(s, cx, cy, cSize, cSize, cBlack);
      fillRectPx(s, cx + 1, cy + 1, cSize - 2, 1, cGoldLight);
      fillRectPx(s, cx + 1, cy + 1, 1, cSize - 2, cGoldLight);
      fillRectPx(s, cx + 1, cy + cSize - 2, cSize - 2, 1, cGoldDeep);
      fillRectPx(s, cx + cSize - 2, cy + 1, 1, cSize - 2, cGoldDeep);
      // Inner steel corner plate
      const pOff = Math.floor((cSize - 5) * 0.5);
      fillRectPx(s, cx + pOff, cy + pOff, 5, 5, cSteelMid);
      strokeRectPx(s, cx + pOff, cy + pOff, 5, 5, cBlack);
      fillRectPx(s, cx + pOff + 1, cy + pOff + 1, 2, 2, cSteelLight);
      fillRectPx(s, cx + pOff + 2, cy + pOff + 2, 2, 2, cSteelDark);
    }

    return commitPixelSurface(s);
  }

  /**
   * Draws the revealed Next-Stage lower pixel map (`Stage N+1` darkened to 70%) + outer Gold Frame.
   */
  public renderUnderFloor(
    ctx: CanvasRenderingContext2D,
    shakeX: number,
    shakeY: number,
    freezeRemaining = 0,
    equippedFillId = 'FILL_DARK_GRID',
    timeSeconds = 0
  ): void {
    ctx.save();
    disableSmoothing(ctx);

    const vx = Math.round(ARENA_VIEW_X + shakeX);
    const vy = Math.round(ARENA_VIEW_Y + shakeY);

    if (this.underStageCanvas) {
      if (freezeRemaining > 0) {
        const monoAmt = Math.min(0.88, freezeRemaining / 2.0);
        ctx.filter = `grayscale(${Math.round(monoAmt * 100)}%)`;
      }
      ctx.drawImage(this.underStageCanvas, vx, vy, ARENA_VIEW_WIDTH, ARENA_VIEW_HEIGHT);
      ctx.filter = 'none';
    }

    const customFill = getTerritoryFillOverlayCanvas(equippedFillId);
    if (customFill) {
      ctx.save();
      ctx.globalAlpha = equippedFillId === 'FILL_DEEP_NEBULA' ? 0.92 : 0.78;
      ctx.drawImage(customFill, vx, vy, ARENA_VIEW_WIDTH, ARENA_VIEW_HEIGHT);
      if (equippedFillId === 'FILL_DEEP_NEBULA') {
        ctx.globalAlpha = 0.75;
        for (let i = 0; i < 18; i++) {
          const sx = vx + ((i * 137 + 41) % (ARENA_VIEW_WIDTH - 16)) + 8;
          const sy = vy + ((i * 193 + 67) % (ARENA_VIEW_HEIGHT - 16)) + 8;
          if (Math.sin(timeSeconds * 4 + i * 1.3) > 0.35) {
            ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#E879F9';
            ctx.fillRect(sx, sy, 4, 4);
          }
        }
      }
      ctx.restore();
    }

    if (this.goldFrameCanvas) {
      ctx.drawImage(
        this.goldFrameCanvas,
        vx - FRAME_BEZEL_PX,
        vy - FRAME_BEZEL_PX,
        ARENA_VIEW_WIDTH + FRAME_BEZEL_PX * 2,
        ARENA_VIEW_HEIGHT + FRAME_BEZEL_PX * 2
      );
    }

    ctx.restore();
  }

  /**
   * Renders the uncut `Stage N` 16-bit pixel terrain clipped to `activePolygon`
   * AND the authentic 1989 Yellow-Green (`#D8F028` / `#28E838`) active shield perimeter line
   * (flashing Red-Yellow when shield drops below `150` units!).
   */
  public renderUncutSlab(
    ctx: CanvasRenderingContext2D,
    activePolygon: readonly Point[],
    freezeRemaining = 0,
    shieldLowWarning = false,
    timeSeconds = 0
  ): void {
    if (activePolygon.length < 3 || !this.topStageCanvas) return;

    ctx.save();
    disableSmoothing(ctx);

    // 1. Dark pixel cliff drop shadow cast onto revealed lower stage (`+4, +5` logical units)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(activePolygon[0].x + 4, activePolygon[0].y + 5);
    for (let i = 1; i < activePolygon.length; i++) {
      ctx.lineTo(activePolygon[i].x + 4, activePolygon[i].y + 5);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(4, 6, 16, 0.65)';
    ctx.fill();
    ctx.restore();

    // 2. Clip to `activePolygon` and blit crisp `270 x 360` Stage N terrain across `900 x 1200` logical space
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(activePolygon[0].x, activePolygon[0].y);
    for (let i = 1; i < activePolygon.length; i++) {
      ctx.lineTo(activePolygon[i].x, activePolygon[i].y);
    }
    ctx.closePath();
    ctx.clip();

    if (freezeRemaining > 0) {
      const monoAmt = Math.min(0.88, freezeRemaining / 2.0);
      ctx.filter = `grayscale(${Math.round(monoAmt * 100)}%)`;
    }
    ctx.drawImage(this.topStageCanvas, 0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    ctx.filter = 'none';
    ctx.restore();

    // 3. Authentic 1989 Yellow-Green Shield Line (`#28E838` + `#D8F028` core; Red-Yellow warning flash < 150!)
    ctx.beginPath();
    ctx.moveTo(activePolygon[0].x, activePolygon[0].y);
    for (let i = 1; i < activePolygon.length; i++) {
      ctx.lineTo(activePolygon[i].x, activePolygon[i].y);
    }
    ctx.closePath();

    ctx.lineJoin = 'miter';
    ctx.lineCap = 'square';

    const flashAlt = shieldLowWarning && Math.floor(timeSeconds * 14) % 2 === 1;
    const outerRail = shieldLowWarning ? (flashAlt ? '#FF2820' : '#E89018') : '#28E838';
    const innerCore = shieldLowWarning ? (flashAlt ? '#FFF048' : '#FFFFFF') : '#D8F028';

    ctx.strokeStyle = PALETTE.PIXEL_BLACK;
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.strokeStyle = outerRail;
    ctx.lineWidth = 6.8;
    ctx.stroke();

    ctx.strokeStyle = innerCore;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renders Red-and-Silver Diagonal Striped Pixel Barrier Bars along locked perimeter segments
   * (`01-hedef-oynanis.jpg` left and right middle!).
   */
  public renderSteelBarriers(
    ctx: CanvasRenderingContext2D,
    activeBarriers: readonly Barrier[]
  ): void {
    if (activeBarriers.length === 0) return;

    ctx.save();
    disableSmoothing(ctx);

    for (const b of activeBarriers) {
      const isHoriz = Math.abs(b.y1 - b.y2) < 0.5;
      const xMin = Math.min(b.x1, b.x2);
      const yMin = Math.min(b.y1, b.y2);
      const len = isHoriz ? Math.abs(b.x2 - b.x1) : Math.abs(b.y2 - b.y1);
      if (len < 2) continue;

      ctx.save();
      if (isHoriz) {
        const shiftY = yMin <= 2 ? -9 : 9;
        ctx.translate(xMin, yMin + shiftY);
      } else {
        const shiftX = xMin <= 2 ? -9 : 9;
        ctx.translate(xMin + shiftX, yMin);
        ctx.rotate(Math.PI * 0.5);
      }

      const barH = 16;
      ctx.fillStyle = '#080810';
      ctx.fillRect(-2, -barH * 0.5 - 2, len + 4, barH + 4);

      // Clip inside bar & paint sharp pixel diagonal red/silver stripes
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, -barH * 0.5, len, barH);
      ctx.clip();

      ctx.fillStyle = '#DCE6F2';
      ctx.fillRect(0, -barH * 0.5, len, barH);

      ctx.fillStyle = '#D82018';
      const stripePeriod = 26;
      for (let sx = -barH; sx < len + barH; sx += stripePeriod) {
        ctx.beginPath();
        ctx.moveTo(sx, -barH * 0.5);
        ctx.lineTo(sx + 13, -barH * 0.5);
        ctx.lineTo(sx + 13 - barH, barH * 0.5);
        ctx.lineTo(sx - barH, barH * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Brushed silver end-cap brackets (`01-hedef-oynanis.jpg`)
      for (const capX of [-4, len - 8]) {
        ctx.fillStyle = '#98A6BC';
        ctx.fillRect(capX, -barH * 0.5 - 2, 12, barH + 4);
        ctx.strokeStyle = '#080810';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(capX, -barH * 0.5 - 2, 12, barH + 4);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
