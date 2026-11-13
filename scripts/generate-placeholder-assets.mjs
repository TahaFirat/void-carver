import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT_DIR = process.cwd();
const RESOURCES_DIR = path.join(ROOT_DIR, 'resources');

// Precomputed CRC32 table for compliant PNG chunk encoding
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(typeStr, dataBuf) {
  const typeBuf = Buffer.from(typeStr, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);

  const crcInput = Buffer.concat([typeBuf, dataBuf]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

/**
 * Encodes a 24-bit Truecolor RGB buffer (3 bytes per pixel, NO ALPHA CHANNEL, colorType = 2)
 * into a compliant PNG file (passes Apple App Store ITMS opaque icon validation).
 */
function encodeRgbPng(width, height, rgbPixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit per channel
  ihdr[9] = 2; // Color Type 2 = Truecolor RGB (ZERO ALPHA!)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowStride = width * 3 + 1;
  const rawData = Buffer.alloc(rowStride * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowStride;
    rawData[rowStart] = 0; // Filter type 0
    const srcStart = y * width * 3;
    rgbPixels.copy(rawData, rowStart + 1, srcStart, srcStart + width * 3);
  }

  const compressed = zlib.deflateSync(rawData, { level: 6 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5]
];

function hexRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

// Twin-prong 16-bit pixel fighter sprite (16x16, pointing UP)
const SHIP_SPRITE_16 = [
  '....KK....KK....',
  '...KWWK..KWWK...',
  '...KWMMKKMMWK...',
  '..KWM.RRRR.MWK..',
  '..KWM.RYYR.MWK..',
  '.KWMM.RRRR.MMWK.',
  '.KWMMMKKKKMMMWK.',
  'KWMMMMWWWWMMMMWK',
  'KWMMDDDDDDDDMMWK',
  'KWMDRRDDDDDDRMWK',
  'KKK.KDDDDDDK.KKK',
  '....KK.OO.KK....',
  '......OYYO......',
  '......OOOO......',
  '.......OO.......',
  '................'
];

const SHIP_COLORS = {
  K: hexRgb('#080810'),
  W: hexRgb('#F0F6FF'),
  M: hexRgb('#A8B8D0'),
  D: hexRgb('#54627A'),
  R: hexRgb('#E82820'),
  Y: hexRgb('#FFF498'),
  O: hexRgb('#FF7810')
};

/**
 * Builds a genuine 64x64 16-bit pixel-art emblem canvas:
 * - Starry `#04060E` space backdrop
 * - 3D Gold-Silver Pixel Frame with 4 corner blocks
 * - Green Wireframe Planet (`#28E038` / `#107824` lat-long grid + Bayer 4x4 dithering)
 * - Bright Green Safe Border + 90-degree Orange-Gold Laser Trail
 * - Red-Ruby Steel Block + Twin-Prong Fighter with Circular Green Shield Aura
 */
function buildPixelEmblem64() {
  const N = 64;
  const grid = new Uint8Array(N * N * 3);

  const setP = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    const idx = (y * N + x) * 3;
    grid[idx] = rgb[0];
    grid[idx + 1] = rgb[1];
    grid[idx + 2] = rgb[2];
  };

  const cBg = hexRgb('#04060E');
  const cBlack = hexRgb('#080810');
  const cGoldLight = hexRgb('#FFF088');
  const cGoldMid = hexRgb('#E8B428');
  const cGoldDark = hexRgb('#8C5808');
  const cSteelLight = hexRgb('#DCE6F8');
  const cSteelMid = hexRgb('#74829C');
  const cSteelDark = hexRgb('#384258');
  const cGreenBright = hexRgb('#98FF70');
  const cGreenMid = hexRgb('#28E038');
  const cGreenDark = hexRgb('#0E641C');
  const cPlanetCore = hexRgb('#082A14');
  const cCutOrange = hexRgb('#FF7810');
  const cCutCore = hexRgb('#FFF4A0');
  const cRuby = hexRgb('#E82420');

  // 1. Space fill + pixel stars
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      setP(x, y, cBg);
    }
  }
  const stars = [
    [9, 10],
    [52, 11],
    [12, 48],
    [54, 49],
    [28, 9],
    [48, 24],
    [10, 29]
  ];
  for (const [sx, sy] of stars) {
    setP(sx, sy, hexRgb('#98B4E8'));
  }

  // 2. 3D Gold-Silver Pixel Frame (outer margin 2..61, thickness 4px)
  for (let y = 2; y < N - 2; y++) {
    for (let x = 2; x < N - 2; x++) {
      const inInner = x >= 6 && x < N - 6 && y >= 6 && y < N - 6;
      if (inInner) continue;
      const d = Math.min(x - 2, y - 2, N - 3 - x, N - 3 - y);
      if (d === 0 || d === 3) setP(x, y, cBlack);
      else if (d === 1) setP(x, y, x + y < N ? cGoldLight : cGoldMid);
      else setP(x, y, x + y < N ? cGoldMid : cGoldDark);
    }
  }

  // 4 Corner Blocks (6x6 each)
  const corners = [
    [2, 2],
    [N - 8, 2],
    [2, N - 8],
    [N - 8, N - 8]
  ];
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < 6; dy++) {
      for (let dx = 0; dx < 6; dx++) {
        if (dx === 0 || dy === 0 || dx === 5 || dy === 5) setP(cx + dx, cy + dy, cBlack);
        else if (dx >= 2 && dx <= 3 && dy >= 2 && dy <= 3) setP(cx + dx, cy + dy, cSteelLight);
        else setP(cx + dx, cy + dy, dx + dy < 5 ? cGoldLight : cGoldMid);
      }
    }
  }

  // 3. Green Wireframe Planet centered at (30, 31), radius 19
  const pcx = 30;
  const pcy = 31;
  const prad = 19;
  for (let y = pcy - prad - 1; y <= pcy + prad + 1; y++) {
    for (let x = pcx - prad - 1; x <= pcx + prad + 1; x++) {
      const dx = x - pcx;
      const dy = y - pcy;
      const dist = Math.hypot(dx, dy);
      if (dist <= prad + 0.8 && dist > prad - 0.5) {
        setP(x, y, cBlack);
      } else if (dist <= prad - 0.5) {
        const nx = dx / prad;
        const ny = dy / prad;
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const lat = Math.asin(ny);
        const lon = Math.atan2(nx, nz);

        const latGrid = Math.abs(((lat * 180) / Math.PI) % 24);
        const lonGrid = Math.abs(((lon * 180) / Math.PI) % 26);
        const onWire =
          latGrid < 4.2 ||
          latGrid > 19.8 ||
          lonGrid < 4.5 ||
          lonGrid > 21.5 ||
          dist > prad - 1.8;

        const bayer = BAYER_4X4[y & 3][x & 3] / 16;
        const light = Math.max(0, -nx * 0.45 - ny * 0.45 + nz * 0.75);

        if (onWire) {
          setP(x, y, light + bayer * 0.25 > 0.62 ? cGreenBright : cGreenMid);
        } else {
          setP(x, y, light > bayer * 0.85 ? cGreenDark : cPlanetCore);
        }
      }
    }
  }

  // 4. Safe Bright Green Perimeter inside Gold Frame (x = 7..56, y = 7..56)
  for (let i = 7; i <= 56; i++) {
    setP(i, 7, cGreenMid);
    setP(i, 56, cGreenMid);
    setP(7, i, cGreenMid);
    setP(56, i, cGreenMid);
  }

  // 5. Red-Ruby Energy Block at bottom-left (14, 43, 8x8)
  for (let dy = 0; dy < 8; dy++) {
    for (let dx = 0; dx < 8; dx++) {
      const bx = 13 + dx;
      const by = 43 + dy;
      if (dx === 0 || dy === 0 || dx === 7 || dy === 7) setP(bx, by, cBlack);
      else if (dx >= 2 && dx <= 5 && dy >= 2 && dy <= 5) {
        setP(bx, by, dx === 2 && dy === 2 ? cCutCore : cRuby);
      } else {
        setP(bx, by, dx + dy < 7 ? cSteelLight : cSteelDark);
      }
    }
  }

  // 6. 90-Degree Orange-Gold Laser Cut Path from bottom safe border (x=43, y=56 -> y=36 -> x=36 -> y=25)
  const drawLaserSeg = (x1, y1, x2, y2) => {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        setP(x - 1, y, cCutOrange);
        setP(x + 1, y, cCutOrange);
        setP(x, y - 1, cCutOrange);
        setP(x, y + 1, cCutOrange);
      }
    }
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        setP(x, y, cCutCore);
      }
    }
  };
  drawLaserSeg(45, 55, 45, 40);
  drawLaserSeg(36, 40, 45, 40);
  drawLaserSeg(36, 26, 36, 40);

  // 7. Circular Green Pixel Shield Ring + Twin-Prong Ship at (36, 22)
  const scx = 36;
  const scy = 21;
  for (let y = scy - 11; y <= scy + 11; y++) {
    for (let x = scx - 11; x <= scx + 11; x++) {
      const d = Math.hypot(x - scx, y - scy);
      if (d >= 9.6 && d <= 10.9 && (x + y) % 2 === 0) {
        setP(x, y, cGreenBright);
      }
    }
  }

  for (let sy = 0; sy < 16; sy++) {
    const row = SHIP_SPRITE_16[sy];
    for (let sx = 0; sx < 16; sx++) {
      const ch = row[sx];
      if (ch !== '.' && SHIP_COLORS[ch]) {
        setP(scx - 8 + sx, scy - 8 + sy, SHIP_COLORS[ch]);
      }
    }
  }

  return grid;
}

/**
 * Nearest-neighbor upscales the 64x64 16-bit pixel emblem onto a target 24-bit RGB buffer
 * with ZERO anti-aliasing blur and ZERO alpha channel.
 */
function renderPixelEmblemRgb(width, height, emblemScale = 1.0) {
  const emblem = buildPixelEmblem64();
  const N = 64;
  const buf = Buffer.alloc(width * height * 3);
  const bg = hexRgb('#04060E');

  const boxSize = Math.round(Math.min(width, height) * emblemScale);
  const left = Math.floor((width - boxSize) * 0.5);
  const top = Math.floor((height - boxSize) * 0.5);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const outIdx = (y * width + x) * 3;
      if (x >= left && x < left + boxSize && y >= top && y < top + boxSize) {
        const gx = Math.min(N - 1, Math.floor(((x - left) * N) / boxSize));
        const gy = Math.min(N - 1, Math.floor(((y - top) * N) / boxSize));
        const srcIdx = (gy * N + gx) * 3;
        buf[outIdx] = emblem[srcIdx];
        buf[outIdx + 1] = emblem[srcIdx + 1];
        buf[outIdx + 2] = emblem[srcIdx + 2];
      } else {
        buf[outIdx] = bg[0];
        buf[outIdx + 1] = bg[1];
        buf[outIdx + 2] = bg[2];
      }
    }
  }

  return encodeRgbPng(width, height, buf);
}

function renderSolidSpaceBackdropRgb(width, height) {
  const buf = Buffer.alloc(width * height * 3);
  const bg = hexRgb('#04060E');
  for (let i = 0; i < buf.length; i += 3) {
    buf[i] = bg[0];
    buf[i + 1] = bg[1];
    buf[i + 2] = bg[2];
  }
  return encodeRgbPng(width, height, buf);
}

fs.mkdirSync(RESOURCES_DIR, { recursive: true });

console.log(
  'Generating V4 16-Bit Pixel-Art 1024x1024 opaque App Store & Play Store icons (24-bit RGB, zero alpha)...'
);
const iconPng = renderPixelEmblemRgb(1024, 1024, 1.0);
fs.writeFileSync(path.join(RESOURCES_DIR, 'icon-only.png'), iconPng);

const iconFgPng = renderPixelEmblemRgb(1024, 1024, 0.76);
fs.writeFileSync(path.join(RESOURCES_DIR, 'icon-foreground.png'), iconFgPng);

const iconBgPng = renderSolidSpaceBackdropRgb(1024, 1024);
fs.writeFileSync(path.join(RESOURCES_DIR, 'icon-background.png'), iconBgPng);

console.log('Generating V4 16-Bit Pixel-Art 2732x2732 Splash screens (#04060E)...');
const splashPng = renderPixelEmblemRgb(2732, 2732, 0.42);
fs.writeFileSync(path.join(RESOURCES_DIR, 'splash.png'), splashPng);
fs.writeFileSync(path.join(RESOURCES_DIR, 'splash-dark.png'), splashPng);

console.log('✓ All V4 16-Bit Pixel-Art store source assets generated in resources/ successfully.');
