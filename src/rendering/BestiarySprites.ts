import {
  applyArcadeOutline,
  bayerDitherColor,
  commitPixelSurface,
  createPixelSurface,
  drawLinePx,
  fillEllipseDitheredPx,
  fillRectPx,
  getPx,
  hexToU32,
  PixelSurface,
  setPx,
  strokeRectPx
} from './PixelArtEngine';
import { getScarabBeetleSprite } from './VolfiedSprites';

const BESTIARY_CACHE = new Map<string, HTMLCanvasElement>();

function mirrorHorizontal(s: PixelSurface): void {
  const half = Math.floor(s.width / 2);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < half; x++) {
      const col = getPx(s, x, y);
      if (col !== 0) {
        setPx(s, s.width - 1 - x, y, col);
      }
    }
  }
}

function fillDiamondPx(
  s: PixelSurface,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rampU32: readonly number[]
): void {
  const x0 = Math.max(0, Math.floor(cx - rx));
  const x1 = Math.min(s.width - 1, Math.ceil(cx + rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const y1 = Math.min(s.height - 1, Math.ceil(cy + ry));
  for (let py = y0; py <= y1; py++) {
    const ny = (py - cy) / Math.max(1, ry);
    for (let px = x0; px <= x1; px++) {
      const nx = (px - cx) / Math.max(1, rx);
      if (Math.abs(nx) + Math.abs(ny) <= 1.0) {
        const light = Math.max(0, Math.min(0.999, (nx + ny + 1.2) / 2.4));
        setPx(s, px, py, bayerDitherColor(px, py, light, rampU32, false));
      }
    }
  }
}

// ============================================================================
// PART 1: 16-BIT BOSS SPRITES (NEW BUILD 11 ARCHETYPES)
// ============================================================================

/**
 * #2 IronCrustacean (Hidrolik Yengeç) — Wide copper-crimson crab with 6 side legs & 2 giant pincers.
 */
export function getIronCrustaceanSprite(
  clawFrame: 0 | 1,
  shellless = false
): HTMLCanvasElement {
  const key = `boss:iron_crustacean:${clawFrame}:${shellless ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(58, 52);
  const rampShell = shellless
    ? [hexToU32('#78F0FF'), hexToU32('#2898D8'), hexToU32('#184878'), hexToU32('#0C203C')]
    : [hexToU32('#FFA860'), hexToU32('#DF4828'), hexToU32('#941C18'), hexToU32('#4A0C10')];
  const cSteelLight = hexToU32('#E0ECFA');
  const cSteelMid = hexToU32('#889AB4');
  const cSteelDark = hexToU32('#3E4A60');
  const cGold = hexToU32('#FFE058');
  const cEye = hexToU32('#48FF88');

  // 3 articulated hydraulic legs on left side (mirrored later)
  const legLift = clawFrame === 0 ? 0 : 2;
  for (let i = 0; i < 3; i++) {
    const baseY = 20 + i * 7;
    const tipY = baseY + 4 + ((i + clawFrame) % 2 === 0 ? legLift : -legLift);
    drawLinePx(s, 16, baseY, 6, baseY - 2, cSteelMid, 3);
    drawLinePx(s, 6, baseY - 2, 2, tipY, cSteelLight, 2);
    setPx(s, 6, baseY - 2, cGold);
  }

  // Left giant hydraulic pincer forward (top)
  const pinch = clawFrame === 1 ? 3 : 0;
  drawLinePx(s, 18, 16, 11, 9, cSteelDark, 4);
  drawLinePx(s, 18, 16, 11, 9, cSteelMid, 2);
  // Outer claw blade
  drawLinePx(s, 11, 9, 6 + pinch, 3, rampShell[1], 4);
  drawLinePx(s, 6 + pinch, 3, 12 + pinch, 2, cSteelLight, 2);
  // Inner scissor thumb
  drawLinePx(s, 12, 10, 16 - pinch, 4, cSteelLight, 2);

  mirrorHorizontal(s);

  // Wide armored crab carapace
  fillEllipseDitheredPx(s, 28.5, 28, 18, 13, rampShell, -0.25, -0.35);
  // Segment plates & rivets
  strokeRectPx(s, 18, 22, 22, 12, cSteelDark);
  fillRectPx(s, 24, 24, 10, 8, shellless ? hexToU32('#FFF498') : rampShell[0]);
  for (const rx of [16, 22, 35, 41]) {
    fillRectPx(s, rx, 27, 2, 2, cGold);
  }

  // Twin glowing stalk eyes
  fillRectPx(s, 22, 14, 3, 4, cSteelDark);
  fillRectPx(s, 33, 14, 3, 4, cSteelDark);
  fillRectPx(s, 22, 13, 3, 2, cEye);
  fillRectPx(s, 33, 13, 3, 2, cEye);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #4 SniperScarab (Zırhlı Altın Bokböceği) — Armored gold-amber elytra opening to fire 3-shot sniper burst.
 */
export function getSniperScarabSprite(wingsOpen: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:sniper_scarab:${wingsOpen ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(52, 54);
  const rampGold = [
    hexToU32('#FFF8A8'),
    hexToU32('#F4B828'),
    hexToU32('#A86810'),
    hexToU32('#542C06')
  ];
  const rampJade = [hexToU32('#98FF98'), hexToU32('#24C858'), hexToU32('#0E5C2C')];
  const cWing = hexToU32('#68F0FF', 210);
  const cCore = hexToU32('#FF3830');
  const cCoreHot = hexToU32('#FFF8C0');
  const cLeg = hexToU32('#8C6420');

  // 6 scarab legs
  const step = frame === 0 ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    const y = 18 + i * 9;
    drawLinePx(s, 14, y, 4, y + (i - 1) * 4 + step, cLeg, 2);
  }
  mirrorHorizontal(s);

  // Armored head & mandibles (top, facing -Y; rotated on render)
  fillEllipseDitheredPx(s, 25.5, 13, 9, 6, rampGold);
  drawLinePx(s, 20, 8, 22, 3, rampGold[0], 2);
  drawLinePx(s, 31, 8, 29, 3, rampGold[0], 2);

  if (!wingsOpen) {
    // Interlocked golden elytra shell (70% armor!)
    fillEllipseDitheredPx(s, 25.5, 31, 15, 17, rampGold, -0.3, -0.3);
    drawLinePx(s, 25, 15, 25, 47, rampGold[3], 2);
    drawLinePx(s, 13, 25, 38, 25, rampGold[2], 1);
    fillEllipseDitheredPx(s, 25.5, 24, 5, 6, rampJade);
  } else {
    // Exposed glowing crimson plasma sniper core + spread golden wing cases!
    fillEllipseDitheredPx(s, 25.5, 31, 11, 14, [
      cCoreHot,
      hexToU32('#FF7820'),
      cCore,
      hexToU32('#480810')
    ]);
    // Inner translucent cyan wings
    fillEllipseDitheredPx(s, 12, 32 - frame * 2, 7, 12, [cCoreHot, cWing, hexToU32('#1878A8')]);
    fillEllipseDitheredPx(s, 39, 32 - frame * 2, 7, 12, [cCoreHot, cWing, hexToU32('#1878A8')]);
    // Split outer golden elytra shells
    fillEllipseDitheredPx(s, 9, 26, 6, 14, rampGold);
    fillEllipseDitheredPx(s, 42, 26, 6, 14, rampGold);
    // Glowing sniper barrel
    fillRectPx(s, 24, 4, 4, 14, cCoreHot);
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #7 SpiralNautilus (Zırhlı Ammonit Kabuğu) — Matches top-left of reference catalog!
 * Chambered cobalt-steel ammonite spiral shell + 5 coral tentacles (or retracted pinball buzz-shell!).
 */
export function getSpiralNautilusSprite(retracted: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:spiral_nautilus:${retracted ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(56, 56);
  const rampShell = [
    hexToU32('#E4F4FF'),
    hexToU32('#68B4F8'),
    hexToU32('#2C64B8'),
    hexToU32('#142C5C')
  ];
  const rampCoral = [hexToU32('#FFB090'), hexToU32('#E84838'), hexToU32('#881820')];
  const cSpike = hexToU32('#FFF4A0');

  if (!retracted) {
    // 5 waving coral-crimson tentacles extending out to the right (+X heading)
    const wave = frame === 0 ? -2 : 2;
    for (let t = -2; t <= 2; t++) {
      const sy = 28 + t * 4;
      const midY = sy + (t % 2 === 0 ? wave : -wave);
      drawLinePx(s, 32, sy, 44, midY, rampCoral[1], 3);
      drawLinePx(s, 44, midY, 53, sy + t * 2 - wave, rampCoral[0], 2);
    }
    // Mantle & large fierce cephalopod eye
    fillEllipseDitheredPx(s, 33, 28, 9, 10, rampCoral);
    fillRectPx(s, 34, 23, 6, 6, hexToU32('#FFF878'));
    fillRectPx(s, 36, 25, 3, 3, hexToU32('#100818'));
  } else {
    // Retracted high-speed pinball buzz-rim spikes around entire circumference!
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI) / 6 + (frame * Math.PI) / 12;
      const x0 = 27.5 + Math.cos(ang) * 19;
      const y0 = 27.5 + Math.sin(ang) * 19;
      const x1 = 27.5 + Math.cos(ang) * 25;
      const y1 = 27.5 + Math.sin(ang) * 25;
      drawLinePx(s, x0, y0, x1, y1, cSpike, 3);
    }
  }

  // Main chambered ammonite shell
  const cx = retracted ? 27.5 : 23.5;
  const cy = 28;
  fillEllipseDitheredPx(s, cx, cy, 19, 19, rampShell, -0.35, -0.35);

  // Carve logarithmic spiral suture ribs across shell
  for (let a = 0; a < 22; a++) {
    const theta = a * 0.45;
    const r = 2 + a * 0.78;
    const px = cx + Math.cos(theta) * r;
    const py = cy + Math.sin(theta) * r;
    fillRectPx(s, px - 1, py - 1, 3, 3, rampShell[3]);
    setPx(s, px, py, rampShell[0]);
  }
  // Radial chamber ribs
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    drawLinePx(
      s,
      cx + Math.cos(ang) * 7,
      cy + Math.sin(ang) * 7,
      cx + Math.cos(ang) * 18,
      cy + Math.sin(ang) * 18,
      rampShell[3],
      1
    );
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #8 MagmaSerpent (Magma Ejderi) — Basalt dragon head & segments cracked with glowing molten lava!
 */
export function getMagmaSerpentHeadSprite(jawFrame: 0 | 1): HTMLCanvasElement {
  const key = `boss:magma_head:${jawFrame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(48, 44);
  const rampBasalt = [
    hexToU32('#7A4438'),
    hexToU32('#482022'),
    hexToU32('#281016'),
    hexToU32('#14080C')
  ];
  const cLavaHot = hexToU32('#FFF890');
  const cLavaMid = hexToU32('#FF8818');
  const cLavaRed = hexToU32('#E82818');

  // Swept-back golden-lava dragon horns (head faces +X)
  drawLinePx(s, 22, 12, 5, 4, cLavaMid, 4);
  drawLinePx(s, 22, 12, 6, 5, cLavaHot, 2);
  drawLinePx(s, 22, 31, 5, 39, cLavaMid, 4);
  drawLinePx(s, 22, 31, 6, 38, cLavaHot, 2);

  // Armored basalt dragon skull
  fillEllipseDitheredPx(s, 24, 22, 15, 12, rampBasalt);

  // Snapping jaws facing +X
  const spread = jawFrame === 1 ? 4 : 1;
  drawLinePx(s, 32, 16, 44, 14 - spread, rampBasalt[0], 4);
  drawLinePx(s, 32, 28, 44, 30 + spread, rampBasalt[0], 4);
  // Molten maw core & fangs
  fillRectPx(s, 33, 19, 8, 6, cLavaRed);
  fillRectPx(s, 35, 20, 5, 4, cLavaHot);
  setPx(s, 42, 16 - spread, cLavaHot);
  setPx(s, 42, 28 + spread, cLavaHot);

  // Molten lava cracks & blazing eye
  drawLinePx(s, 14, 22, 30, 22, cLavaMid, 2);
  setPx(s, 20, 22, cLavaHot);
  fillRectPx(s, 28, 14, 4, 3, cLavaHot);
  fillRectPx(s, 28, 27, 4, 3, cLavaHot);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

export function getMagmaSerpentSegmentSprite(frame: 0 | 1, isTail = false): HTMLCanvasElement {
  const key = `boss:magma_seg:${frame}:${isTail ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(32, 30);
  const rampBasalt = [hexToU32('#743C32'), hexToU32('#441C20'), hexToU32('#220E12')];
  const cLava = frame === 0 ? hexToU32('#FF9818') : hexToU32('#FFF078');
  const cFin = hexToU32('#E83818');

  const rx = isTail ? 11 : 10;
  const ry = isTail ? 6 : 9;
  // Lateral fire spines
  drawLinePx(s, 16, 4, 12, 1, cFin, 2);
  drawLinePx(s, 16, 25, 12, 28, cFin, 2);
  fillEllipseDitheredPx(s, 16, 15, rx, ry, rampBasalt);
  // Glowing magma vein seam
  drawLinePx(s, 10, 15, 22, 15, cLava, 2);
  drawLinePx(s, 16, 9, 16, 21, hexToU32('#FF5018'), 2);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #9 MechaTarantula (8-Bacaklı Ağ Örümceği) — Matches top-right of reference catalog!
 */
export function getMechaTarantulaSprite(legFrame: 0 | 1 | 2 | 3): HTMLCanvasElement {
  const key = `boss:mecha_tarantula:${legFrame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(62, 56);
  const rampAmber = [
    hexToU32('#FFF088'),
    hexToU32('#ECA018'),
    hexToU32('#9C580C'),
    hexToU32('#4C2406')
  ];
  const rampSteel = [hexToU32('#DCE8F8'), hexToU32('#7C8CA8'), hexToU32('#364054')];
  const cEye = hexToU32('#FF2838');
  const cWebCore = hexToU32('#58F4FF');

  // 4 articulated mechanical spider legs on left, mirrored to 8 legs!
  for (let i = 0; i < 4; i++) {
    const phase = ((legFrame + i) % 4) - 1.5;
    const attachY = 18 + i * 6;
    const kneeX = 9 + (i === 0 || i === 3 ? 2 : 0);
    const kneeY = attachY - 5 + Math.round(phase * 2);
    const footX = 2 + (i % 2) * 2;
    const footY = attachY + 4 + Math.round(phase * 3);
    drawLinePx(s, 20, attachY, kneeX, kneeY, rampSteel[1], 3);
    drawLinePx(s, kneeX, kneeY, footX, footY, rampAmber[1], 2);
    fillRectPx(s, kneeX - 1, kneeY - 1, 3, 3, rampAmber[0]);
  }
  mirrorHorizontal(s);

  // Bulbous rear hazard-striped abdomen (bottom)
  fillEllipseDitheredPx(s, 30.5, 36, 14, 13, rampAmber);
  // Black hazard chevrons on abdomen
  for (const hy of [31, 36, 41]) {
    fillRectPx(s, 21, hy, 20, 2, hexToU32('#18141C'));
  }
  // Glowing cyan web-spinneret at rear tip
  fillRectPx(s, 28, 48, 6, 4, cWebCore);

  // Armored steel cephalothorax (front/top) + fangs
  fillEllipseDitheredPx(s, 30.5, 19, 11, 9, rampSteel);
  drawLinePx(s, 25, 10, 23, 4, rampAmber[0], 3);
  drawLinePx(s, 36, 10, 38, 4, rampAmber[0], 3);
  // 6 glowing crimson spider eyes
  for (const [ex, ey] of [
    [26, 14],
    [30, 13],
    [34, 14],
    [25, 17],
    [30, 17],
    [35, 17]
  ]) {
    fillRectPx(s, ex, ey, 2, 2, cEye);
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #10 HiveCarrier (Ana Kovan Gemisi) — Heavy bio-dreadnought with opening yellow-black ventral bay!
 */
export function getHiveCarrierSprite(bayOpen: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:hive_carrier:${bayOpen ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(64, 58);
  const rampHull = [
    hexToU32('#FF8870'),
    hexToU32('#C83028'),
    hexToU32('#781820'),
    hexToU32('#380A12')
  ];
  const rampArmor = [hexToU32('#D8E2F0'), hexToU32('#74849C'), hexToU32('#323C4E')];
  const cPustule = frame === 0 ? hexToU32('#78FF58') : hexToU32('#D8FF88');
  const cWarn = hexToU32('#FFD028');
  const cDark = hexToU32('#14121A');

  // Twin side bio-pods
  fillEllipseDitheredPx(s, 14, 29, 10, 20, rampHull);
  fillEllipseDitheredPx(s, 50, 29, 10, 20, rampHull);
  // Glowing spore incubation pustules on flanks
  for (const py of [16, 26, 36]) {
    fillEllipseDitheredPx(s, 11, py, 3.5, 3.5, [cPustule, hexToU32('#1C8830')]);
    fillEllipseDitheredPx(s, 53, py, 3.5, 3.5, [cPustule, hexToU32('#1C8830')]);
  }

  // Central dreadnought hull
  fillEllipseDitheredPx(s, 32, 29, 16, 23, rampArmor);

  // Ventral Launch Bay (center rectangle y=16..42, x=23..41)
  if (!bayOpen) {
    fillRectPx(s, 23, 16, 18, 26, cWarn);
    for (let y = 16; y < 42; y += 4) {
      fillRectPx(s, 23, y, 18, 2, cDark);
    }
    drawLinePx(s, 32, 16, 32, 42, cDark, 2);
  } else {
    // Open bay doors + blazing honeycomb launch core!
    fillRectPx(s, 19, 16, 4, 26, cWarn);
    fillRectPx(s, 41, 16, 4, 26, cWarn);
    fillRectPx(s, 23, 16, 18, 26, hexToU32('#2C0808'));
    fillEllipseDitheredPx(s, 32, 29, 7, 10, [
      hexToU32('#FFF8A0'),
      hexToU32('#FF8818'),
      hexToU32('#C82810')
    ]);
  }

  // Forward command bridge eyes
  fillRectPx(s, 26, 8, 12, 4, hexToU32('#48E8FF'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #11 MirrorPrism (Yansıtıcı Kristal Piramit) — Faceted gold-and-cyan diamond prism!
 */
export function getMirrorPrismSprite(rotStep: 0 | 1 | 2 | 3): HTMLCanvasElement {
  const key = `boss:mirror_prism:${rotStep}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(54, 54);
  const rampCrystalA = [
    hexToU32('#FFFFFF'),
    hexToU32('#78F0FF'),
    hexToU32('#2090D8'),
    hexToU32('#103C78')
  ];
  const rampCrystalB = [
    hexToU32('#C8FFFF'),
    hexToU32('#38B8F0'),
    hexToU32('#1858A8'),
    hexToU32('#0C2450')
  ];
  const cGoldBright = hexToU32('#FFF498');
  const cGoldMid = hexToU32('#E0A020');
  const cRuby = hexToU32('#FF2848');

  // Outer octahedral diamond crystal
  fillDiamondPx(s, 26.5, 26.5, 22, 22, rotStep % 2 === 0 ? rampCrystalA : rampCrystalB);

  // Golden metallic frame ribs along diamond edges & cross axes
  drawLinePx(s, 26, 4, 48, 26, cGoldMid, 2);
  drawLinePx(s, 48, 26, 26, 48, cGoldMid, 2);
  drawLinePx(s, 26, 48, 4, 26, cGoldMid, 2);
  drawLinePx(s, 4, 26, 26, 4, cGoldBright, 2);
  drawLinePx(s, 26, 6, 26, 46, cGoldBright, 2);
  drawLinePx(s, 6, 26, 46, 26, cGoldBright, 2);

  // Central ruby refraction core + 4 vertex emitters
  fillDiamondPx(s, 26.5, 26.5, 7, 7, [
    hexToU32('#FFF8C8'),
    cRuby,
    hexToU32('#880C24')
  ]);
  for (const [vx, vy] of [
    [26, 4],
    [48, 26],
    [26, 48],
    [4, 26]
  ]) {
    fillRectPx(s, vx - 2, vy - 2, 4, 4, cRuby);
    setPx(s, vx, vy, cGoldBright);
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #12 ElectricMedusa (Biyo-Elektrik Denizanası) — Translucent cyan-violet dome + 6 crackling tentacles!
 */
export function getElectricMedusaSprite(pulseFrame: 0 | 1 | 2): HTMLCanvasElement {
  const key = `boss:electric_medusa:${pulseFrame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(54, 60);
  const rampBell = [
    hexToU32('#E0FFFF', 235),
    hexToU32('#48E0FF', 225),
    hexToU32('#5848D8', 220),
    hexToU32('#281868', 230)
  ];
  const cNode = hexToU32('#FF68E8');
  const cSpark = hexToU32('#FFF898');
  const cArc = hexToU32('#68F8FF');

  // 6 undulating electric tentacles below dome
  for (let i = 0; i < 6; i++) {
    const baseX = 12 + i * 6;
    const sway = Math.round(Math.sin(pulseFrame * 2.1 + i * 1.1) * 3);
    drawLinePx(s, baseX, 30, baseX + sway, 43, rampBell[2], 2);
    drawLinePx(s, baseX + sway, 43, baseX - sway, 55, cArc, 2);
    if ((i + pulseFrame) % 2 === 0) {
      fillRectPx(s, baseX - sway - 1, 52, 3, 3, cSpark);
    }
  }

  // Pulsing umbrella bell dome
  const bellRx = pulseFrame === 1 ? 22 : pulseFrame === 2 ? 19 : 20.5;
  const bellRy = pulseFrame === 1 ? 14 : pulseFrame === 2 ? 17 : 15.5;
  fillEllipseDitheredPx(s, 26.5, 20, bellRx, bellRy, rampBell, -0.25, -0.4);
  // Scalloped bottom bell rim
  fillRectPx(s, 7, 29, 40, 3, rampBell[1]);

  // Glowing internal bio-neural cores
  fillEllipseDitheredPx(s, 20, 20, 4, 4, [cSpark, cNode, hexToU32('#781068')]);
  fillEllipseDitheredPx(s, 33, 20, 4, 4, [cSpark, cNode, hexToU32('#781068')]);
  fillRectPx(s, 25, 13, 4, 5, cSpark);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #13 GravityGolem (Manyetik Çekim Monoliti) — Dark-iron monolith core + orbiting magnetic shards!
 */
export function getGravityGolemCoreSprite(pulling: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:gravity_golem:${pulling ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(50, 50);
  const rampIron = [
    hexToU32('#9CA8C4'),
    hexToU32('#4E5674'),
    hexToU32('#282C42'),
    hexToU32('#141424')
  ];
  const cRune = pulling
    ? frame === 0
      ? hexToU32('#FFF898')
      : hexToU32('#FF58F8')
    : hexToU32('#68E8FF');
  const cMagnetRed = hexToU32('#FF3848');
  const cMagnetBlue = hexToU32('#3898FF');

  // Heavy octagonal monolith body
  fillEllipseDitheredPx(s, 24.5, 24.5, 19, 19, rampIron);
  strokeRectPx(s, 12, 12, 26, 26, rampIron[0]);

  // North/South magnetic poles on left/right prongs
  fillRectPx(s, 4, 19, 7, 12, cMagnetRed);
  fillRectPx(s, 39, 19, 7, 12, cMagnetBlue);

  // Glowing gravity singularity eye & rune cross
  drawLinePx(s, 25, 9, 25, 40, cRune, 2);
  drawLinePx(s, 9, 25, 40, 25, cRune, 2);
  fillEllipseDitheredPx(s, 24.5, 24.5, 7, 7, [
    hexToU32('#FFFFFF'),
    cRune,
    hexToU32('#481888')
  ]);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

export function getGravityShardSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:gravity_shard:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(20, 20);
  fillDiamondPx(s, 9.5, 9.5, 7, 7, [
    hexToU32('#D8E4F8'),
    hexToU32('#6C7898'),
    hexToU32('#2C3248')
  ]);
  fillRectPx(s, 8, 8, 4, 4, frame === 0 ? hexToU32('#68F0FF') : hexToU32('#D868FF'));
  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #15 HydraBioHead (Üç Başlı Biyo-Hidra) — Armored torso + articulated neck nodes + 3 independent heads!
 */
export function getHydraBodySprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:hydra_body:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(52, 48);
  const rampScales = [
    hexToU32('#98FF78'),
    hexToU32('#2CC848'),
    hexToU32('#14702C'),
    hexToU32('#0A3418')
  ];
  const cHeart = frame === 0 ? hexToU32('#FF4838') : hexToU32('#FFD048');

  // 4 clawed bio-flippers
  for (const [fx, fy] of [
    [6, 12],
    [40, 12],
    [6, 32],
    [40, 32]
  ]) {
    fillEllipseDitheredPx(s, fx + 3, fy + 2, 6, 4, rampScales);
  }
  fillEllipseDitheredPx(s, 25.5, 24, 18, 16, rampScales);
  // Central crimson-gold reactor heart
  fillDiamondPx(s, 25.5, 24, 8, 8, [hexToU32('#FFF8A8'), cHeart, hexToU32('#780C18')]);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

export function getHydraNeckNodeSprite(detachedTint = false): HTMLCanvasElement {
  const key = `boss:hydra_neck:${detachedTint ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(14, 14);
  const ramp = detachedTint
    ? [hexToU32('#FFB858'), hexToU32('#D83828'), hexToU32('#681018')]
    : [hexToU32('#98FF78'), hexToU32('#28B848'), hexToU32('#105824')];
  fillEllipseDitheredPx(s, 6.5, 6.5, 5, 5, ramp);
  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

export function getHydraHeadSprite(jawOpen: boolean, detachedTint = false): HTMLCanvasElement {
  const key = `boss:hydra_head:${jawOpen ? 1 : 0}:${detachedTint ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(32, 28);
  const ramp = detachedTint
    ? [hexToU32('#FFE078'), hexToU32('#E84828'), hexToU32('#881418'), hexToU32('#3C080C')]
    : [hexToU32('#B0FF80'), hexToU32('#30C848'), hexToU32('#146C28'), hexToU32('#0A3414')];
  const cFang = hexToU32('#FFFFFF');
  const cEye = hexToU32('#FFE848');

  // Swept crest fins (head faces +X)
  drawLinePx(s, 14, 7, 4, 2, hexToU32('#FF3838'), 3);
  drawLinePx(s, 14, 20, 4, 25, hexToU32('#FF3838'), 3);
  fillEllipseDitheredPx(s, 15, 14, 10, 8, ramp);

  const open = jawOpen ? 3 : 1;
  drawLinePx(s, 20, 10, 29, 9 - open, ramp[0], 3);
  drawLinePx(s, 20, 18, 29, 19 + open, ramp[1], 3);
  setPx(s, 28, 11 - open, cFang);
  setPx(s, 28, 17 + open, cFang);
  if (jawOpen) {
    fillRectPx(s, 21, 12, 6, 4, hexToU32('#FF5020'));
  }
  fillRectPx(s, 18, 8, 3, 3, cEye);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #16 SawbladeJuggernaut (Dev Testere Tankı) — Giant 16-tooth steel buzzsaw ring + crimson-olive tank core!
 */
export function getSawbladeJuggernautSprite(
  sawFrame: 0 | 1,
  grindingWall: boolean
): HTMLCanvasElement {
  const key = `boss:sawblade_juggernaut:${sawFrame}:${grindingWall ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(58, 58);
  const cToothHot = grindingWall ? hexToU32('#FFF498') : hexToU32('#FFFFFF');
  const cToothMid = grindingWall ? hexToU32('#FF9828') : hexToU32('#BCCCE4');
  const cRingDark = hexToU32('#4A566C');
  const rampCore = [
    hexToU32('#FF7858'),
    hexToU32('#C82820'),
    hexToU32('#586C38'),
    hexToU32('#28341C')
  ];

  // 16 outer buzzsaw teeth!
  const cx = 28.5;
  const cy = 28.5;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 + (sawFrame * Math.PI) / 16;
    const x0 = cx + Math.cos(a) * 19;
    const y0 = cy + Math.sin(a) * 19;
    const x1 = cx + Math.cos(a + 0.14) * 26;
    const y1 = cy + Math.sin(a + 0.14) * 26;
    drawLinePx(s, x0, y0, x1, y1, i % 2 === 0 ? cToothHot : cToothMid, 3);
  }

  // Steel saw ring & armored tank turret
  fillEllipseDitheredPx(s, cx, cy, 20, 20, [cToothMid, cRingDark, hexToU32('#222836')]);
  fillEllipseDitheredPx(s, cx, cy, 13, 13, rampCore);
  strokeRectPx(s, 21, 21, 16, 16, hexToU32('#FFE058'));
  fillRectPx(s, 26, 26, 6, 6, hexToU32('#FFF8A8'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #17 ChronoSphinx (Zaman Sfenksi) — Royal gold-and-lapis winged alien techno-sphinx!
 */
export function getChronoSphinxSprite(wingFrame: 0 | 1, blinking = false): HTMLCanvasElement {
  const key = `boss:chrono_sphinx:${wingFrame}:${blinking ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const alpha = blinking ? 175 : 255;
  const s = createPixelSurface(58, 54);
  const rampGold = [
    hexToU32('#FFF8A8', alpha),
    hexToU32('#E8A820', alpha),
    hexToU32('#9C5C0C', alpha),
    hexToU32('#482404', alpha)
  ];
  const rampLapis = [
    hexToU32('#78D8FF', alpha),
    hexToU32('#2868D8', alpha),
    hexToU32('#142C74', alpha)
  ];
  const cChrono = hexToU32('#58FF98', alpha);

  // Spread ceremonial gold-and-lapis wings on left (mirrored)
  const lift = wingFrame === 0 ? 0 : 3;
  for (let f = 0; f < 4; f++) {
    const y0 = 20 + f * 5;
    drawLinePx(
      s,
      20,
      y0,
      3 + f * 2,
      10 + f * 7 - lift,
      f % 2 === 0 ? rampGold[1] : rampLapis[1],
      4
    );
    setPx(s, 4 + f * 2, 10 + f * 7 - lift, rampGold[0]);
  }
  mirrorHorizontal(s);

  // Nemes headdress & royal torso
  fillDiamondPx(s, 28.5, 27, 14, 18, rampLapis);
  fillEllipseDitheredPx(s, 28.5, 22, 10, 11, rampGold);
  // Lapis stripes on headdress
  for (const sy of [16, 20, 24]) {
    fillRectPx(s, 19, sy, 6, 2, rampLapis[1]);
    fillRectPx(s, 33, sy, 6, 2, rampLapis[1]);
  }
  // Glowing emerald hourglass core on chest + third eye
  fillDiamondPx(s, 28.5, 34, 5, 6, [hexToU32('#FFFFFF', alpha), cChrono, rampLapis[2]]);
  fillRectPx(s, 24, 19, 3, 2, cChrono);
  fillRectPx(s, 31, 19, 3, 2, cChrono);
  fillRectPx(s, 28, 14, 2, 3, hexToU32('#FF3848', alpha));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

// ============================================================================
// PART 2: ALL 14 MINION SPECIES 16-BIT PIXEL SPRITES
// ============================================================================

export { getScarabBeetleSprite };

/**
 * #2 WaspSwarmer (Sarı Yaban Arısı) — Yellow-black striped wasp + 2-frame flapping ice-cyan wings!
 */
export function getWaspSwarmerSprite(wingFrame: 0 | 1): HTMLCanvasElement {
  const key = `minion:wasp:${wingFrame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(22, 22);
  const cYellow = hexToU32('#FFE030');
  const cAmber = hexToU32('#D88810');
  const cBlack = hexToU32('#181420');
  const cWing = hexToU32('#B8F8FF', 225);
  const cEye = hexToU32('#FF2838');

  // Flapping wings
  if (wingFrame === 0) {
    fillEllipseDitheredPx(s, 6, 8, 4.5, 3, [hexToU32('#FFFFFF'), cWing]);
    fillEllipseDitheredPx(s, 15, 8, 4.5, 3, [hexToU32('#FFFFFF'), cWing]);
  } else {
    fillEllipseDitheredPx(s, 5, 12, 4.5, 2.5, [hexToU32('#FFFFFF'), cWing]);
    fillEllipseDitheredPx(s, 16, 12, 4.5, 2.5, [hexToU32('#FFFFFF'), cWing]);
  }

  // Wasp head, thorax & striped stinger abdomen
  fillEllipseDitheredPx(s, 10.5, 13, 4.5, 6, [cYellow, cAmber]);
  fillRectPx(s, 7, 11, 8, 2, cBlack);
  fillRectPx(s, 7, 15, 8, 2, cBlack);
  drawLinePx(s, 10, 18, 10, 20, hexToU32('#FFFFFF'), 2);
  fillRectPx(s, 8, 5, 6, 4, cAmber);
  fillRectPx(s, 8, 5, 2, 2, cEye);
  fillRectPx(s, 12, 5, 2, 2, cEye);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #3 LineLeech (Kızıl Çizgi Sülüğü) — 4-frame undulating crimson-orange parasitic worm!
 */
export function getLineLeechSprite(wriggleFrame: 0 | 1 | 2 | 3): HTMLCanvasElement {
  const key = `minion:line_leech:${wriggleFrame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(24, 18);
  const ramp = [hexToU32('#FFB848'), hexToU32('#E83820'), hexToU32('#801018')];
  const phase = (wriggleFrame * Math.PI) / 2;

  // 5 body rings wriggling along +X
  for (let i = 0; i < 5; i++) {
    const cx = 5 + i * 3.5;
    const cy = 9 + Math.sin(phase + i * 1.1) * 2.4;
    const r = i === 4 ? 4.2 : 3.6 - (4 - i) * 0.35;
    fillEllipseDitheredPx(s, cx, cy, r, r, ramp);
  }
  // Lamprey toothy maw at front (+X)
  const headY = Math.round(9 + Math.sin(phase + 4.4) * 2.4);
  fillRectPx(s, 20, headY - 2, 2, 4, hexToU32('#FFF8B8'));
  setPx(s, 20, headY, hexToU32('#380408'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #4 PodTurret (Yüzen Göz Tareti) — Silver-cobalt tripod sphere with locking crimson-gold eye!
 */
export function getPodTurretSprite(lockedOn: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:pod_turret:${lockedOn ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(22, 24);
  const rampMetal = [hexToU32('#F0F6FF'), hexToU32('#7C98C8'), hexToU32('#30446C')];
  const cEyeOuter = lockedOn ? hexToU32('#FF2838') : hexToU32('#FF8820');
  const cPupil = lockedOn && frame === 0 ? hexToU32('#FFFFFF') : hexToU32('#FFF068');

  // 3 lower thruster legs
  drawLinePx(s, 7, 16, 4, 21, rampMetal[1], 2);
  drawLinePx(s, 11, 17, 11, 22, rampMetal[1], 2);
  drawLinePx(s, 15, 16, 18, 21, rampMetal[1], 2);

  // Spherical metallic pod + giant central optic sensor
  fillEllipseDitheredPx(s, 11, 10, 8, 8, rampMetal);
  fillEllipseDitheredPx(s, 11, 10, 4.5, 4.5, [cPupil, cEyeOuter, hexToU32('#580818')]);
  fillRectPx(s, 10, 9, 2, 2, hexToU32('#140810'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #5 SplitterAmoeba (Bölünen Yeşil Amip) — Translucent emerald cell with twin magenta nuclei!
 */
export function getSplitterAmoebaSprite(isChild: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:amoeba:${isChild ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const dim = isChild ? 16 : 24;
  const s = createPixelSurface(dim, dim);
  const rampGel = [
    hexToU32('#C8FF98', 235),
    hexToU32('#38D858', 225),
    hexToU32('#147030', 230)
  ];
  const cNuc = hexToU32('#FF38A8');
  const cNucHot = hexToU32('#FFF098');

  if (isChild) {
    const rx = frame === 0 ? 6 : 5;
    const ry = frame === 0 ? 5 : 6;
    fillEllipseDitheredPx(s, 7.5, 7.5, rx, ry, rampGel);
    fillRectPx(s, 6, 6, 3, 3, cNuc);
    setPx(s, 7, 7, cNucHot);
  } else {
    // Bilobed dividing cell with twin nuclei!
    const pinch = frame === 0 ? 3.5 : 4.8;
    fillEllipseDitheredPx(s, 11.5 - pinch * 0.55, 11.5, 7.2, 8.2, rampGel);
    fillEllipseDitheredPx(s, 11.5 + pinch * 0.55, 11.5, 7.2, 8.2, rampGel);
    fillRectPx(s, 7, 10, 3, 3, cNuc);
    fillRectPx(s, 14, 10, 3, 3, cNuc);
    setPx(s, 8, 11, cNucHot);
    setPx(s, 15, 11, cNucHot);
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #6 BorderSparkCrab (Dikenli Kenar Yengeci) — Steel-spiked crimson perimeter crab with voltage arcs!
 */
export function getBorderSparkCrabSprite(frame: 0 | 1, electrified = true): HTMLCanvasElement {
  const key = `minion:spark_crab:${frame}:${electrified ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(24, 22);
  const rampCrab = [hexToU32('#FF7858'), hexToU32('#D02828'), hexToU32('#5C141C')];
  const cSpike = hexToU32('#E4EEFC');
  const cSpark = frame === 0 ? hexToU32('#68F8FF') : hexToU32('#FFF468');

  // Side legs + dorsal steel spikes
  for (const ly of [10, 14, 18]) {
    drawLinePx(s, 6, ly, 1, ly + (frame === 0 ? 1 : -1), cSpike, 2);
    drawLinePx(s, 17, ly, 22, ly + (frame === 0 ? -1 : 1), cSpike, 2);
  }
  for (const sx of [7, 11, 16]) {
    drawLinePx(s, sx, 6, sx, 1, cSpike, 2);
  }

  fillEllipseDitheredPx(s, 11.5, 12, 7.5, 6, rampCrab);
  fillRectPx(s, 8, 10, 2, 2, hexToU32('#FFF888'));
  fillRectPx(s, 14, 10, 2, 2, hexToU32('#FFF888'));

  if (electrified) {
    setPx(s, 3, 4 + frame * 2, cSpark);
    setPx(s, 20, 6 - frame * 2, cSpark);
    fillRectPx(s, 10, 2, 4, 2, cSpark);
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #7 ShieldSapper (Kalkan Emici Elektrik Paraziti) — Cobalt tick siphoning border shield with cyan lightning!
 */
export function getShieldSapperSprite(latched: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:shield_sapper:${latched ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(22, 22);
  const rampTick = [hexToU32('#98F8FF'), hexToU32('#2888E8'), hexToU32('#143478')];
  const cCopper = hexToU32('#FF9838');
  const cArc = frame === 0 ? hexToU32('#FFFFFF') : hexToU32('#58F4FF');

  // 4 gripping legs + twin siphon prongs facing +X
  drawLinePx(s, 9, 6, 5, 2, cCopper, 2);
  drawLinePx(s, 9, 15, 5, 19, cCopper, 2);
  drawLinePx(s, 14, 7, 19, 4, cCopper, 2);
  drawLinePx(s, 14, 14, 19, 17, cCopper, 2);

  fillEllipseDitheredPx(s, 10, 10.5, 6.5, 6, rampTick);
  if (latched) {
    // Crackling lightning arc between prongs!
    drawLinePx(s, 18, 5, 20, 10 + (frame === 0 ? -1 : 1), cArc, 2);
    drawLinePx(s, 20, 10 + (frame === 0 ? -1 : 1), 18, 16, cArc, 2);
    fillRectPx(s, 8, 9, 5, 4, cArc);
  } else {
    fillRectPx(s, 9, 9, 3, 3, hexToU32('#FFF078'));
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #8 MineLayerDrone (Mayın Döşeyici Dron) + Spiked Space Mine
 */
export function getMineLayerDroneSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:mine_layer:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(24, 22);
  const rampSteel = [hexToU32('#CBD6EA'), hexToU32('#64728C'), hexToU32('#2C3446')];
  const cHazard = hexToU32('#FFB828');
  const cBlink = frame === 0 ? hexToU32('#FF3030') : hexToU32('#FFE868');

  // Quad thruster pods
  for (const [px, py] of [
    [3, 3],
    [17, 3],
    [3, 15],
    [17, 15]
  ]) {
    fillRectPx(s, px, py, 4, 4, rampSteel[1]);
    setPx(s, px + 1, py + 1, cHazard);
  }
  fillRectPx(s, 6, 5, 12, 12, rampSteel[2]);
  strokeRectPx(s, 6, 5, 12, 12, rampSteel[0]);
  fillRectPx(s, 10, 9, 4, 4, cBlink);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

export function getProximityMineSprite(blinkRed: boolean): HTMLCanvasElement {
  const key = `hazard:space_mine:${blinkRed ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(16, 16);
  const cSpike = hexToU32('#DCE6F8');
  drawLinePx(s, 8, 1, 8, 14, cSpike, 2);
  drawLinePx(s, 1, 8, 14, 8, cSpike, 2);
  drawLinePx(s, 3, 3, 12, 12, cSpike, 1);
  drawLinePx(s, 12, 3, 3, 12, cSpike, 1);
  fillEllipseDitheredPx(s, 7.5, 7.5, 4.8, 4.8, [hexToU32('#8896B0'), hexToU32('#323A4E')]);
  fillRectPx(s, 6, 6, 4, 4, blinkRed ? hexToU32('#FF2830') : hexToU32('#FFF058'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #9 ChargerHorn (Boynuzlu Gergedan Böceği) — Gunmetal rhino beetle with glowing Bull-Charge horn!
 */
export function getChargerHornSprite(telegraphing: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:charger_horn:${telegraphing ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(26, 22);
  const rampArmor = [hexToU32('#C8D4EA'), hexToU32('#606E88'), hexToU32('#2A3244')];
  const cHorn = telegraphing ? hexToU32('#FFF898') : hexToU32('#FF9C28');

  // 6 heavy beetle legs (facing +X)
  for (const lx of [6, 10, 14]) {
    drawLinePx(s, lx, 5, lx + (frame === 0 ? 1 : -1), 1, rampArmor[1], 2);
    drawLinePx(s, lx, 16, lx + (frame === 0 ? -1 : 1), 20, rampArmor[1], 2);
  }
  fillEllipseDitheredPx(s, 10.5, 11, 8, 6.5, rampArmor);
  // Giant forward rhino horn (+X)
  drawLinePx(s, 16, 11, 24, 11, cHorn, 4);
  setPx(s, 24, 11, hexToU32('#FFFFFF'));
  fillRectPx(s, 15, 7, 2, 2, hexToU32('#FF2838'));
  fillRectPx(s, 15, 13, 2, 2, hexToU32('#FF2838'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #10 PhaseGhost (Hayalet Plazma) — Translucent ice-cyan wraith that glides through solid boxes!
 */
export function getPhaseGhostSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:phase_ghost:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(22, 24);
  const rampGhost = [
    hexToU32('#FFFFFF', 215),
    hexToU32('#78F4FF', 195),
    hexToU32('#2888E0', 180)
  ];
  fillEllipseDitheredPx(s, 10.5, 10, 7.5, 7.5, rampGhost);
  // Waving ectoplasm skirt
  for (let i = 0; i < 4; i++) {
    const tx = 5 + i * 3.5;
    const tailLen = (i + frame) % 2 === 0 ? 21 : 18;
    drawLinePx(s, tx, 14, tx, tailLen, rampGhost[1], 3);
  }
  // Hollow spectral eyes
  fillRectPx(s, 7, 8, 3, 4, hexToU32('#081028'));
  fillRectPx(s, 12, 8, 3, 4, hexToU32('#081028'));
  setPx(s, 8, 9, hexToU32('#FF58D8'));
  setPx(s, 13, 9, hexToU32('#FF58D8'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #11 OrbitSatellite (Lazer Koruma Uydusu) — Twin sapphire solar wings + gold core!
 */
export function getOrbitSatelliteSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:orbit_sat:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(24, 22);
  const cSolar = hexToU32('#2478E8');
  const cGrid = hexToU32('#88E0FF');
  const cGold = hexToU32('#FFD038');

  // Left & right solar panel wings
  fillRectPx(s, 1, 6, 6, 10, cSolar);
  strokeRectPx(s, 1, 6, 6, 10, cGrid);
  fillRectPx(s, 17, 6, 6, 10, cSolar);
  strokeRectPx(s, 17, 6, 6, 10, cGrid);
  drawLinePx(s, 7, 11, 17, 11, hexToU32('#DCE8FA'), 2);

  // Central gold defense core
  fillDiamondPx(s, 11.5, 11, 4.5, 4.5, [hexToU32('#FFF8A8'), cGold, hexToU32('#9C5808')]);
  fillRectPx(s, 11, 10, 2, 2, frame === 0 ? hexToU32('#FF2838') : hexToU32('#FFFFFF'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #12 HomingSeeker (Güdümlü Biyo-Füze) — Sleek emerald-crimson bio-missile + pixel exhaust flame!
 */
export function getHomingSeekerSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:homing_seeker:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(24, 16);
  // Exhaust flame at -X, warhead nose at +X
  const flameLen = frame === 0 ? 6 : 3;
  drawLinePx(s, 7, 8, 7 - flameLen, 8, hexToU32('#FF6818'), 4);
  drawLinePx(s, 7, 8, 8 - flameLen, 8, hexToU32('#FFF488'), 2);

  // Stabilizer fins
  drawLinePx(s, 9, 4, 6, 1, hexToU32('#D82828'), 2);
  drawLinePx(s, 9, 11, 6, 14, hexToU32('#D82828'), 2);
  // Bio-torpedo fuselage & crimson warhead
  fillEllipseDitheredPx(s, 13, 8, 6.5, 4, [
    hexToU32('#98FF78'),
    hexToU32('#28B848'),
    hexToU32('#105824')
  ]);
  fillEllipseDitheredPx(s, 19, 8, 3.5, 3, [hexToU32('#FFB878'), hexToU32('#E82828')]);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #13 AnchorBarnacle (Taşlaşan Kaya Midyesi) — Open drifting mollusk vs petrified solid fortress block!
 */
export function getAnchorBarnacleSprite(petrified: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:anchor_barnacle:${petrified ? 1 : 0}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(26, 26);
  if (petrified) {
    // Clamped solid stone-steel wall block!
    fillRectPx(s, 2, 2, 22, 22, hexToU32('#58647C'));
    strokeRectPx(s, 2, 2, 22, 22, hexToU32('#CFDCEE'));
    strokeRectPx(s, 5, 5, 16, 16, hexToU32('#2C3244'));
    for (const [rx, ry] of [
      [4, 4],
      [20, 4],
      [4, 20],
      [20, 20]
    ]) {
      fillRectPx(s, rx, ry, 2, 2, hexToU32('#FFF088'));
    }
    drawLinePx(s, 6, 13, 19, 13, hexToU32('#181C28'), 2);
  } else {
    // Open violet-grey barnacle shell with peeking glowing orange eye
    const rampShell = [hexToU32('#D8C8F0'), hexToU32('#7C64A8'), hexToU32('#3C2C5C')];
    fillEllipseDitheredPx(s, 13, 13, 10, 9, rampShell);
    fillEllipseDitheredPx(s, 13, 13, 5, 4 + frame, [
      hexToU32('#FFF898'),
      hexToU32('#FF6820'),
      hexToU32('#681018')
    ]);
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * #14 KamikazeSpore (Kovan Sporu) — Pulsing volatile orange-gold bio-spore cluster!
 */
export function getKamikazeSporeSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:kamikaze_spore:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(16, 16);
  const ramp = [hexToU32('#FFF8A0'), hexToU32('#FF8818'), hexToU32('#B82410')];
  fillEllipseDitheredPx(s, 7.5, 7.5, frame === 0 ? 5.2 : 4.6, frame === 0 ? 4.6 : 5.2, ramp);
  setPx(s, 4, 4, hexToU32('#FFE058'));
  setPx(s, 11, 4, hexToU32('#FFE058'));
  setPx(s, 4, 11, hexToU32('#FFE058'));
  setPx(s, 11, 11, hexToU32('#FFE058'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

// ============================================================================
// PART 3: ARENA FIELD HAZARD SPRITES (MAGMA POOLS & CYBER WEBS)
// ============================================================================

export function getMagmaPoolSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `hazard:magma_pool:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(28, 28);
  const rampLava = [
    hexToU32('#FFF898', 235),
    hexToU32('#FF8C18', 230),
    hexToU32('#D82810', 225),
    hexToU32('#4C1010', 220)
  ];
  fillEllipseDitheredPx(s, 13.5, 14, 11.5, 10.5, rampLava, frame === 0 ? -0.2 : 0.2, -0.15);
  // Bubbling bright magma blisters
  fillRectPx(s, frame === 0 ? 9 : 15, 10, 3, 3, hexToU32('#FFFFFF'));
  fillRectPx(s, frame === 0 ? 16 : 10, 16, 2, 2, hexToU32('#FFF488'));

  applyArcadeOutline(s, '#140608');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

export function getWebZoneSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `hazard:web_zone:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(36, 36);
  const cStrand = hexToU32('#58E8FF', 195);
  const cNode = frame === 0 ? hexToU32('#FFE868') : hexToU32('#FFFFFF');
  const cx = 17.5;
  const cy = 17.5;

  // 8 radial silk spokes
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    drawLinePx(s, cx, cy, cx + Math.cos(a) * 16, cy + Math.sin(a) * 16, cStrand, 1);
  }
  // 3 concentric octagonal rings
  for (const r of [6, 11, 15.5]) {
    for (let i = 0; i < 8; i++) {
      const a0 = (i * Math.PI) / 4;
      const a1 = ((i + 1) * Math.PI) / 4;
      drawLinePx(
        s,
        cx + Math.cos(a0) * r,
        cy + Math.sin(a0) * r,
        cx + Math.cos(a1) * r,
        cy + Math.sin(a1) * r,
        cStrand,
        1
      );
    }
  }
  fillRectPx(s, 16, 16, 4, 4, cNode);
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

// ============================================================================
// PART 4: BUILD 12 EXPANSION — 6 NEW 16-BIT BOSSES, 4 SMOOTH MINIONS & CRYSTALS
// ============================================================================

/**
 * Build 12 Boss #5: FrostLeviathan (Buzul Leviathan) — Crystalline ice-cyan & diamond-white sea dragon!
 */
export function getFrostLeviathanHeadSprite(frame: 0 | 1, charging = false): HTMLCanvasElement {
  const key = `boss:frost_leviathan_head:${frame}:${charging ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(42, 34);
  const rampIce = charging
    ? [hexToU32('#FFFFFF'), hexToU32('#88FFFF'), hexToU32('#2898F8'), hexToU32('#104088')]
    : [hexToU32('#F4FCFF'), hexToU32('#6CE4FF'), hexToU32('#1E7CD8'), hexToU32('#0E2E68')];
  const cCrest = hexToU32('#C8F8FF');
  const cEye = charging ? hexToU32('#FFF468') : hexToU32('#FFFFFF');

  // Swept crystalline dorsal & ventral fins (facing +X)
  const finLift = frame === 0 ? 0 : 2;
  drawLinePx(s, 16, 8, 5, 2 + finLift, cCrest, 3);
  drawLinePx(s, 16, 25, 5, 31 - finLift, cCrest, 3);
  drawLinePx(s, 24, 9, 14, 3 + finLift, rampIce[1], 2);
  drawLinePx(s, 24, 24, 14, 30 - finLift, rampIce[1], 2);

  // Armored glacial dragon skull & snout (+X)
  fillEllipseDitheredPx(s, 20, 17, 13, 9.5, rampIce);
  fillDiamondPx(s, 31, 17, 8, 6, rampIce);
  // Twin ice horns + glowing eyes
  drawLinePx(s, 26, 12, 36, 9, hexToU32('#FFFFFF'), 2);
  drawLinePx(s, 26, 22, 36, 25, hexToU32('#FFFFFF'), 2);
  fillRectPx(s, 27, 13, 3, 2, cEye);
  fillRectPx(s, 27, 19, 3, 2, cEye);

  applyArcadeOutline(s, '#060A18');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

export function getFrostLeviathanSegmentSprite(isTail: boolean): HTMLCanvasElement {
  const key = `boss:frost_leviathan_seg:${isTail ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const dim = isTail ? 20 : 26;
  const s = createPixelSurface(dim, dim);
  const rampIce = [hexToU32('#E8FAFF'), hexToU32('#58D4F8'), hexToU32('#1A64B8'), hexToU32('#0C2858')];
  const r = isTail ? 6.5 : 9.5;
  fillDiamondPx(s, dim * 0.5, dim * 0.5, r, r * 0.85, rampIce);
  fillRectPx(s, Math.floor(dim * 0.5) - 1, Math.floor(dim * 0.5) - 1, 3, 3, hexToU32('#FFFFFF'));

  applyArcadeOutline(s, '#060A18');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

export function getFrostTrailSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `hazard:frost_trail:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(26, 26);
  const ramp = [
    hexToU32('#FFFFFF', 225),
    hexToU32('#78F0FF', 205),
    hexToU32('#2088E0', 185)
  ];
  fillDiamondPx(s, 12.5, 12.5, 10, 10, ramp);
  drawLinePx(s, 12, 3, 12, 22, hexToU32('#FFFFFF', 230), 1);
  drawLinePx(s, 3, 12, 22, 12, hexToU32('#FFFFFF', 230), 1);
  if (frame === 0) {
    setPx(s, 7, 7, hexToU32('#FFFFFF'));
    setPx(s, 18, 17, hexToU32('#FFFFFF'));
  } else {
    setPx(s, 17, 7, hexToU32('#FFFFFF'));
    setPx(s, 7, 18, hexToU32('#FFFFFF'));
  }
  applyArcadeOutline(s, '#081428');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Boss #8: PlasmaScorpion (Plazma Akrebi) — Gunmetal & copper-orange mecha-scorpion!
 * Matches reference art: twin heavy pincers, 8 segmented legs, sequential glowing stinger tail!
 */
export function getPlasmaScorpionSprite(frame: 0 | 1, tailLitNodes: number): HTMLCanvasElement {
  const clampNodes = Math.max(0, Math.min(4, Math.round(tailLitNodes)));
  const key = `boss:plasma_scorpion:${frame}:${clampNodes}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(60, 56);
  const rampSteel = [hexToU32('#DCE6F6'), hexToU32('#6E7C94'), hexToU32('#343C4E'), hexToU32('#181C28')];
  const rampCopper = [hexToU32('#FFF098'), hexToU32('#FF8C24'), hexToU32('#C83C10'), hexToU32('#581808')];

  // 8 articulated side legs (4 left, 4 right)
  for (let i = 0; i < 4; i++) {
    const ly = 22 + i * 6;
    const shift = (i + frame) % 2 === 0 ? -2 : 2;
    drawLinePx(s, 22, ly, 8, ly - 3 + shift, rampSteel[1], 2);
    drawLinePx(s, 8, ly - 3 + shift, 4, ly + 3 + shift, rampCopper[1], 2);
  }
  mirrorHorizontal(s);

  // Twin heavy front pincers (bottom-left & bottom-right)
  const pinch = frame === 0 ? 0 : 2;
  for (const side of [-1, 1]) {
    const cx = 30 + side * 15;
    drawLinePx(s, 30 + side * 7, 36, cx, 44, rampSteel[1], 3);
    fillEllipseDitheredPx(s, cx + side * 2, 47, 6.5, 5, rampSteel);
    drawLinePx(s, cx, 49, cx + side * (5 - pinch), 53, rampCopper[0], 2);
    drawLinePx(s, cx + side * 4, 46, cx + side * (7 - pinch), 51, rampCopper[1], 2);
  }

  // Segmented gunmetal carapace with glowing orange reactor seams
  fillEllipseDitheredPx(s, 30, 30, 11.5, 13.5, rampSteel);
  for (const ry of [23, 28, 33, 38]) {
    fillRectPx(s, 24, ry, 12, 2, rampCopper[1]);
  }
  fillRectPx(s, 26, 40, 3, 2, hexToU32('#FF3828'));
  fillRectPx(s, 31, 40, 3, 2, hexToU32('#FF3828'));

  // Curved 4-node arched scorpion tail + plasma stinger over the back
  const tailCoords: Array<[number, number, number]> = [
    [26, 17, 4.8],
    [23, 11, 4.4],
    [28, 6, 4.2],
    [35, 8, 4.6]
  ];
  for (let idx = 0; idx < tailCoords.length; idx++) {
    const [tx, ty, tr] = tailCoords[idx]!;
    const lit = idx < clampNodes;
    fillEllipseDitheredPx(s, tx, ty, tr, tr, lit ? rampCopper : rampSteel);
  }
  // Stinger barb
  const stingerHot = clampNodes >= 3;
  drawLinePx(s, 37, 9, 43, 14, stingerHot ? hexToU32('#FFFFFF') : rampCopper[1], 3);
  setPx(s, 44, 15, hexToU32('#FFF488'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Boss #12: SinkholeWorm (Obruk Solucanı) — Sand-gold & obsidian armored dune wyrm!
 */
export function getSinkholeWormSprite(frame: 0 | 1, submerging = false): HTMLCanvasElement {
  const key = `boss:sinkhole_worm:${frame}:${submerging ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(54, 54);
  const rampGold = [hexToU32('#FFF4A8'), hexToU32('#E8A830'), hexToU32('#8C5210'), hexToU32('#3C2008')];
  const rampVoid = [hexToU32('#E088FF'), hexToU32('#8428C8'), hexToU32('#280A48')];

  const outerR = submerging ? 17 : 22;
  fillEllipseDitheredPx(s, 27, 27, outerR, outerR, rampGold);
  fillEllipseDitheredPx(s, 27, 27, outerR * 0.68, outerR * 0.68, rampVoid);

  // Rotating ring of 8 crystalline teeth around the gravity maw
  const rot = frame === 0 ? 0 : Math.PI / 8;
  for (let i = 0; i < 8; i++) {
    const a = rot + (i * Math.PI) / 4;
    const x0 = 27 + Math.cos(a) * (outerR * 0.72);
    const y0 = 27 + Math.sin(a) * (outerR * 0.72);
    const x1 = 27 + Math.cos(a) * (outerR * 0.36);
    const y1 = 27 + Math.sin(a) * (outerR * 0.36);
    drawLinePx(s, x0, y0, x1, y1, hexToU32('#FFF8D0'), 2);
  }
  fillEllipseDitheredPx(s, 27, 27, 4.5, 4.5, [hexToU32('#FFFFFF'), hexToU32('#B848FF'), hexToU32('#140424')]);

  applyArcadeOutline(s, '#08060E');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Boss #15: QuantumButterfly (Kuantum Kelebeği) — Symmetrical neon-cyan & violet astral butterfly!
 */
export function getQuantumButterflySprite(frame: 0 | 1, charging = false): HTMLCanvasElement {
  const key = `boss:quantum_butterfly:${frame}:${charging ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(60, 52);
  const wingSpan = frame === 0 ? 25 : 18;
  const rampUpper = charging
    ? [hexToU32('#FFFFFF'), hexToU32('#FFF078'), hexToU32('#38E8FF'), hexToU32('#1858B8')]
    : [hexToU32('#E8FFFF'), hexToU32('#48F0FF'), hexToU32('#2878E8'), hexToU32('#142868')];
  const rampLower = [hexToU32('#FFE0FF'), hexToU32('#E858FF'), hexToU32('#7820B8'), hexToU32('#2C0C54')];

  // Draw left upper & lower stained-glass wings, then mirror horizontally!
  fillEllipseDitheredPx(s, 30 - wingSpan * 0.55, 18, wingSpan * 0.55, 12, rampUpper);
  fillEllipseDitheredPx(s, 30 - wingSpan * 0.42, 35, wingSpan * 0.42, 10, rampLower);
  // Wing circuit eye-spots
  fillDiamondPx(s, 30 - Math.round(wingSpan * 0.62), 17, 4.5, 4.5, [hexToU32('#FFFFFF'), hexToU32('#FFD848')]);
  fillDiamondPx(s, 30 - Math.round(wingSpan * 0.45), 35, 3.5, 3.5, [hexToU32('#FFFFFF'), hexToU32('#58FFFF')]);
  // Left antenna
  drawLinePx(s, 28, 12, 21, 4, hexToU32('#88F8FF'), 2);
  setPx(s, 20, 3, hexToU32('#FFF488'));

  mirrorHorizontal(s);

  // Central golden-silver astral thorax
  fillEllipseDitheredPx(s, 30, 26, 4.5, 14, [hexToU32('#FFFFFF'), hexToU32('#FFE068'), hexToU32('#985810')]);

  applyArcadeOutline(s, '#060814');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Boss #19: SolarFlareCore (Güneş Fırtınası Çekirdeği) — Rotating stellar corona reactor!
 */
export function getSolarFlareCoreSprite(frame: 0 | 1, charging = false): HTMLCanvasElement {
  const key = `boss:solar_flare_core:${frame}:${charging ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(58, 58);
  const rampSun = charging
    ? [hexToU32('#FFFFFF'), hexToU32('#FFF898'), hexToU32('#FF7818'), hexToU32('#B81810')]
    : [hexToU32('#FFF8C0'), hexToU32('#FFD038'), hexToU32('#E85814'), hexToU32('#78180C')];
  const rampRing = [hexToU32('#DCE6F8'), hexToU32('#7484A0'), hexToU32('#2C3448')];

  // 4 cardinal magnetic prominence spikes
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + (frame === 0 ? 0 : 0.14);
    const x1 = 29 + Math.cos(a) * 26;
    const y1 = 29 + Math.sin(a) * 26;
    drawLinePx(s, 29, 29, x1, y1, hexToU32('#FF9824'), 4);
    drawLinePx(s, 29, 29, x1, y1, hexToU32('#FFF898'), 2);
  }

  // Containment gyro-ring + blazing fusion sphere
  fillEllipseDitheredPx(s, 29, 29, 20, 20, rampRing);
  fillEllipseDitheredPx(s, 29, 29, 15.5, 15.5, rampSun);
  fillDiamondPx(s, 29, 29, 7, 7, [hexToU32('#FFFFFF'), hexToU32('#FFF488'), hexToU32('#FF6818')]);

  applyArcadeOutline(s, '#08060C');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Boss #24: VoidEmperor (Hiçlik İmparatoru) — 2-Stage Final Boss!
 * Form 1 (`!awakenedCore`): Heavy obsidian-gold armored throne monolith.
 * Form 2 (`awakenedCore`): Winged astral void sovereign core!
 */
export function getVoidEmperorSprite(
  frame: 0 | 1,
  awakenedCore: boolean,
  charging = false
): HTMLCanvasElement {
  const key = `boss:void_emperor:${frame}:${awakenedCore ? 1 : 0}:${charging ? 1 : 0}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(64, 60);
  const rampGold = [hexToU32('#FFF8B8'), hexToU32('#F4B830'), hexToU32('#94580C'), hexToU32('#3E2004')];
  const rampObsidian = [hexToU32('#98A8C8'), hexToU32('#485470'), hexToU32('#202638'), hexToU32('#0E121E')];
  const rampAstral = charging
    ? [hexToU32('#FFFFFF'), hexToU32('#FFE878'), hexToU32('#E848FF'), hexToU32('#581498')]
    : [hexToU32('#F8E8FF'), hexToU32('#B858FF'), hexToU32('#5820B8'), hexToU32('#1E0848')];

  if (!awakenedCore) {
    // Form 1: Royal Armored Throne Monolith
    fillRectPx(s, 14, 12, 36, 38, rampObsidian[2]);
    strokeRectPx(s, 14, 12, 36, 38, rampGold[1]);
    strokeRectPx(s, 17, 15, 30, 32, rampObsidian[0]);
    // Crown spires
    drawLinePx(s, 18, 12, 14, 4, rampGold[0], 3);
    drawLinePx(s, 32, 12, 32, 2, rampGold[0], 4);
    drawLinePx(s, 46, 12, 50, 4, rampGold[0], 3);
    // Shoulder pauldrons
    fillDiamondPx(s, 12, 26, 7, 10, rampGold);
    fillDiamondPx(s, 52, 26, 7, 10, rampGold);
    // Central void eye
    fillDiamondPx(s, 32, 30, 9, 11, rampAstral);
    fillRectPx(s, 30, 28, 4, 5, frame === 0 ? hexToU32('#FFFFFF') : hexToU32('#FFE868'));
  } else {
    // Form 2: Awakened Winged Sovereign Core
    const lift = frame === 0 ? 0 : 3;
    // Left seraphic energy blades (mirrored)
    for (let k = 0; k < 3; k++) {
      const wy = 18 + k * 10;
      drawLinePx(s, 24, 28, 4, wy - lift + k * 2, rampAstral[1], 4);
      drawLinePx(s, 24, 28, 6, wy - lift + k * 2, hexToU32('#FFF498'), 2);
    }
    mirrorHorizontal(s);

    // Royal crest + radiant core
    drawLinePx(s, 32, 14, 32, 3, rampGold[0], 3);
    drawLinePx(s, 27, 15, 22, 6, rampGold[1], 2);
    drawLinePx(s, 37, 15, 42, 6, rampGold[1], 2);
    fillDiamondPx(s, 32, 30, 13, 15, rampGold);
    fillEllipseDitheredPx(s, 32, 30, 9, 10, rampAstral);
    fillRectPx(s, 30, 28, 4, 4, hexToU32('#FFFFFF'));
  }

  applyArcadeOutline(s, '#05060C');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Minion #15: CosmicManta (Kozmik Vatoz) — Graceful sapphire-cyan space manta ray!
 */
export function getCosmicMantaSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:cosmic_manta:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(26, 24);
  const rampManta = [hexToU32('#E8FFFF'), hexToU32('#48D8FF'), hexToU32('#1C68C8'), hexToU32('#0E2C64')];
  const sweep = frame === 0 ? 0 : 2;

  // Tail streamer (-X) + swept manta wings (+X heading)
  drawLinePx(s, 9, 12, 2, 12 + (frame === 0 ? 1 : -1), hexToU32('#78F8FF'), 2);
  drawLinePx(s, 15, 12, 10, 3 + sweep, rampManta[1], 4);
  drawLinePx(s, 15, 12, 10, 21 - sweep, rampManta[1], 4);
  fillDiamondPx(s, 16, 12, 7.5, 6.5, rampManta);
  fillRectPx(s, 19, 9, 2, 2, hexToU32('#FFF488'));
  fillRectPx(s, 19, 13, 2, 2, hexToU32('#FFF488'));

  applyArcadeOutline(s, '#060812');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Minion #16: RicochetCrystal (Seken Kristal Küp) — Iridescent prism diamond!
 */
export function getRicochetCrystalSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:ricochet_crystal:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(22, 22);
  const rampPrism =
    frame === 0
      ? [hexToU32('#FFFFFF'), hexToU32('#68F8FF'), hexToU32('#D848FF'), hexToU32('#283898')]
      : [hexToU32('#FFFFFF'), hexToU32('#98FF98'), hexToU32('#48D8FF'), hexToU32('#2858A8')];

  fillDiamondPx(s, 10.5, 10.5, 8.5, 8.5, rampPrism);
  drawLinePx(s, 10, 3, 10, 18, hexToU32('#FFFFFF'), 1);
  drawLinePx(s, 3, 10, 18, 10, hexToU32('#FFFFFF'), 1);

  applyArcadeOutline(s, '#060812');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Minion #17: VortexDrifter (Çekim Girdabı) — Swirling turquoise-violet nebula disc!
 */
export function getVortexDrifterSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:vortex_drifter:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(24, 24);
  const rampNebula = [hexToU32('#FFFFFF'), hexToU32('#58F8D8'), hexToU32('#8848E8'), hexToU32('#241458')];
  fillEllipseDitheredPx(s, 11.5, 11.5, 8.5, 8.5, rampNebula, frame === 0 ? -0.3 : 0.3, 0.2);
  fillRectPx(s, 10, 10, 4, 4, hexToU32('#FFF8A8'));

  applyArcadeOutline(s, '#060812');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Minion #18: CometSeed (Kuyruklu Yıldız Tohumu) — Blazing golden-cyan comet core + tail!
 */
export function getCometSeedSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:comet_seed:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(26, 18);
  const tailLen = frame === 0 ? 11 : 8;
  drawLinePx(s, 16, 9, 16 - tailLen, 9, hexToU32('#FF8820'), 5);
  drawLinePx(s, 16, 9, 17 - tailLen, 9, hexToU32('#FFF898'), 2);
  fillEllipseDitheredPx(s, 18, 9, 5.5, 5.5, [
    hexToU32('#FFFFFF'),
    hexToU32('#78F8FF'),
    hexToU32('#1888E8')
  ]);

  applyArcadeOutline(s, '#060812');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}

/**
 * Build 12 Collectible Field Power-Up Crystals (`TIME_FREEZE`, `SPEED_BOOST`, `TRAIL_SHIELD_1HIT`, `LASER_CANNON`)!
 */
export function getFieldCrystalSprite(
  type: 'TIME_FREEZE' | 'SPEED_BOOST' | 'TRAIL_SHIELD_1HIT' | 'LASER_CANNON',
  frame: 0 | 1
): HTMLCanvasElement {
  const key = `powerup:field_crystal:${type}:${frame}`;
  const cached = BESTIARY_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(26, 30);
  const ramps: Record<typeof type, readonly number[]> = {
    TIME_FREEZE: [hexToU32('#FFFFFF'), hexToU32('#78F8FF'), hexToU32('#1E88E8'), hexToU32('#0C3478')],
    SPEED_BOOST: [hexToU32('#FFFFFF'), hexToU32('#FFF068'), hexToU32('#FF9818'), hexToU32('#9C3C08')],
    TRAIL_SHIELD_1HIT: [hexToU32('#FFFFFF'), hexToU32('#68E0FF'), hexToU32('#2868F0'), hexToU32('#142878')],
    LASER_CANNON: [hexToU32('#FFFFFF'), hexToU32('#FF9878'), hexToU32('#E82838'), hexToU32('#680C18')]
  };
  const ramp = ramps[type];

  // Tall octagonal arcade crystal prism
  fillDiamondPx(s, 12.5, 14.5, 9.5, 12.5, ramp);
  drawLinePx(s, 12, 4, 12, 25, hexToU32('#FFFFFF', frame === 0 ? 235 : 170), 2);
  if (frame === 0) {
    fillRectPx(s, 8, 9, 3, 3, hexToU32('#FFFFFF'));
  } else {
    fillRectPx(s, 14, 17, 3, 3, hexToU32('#FFFFFF'));
  }

  applyArcadeOutline(s, '#060812');
  const out = commitPixelSurface(s);
  BESTIARY_CACHE.set(key, out);
  return out;
}
