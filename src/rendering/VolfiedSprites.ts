import { ShipSkinConfig } from '../core/Config';
import { Direction } from '../geometry/Types';
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

const SPRITE_CACHE = new Map<string, HTMLCanvasElement>();

function rotatePixelSurfaceCW(src: PixelSurface, quarterTurns: 0 | 1 | 2 | 3): PixelSurface {
  if (quarterTurns === 0) return src;
  const w = quarterTurns % 2 === 1 ? src.height : src.width;
  const h = quarterTurns % 2 === 1 ? src.width : src.height;
  const dst = createPixelSurface(w, h);

  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const col = getPx(src, x, y);
      if (col === 0) continue;
      if (quarterTurns === 1) {
        setPx(dst, src.height - 1 - y, x, col);
      } else if (quarterTurns === 2) {
        setPx(dst, src.width - 1 - x, src.height - 1 - y, col);
      } else {
        setPx(dst, y, src.width - 1 - x, col);
      }
    }
  }
  return dst;
}

function mirrorLeftToRight(s: PixelSurface): void {
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

// ============================================================================
// 1. TWIN-PRONG STARFIGHTER & CIRCULAR GREEN PIXEL SHIELD
// ============================================================================
export function getPlayerShipSprite(skin: ShipSkinConfig, dir: Direction): HTMLCanvasElement {
  const key = `ship:${skin.id}:${dir}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  // Build 20x20 UP-facing twin-prong starfighter (matches 01-hedef-oynanis.jpg!)
  const base = createPixelSurface(20, 20);
  const cLight = hexToU32(skin.hullLightHex);
  const cMid = hexToU32(skin.hullMidHex);
  const cDark = hexToU32(skin.hullDarkHex);
  const cPod = hexToU32(skin.wingAccentHex);
  const cCockpitLight = hexToU32(skin.cockpitLightHex);
  const cCockpitDark = hexToU32(skin.cockpitDarkHex);

  // Left forward prong (x: 5..7, y: 2..13)
  fillRectPx(base, 6, 2, 1, 3, cLight);
  fillRectPx(base, 5, 4, 2, 9, cLight);
  fillRectPx(base, 7, 6, 1, 7, cMid);

  // Left outer delta winglet (x: 2..4, y: 10..16)
  fillRectPx(base, 4, 10, 1, 6, cMid);
  fillRectPx(base, 3, 11, 1, 5, cLight);
  fillRectPx(base, 2, 12, 1, 4, cDark);
  setPx(base, 3, 12, cPod);
  setPx(base, 3, 13, cPod);

  // Center fuselage bridge (x: 8..9, y: 8..16)
  fillRectPx(base, 8, 8, 2, 8, cLight);
  fillRectPx(base, 7, 13, 3, 3, cDark);

  // Mirror to right half, then shade right prong slightly for 3D depth
  mirrorLeftToRight(base);
  for (let y = 3; y <= 15; y++) {
    for (let x = 11; x <= 17; x++) {
      if (getPx(base, x, y) === cLight) {
        setPx(base, x, y, cMid);
      }
    }
  }

  // Glowing central red ruby cockpit (x: 8..11, y: 9..13)
  fillRectPx(base, 8, 10, 4, 3, cCockpitDark);
  fillRectPx(base, 9, 9, 2, 4, cCockpitDark);
  fillRectPx(base, 9, 10, 2, 2, cCockpitLight);

  const turns: 0 | 1 | 2 | 3 =
    dir === 'UP' ? 0 : dir === 'RIGHT' ? 1 : dir === 'DOWN' ? 2 : 3;
  const rotated = rotatePixelSurfaceCW(base, turns);
  applyArcadeOutline(rotated, '#080810');

  const out = commitPixelSurface(rotated);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getMiniShipHudSprite(): HTMLCanvasElement {
  const key = 'hud:miniship';
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(12, 13);
  const cLight = hexToU32('#E8F0FA');
  const cMid = hexToU32('#94A2B8');
  const cRed = hexToU32('#E82820');

  // Left & right twin prongs
  fillRectPx(s, 3, 2, 2, 8, cLight);
  fillRectPx(s, 7, 2, 2, 8, cMid);
  fillRectPx(s, 1, 7, 2, 4, cMid);
  fillRectPx(s, 9, 7, 2, 4, cMid);
  fillRectPx(s, 4, 6, 4, 5, cLight);
  fillRectPx(s, 5, 6, 2, 3, cRed);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getCircularShieldSprite(frame: 0 | 1, warningRed: boolean): HTMLCanvasElement {
  const key = `shield:${frame}:${warningRed ? 1 : 0}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(28, 28);
  const cx = 13.5;
  const cy = 13.5;
  const cMain = hexToU32(warningRed ? '#FF3820' : '#38F048');
  const cSpark = hexToU32(warningRed ? '#FFF068' : '#C8FF68');

  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d >= 10.6 && d <= 12.1) {
        const bead = ((x + y + frame) & 1) === 0;
        setPx(s, x, y, bead ? cSpark : cMain);
      }
    }
  }
  applyArcadeOutline(s, '#080810');

  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

// ============================================================================
// 2. GRAY & GOLD RED-RUBY ENERGY BLOCKS + LETTER CAPSULES
// ============================================================================
export function getEnergyBlockSprite(
  isGoldSpecial: boolean,
  gemBrightFrame: 0 | 1
): HTMLCanvasElement {
  const key = `block:${isGoldSpecial ? 'G' : 'S'}:${gemBrightFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(20, 20);
  const cBlack = hexToU32('#080810');

  const topHex = isGoldSpecial ? '#FFF290' : '#DCE4F0';
  const midHex = isGoldSpecial ? '#F0B824' : '#8E98AA';
  const botHex = isGoldSpecial ? '#946208' : '#4C5464';

  const cTop = hexToU32(topHex);
  const cMid = hexToU32(midHex);
  const cBot = hexToU32(botHex);

  // Outer 20x20 black frame
  fillRectPx(s, 0, 0, 20, 20, cBlack);

  // 3px 3D diagonal-mitered bevels (exact 01-hedef-oynanis.jpg block!)
  for (let y = 1; y < 19; y++) {
    for (let x = 1; x < 19; x++) {
      if (x >= 4 && x <= 15 && y >= 4 && y <= 15) {
        setPx(s, x, y, cMid);
      } else if (x + y < 19) {
        setPx(s, x, y, cTop);
      } else if (x + y > 19) {
        setPx(s, x, y, cBot);
      } else {
        setPx(s, x, y, cMid);
      }
    }
  }
  strokeRectPx(s, 4, 4, 12, 12, cBlack);

  // Dark recessed central jewel socket (6..13)
  fillRectPx(s, 6, 6, 8, 8, hexToU32('#181C28'));

  // Gleaming Red Octagonal Ruby Crystal
  const cGemDark = hexToU32('#880A12');
  const cGemMid = hexToU32(gemBrightFrame === 1 ? '#FF3028' : '#D81820');
  const cGemGlint = hexToU32('#FFB8B8');
  const cWhite = hexToU32('#FFFFFF');

  const rStart = isGoldSpecial ? 6 : 7;
  const rSize = isGoldSpecial ? 8 : 6;
  fillRectPx(s, rStart, rStart, rSize, rSize, cGemDark);
  fillRectPx(s, rStart, rStart, rSize - 1, rSize - 1, cGemMid);
  // Clip corners for octagonal jewel look
  setPx(s, rStart, rStart, hexToU32('#181C28'));
  setPx(s, rStart + rSize - 1, rStart, hexToU32('#181C28'));
  setPx(s, rStart, rStart + rSize - 1, hexToU32('#181C28'));
  setPx(s, rStart + rSize - 1, rStart + rSize - 1, hexToU32('#181C28'));

  // Specular pixel glint
  setPx(s, rStart + 1, rStart + 1, cWhite);
  setPx(s, rStart + 2, rStart + 1, cGemGlint);
  setPx(s, rStart + 1, rStart + 2, cGemGlint);

  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getCapsuleSprite(code: string): HTMLCanvasElement {
  const key = `capsule:${code}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(16, 14);
  const bgMap: Record<string, [string, string]> = {
    S: ['#68D8FF', '#1878D8'],
    T: ['#C898FF', '#6828B8'],
    P: ['#88FF88', '#18A838'],
    L: ['#FF9870', '#D82818'],
    C: ['#FFF078', '#C88810'],
    '★': ['#FFF498', '#E89810']
  };
  const [lightHex, darkHex] = bgMap[code] ?? ['#DCE6F8', '#5C6C88'];
  const ramp = [hexToU32('#FFFFFF'), hexToU32(lightHex), hexToU32(darkHex)];
  fillEllipseDitheredPx(s, 7.5, 6.5, 6.8, 5.2, ramp);
  applyArcadeOutline(s, '#080810');

  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

// ============================================================================
// 3. 16-BIT PIXEL-ART MINIONS (SCARAB, POD FIGHTER, BLUE SPHERE, SPIKE MINE)
// ============================================================================
export function getScarabBeetleSprite(legFrame: 0 | 1): HTMLCanvasElement {
  const key = `minion:scarab:${legFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(20, 20);
  const shellRamp = [
    hexToU32('#FFD868'),
    hexToU32('#FFA028'),
    hexToU32('#D85C10'),
    hexToU32('#882C08')
  ];
  const greenMid = hexToU32('#38C840');
  const greenLight = hexToU32('#98F868');
  const hornCol = hexToU32('#FFE078');

  // 6 Animated Green-Black Insect Legs (left half, then mirrored)
  const shift = legFrame === 0 ? 0 : 1;
  drawLinePx(s, 5, 6, 2, 4 + shift, greenMid);
  drawLinePx(s, 2, 4 + shift, 1, 6 + shift, greenLight);

  drawLinePx(s, 4, 10, 1, 10 - shift, greenMid);
  drawLinePx(s, 1, 10 - shift, 1, 12 - shift, greenLight);

  drawLinePx(s, 5, 14, 2, 16 - shift, greenMid);
  drawLinePx(s, 2, 16 - shift, 2, 18, greenLight);

  // Front mandibles
  setPx(s, 7, 2, hornCol);
  setPx(s, 8, 3, hornCol);
  mirrorLeftToRight(s);

  // Domed Orange-Emerald Segmented Carapace (01-hedef-oynanis.jpg beetles!)
  fillEllipseDitheredPx(s, 9.5, 10.5, 5.2, 6.5, shellRamp);

  // Emerald thorax collar & central wing seam
  fillRectPx(s, 6, 7, 8, 2, greenMid);
  fillRectPx(s, 7, 7, 6, 1, greenLight);
  fillRectPx(s, 9, 9, 2, 7, greenMid);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getPodFighterSprite(pulseFrame: 0 | 1): HTMLCanvasElement {
  const key = `minion:pod:${pulseFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(20, 20);
  const wingLight = hexToU32('#F4F8FF');
  const wingMid = hexToU32('#B0C0DA');
  const wingDark = hexToU32('#687894');

  // Curved white lateral armor pods
  fillRectPx(s, 3, 4, 3, 12, wingLight);
  fillRectPx(s, 4, 3, 3, 14, wingMid);
  fillRectPx(s, 5, 6, 2, 8, wingDark);
  mirrorLeftToRight(s);

  // Pulsing Magenta-Purple Alien Core
  const coreRamp =
    pulseFrame === 0
      ? [hexToU32('#FFD0FA'), hexToU32('#EA48C8'), hexToU32('#881478')]
      : [hexToU32('#FFFFFF'), hexToU32('#FF68E0'), hexToU32('#A81C90')];
  fillEllipseDitheredPx(s, 9.5, 9.5, 4.2, 4.8, coreRamp);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getBlueSphereSprite(isMini: boolean, frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:sphere:${isMini ? 'm' : 'f'}:${frame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const sz = isMini ? 14 : 20;
  const s = createPixelSurface(sz, sz);
  const r = isMini ? 5.0 : 7.6;
  const ramp =
    frame === 0
      ? [hexToU32('#E8FCFF'), hexToU32('#58C8FF'), hexToU32('#1868E0'), hexToU32('#0A2C78')]
      : [hexToU32('#FFFFFF'), hexToU32('#78DCFF'), hexToU32('#247CF0'), hexToU32('#0E368C')];

  fillEllipseDitheredPx(s, (sz - 1) * 0.5, (sz - 1) * 0.5, r, r, ramp);
  applyArcadeOutline(s, '#080810');

  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getSpikeMineSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `minion:mine:${frame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(18, 18);
  const cSpike = hexToU32('#DCE6F4');
  // 8 directional pixel spikes
  drawLinePx(s, 9, 1, 9, 16, cSpike, 2);
  drawLinePx(s, 1, 9, 16, 9, cSpike, 2);
  drawLinePx(s, 3, 3, 14, 14, cSpike);
  drawLinePx(s, 14, 3, 3, 14, cSpike);

  const coreRamp = [
    hexToU32(frame === 0 ? '#FFE878' : '#FFFFFF'),
    hexToU32('#FF4020'),
    hexToU32('#687488'),
    hexToU32('#303848')
  ];
  fillEllipseDitheredPx(s, 8.5, 8.5, 5.2, 5.2, coreRamp);
  applyArcadeOutline(s, '#080810');

  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

// ============================================================================
// 4. 16-BIT PIXEL-ART BOSSES (ALL 10 ARCHETYPES!)
// ============================================================================
export type CentipedeColorVariant = 'YELLOW_GREEN' | 'GOLD' | 'CRIMSON';

function getCentipedeRamp(variant: CentipedeColorVariant): number[] {
  if (variant === 'GOLD') {
    return [
      hexToU32('#FFF498'),
      hexToU32('#F8B824'),
      hexToU32('#C86C10'),
      hexToU32('#743406')
    ];
  }
  if (variant === 'CRIMSON') {
    return [
      hexToU32('#FFA8C8'),
      hexToU32('#E82868'),
      hexToU32('#9C1444'),
      hexToU32('#520824')
    ];
  }
  // Stage 01 signature Yellow-Green Centipede (01-hedef-oynanis.jpg!)
  return [
    hexToU32('#F4FA68'),
    hexToU32('#B8DC28'),
    hexToU32('#38A830'),
    hexToU32('#18581C')
  ];
}

export function getCentipedeSegmentSprite(
  variant: CentipedeColorVariant,
  legFrame: 0 | 1
): HTMLCanvasElement {
  const key = `boss:centi:seg:${variant}:${legFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  // Oriented facing RIGHT (0 rad) so rotation matches atan2(dy, dx)!
  const s = createPixelSurface(20, 26);
  const ramp = getCentipedeRamp(variant);
  const cLegLight = hexToU32('#DCE6F4');
  const cLegMid = hexToU32('#7E8CA4');

  // Top & bottom curved steel centipede legs
  const bend = legFrame === 0 ? -2 : 2;
  drawLinePx(s, 10, 5, 8 + bend, 1, cLegLight, 2);
  drawLinePx(s, 8 + bend, 1, 5 + bend, 2, cLegMid);
  drawLinePx(s, 10, 20, 8 - bend, 24, cLegLight, 2);
  drawLinePx(s, 8 - bend, 24, 5 - bend, 23, cLegMid);

  // Segmented armored ring
  fillEllipseDitheredPx(s, 10, 12.5, 6.2, 7.5, ramp);
  // Central dark iron spine link
  fillRectPx(s, 5, 11, 10, 3, hexToU32('#384254'));
  fillRectPx(s, 6, 12, 8, 1, hexToU32('#98A8C0'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getCentipedeHeadSprite(
  variant: CentipedeColorVariant,
  jawFrame: 0 | 1
): HTMLCanvasElement {
  const key = `boss:centi:head:${variant}:${jawFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  // Oriented facing RIGHT (0 rad)
  const s = createPixelSurface(30, 30);
  const ramp = getCentipedeRamp(variant);
  const cClawLight = hexToU32('#E8F0FC');
  const cClawDark = hexToU32('#7A88A0');
  const open = jawFrame === 0 ? 0 : 2;

  // Giant curved silver pincer mandibles at front-right (`x: 18..28`)
  drawLinePx(s, 17, 8, 24, 4 - open, cClawLight, 2);
  drawLinePx(s, 24, 4 - open, 28, 8 - open, cClawDark, 2);
  drawLinePx(s, 17, 21, 24, 25 + open, cClawLight, 2);
  drawLinePx(s, 24, 25 + open, 28, 21 + open, cClawDark, 2);

  // Armored beetle-centipede head carapace
  fillEllipseDitheredPx(s, 12, 14.5, 9.5, 9.5, ramp);

  // Glowing compound eyes (`green` on gold/crimson, `emerald/crimson` highlight)
  const eyeCol = variant === 'YELLOW_GREEN' ? hexToU32('#28E838') : hexToU32('#FF3020');
  fillRectPx(s, 16, 9, 4, 3, eyeCol);
  fillRectPx(s, 16, 17, 4, 3, eyeCol);
  setPx(s, 17, 10, hexToU32('#FFFFFF'));
  setPx(s, 17, 18, hexToU32('#FFFFFF'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getLobsterMechaSprite(clawOpenFrame: 0 | 1): HTMLCanvasElement {
  const key = `boss:lobster:${clawOpenFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  // Facing RIGHT (0 rad), 46x44 arcade px
  const s = createPixelSurface(46, 44);
  const shellRamp = [
    hexToU32('#FFB868'),
    hexToU32('#E85824'),
    hexToU32('#A82414'),
    hexToU32('#5C0E0A')
  ];
  const clawRamp = [
    hexToU32('#FFF0A0'),
    hexToU32('#F07828'),
    hexToU32('#B82C18'),
    hexToU32('#68120C')
  ];

  // 6 Lateral crustacean legs
  for (let i = 0; i < 3; i++) {
    const lx = 10 + i * 6;
    drawLinePx(s, lx, 10, lx - 3, 2 + (i % 2), shellRamp[1], 2);
    drawLinePx(s, lx, 33, lx - 3, 41 - (i % 2), shellRamp[1], 2);
  }

  // Two Giant Hydraulic Front Crusher Claws (`x: 24..44`)
  const gap = clawOpenFrame === 1 ? 3 : 1;
  fillEllipseDitheredPx(s, 33, 9 - gap, 9, 5, clawRamp);
  fillEllipseDitheredPx(s, 35, 14, 7, 3, clawRamp);
  fillEllipseDitheredPx(s, 33, 34 + gap, 9, 5, clawRamp);
  fillEllipseDitheredPx(s, 35, 29, 7, 3, clawRamp);

  // Broad Armored Carapace
  fillEllipseDitheredPx(s, 17, 21.5, 13.5, 14.5, shellRamp);
  // Segment ribs & glowing yellow stalk eyes
  for (const rx of [11, 16, 21]) {
    drawLinePx(s, rx, 9, rx, 34, shellRamp[3]);
  }
  fillRectPx(s, 27, 16, 3, 3, hexToU32('#FFF058'));
  fillRectPx(s, 27, 24, 3, 3, hexToU32('#FFF058'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getBioWheelSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:biowheel:${frame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(42, 42);
  const cx = 20.5;
  const cy = 20.5;
  const greenRamp = [
    hexToU32('#B8FF70'),
    hexToU32('#38C840'),
    hexToU32('#187828'),
    hexToU32('#0A3C14')
  ];
  const podRamp = [hexToU32('#FFD0FF'), hexToU32('#D838B8'), hexToU32('#781468')];

  // 6 Rotating green armor paddles + glowing purple bio-capsules
  const baseAng = frame * 0.26;
  for (let i = 0; i < 6; i++) {
    const a = baseAng + (i * Math.PI) / 3;
    const px = cx + Math.cos(a) * 14.5;
    const py = cy + Math.sin(a) * 14.5;
    fillEllipseDitheredPx(s, px, py, 5.2, 5.2, greenRamp);

    const aPod = a + Math.PI / 6;
    const qx = cx + Math.cos(aPod) * 13.5;
    const qy = cy + Math.sin(aPod) * 13.5;
    fillEllipseDitheredPx(s, qx, qy, 3.8, 3.8, podRamp);
  }

  fillEllipseDitheredPx(s, cx, cy, 11.5, 11.5, greenRamp);
  fillEllipseDitheredPx(s, cx, cy, 5.5, 5.5, podRamp);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getMantisSprite(slashFrame: 0 | 1): HTMLCanvasElement {
  const key = `boss:mantis:${slashFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  // Facing RIGHT (0 rad)
  const s = createPixelSurface(44, 44);
  const bodyRamp = [
    hexToU32('#C8FF78'),
    hexToU32('#48C838'),
    hexToU32('#1C7824'),
    hexToU32('#0C3C12')
  ];
  const bladeRamp = [hexToU32('#FFFFFF'), hexToU32('#C8D8F0'), hexToU32('#687894')];

  const reach = slashFrame === 1 ? 5 : 0;
  // Serrated pixel scythe arms
  fillEllipseDitheredPx(s, 28 + reach, 9, 10, 3.8, bladeRamp);
  fillEllipseDitheredPx(s, 28 + reach, 34, 10, 3.8, bladeRamp);
  // Saw teeth
  for (let tx = 22; tx <= 34; tx += 4) {
    setPx(s, tx + reach, 13, hexToU32('#FFFFFF'));
    setPx(s, tx + reach, 30, hexToU32('#FFFFFF'));
  }

  // Thorax & segmented abdomen
  fillEllipseDitheredPx(s, 14, 21.5, 11, 9.5, bodyRamp);
  fillEllipseDitheredPx(s, 24, 21.5, 6.5, 7.5, bodyRamp);
  fillRectPx(s, 27, 16, 4, 3, hexToU32('#FF2820'));
  fillRectPx(s, 27, 24, 4, 3, hexToU32('#FF2820'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getCruiserCoreSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:cruiser:${frame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(46, 46);
  const hullRamp = [
    hexToU32('#E8F2FF'),
    hexToU32('#9AB0CC'),
    hexToU32('#586C88'),
    hexToU32('#2C384C')
  ];
  const coreRamp = [
    hexToU32('#FFF898'),
    hexToU32(frame === 0 ? '#FF6820' : '#FF3020'),
    hexToU32('#88140C')
  ];

  // 4 Directional cannon turrets
  fillRectPx(s, 19, 1, 8, 8, hullRamp[1]);
  fillRectPx(s, 19, 37, 8, 8, hullRamp[2]);
  fillRectPx(s, 1, 19, 8, 8, hullRamp[1]);
  fillRectPx(s, 37, 19, 8, 8, hullRamp[2]);

  // Octagonal riveted fortress hull
  fillEllipseDitheredPx(s, 22.5, 22.5, 16.5, 16.5, hullRamp);
  strokeRectPx(s, 12, 12, 22, 22, hexToU32('#182030'));
  fillEllipseDitheredPx(s, 22.5, 22.5, 7.5, 7.5, coreRamp);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getTwinHalfSprite(isRightHalf: boolean, pulseFrame: 0 | 1): HTMLCanvasElement {
  const key = `boss:twin:${isRightHalf ? 'R' : 'L'}:${pulseFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(26, 40);
  const ramp = isRightHalf
    ? [hexToU32('#C8F4FF'), hexToU32('#3898F8'), hexToU32('#1848A8'), hexToU32('#0A2058')]
    : [hexToU32('#FFF4A0'), hexToU32('#F0A824'), hexToU32('#A85810'), hexToU32('#582806')];

  const cx = isRightHalf ? 5 : 20;
  for (let y = 3; y < 37; y++) {
    for (let x = 2; x < 24; x++) {
      if ((isRightHalf && x < 5) || (!isRightHalf && x > 20)) continue;
      const nx = (x - cx) / 16.5;
      const ny = (y - 19.5) / 16.5;
      if (nx * nx + ny * ny <= 1.0) {
        const d = Math.hypot(nx, ny);
        setPx(s, x, y, bayerDitherColor(x, y, d, ramp, true));
      }
    }
  }
  // Glowing red-gold docking core on inner flat face
  const coreX = isRightHalf ? 5 : 17;
  fillRectPx(
    s,
    coreX,
    15,
    4,
    10,
    hexToU32(pulseFrame === 0 ? '#FF3820' : '#FFF070')
  );

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getMorphingCellSprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:cell:${frame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(42, 42);
  const cellRamp = [
    hexToU32('#B8FFD8'),
    hexToU32('#38D898'),
    hexToU32('#6838B8'),
    hexToU32('#341468')
  ];
  fillEllipseDitheredPx(s, 20.5, 20.5, 17, 15.5, cellRamp);
  // Multiple glowing alien nuclei eyes
  for (const [ex, ey] of [
    [14, 15],
    [26, 15],
    [20, 25]
  ]) {
    fillRectPx(s, ex - 2, ey - 2, 5, 5, hexToU32(frame === 0 ? '#FF3828' : '#FFE858'));
    setPx(s, ex - 1, ey - 1, hexToU32('#FFFFFF'));
  }

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getCyberSkullSprite(jawOpen: boolean): HTMLCanvasElement {
  const key = `boss:skull:${jawOpen ? 1 : 0}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(48, 54);
  const skullRamp = [
    hexToU32('#F4F8FF'),
    hexToU32('#B4C4DE'),
    hexToU32('#7284A4'),
    hexToU32('#42506C'),
    hexToU32('#222A3E')
  ];
  const cableRamp = [hexToU32('#B898E0'), hexToU32('#684898'), hexToU32('#341E58')];

  // Ribbed lateral power cables (left & mirrored right)
  for (let cy = 22; cy <= 40; cy += 4) {
    fillEllipseDitheredPx(s, 7, cy, 4.5, 2.5, cableRamp);
    fillEllipseDitheredPx(s, 40, cy, 4.5, 2.5, cableRamp);
  }

  // Articulating Mechanical Lower Jaw
  const jawY = jawOpen ? 37 : 33;
  for (let y = jawY; y < jawY + 13; y++) {
    for (let x = 14; x < 34; x++) {
      const t = Math.abs(x - 23.5) / 12;
      setPx(s, x, y, bayerDitherColor(x, y, t, skullRamp));
    }
  }
  if (jawOpen) {
    fillRectPx(s, 17, 33, 14, 5, hexToU32('#FF3018'));
    fillRectPx(s, 19, 34, 10, 3, hexToU32('#FFF078'));
  }
  // Pixel teeth grill
  for (let tx = 16; tx <= 30; tx += 3) {
    fillRectPx(s, tx, jawY + 2, 2, 5, hexToU32('#FFFFFF'));
  }

  // Cranium dome (`48x54` Bayer dithered)
  fillEllipseDitheredPx(s, 23.5, 20, 16.5, 16, skullRamp);

  // Forehead Gold Crest + Ruby Jewel
  fillRectPx(s, 20, 7, 8, 9, hexToU32('#F8C830'));
  fillRectPx(s, 22, 9, 4, 5, hexToU32('#E82020'));
  setPx(s, 22, 9, hexToU32('#FFFFFF'));

  // Deep black eye sockets + glowing red pixel pupils
  fillRectPx(s, 13, 19, 8, 6, hexToU32('#080A14'));
  fillRectPx(s, 27, 19, 8, 6, hexToU32('#080A14'));
  fillRectPx(s, 16, 21, 3, 3, hexToU32('#FF2820'));
  fillRectPx(s, 29, 21, 3, 3, hexToU32('#FF2820'));
  setPx(s, 16, 21, hexToU32('#FFF0A0'));
  setPx(s, 29, 21, hexToU32('#FFF0A0'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getOpticNerveBodySprite(frame: 0 | 1): HTMLCanvasElement {
  const key = `boss:optic:${frame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  // Facing RIGHT (0 rad)
  const s = createPixelSurface(38, 38);
  const scleraRamp = [
    hexToU32('#FFFFFF'),
    hexToU32('#E8D0DC'),
    hexToU32('#B8849C'),
    hexToU32('#78425C')
  ];
  fillEllipseDitheredPx(s, 19, 19, 15, 15, scleraRamp);
  // Crimson iris & slit pupil on right side
  fillEllipseDitheredPx(s, 25, 19, 6.5, 7.5, [
    hexToU32('#FFF078'),
    hexToU32(frame === 0 ? '#FF3020' : '#E81848'),
    hexToU32('#680818')
  ]);
  fillRectPx(s, 26, 15, 3, 8, hexToU32('#080810'));
  setPx(s, 24, 16, hexToU32('#FFFFFF'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getOpticTailNodeSprite(): HTMLCanvasElement {
  const key = 'boss:optic:node';
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(12, 12);
  fillEllipseDitheredPx(s, 5.5, 5.5, 4.2, 4.2, [
    hexToU32('#FFA8C8'),
    hexToU32('#B83868'),
    hexToU32('#581430')
  ]);
  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getAlienBrainSprite(shuttersOpen: boolean): HTMLCanvasElement {
  const key = `boss:brain:${shuttersOpen ? 1 : 0}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(56, 52);
  const brainRamp = [
    hexToU32('#FFC8F0'),
    hexToU32('#E858B0'),
    hexToU32('#A82878'),
    hexToU32('#5C1044')
  ];
  const armorRamp = [
    hexToU32('#E8F0FC'),
    hexToU32('#98A8C4'),
    hexToU32('#52607A'),
    hexToU32('#283042')
  ];

  // Convoluted pink-purple alien brain lobes
  fillEllipseDitheredPx(s, 27.5, 25.5, 21, 18.5, brainRamp);
  for (let fy = 12; fy <= 38; fy += 5) {
    drawLinePx(s, 11, fy, 25, fy + (fy % 2 === 0 ? 2 : -2), hexToU32('#480834'));
    drawLinePx(s, 30, fy, 44, fy + (fy % 2 === 0 ? -2 : 2), hexToU32('#480834'));
  }
  fillRectPx(s, 27, 8, 2, 35, hexToU32('#480834'));

  // Central optic core
  fillEllipseDitheredPx(s, 27.5, 25.5, 6.5, 6.5, [
    hexToU32('#FFFFFF'),
    hexToU32('#FF3820'),
    hexToU32('#780810')
  ]);

  // 4 Opening/Closing Steel Armor Shutters
  const off = shuttersOpen ? 6 : 1;
  drawRivetedShutter(s, 4 - Math.min(3, off), 4, 16, 15, armorRamp);
  drawRivetedShutter(s, 36 + Math.min(3, off), 4, 16, 15, armorRamp);
  drawRivetedShutter(s, 4 - Math.min(3, off), 33, 16, 15, armorRamp);
  drawRivetedShutter(s, 36 + Math.min(3, off), 33, 16, 15, armorRamp);

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

function drawRivetedShutter(
  s: PixelSurface,
  x: number,
  y: number,
  w: number,
  h: number,
  ramp: readonly number[]
): void {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      setPx(s, px, py, bayerDitherColor(px, py, (py - y) / h, ramp));
    }
  }
  strokeRectPx(s, x, y, w, h, hexToU32('#141A28'));
}

// ============================================================================
// 5. MENU & CONTROL PANEL 16-BIT PIXEL SPRITES (01 & 02 REFERENCE IMAGES!)
// ============================================================================
export function getArcadeJoystickSprite(dir: Direction | null): HTMLCanvasElement {
  const key = `ui:joy:${dir ?? 'C'}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(48, 54);
  const baseRamp = [
    hexToU32('#4A5468'),
    hexToU32('#2C3240'),
    hexToU32('#181C26'),
    hexToU32('#0C0E16')
  ];
  const shaftRamp = [hexToU32('#FFFFFF'), hexToU32('#AAB6CA'), hexToU32('#546074')];
  const ballRamp = [
    hexToU32('#FFD0C8'),
    hexToU32('#FF3824'),
    hexToU32('#C81814'),
    hexToU32('#780A0A')
  ];

  // Dark beveled oval base washer at bottom (`cy = 40`)
  fillEllipseDitheredPx(s, 23.5, 41, 18.5, 9.5, baseRamp);
  fillEllipseDitheredPx(s, 23.5, 40, 12.5, 6.2, [
    hexToU32('#282E3C'),
    hexToU32('#121620')
  ]);

  // Directional ball-top offset (tilts realistically when thumb pushes!)
  let bx = 23.5;
  let by = 18;
  if (dir === 'LEFT') bx -= 6;
  if (dir === 'RIGHT') bx += 6;
  if (dir === 'UP') by -= 5;
  if (dir === 'DOWN') by += 5;

  // Steel joystick shaft connecting `(23.5, 39)` -> `(bx, by + 6)`
  drawLinePx(s, 23, 39, Math.round(bx) - 1, Math.round(by + 6), shaftRamp[0], 2);
  drawLinePx(s, 25, 39, Math.round(bx) + 1, Math.round(by + 6), shaftRamp[2], 2);

  // Glossy Red Pixel Ball-Top (`r = 12`)
  fillEllipseDitheredPx(s, bx, by, 12.2, 11.8, ballRamp, -0.36, -0.38);
  fillRectPx(s, Math.round(bx - 5), Math.round(by - 6), 3, 3, hexToU32('#FFFFFF'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getArcadeCutButtonSprite(pressed: boolean): HTMLCanvasElement {
  const key = `ui:cutbtn:${pressed ? 1 : 0}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(50, 40);
  const rimRamp = [hexToU32('#B82820'), hexToU32('#7C1210'), hexToU32('#440808')];
  const capRamp = [
    hexToU32('#FFB8AC'),
    hexToU32('#F43420'),
    hexToU32('#C41812'),
    hexToU32('#840C0A')
  ];

  // Outer red arcade button collar (`cy = 23`)
  fillEllipseDitheredPx(s, 24.5, 24, 21.5, 12.5, rimRamp);

  // Plunger cap (sinks 3 arcade pixels down when pressed!)
  const capY = pressed ? 21 : 17.5;
  fillEllipseDitheredPx(s, 24.5, capY + 3, 17.5, 9.5, [hexToU32('#98120E'), hexToU32('#5C0808')]);
  fillEllipseDitheredPx(s, 24.5, capY, 17.5, 9.5, capRamp, -0.25, -0.4);
  // Crisp highlight arc on convex button top
  fillRectPx(s, 16, Math.round(capY - 5), 14, 2, hexToU32('#FF9888'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getPadlockPixelSprite(): HTMLCanvasElement {
  const key = 'ui:padlock';
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(12, 14);
  const cGoldLight = hexToU32('#FFF088');
  const cGold = hexToU32('#F8B828');
  const cGoldDark = hexToU32('#A86C08');
  const cShackle = hexToU32('#DCE6F4');

  // Steel shackle arch
  fillRectPx(s, 3, 2, 6, 4, cShackle);
  fillRectPx(s, 4, 3, 4, 3, 0);

  // Golden lock body + keyhole
  fillRectPx(s, 2, 6, 8, 7, cGold);
  fillRectPx(s, 2, 6, 8, 1, cGoldLight);
  fillRectPx(s, 2, 12, 8, 1, cGoldDark);
  fillRectPx(s, 5, 8, 2, 3, hexToU32('#080810'));

  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

export function getPixelStarSprite(earned: boolean): HTMLCanvasElement {
  const key = `ui:star:${earned ? 1 : 0}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const rows = [
    '....##....',
    '....##....',
    '...####...',
    '##########',
    '.########.',
    '..######..',
    '..######..',
    '.###..###.',
    '##......##'
  ];
  const s = createPixelSurface(12, 11);
  const cTop = hexToU32(earned ? '#FFF898' : '#4E5A72');
  const cBot = hexToU32(earned ? '#F0A818' : '#2E3648');

  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < 10; x++) {
      if (rows[y][x] === '#') {
        setPx(s, x + 1, y + 1, y < 4 ? cTop : cBot);
      }
    }
  }
  applyArcadeOutline(s, '#080810');
  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

/**
 * Generates the iconic `02-hedef-ana-menu.jpg` 16-bit Pixel-Art Emerald Wireframe Planet
 * + Diagonal Blazing Orange Pixel Laser Slash + Banking Twin-Prong Fighter (`132 x 124` arcade px)!
 */
export function getMenuPlanetHeroSprite(): HTMLCanvasElement {
  const key = 'ui:heroplanet';
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(136, 126);
  const cx = 68;
  const cy = 65;
  const r = 54;

  const globeRamp = [
    hexToU32('#34BA54'),
    hexToU32('#1C8838'),
    hexToU32('#0E5624'),
    hexToU32('#073216'),
    hexToU32('#031A0B')
  ];
  const cGrid = hexToU32('#48F468');
  const cRim = hexToU32('#38E858');

  // 1. Bayer-dithered green sphere
  for (let py = cy - r; py <= cy + r; py++) {
    for (let px = cx - r; px <= cx + r; px++) {
      const nx = (px - cx) / r;
      const ny = (py - cy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1.0) continue;
      const distLight = Math.hypot(nx + 0.28, ny + 0.28) / 1.45;
      setPx(s, px, py, bayerDitherColor(px, py, distLight, globeRamp, true));
    }
  }

  // 2. Crisp pixel latitude & longitude wireframe lines clipped to sphere
  for (const lat of [-0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72]) {
    const ly = cy + lat * r;
    const rx = Math.sqrt(Math.max(0, 1 - lat * lat)) * r;
    for (let a = 0; a < Math.PI * 2; a += 0.03) {
      const px = Math.round(cx + Math.cos(a) * rx);
      const py = Math.round(ly + Math.sin(a) * rx * 0.16);
      if (Math.hypot(px - cx, py - cy) <= r - 1) {
        setPx(s, px, py, cGrid);
      }
    }
  }
  for (const lonFactor of [-0.82, -0.52, -0.22, 0.08, 0.38, 0.68]) {
    for (let t = -1; t <= 1; t += 0.015) {
      const py = Math.round(cy + t * r);
      const span = Math.sqrt(Math.max(0, 1 - t * t)) * r;
      const px = Math.round(cx + lonFactor * span);
      if (Math.hypot(px - cx, py - cy) <= r - 1) {
        setPx(s, px, py, cGrid);
      }
    }
  }

  // Outer emerald pixel ring
  for (let a = 0; a < Math.PI * 2; a += 0.01) {
    setPx(s, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), cRim);
  }

  // 3. Diagonal Orange-White Pixel Laser Trail (`(18, 110)` -> `(92, 34)`)
  for (let i = 0; i <= 76; i++) {
    const t = i / 76;
    const lx = 18 + t * 74;
    const ly = 110 - t * 76;
    const thick = 1 + Math.floor(t * 4);
    drawLinePx(s, lx - 1, ly + 1, lx + 1, ly - 1, hexToU32('#D84810'), thick + 2);
    drawLinePx(s, lx, ly, lx, ly, hexToU32('#FFA828'), thick);
    if (t > 0.35) {
      setPx(s, Math.round(lx), Math.round(ly), hexToU32('#FFF8B8'));
    }
  }

  // 4. Detailed 45-degree Banking Twin-Prong Starfighter at `(101, 24)` (`02-hedef-ana-menu.jpg`!)
  const cHullLight = hexToU32('#F0F6FF');
  const cHullMid = hexToU32('#A4B2C8');
  const cHullDark = hexToU32('#58647A');
  const cRed = hexToU32('#E82820');

  // Left-upper prong & right-lower prong along (+1, -1) diagonal
  drawLinePx(s, 91, 23, 108, 6, cHullLight, 3);
  drawLinePx(s, 99, 31, 116, 14, cHullMid, 3);
  // Central body & red cockpit pods
  drawLinePx(s, 92, 30, 104, 18, cHullLight, 5);
  drawLinePx(s, 88, 24, 94, 18, cHullDark, 3);
  drawLinePx(s, 98, 34, 104, 28, cHullDark, 3);
  fillRectPx(s, 96, 22, 4, 4, cRed);
  fillRectPx(s, 89, 21, 3, 3, cRed);
  fillRectPx(s, 100, 32, 3, 3, cRed);
  setPx(s, 109, 5, cRed);
  setPx(s, 117, 13, cRed);

  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}

// ============================================================================
// V5 SOLID WALL BLOCKS (impassable riveted steel towers, 20x20 arcade px face)
// ============================================================================
export type SolidWallVariant = 'STEEL' | 'GOLD' | 'ARMOR';

/**
 * Riveted steel tower face with 4 corner rivets.
 * - `STEEL`: standard power-up wall (red ruby gem)
 * - `GOLD`: special super-shot wall (gold frame + big ruby)
 * - `ARMOR`: blind armor pillar (no gem, diagonal riveted cross plate)
 */
export function getSolidWallSprite(variant: SolidWallVariant, gemBrightFrame: 0 | 1): HTMLCanvasElement {
  const key = `wall:${variant}:${gemBrightFrame}`;
  const cached = SPRITE_CACHE.get(key);
  if (cached) return cached;

  const s = createPixelSurface(20, 20);
  const cBlack = hexToU32('#080810');
  const isGold = variant === 'GOLD';
  const isArmor = variant === 'ARMOR';

  const cTop = hexToU32(isGold ? '#FFF290' : isArmor ? '#B8C0CC' : '#DCE4F0');
  const cMid = hexToU32(isGold ? '#F0B824' : isArmor ? '#6C7484' : '#8E98AA');
  const cBot = hexToU32(isGold ? '#946208' : isArmor ? '#363C4A' : '#4C5464');
  const cRivet = hexToU32(isGold ? '#FFFBD0' : '#F4F8FF');
  const cRivetShadow = hexToU32('#2A2E3A');

  fillRectPx(s, 0, 0, 20, 20, cBlack);
  for (let y = 1; y < 19; y++) {
    for (let x = 1; x < 19; x++) {
      if (x >= 4 && x <= 15 && y >= 4 && y <= 15) {
        setPx(s, x, y, cMid);
      } else if (x + y < 19) {
        setPx(s, x, y, cTop);
      } else if (x + y > 19) {
        setPx(s, x, y, cBot);
      } else {
        setPx(s, x, y, cMid);
      }
    }
  }
  strokeRectPx(s, 4, 4, 12, 12, cBlack);

  // 4 corner rivets on the bevel
  for (const [rx, ry] of [
    [2, 2],
    [17, 2],
    [2, 17],
    [17, 17]
  ]) {
    setPx(s, rx, ry, cRivet);
    setPx(s, rx + 1 > 18 ? rx : rx + 1, ry + 1 > 18 ? ry : ry + 1, cRivetShadow);
  }

  if (isArmor) {
    // Diagonal riveted cross plate (no gem -> blind pillar)
    const cPlate = hexToU32('#9AA2B2');
    const cPlateDark = hexToU32('#40465A');
    for (let i = 5; i <= 14; i++) {
      setPx(s, i, i, cPlate);
      setPx(s, 19 - i, i, cPlate);
      setPx(s, i + 1 > 14 ? i : i + 1, i, cPlateDark);
    }
    for (const [rx, ry] of [
      [6, 6],
      [13, 6],
      [6, 13],
      [13, 13],
      [9, 9]
    ]) {
      setPx(s, rx, ry, cRivet);
    }
  } else {
    fillRectPx(s, 6, 6, 8, 8, hexToU32('#181C28'));
    const cGemDark = hexToU32('#880A12');
    const cGemMid = hexToU32(gemBrightFrame === 1 ? '#FF3028' : '#D81820');
    const cGemGlint = hexToU32('#FFB8B8');
    const rStart = isGold ? 6 : 7;
    const rSize = isGold ? 8 : 6;
    fillRectPx(s, rStart, rStart, rSize, rSize, cGemDark);
    fillRectPx(s, rStart, rStart, rSize - 1, rSize - 1, cGemMid);
    const socket = hexToU32('#181C28');
    setPx(s, rStart, rStart, socket);
    setPx(s, rStart + rSize - 1, rStart, socket);
    setPx(s, rStart, rStart + rSize - 1, socket);
    setPx(s, rStart + rSize - 1, rStart + rSize - 1, socket);
    setPx(s, rStart + 1, rStart + 1, hexToU32('#FFFFFF'));
    setPx(s, rStart + 2, rStart + 1, cGemGlint);
    setPx(s, rStart + 1, rStart + 2, cGemGlint);
  }

  const out = commitPixelSurface(s);
  SPRITE_CACHE.set(key, out);
  return out;
}
