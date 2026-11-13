import { NATIVE_PIXEL_H, NATIVE_PIXEL_W } from '../core/Config';
import {
  bayerDitherColor,
  commitPixelSurface,
  createPixelSurface,
  darkenU32,
  drawLinePx,
  fillRectPx,
  hexToU32,
  PixelSurface,
  setPx,
  strokeRectPx
} from './PixelArtEngine';

const TERRAIN_RAW_CACHE = new Map<number, Uint32Array>();
const TERRAIN_CANVAS_CACHE = new Map<string, HTMLCanvasElement>();

function seededHash(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function drawPixelCrater(
  s: PixelSurface,
  cx: number,
  cy: number,
  r: number,
  rimLight: number,
  rimShadow: number,
  floorMid: number,
  floorDeep: number
): void {
  const x0 = Math.max(0, Math.floor(cx - r - 3));
  const x1 = Math.min(s.width - 1, Math.ceil(cx + r + 3));
  const y0 = Math.max(0, Math.floor(cy - r - 3));
  const y1 = Math.min(s.height - 1, Math.ceil(cy + r + 3));

  for (let py = y0; py <= y1; py++) {
    const dy = py - cy;
    for (let px = x0; px <= x1; px++) {
      const dx = px - cx;
      const dist = Math.hypot(dx, dy);
      if (dist > r + 2.2) continue;

      const lightDot = (dx * 0.72 + dy * 0.69) / Math.max(1, dist);
      if (dist >= r - 1.2) {
        // Raised outer crater lip (dark on NW outer slope, sunlit on SE outer lip)
        s.u32[py * s.width + px] = lightDot > 0.1 ? rimLight : rimShadow;
      } else {
        // Interior bowl (shadowed NW crescent inside bowl, sunlit SE inner wall)
        const innerShift = Math.hypot(dx + r * 0.24, dy + r * 0.24) / r;
        if (innerShift < 0.68) {
          s.u32[py * s.width + px] =
            (px + py) % 2 === 0 && innerShift > 0.45 ? floorMid : floorDeep;
        } else {
          s.u32[py * s.width + px] = lightDot > 0.25 ? rimLight : floorMid;
        }
      }
    }
  }
}

function drawRivetedPanel(
  s: PixelSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: readonly number[],
  outlineU32: number
): void {
  for (let py = y; py < y + h; py++) {
    if (py < 0 || py >= s.height) continue;
    const t = (py - y) / Math.max(1, h);
    for (let px = x; px < x + w; px++) {
      if (px < 0 || px >= s.width) continue;
      s.u32[py * s.width + px] = bayerDitherColor(px, py, 0.25 + t * 0.45, ramp);
    }
  }
  strokeRectPx(s, x, y, w, h, outlineU32);
  // Top/left highlight bevel
  fillRectPx(s, x + 1, y + 1, w - 2, 1, ramp[0]);
  fillRectPx(s, x + 1, y + 1, 1, h - 2, ramp[0]);
  // Bottom/right shadow bevel
  fillRectPx(s, x + 1, y + h - 2, w - 2, 1, ramp[ramp.length - 1]);
  fillRectPx(s, x + w - 2, y + 1, 1, h - 2, ramp[ramp.length - 1]);

  // 4 corner rivets
  if (w >= 12 && h >= 12) {
    setPx(s, x + 3, y + 3, outlineU32);
    setPx(s, x + w - 4, y + 3, outlineU32);
    setPx(s, x + 3, y + h - 4, outlineU32);
    setPx(s, x + w - 4, y + h - 4, outlineU32);
  }
}

function drawVerticalSteelPipe(
  s: PixelSurface,
  cx: number,
  y0: number,
  y1: number,
  radius: number,
  pipeRamp: readonly number[],
  outlineU32: number
): void {
  const top = Math.max(0, Math.min(y0, y1) | 0);
  const bot = Math.min(s.height - 1, Math.max(y0, y1) | 0);
  for (let py = top; py <= bot; py++) {
    const isFlange = py % 38 === 0 || py % 38 === 1;
    const r = isFlange ? radius + 2 : radius;
    for (let dx = -r; dx <= r; dx++) {
      const px = (cx + dx) | 0;
      if (px < 0 || px >= s.width) continue;
      if (Math.abs(dx) === r) {
        s.u32[py * s.width + px] = outlineU32;
      } else {
        const norm = Math.abs(dx + r * 0.28) / (r * 1.28);
        s.u32[py * s.width + px] = bayerDitherColor(px, py, norm, pipeRamp);
      }
    }
  }
}

function drawHorizontalSteelPipe(
  s: PixelSurface,
  x0: number,
  x1: number,
  cy: number,
  radius: number,
  pipeRamp: readonly number[],
  outlineU32: number
): void {
  const left = Math.max(0, Math.min(x0, x1) | 0);
  const right = Math.min(s.width - 1, Math.max(x0, x1) | 0);
  for (let px = left; px <= right; px++) {
    const isFlange = px % 36 === 0 || px % 36 === 1;
    const r = isFlange ? radius + 2 : radius;
    for (let dy = -r; dy <= r; dy++) {
      const py = (cy + dy) | 0;
      if (py < 0 || py >= s.height) continue;
      if (Math.abs(dy) === r) {
        s.u32[py * s.width + px] = outlineU32;
      } else {
        const norm = Math.abs(dy + r * 0.28) / (r * 1.28);
        s.u32[py * s.width + px] = bayerDitherColor(px, py, norm, pipeRamp);
      }
    }
  }
}

function drawPipeElbow(
  s: PixelSurface,
  cornerX: number,
  cornerY: number,
  innerR: number,
  outerR: number,
  quadrant: 0 | 1 | 2 | 3,
  pipeRamp: readonly number[],
  outlineU32: number
): void {
  for (let dy = -outerR; dy <= outerR; dy++) {
    for (let dx = -outerR; dx <= outerR; dx++) {
      const ok =
        (quadrant === 0 && dx >= 0 && dy <= 0) ||
        (quadrant === 1 && dx <= 0 && dy <= 0) ||
        (quadrant === 2 && dx <= 0 && dy >= 0) ||
        (quadrant === 3 && dx >= 0 && dy >= 0);
      if (!ok) continue;

      const dist = Math.hypot(dx, dy);
      if (dist < innerR || dist > outerR) continue;
      const px = (cornerX + dx) | 0;
      const py = (cornerY + dy) | 0;
      if (px < 0 || py < 0 || px >= s.width || py >= s.height) continue;

      if (dist <= innerR + 1 || dist >= outerR - 1) {
        s.u32[py * s.width + px] = outlineU32;
      } else {
        const midR = (innerR + outerR) * 0.5;
        const tubeNorm = Math.abs(dist - (midR - 2)) / ((outerR - innerR) * 0.65);
        s.u32[py * s.width + px] = bayerDitherColor(px, py, tubeNorm, pipeRamp);
      }
    }
  }
}

function generateRawStageBuffer(stageId: number): Uint32Array {
  const cached = TERRAIN_RAW_CACHE.get(stageId);
  if (cached) return cached;

  const s = createPixelSurface(NATIVE_PIXEL_W, NATIVE_PIXEL_H);
  const w = NATIVE_PIXEL_W;
  const h = NATIVE_PIXEL_H;
  const cBlack = hexToU32('#080A12');

  switch (stageId) {
    // =========================================================================
    // STAGE 01: Cratered Sand Planet + Right Curved Steel Pipe Space Base (01-hedef-oynanis.jpg!)
    // =========================================================================
    case 1: {
      const sandRamp = [
        hexToU32('#E6BC74'),
        hexToU32('#CFA056'),
        hexToU32('#B88640'),
        hexToU32('#96682C'),
        hexToU32('#6E481A')
      ];
      const pipeRamp = [
        hexToU32('#DCE4F0'),
        hexToU32('#A8B2C2'),
        hexToU32('#7A8292'),
        hexToU32('#505868'),
        hexToU32('#303644')
      ];
      const basePlateRamp = [
        hexToU32('#949EAE'),
        hexToU32('#707888'),
        hexToU32('#525A68'),
        hexToU32('#383E4C')
      ];

      // 1. Warm sandy planet terrain across entire canvas
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const wave =
            0.35 +
            0.18 * Math.sin(px * 0.045 + py * 0.025) +
            0.12 * Math.cos(px * 0.09 - py * 0.06);
          s.u32[py * w + px] = bayerDitherColor(px, py, wave, sandRamp, true);
        }
      }

      // Scattered pixel pebbles
      for (let i = 0; i < 160; i++) {
        const px = Math.floor(seededHash(i * 31 + 7) * 195);
        const py = Math.floor(seededHash(i * 57 + 13) * h);
        setPx(s, px, py, sandRamp[4]);
        setPx(s, px + 1, py, sandRamp[0]);
      }

      // Shaded planetary craters on left & middle desert
      const craters = [
        [136, 18, 18],
        [34, 48, 12],
        [98, 92, 14],
        [28, 138, 19],
        [72, 136, 13],
        [152, 118, 11],
        [94, 162, 10],
        [124, 204, 13],
        [52, 224, 15],
        [164, 246, 12],
        [178, 286, 19],
        [154, 318, 16],
        [118, 344, 13],
        [40, 310, 14]
      ];
      for (const [cx, cy, cr] of craters) {
        drawPixelCrater(s, cx, cy, cr, sandRamp[0], sandRamp[4], sandRamp[2], sandRamp[4]);
      }

      // 2. Right 32% Embedded Riveted Alien Base Hull (`x: 192..269`)
      for (let py = 0; py < h; py += 45) {
        drawRivetedPanel(s, 196, py, 37, 45, basePlateRamp, cBlack);
        drawRivetedPanel(s, 233, py, 37, 45, basePlateRamp, cBlack);
      }
      // Mechanical grill vents inside base
      for (let vy = 132; vy < 176; vy += 4) {
        fillRectPx(s, 242, vy, 20, 2, cBlack);
      }

      // 3. Giant 3D Curved Cylindrical Steel Pipes (`01-hedef-oynanis.jpg` right-side pipes!)
      drawVerticalSteelPipe(s, 214, 0, 186, 11, pipeRamp, cBlack);
      drawHorizontalSteelPipe(s, 190, 204, 46, 11, pipeRamp, cBlack);
      drawPipeElbow(s, 204, 57, 4, 22, 1, pipeRamp, cBlack);

      drawVerticalSteelPipe(s, 180, 150, 232, 11, pipeRamp, cBlack);
      drawHorizontalSteelPipe(s, 192, 269, 198, 11, pipeRamp, cBlack);
      drawPipeElbow(s, 191, 209, 4, 22, 1, pipeRamp, cBlack);

      drawVerticalSteelPipe(s, 222, 210, 360, 12, pipeRamp, cBlack);
      drawHorizontalSteelPipe(s, 196, 210, 336, 11, pipeRamp, cBlack);
      break;
    }

    // =========================================================================
    // STAGE 02: Deep Cobalt Bio-Ocean & Sunken Cyber-Temple (01-hedef-oynanis.jpg lower layer!)
    // =========================================================================
    case 2: {
      const seaRamp = [
        hexToU32('#2854D8'),
        hexToU32('#183AA8'),
        hexToU32('#0C2278'),
        hexToU32('#071552'),
        hexToU32('#040B32')
      ];
      const ruinRamp = [
        hexToU32('#3868E8'),
        hexToU32('#1E44B8'),
        hexToU32('#102882'),
        hexToU32('#07144E')
      ];

      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const ripple =
            0.42 +
            0.25 * Math.sin(px * 0.09 + Math.sin(py * 0.08) * 2.2) +
            0.15 * (py / h);
          s.u32[py * w + px] = bayerDitherColor(px, py, ripple, seaRamp, true);
        }
      }

      // Sunken stepped cyber-temple structures & conduits
      const blocks = [
        [12, 74, 86, 56],
        [34, 56, 64, 22],
        [152, 86, 96, 68],
        [18, 228, 108, 118],
        [46, 204, 80, 30],
        [148, 238, 104, 98]
      ];
      for (const [bx, by, bw, bh] of blocks) {
        drawRivetedPanel(s, bx, by, bw, bh, ruinRamp, hexToU32('#030824'));
        // Stepped temple stairs & circuit grooves
        for (let sy = by + 8; sy < by + bh - 8; sy += 8) {
          fillRectPx(s, bx + 10, sy, 22, 3, seaRamp[4]);
          fillRectPx(s, bx + 10, sy - 1, 22, 1, ruinRamp[0]);
        }
      }
      break;
    }

    // =========================================================================
    // STAGE 03: Rocky Canyon & Embedded Pipe Reactor Station
    // =========================================================================
    case 3: {
      const rockRamp = [
        hexToU32('#B47A4C'),
        hexToU32('#8C5A34'),
        hexToU32('#683E22'),
        hexToU32('#482814'),
        hexToU32('#2A150A')
      ];
      const steelRamp = [
        hexToU32('#C8D2E0'),
        hexToU32('#8A94A6'),
        hexToU32('#5A6272'),
        hexToU32('#343A48')
      ];
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const ridge =
            0.45 +
            0.28 * Math.sin(px * 0.11 + py * 0.05) +
            0.18 * Math.cos(px * 0.04 - py * 0.12);
          s.u32[py * w + px] = bayerDitherColor(px, py, ridge, rockRamp, true);
        }
      }
      for (let i = 0; i < 22; i++) {
        const rx = Math.floor(seededHash(i * 19 + 3) * w);
        const ry = Math.floor(seededHash(i * 41 + 9) * h);
        drawPixelCrater(s, rx, ry, 10 + (i % 7), rockRamp[0], rockRamp[4], rockRamp[2], rockRamp[4]);
      }
      // Embedded lower-left & center reactor station with glowing red pixel LEDs
      drawRivetedPanel(s, 14, 198, 118, 142, steelRamp, cBlack);
      drawHorizontalSteelPipe(s, 0, 168, 224, 9, steelRamp, cBlack);
      drawVerticalSteelPipe(s, 156, 180, 360, 10, steelRamp, cBlack);
      for (let lx = 28; lx <= 108; lx += 16) {
        fillRectPx(s, lx, 254, 6, 6, hexToU32('#FF2820'));
        setPx(s, lx + 1, 255, hexToU32('#FFB8B8'));
      }
      break;
    }

    // =========================================================================
    // STAGE 04: Emerald Crystal Cavern & Gold Conductor Channels
    // =========================================================================
    case 4: {
      const emRamp = [
        hexToU32('#54D096'),
        hexToU32('#2C9468'),
        hexToU32('#186446'),
        hexToU32('#0D3E2B'),
        hexToU32('#062218')
      ];
      const goldLine = hexToU32('#F0C038');
      const goldDark = hexToU32('#8C6410');
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const facet = ((Math.abs((px % 36) - 18) + Math.abs((py % 36) - 18)) / 36) * 0.85;
          s.u32[py * w + px] = bayerDitherColor(px, py, facet, emRamp, true);
        }
      }
      for (let gy = 36; gy < h; gy += 54) {
        fillRectPx(s, 18, gy, w - 36, 3, goldDark);
        fillRectPx(s, 18, gy, w - 36, 1, goldLine);
        for (let gx = 32; gx < w - 24; gx += 48) {
          fillRectPx(s, gx, gy - 18, 3, 38, goldDark);
          fillRectPx(s, gx, gy - 18, 1, 38, goldLine);
          fillRectPx(s, gx - 3, gy - 3, 8, 8, goldLine);
        }
      }
      break;
    }

    // =========================================================================
    // STAGE 05: Armored Orbital Station Deck & Hazard Hatches
    // =========================================================================
    case 5: {
      const deckRamp = [
        hexToU32('#96A4B8'),
        hexToU32('#6A788C'),
        hexToU32('#485466'),
        hexToU32('#2C3442')
      ];
      for (let py = 0; py < h; py += 40) {
        for (let px = 0; px < w; px += 45) {
          drawRivetedPanel(s, px, py, 45, 40, deckRamp, cBlack);
        }
      }
      // Yellow-black hazard hatches
      const hatches = [
        [45, 80, 90, 40],
        [135, 240, 90, 40]
      ];
      for (const [hx, hy, hw, hh] of hatches) {
        for (let py = hy + 3; py < hy + hh - 3; py++) {
          for (let px = hx + 3; px < hx + hw - 3; px++) {
            const stripe = ((px + py) >> 3) & 1;
            s.u32[py * w + px] = stripe ? hexToU32('#F0B820') : hexToU32('#181C26');
          }
        }
      }
      break;
    }

    // =========================================================================
    // STAGE 06: Ancient Gold-Bronze Twin Temple
    // =========================================================================
    case 6: {
      const goldRamp = [
        hexToU32('#F4D272'),
        hexToU32('#CA9C3A'),
        hexToU32('#986E1E'),
        hexToU32('#68460E'),
        hexToU32('#3E2606')
      ];
      for (let py = 0; py < h; py += 36) {
        for (let px = 0; px < w; px += 45) {
          drawRivetedPanel(s, px, py, 45, 36, goldRamp, hexToU32('#241404'));
          // Alien hieroglyph carving inside stone block
          strokeRectPx(s, px + 10, py + 8, 25, 20, goldRamp[4]);
          fillRectPx(s, px + 18, py + 14, 9, 8, goldRamp[0]);
        }
      }
      // Symmetric twin pillars
      drawVerticalSteelPipe(s, 54, 0, h, 10, goldRamp, hexToU32('#241404'));
      drawVerticalSteelPipe(s, w - 54, 0, h, 10, goldRamp, hexToU32('#241404'));
      break;
    }

    // =========================================================================
    // STAGE 07: Violet Bio-Hive & Cocoon Chambers
    // =========================================================================
    case 7: {
      const hiveRamp = [
        hexToU32('#A868E0'),
        hexToU32('#7842B0'),
        hexToU32('#502880'),
        hexToU32('#321654'),
        hexToU32('#1A0A30')
      ];
      const tubeRamp = [
        hexToU32('#98F8FF'),
        hexToU32('#38B8E0'),
        hexToU32('#186898'),
        hexToU32('#0C3458')
      ];
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const cell =
            0.4 + 0.35 * Math.abs(Math.sin(px * 0.14) * Math.cos(py * 0.14));
          s.u32[py * w + px] = bayerDitherColor(px, py, cell, hiveRamp, true);
        }
      }
      drawVerticalSteelPipe(s, 36, 0, h, 9, tubeRamp, cBlack);
      drawVerticalSteelPipe(s, w - 36, 0, h, 9, tubeRamp, cBlack);
      break;
    }

    // =========================================================================
    // STAGE 08: Volcanic Basalt Canyon & Crimson Magma Fissures
    // =========================================================================
    case 8: {
      const basaltRamp = [
        hexToU32('#7A4C52'),
        hexToU32('#58343A'),
        hexToU32('#3E2228'),
        hexToU32('#281418'),
        hexToU32('#160A0E')
      ];
      const lavaRamp = [
        hexToU32('#FFF078'),
        hexToU32('#FF9020'),
        hexToU32('#E03414'),
        hexToU32('#88140C')
      ];
      const girderRamp = [
        hexToU32('#B0BAC8'),
        hexToU32('#747E90'),
        hexToU32('#444C5C'),
        hexToU32('#242A36')
      ];
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const fissure = Math.abs(Math.sin(px * 0.045 + Math.cos(py * 0.04) * 2.1));
          if (fissure < 0.14) {
            s.u32[py * w + px] = bayerDitherColor(px, py, fissure / 0.14, lavaRamp);
          } else {
            const rockT = 0.25 + 0.55 * Math.abs(Math.cos(px * 0.09 - py * 0.07));
            s.u32[py * w + px] = bayerDitherColor(px, py, rockT, basaltRamp, true);
          }
        }
      }
      // Steel bridge girders spanning lava canyon
      drawRivetedPanel(s, 0, 162, w, 24, girderRamp, cBlack);
      break;
    }

    // =========================================================================
    // STAGE 09: Copper Foundry & Giant Cogwheel Mechanism
    // =========================================================================
    case 9: {
      const copperRamp = [
        hexToU32('#F09850'),
        hexToU32('#C0682C'),
        hexToU32('#8C4418'),
        hexToU32('#58280C'),
        hexToU32('#301406')
      ];
      for (let py = 0; py < h; py += 45) {
        for (let px = 0; px < w; px += 54) {
          drawRivetedPanel(s, px, py, 54, 45, copperRamp, cBlack);
        }
      }
      // Giant interlocking pixel gears
      for (const [gcx, gcy, gr] of [
        [78, 108, 44],
        [162, 168, 52],
        [92, 268, 46]
      ]) {
        for (let py = gcy - gr - 6; py <= gcy + gr + 6; py++) {
          for (let px = gcx - gr - 6; px <= gcx + gr + 6; px++) {
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            const d = Math.hypot(px - gcx, py - gcy);
            const ang = Math.atan2(py - gcy, px - gcx);
            const tooth = Math.cos(ang * 12) > 0.2 ? 5 : 0;
            if (d <= gr + tooth && d >= gr * 0.38) {
              s.u32[py * w + px] =
                d > gr - 2 ? copperRamp[0] : bayerDitherColor(px, py, d / gr, copperRamp);
            }
          }
        }
      }
      break;
    }

    // =========================================================================
    // STAGE 10: Glacial Crater & Frozen Cruiser Wreckage
    // =========================================================================
    case 10: {
      const iceRamp = [
        hexToU32('#D8F2FF'),
        hexToU32('#9CC8E4'),
        hexToU32('#6894B4'),
        hexToU32('#426684'),
        hexToU32('#243E54')
      ];
      const wingRamp = [
        hexToU32('#C8D4E4'),
        hexToU32('#8896AA'),
        hexToU32('#546074'),
        hexToU32('#2E3646')
      ];
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const frost = 0.35 + 0.3 * Math.sin(px * 0.06 + py * 0.04);
          s.u32[py * w + px] = bayerDitherColor(px, py, frost, iceRamp, true);
        }
      }
      for (const [cx, cy, cr] of [
        [58, 74, 18],
        [204, 88, 16],
        [64, 286, 20],
        [198, 298, 15]
      ]) {
        drawPixelCrater(s, cx, cy, cr, iceRamp[0], iceRamp[4], iceRamp[2], iceRamp[4]);
      }
      // Buried cruiser wing hull across center
      drawRivetedPanel(s, 72, 138, 136, 84, wingRamp, cBlack);
      fillRectPx(s, 88, 172, 104, 14, hexToU32('#D83028'));
      break;
    }

    // =========================================================================
    // STAGE 11: Turquoise Submarine Turbine Base
    // =========================================================================
    case 11: {
      const subRamp = [
        hexToU32('#48C4D4'),
        hexToU32('#248C9E'),
        hexToU32('#125C6C'),
        hexToU32('#093844'),
        hexToU32('#041E26')
      ];
      for (let py = 0; py < h; py += 45) {
        for (let px = 0; px < w; px += 45) {
          drawRivetedPanel(s, px, py, 45, 45, subRamp, cBlack);
        }
      }
      for (let ty = 60; ty < h; ty += 120) {
        drawHorizontalSteelPipe(s, 0, w, ty, 8, subRamp, cBlack);
      }
      break;
    }

    // =========================================================================
    // STAGE 12: Cybernetic Fortress Gate
    // =========================================================================
    case 12: {
      const gateRamp = [
        hexToU32('#9A94C4'),
        hexToU32('#686294'),
        hexToU32('#423C68'),
        hexToU32('#282244'),
        hexToU32('#141026')
      ];
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const rib = Math.abs(Math.sin((py + Math.abs(px - w * 0.5) * 0.45) * 0.22));
          s.u32[py * w + px] = bayerDitherColor(px, py, rib * 0.85, gateRamp, true);
        }
      }
      drawRivetedPanel(s, 85, 118, 100, 124, gateRamp, cBlack);
      strokeRectPx(s, 102, 136, 66, 88, hexToU32('#F0B830'));
      break;
    }

    // =========================================================================
    // STAGE 13: Biomechanical Spine Tunnel (Inner World!)
    // =========================================================================
    case 13: {
      const fleshRamp = [
        hexToU32('#944864'),
        hexToU32('#682E46'),
        hexToU32('#461C2E'),
        hexToU32('#280E1A')
      ];
      const boneRamp = [
        hexToU32('#E8DCC8'),
        hexToU32('#B8A48C'),
        hexToU32('#84705C'),
        hexToU32('#4C3E32')
      ];
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const muscle = 0.3 + 0.5 * Math.abs(Math.sin(px * 0.08 + Math.sin(py * 0.07)));
          s.u32[py * w + px] = bayerDitherColor(px, py, muscle, fleshRamp, true);
        }
      }
      // Central segmented spinal column & lateral rib vertebrae
      for (let vy = 8; vy < h; vy += 24) {
        drawRivetedPanel(s, 112, vy, 46, 20, boneRamp, cBlack);
        drawHorizontalSteelPipe(s, 28, 112, vy + 10, 5, boneRamp, cBlack);
        drawHorizontalSteelPipe(s, 158, w - 28, vy + 10, 5, boneRamp, cBlack);
      }
      break;
    }

    // =========================================================================
    // STAGE 14: Synaptic Circuit Matrix
    // =========================================================================
    case 14: {
      const synRamp = [
        hexToU32('#2E5888'),
        hexToU32('#1C3A60'),
        hexToU32('#102440'),
        hexToU32('#081324')
      ];
      const gold = hexToU32('#F8B830');
      const copper = hexToU32('#B86818');
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const grid = px % 30 === 0 || py % 30 === 0 ? 0.15 : 0.72;
          s.u32[py * w + px] = bayerDitherColor(px, py, grid, synRamp);
        }
      }
      for (let ny = 45; ny < h; ny += 60) {
        for (let nx = 45; nx < w; nx += 60) {
          drawLinePx(s, nx, ny, nx + 30, ny + 30, copper, 2);
          drawLinePx(s, nx, ny, nx - 30, ny + 30, copper, 2);
          fillRectPx(s, nx - 5, ny - 5, 10, 10, copper);
          fillRectPx(s, nx - 3, ny - 3, 6, 6, gold);
        }
      }
      break;
    }

    // =========================================================================
    // STAGE 15: Crimson Bio-Core Arteries
    // =========================================================================
    case 15: {
      const coreRamp = [
        hexToU32('#E84868'),
        hexToU32('#A82844'),
        hexToU32('#72162C'),
        hexToU32('#440B1A'),
        hexToU32('#24050E')
      ];
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const vein = Math.abs(Math.sin(px * 0.07 + Math.sin(py * 0.06) * 2.4));
          s.u32[py * w + px] = bayerDitherColor(px, py, vein * 0.9, coreRamp, true);
        }
      }
      drawVerticalSteelPipe(s, 48, 0, h, 8, coreRamp, cBlack);
      drawVerticalSteelPipe(s, w - 48, 0, h, 8, coreRamp, cBlack);
      break;
    }

    // =========================================================================
    // STAGE 16: Outer Mother-Brain Cortex
    // =========================================================================
    case 16: {
      const brainRamp = [
        hexToU32('#E868C8'),
        hexToU32('#B04098'),
        hexToU32('#782468'),
        hexToU32('#4A1242'),
        hexToU32('#260824')
      ];
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const fold =
            0.35 +
            0.35 * Math.sin(px * 0.14 + Math.cos(py * 0.12) * 2.2) +
            0.18 * Math.cos(py * 0.16);
          s.u32[py * w + px] = bayerDitherColor(px, py, fold, brainRamp, true);
        }
      }
      break;
    }

    // =========================================================================
    // STAGE 17: LIBERATION ESCAPE HATCH (Revealed underneath Stage 16!)
    // =========================================================================
    default: {
      const vaultRamp = [
        hexToU32('#DCE8F8'),
        hexToU32('#98A8C2'),
        hexToU32('#5C6C86'),
        hexToU32('#323E52'),
        hexToU32('#18202E')
      ];
      for (let py = 0; py < h; py += 45) {
        for (let px = 0; px < w; px += 45) {
          drawRivetedPanel(s, px, py, 45, 45, vaultRamp, cBlack);
        }
      }
      // Central glowing circular Escape Hatch
      const hcx = w * 0.5;
      const hcy = h * 0.5;
      for (let py = 60; py < h - 60; py++) {
        for (let px = 30; px < w - 30; px++) {
          const d = Math.hypot(px - hcx, py - hcy);
          if (d <= 88 && d >= 68) {
            const stripe = ((px + py) >> 3) & 1;
            s.u32[py * w + px] = stripe ? hexToU32('#F8C830') : hexToU32('#182030');
          } else if (d < 68 && d >= 26) {
            s.u32[py * w + px] = bayerDitherColor(px, py, d / 68, vaultRamp);
          } else if (d < 26) {
            s.u32[py * w + px] = d < 12 ? hexToU32('#98FF70') : hexToU32('#20B848');
          }
        }
      }
      break;
    }
  }

  const copy = new Uint32Array(s.u32);
  TERRAIN_RAW_CACHE.set(stageId, copy);
  return copy;
}

/**
 * Returns a cached `270 x 360` pixel-art HTMLCanvasElement for `stageId` (`1..17`),
 * optionally darkened (`brightness = 0.68`) when used as the revealed Next-Stage lower map!
 */
export function getStageTerrainCanvas(stageId: number, brightness = 1.0): HTMLCanvasElement {
  const clamped = Math.max(1, Math.min(17, stageId));
  const key = `${clamped}:${brightness.toFixed(2)}`;
  const cached = TERRAIN_CANVAS_CACHE.get(key);
  if (cached) return cached;

  const src = generateRawStageBuffer(clamped);
  const surf = createPixelSurface(NATIVE_PIXEL_W, NATIVE_PIXEL_H);

  if (Math.abs(brightness - 1.0) < 0.01) {
    surf.u32.set(src);
  } else {
    for (let i = 0; i < src.length; i++) {
      surf.u32[i] = darkenU32(src[i], brightness);
    }
  }

  const canvas = commitPixelSurface(surf);
  TERRAIN_CANVAS_CACHE.set(key, canvas);
  return canvas;
}
