import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE,
  PIXEL_SCALE,
  SHIP_SKINS,
  ShipSkinId
} from '../core/Config';
import { LevelClearBreakdown } from '../core/ScoreSystem';
import {
  blitPixelSprite,
  commitPixelSurface,
  createPixelSurface,
  drawPixelText,
  fillRectPx,
  hexToU32,
  PixelSurface,
  setPx
} from '../rendering/PixelArtEngine';
import {
  getMenuPlanetHeroSprite,
  getPixelStarSprite,
  getPlayerShipSprite
} from '../rendering/VolfiedSprites';
import { GameSaveData, StorageService } from '../services/StorageService';
import { ColumnTransform, getLayout } from '../core/ResponsiveLayout';

export type ScreenState =
  | 'MAIN_MENU'
  | 'SECTOR_SELECT'
  | 'HANGAR'
  | 'ACHIEVEMENTS'
  | 'SETTINGS'
  | 'PLAYING'
  | 'PAUSED'
  | 'SECOND_CHANCE'
  | 'REWARDED_AD_SIM'
  | 'LEVEL_CLEAR'
  | 'GAME_OVER'
  | 'CAMPAIGN_VICTORY';

export interface UiButtonRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function isShipSkinId(val: string): val is ShipSkinId {
  return SHIP_SKINS.some((s) => s.id === val);
}

interface StarSpec {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  color: string;
}

const SPACE_STARS: StarSpec[] = Array.from({ length: 84 }, (_, idx) => {
  const seed1 = (idx * 7919 + 104729) % 10000;
  const seed2 = (idx * 6151 + 524287) % 10000;
  const cols = ['#FFFFFF', '#98D4FF', '#FFE088', '#68F098', '#B8C8E8'];
  return {
    x: Math.floor((seed1 / 10000) * CANVAS_WIDTH),
    y: Math.floor((seed2 / 10000) * CANVAS_HEIGHT),
    size: idx % 9 === 0 ? 6 : 3,
    speed: 9 + (idx % 4) * 6,
    phase: idx * 0.77,
    color: cols[idx % cols.length]
  };
});

function formatScoreDigits(val: number, len = 7): string {
  return Math.max(0, Math.floor(val)).toString().padStart(len, '0');
}

function formatGroupedScore(val: number): string {
  const n = Math.max(0, Math.floor(val));
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

let cachedTitleLogo: HTMLCanvasElement | null = null;

const LOGO_FONT_8X11: Record<string, readonly string[]> = {
  V: [
    '##....##',
    '##....##',
    '##....##',
    '##....##',
    '##....##',
    '.##..##.',
    '.##..##.',
    '..####..',
    '..####..',
    '...##...',
    '...##...'
  ],
  O: [
    '.######.',
    '########',
    '##....##',
    '##....##',
    '##....##',
    '##....##',
    '##....##',
    '##....##',
    '##....##',
    '########',
    '.######.'
  ],
  I: [
    '.######.',
    '.######.',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
    '.######.',
    '.######.'
  ],
  D: [
    '######..',
    '#######.',
    '##...###',
    '##....##',
    '##....##',
    '##....##',
    '##....##',
    '##....##',
    '##...###',
    '#######.',
    '######..'
  ],
  C: [
    '.######.',
    '########',
    '##....##',
    '##......',
    '##......',
    '##......',
    '##......',
    '##......',
    '##....##',
    '########',
    '.######.'
  ],
  A: [
    '..####..',
    '.######.',
    '##....##',
    '##....##',
    '##....##',
    '########',
    '########',
    '##....##',
    '##....##',
    '##....##',
    '##....##'
  ],
  R: [
    '#######.',
    '########',
    '##....##',
    '##....##',
    '########',
    '#######.',
    '##...##.',
    '##....##',
    '##....##',
    '##....##',
    '##....##'
  ],
  E: [
    '########',
    '########',
    '##......',
    '##......',
    '######..',
    '######..',
    '##......',
    '##......',
    '##......',
    '########',
    '########'
  ]
};

function getVoidCarverLogoSprite(): HTMLCanvasElement {
  if (cachedTitleLogo) return cachedTitleLogo;

  const text = 'VOID CARVER';
  const s: PixelSurface = createPixelSurface(244, 38);

  const cBlack = hexToU32('#080810');
  const cRedBevel = hexToU32('#D82818');
  const cOrangeBevel = hexToU32('#FF7820');
  const chromeRows = [
    hexToU32('#FFFFFF'),
    hexToU32('#E8F4FF'),
    hexToU32('#B4CCE8'),
    hexToU32('#748CB0'),
    hexToU32('#384868'),
    hexToU32('#FFFFFF'),
    hexToU32('#FFE8A8'),
    hexToU32('#E0A858'),
    hexToU32('#B8CCE4'),
    hexToU32('#DCE8F8'),
    hexToU32('#8CA4C4')
  ];

  let cursorX = 8;
  for (const ch of text) {
    if (ch === ' ') {
      cursorX += 12;
      continue;
    }
    const glyph = LOGO_FONT_8X11[ch];
    if (!glyph) continue;
    for (let gy = 0; gy < 11; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        if (glyph[gy][gx] !== '#') continue;
        const px = cursorX + gx * 2;
        const py = 6 + gy * 2;
        fillRectPx(s, px - 2, py - 2, 6, 6, cBlack);
        fillRectPx(s, px + 1, py + 3, 3, 3, cBlack);
      }
    }
    cursorX += 20;
  }

  cursorX = 8;
  for (const ch of text) {
    if (ch === ' ') {
      cursorX += 12;
      continue;
    }
    const glyph = LOGO_FONT_8X11[ch];
    if (!glyph) continue;
    for (let gy = 0; gy < 11; gy++) {
      for (let gx = 0; gx < 8; gx++) {
        if (glyph[gy][gx] !== '#') continue;
        const px = cursorX + gx * 2;
        const py = 6 + gy * 2;
        fillRectPx(s, px - 1, py - 1, 4, 5, gy < 5 ? cOrangeBevel : cRedBevel);
      }
    }
    cursorX += 20;
  }

  cursorX = 8;
  for (const ch of text) {
    if (ch === ' ') {
      cursorX += 12;
      continue;
    }
    const glyph = LOGO_FONT_8X11[ch];
    if (!glyph) continue;
    for (let gy = 0; gy < 11; gy++) {
      const col = chromeRows[gy];
      for (let gx = 0; gx < 8; gx++) {
        if (glyph[gy][gx] !== '#') continue;
        const px = cursorX + gx * 2;
        const py = 6 + gy * 2;
        fillRectPx(s, px, py, 2, 2, col);
      }
    }
    cursorX += 20;
  }

  setPx(s, 10, 6, hexToU32('#FFFFFF'));
  setPx(s, 104, 6, hexToU32('#FFFFFF'));

  cachedTitleLogo = commitPixelSurface(s);
  return cachedTitleLogo;
}

export class MenuRenderer {
  public readonly activeButtons: UiButtonRect[] = [];
  private cur: ColumnTransform = { tx: 0, ty: 0, s: 1 };

  public hitTest(vx: number, vy: number): string | null {
    for (let i = this.activeButtons.length - 1; i >= 0; i--) {
      const b = this.activeButtons[i];
      if (vx >= b.x && vx <= b.x + b.w && vy >= b.y && vy <= b.y + b.h) {
        return b.id;
      }
    }
    return null;
  }

  private addButton(id: string, x: number, y: number, w: number, h: number): void {
    const t = this.cur;
    this.activeButtons.push({ id, x: t.tx + x * t.s, y: t.ty + y * t.s, w: w * t.s, h: h * t.s });
  }

  private withTransform(ctx: CanvasRenderingContext2D, t: ColumnTransform, fn: () => void): void {
    ctx.save();
    ctx.translate(t.tx, t.ty);
    ctx.scale(t.s, t.s);
    const prev = this.cur;
    this.cur = t;
    try {
      fn();
    } finally {
      this.cur = prev;
      ctx.restore();
    }
  }

  public renderScreen(
    ctx: CanvasRenderingContext2D,
    screen: ScreenState,
    save: GameSaveData,
    timeSeconds: number,
    overlayData: {
      currentScore: number;
      currentWave: number;
      isNewRecord: boolean;
      clearBreakdown: LevelClearBreakdown | null;
      adCountdown: number;
      statusToast: string | null;
    }
  ): void {
    this.activeButtons.length = 0;
    const layout = getLayout();

    const isMenu =
      screen === 'MAIN_MENU' ||
      screen === 'SECTOR_SELECT' ||
      screen === 'HANGAR' ||
      screen === 'ACHIEVEMENTS' ||
      screen === 'SETTINGS';
    if (isMenu) {
      this.drawPixelSpaceBackdrop(ctx, timeSeconds, layout.width, layout.height);
    } else {
      ctx.fillStyle = 'rgba(4, 6, 14, 0.84)';
      ctx.fillRect(0, 0, layout.width, layout.height);
    }

    if ((screen === 'MAIN_MENU' || screen === 'SECTOR_SELECT') && layout.menuHero && layout.menuSelector) {
      this.withTransform(ctx, layout.menuHero, () => this.renderMenuHero(ctx, save, timeSeconds));
      this.withTransform(ctx, layout.menuSelector, () => this.renderMenuSelector(ctx, save));
    } else {
      this.withTransform(ctx, layout.menuColumn, () => {
        this.renderColumnScreen(ctx, screen, save, timeSeconds, overlayData);
      });
    }

    if (overlayData.statusToast) {
      this.withTransform(ctx, layout.menuColumn, () => {
        this.drawPixelToast(ctx, overlayData.statusToast as string);
      });
    }
  }

  private renderColumnScreen(
    ctx: CanvasRenderingContext2D,
    screen: ScreenState,
    save: GameSaveData,
    timeSeconds: number,
    overlayData: {
      currentScore: number;
      currentWave: number;
      isNewRecord: boolean;
      clearBreakdown: LevelClearBreakdown | null;
      adCountdown: number;
      statusToast: string | null;
    }
  ): void {
    switch (screen) {
      case 'MAIN_MENU':
      case 'SECTOR_SELECT':
        this.renderEndlessMainMenu(ctx, save, timeSeconds);
        break;
      case 'HANGAR':
        this.renderShipsScreen(ctx, save);
        break;
      case 'SETTINGS':
      case 'ACHIEVEMENTS':
        this.renderSettingsScreen(ctx, save);
        break;
      case 'PAUSED':
        this.renderPauseModal(ctx, save);
        break;
      case 'SECOND_CHANCE':
        this.renderSecondChanceModal(ctx);
        break;
      case 'REWARDED_AD_SIM':
        this.renderRewardedSimModal(ctx, overlayData.adCountdown);
        break;
      case 'LEVEL_CLEAR':
        if (overlayData.clearBreakdown) {
          this.renderLevelClearModal(
            ctx,
            overlayData.clearBreakdown,
            overlayData.currentScore,
            overlayData.currentWave
          );
        }
        break;
      case 'GAME_OVER':
      case 'CAMPAIGN_VICTORY':
        this.renderGameOverModal(
          ctx,
          overlayData.currentScore,
          overlayData.currentWave,
          overlayData.isNewRecord
        );
        break;
      default:
        break;
    }
  }

  // ============================================================================
  // 16-BIT PIXEL SPACE BACKDROP & RIVETED CABINET FRAME HELPERS
  // ============================================================================
  private drawPixelSpaceBackdrop(
    ctx: CanvasRenderingContext2D,
    timeSeconds: number,
    width: number,
    height: number
  ): void {
    ctx.fillStyle = '#04060E';
    ctx.fillRect(0, 0, width, height);

    const tilesX = Math.ceil(width / CANVAS_WIDTH);
    const tilesY = Math.ceil(height / CANVAS_HEIGHT);
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        for (let i = 0; i < SPACE_STARS.length; i++) {
          const st = SPACE_STARS[i];
          const py = Math.floor((st.y + timeSeconds * st.speed) % CANVAS_HEIGHT) + ty * CANVAS_HEIGHT;
          const on = Math.sin(timeSeconds * 3.4 + st.phase + tx * 1.7) > -0.35;
          if (!on) continue;
          ctx.fillStyle = st.color;
          ctx.fillRect(st.x + tx * CANVAS_WIDTH, py, st.size, st.size);
        }
      }
    }
  }

  private drawCabinetOuterBezel(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const m = 10;
    const w = CANVAS_WIDTH - m * 2;
    const h = CANVAS_HEIGHT - m * 2;

    // Steel cabinet outer rim (`01-hedef-sonsuz-menu.jpg`)
    ctx.strokeStyle = '#5C687E';
    ctx.lineWidth = 10;
    ctx.strokeRect(m, m, w, h);
    ctx.strokeStyle = '#9AA8C0';
    ctx.lineWidth = 3;
    ctx.strokeRect(m + 4, m + 4, w - 8, h - 8);

    // 4 Corner steel L-brackets with rivets
    const corners: Array<[number, number]> = [
      [m, m],
      [CANVAS_WIDTH - m - 96, m],
      [m, CANVAS_HEIGHT - m - 96],
      [CANVAS_WIDTH - m - 96, CANVAS_HEIGHT - m - 96]
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = '#6A7890';
      ctx.fillRect(cx, cy, 96, 22);
      ctx.fillRect(cx === m ? cx : cx + 74, cy, 22, 96);
      ctx.fillStyle = '#182030';
      ctx.fillRect(cx + 8, cy + 7, 8, 8);
      ctx.fillRect(cx + 80, cy + 7, 8, 8);
    }
    ctx.restore();
  }

  private drawPixelPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    style: 'goldRed' | 'steel' | 'goldSelected' | 'locked' | 'navyBtn' | 'brushedSteel'
  ): void {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);

    let fill = '#161E30';
    let topRim = '#98ACC8';
    let botRim = '#384660';

    if (style === 'goldRed') {
      fill = '#B81012';
      topRim = '#FFF088';
      botRim = '#B87814';
    } else if (style === 'goldSelected') {
      fill = '#181410';
      topRim = '#FFF490';
      botRim = '#C88414';
    } else if (style === 'locked') {
      fill = '#101522';
      topRim = '#46526A';
      botRim = '#1E2638';
    } else if (style === 'navyBtn') {
      fill = '#101A30';
      topRim = '#B8CAE4';
      botRim = '#485A7A';
    } else if (style === 'brushedSteel') {
      fill = '#6A768C';
      topRim = '#C8D6EA';
      botRim = '#3A4458';
    }

    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(rx - 3, ry - 3, rw + 6, rh + 6);

    ctx.fillStyle = topRim;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = botRim;
    ctx.fillRect(rx + 6, ry + 6, rw - 6, rh - 6);

    ctx.fillStyle = fill;
    ctx.fillRect(rx + 6, ry + 6, rw - 12, rh - 12);

    const rivetCol =
      style === 'locked' ? '#38445A' : style === 'brushedSteel' ? '#263042' : '#E8F2FF';
    ctx.fillStyle = rivetCol;
    ctx.fillRect(rx + 10, ry + 10, 6, 6);
    ctx.fillRect(rx + rw - 16, ry + 10, 6, 6);
    ctx.fillRect(rx + 10, ry + rh - 16, 6, 6);
    ctx.fillRect(rx + rw - 16, ry + rh - 16, 6, 6);
  }

  // ============================================================================
  // V6 ENDLESS MYSTERY MAIN MENU (`01-hedef-sonsuz-menu.jpg` 1:1 MATCH!)
  // ============================================================================
  private renderEndlessMainMenu(
    ctx: CanvasRenderingContext2D,
    save: GameSaveData,
    timeSeconds: number
  ): void {
    this.drawCabinetOuterBezel(ctx);
    this.renderMenuHero(ctx, save, timeSeconds);
    this.renderMenuSelector(ctx, save);
  }

  /**
   * Hero section (`y: 40..610`):
   * Green wireframe planet + diagonal twin-prong fighter + dual thruster flames + chrome `VOID CARVER` logo!
   */
  private renderMenuHero(
    ctx: CanvasRenderingContext2D,
    save: GameSaveData,
    timeSeconds = 0
  ): void {
    const planetHero = getMenuPlanetHeroSprite();
    blitPixelSprite(ctx, planetHero, CANVAS_WIDTH * 0.5, 315, PIXEL_SCALE * 1.32);

    const titleLogo = getVoidCarverLogoSprite();
    blitPixelSprite(ctx, titleLogo, CANVAS_WIDTH * 0.5, 212, PIXEL_SCALE * 1.08);

    // Diagonal Twin-Prong Fighter + Dual Golden Exhaust Plumes (`01-hedef-sonsuz-menu.jpg`!)
    const skin = SHIP_SKINS.find((s) => s.id === save.selectedShip) ?? SHIP_SKINS[0];
    const shipSprite = getPlayerShipSprite(skin, 'UP');
    const bob = Math.sin(timeSeconds * 3.2) * 5;
    const sx = CANVAS_WIDTH * 0.5 + 18;
    const sy = 415 + bob;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(1.12); // ~64° up-right flight angle across wireframe globe!

    // Dual golden-white pixel thruster flames behind twin engines
    const flameLen = 84 + Math.round(Math.sin(timeSeconds * 22) * 10);
    for (const exOff of [-22, 22]) {
      ctx.fillStyle = 'rgba(255, 160, 48, 0.35)';
      ctx.fillRect(exOff - 12, 46, 24, flameLen + 18);
      ctx.fillStyle = '#FF9828';
      ctx.fillRect(exOff - 8, 44, 16, flameLen);
      ctx.fillStyle = '#FFF4A8';
      ctx.fillRect(exOff - 5, 44, 10, Math.round(flameLen * 0.65));
    }

    ctx.imageSmoothingEnabled = false;
    const scale = 6.2;
    const dw = shipSprite.width * scale;
    const dh = shipSprite.height * scale;
    ctx.drawImage(shipSprite, -dw * 0.5, -dh * 0.5, dw, dh);
    ctx.restore();
  }

  /**
   * Endless Record Card + `KOLAY / ORTA / ZOR` + Giant `OYNA` + `GEMİLER / AYARLAR` (`y: 650..1550`)
   */
  private renderMenuSelector(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    // 1. Gold-Framed Personal Record Card (`01-hedef-sonsuz-menu.jpg`)
    const cardX = 72;
    const cardY = 660;
    const cardW = 756;
    const cardH = 204;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 208, 72, 0.32)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#05070E';
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = '#F8D058';
    ctx.lineWidth = 7;
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FFF8B8';
    ctx.lineWidth = 2;
    ctx.strokeRect(cardX + 5, cardY + 5, cardW - 10, cardH - 10);
    ctx.restore();

    const rec = StorageService.getDifficultyRecord(save.difficulty, save);
    const shownScore = Math.max(rec.highScore, 0);
    const shownWave = Math.max(1, rec.bestWave);

    drawPixelText(
      ctx,
      `EN YÜKSEK SKOR: ${formatGroupedScore(shownScore)}`,
      CANVAS_WIDTH * 0.5,
      cardY + 68,
      { scale: 3.7, tone: 'gold', align: 'center' }
    );
    drawPixelText(
      ctx,
      `ULAŞILAN DERİNLİK: DALGA ${String(shownWave).padStart(2, '0')}`,
      CANVAS_WIDTH * 0.5,
      cardY + 142,
      { scale: 3.5, tone: 'cyan', align: 'center' }
    );

    // 2. Side-by-Side `KOLAY` · `ORTA` · `ZOR` Difficulty Selector (`01-hedef-sonsuz-menu.jpg`)
    const diffY = 948;
    const diffH = 128;
    const diffGap = 24;
    const diffW = Math.floor((756 - diffGap * 2) / 3); // 236

    const diffs: Array<{
      id: 'EXPLORER' | 'COMMANDER' | 'LEGEND';
      label: string;
      borderCol: string;
      textTone: 'green' | 'gold' | 'red';
    }> = [
      { id: 'EXPLORER', label: 'KOLAY', borderCol: '#1ED058', textTone: 'green' },
      { id: 'COMMANDER', label: 'ORTA', borderCol: '#F8D048', textTone: 'gold' },
      { id: 'LEGEND', label: 'ZOR', borderCol: '#E82828', textTone: 'red' }
    ];

    for (let i = 0; i < diffs.length; i++) {
      const d = diffs[i];
      const bx = cardX + i * (diffW + diffGap);
      const active = save.difficulty === d.id;
      const by = active ? diffY - 6 : diffY;
      const bh = active ? diffH + 12 : diffH;

      ctx.save();
      if (active) {
        ctx.shadowColor = 'rgba(255, 214, 72, 0.55)';
        ctx.shadowBlur = 22;
      }
      ctx.fillStyle = active ? '#171510' : '#090D16';
      ctx.fillRect(bx, by, diffW, bh);

      ctx.strokeStyle = active ? '#FFF078' : d.borderCol;
      ctx.lineWidth = active ? 7 : 5;
      ctx.strokeRect(bx, by, diffW, bh);

      ctx.shadowBlur = 0;
      ctx.strokeStyle = active ? '#C89218' : d.borderCol;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx + 10, by + 10, diffW - 20, bh - 20);
      ctx.restore();

      drawPixelText(ctx, d.label, bx + diffW * 0.5, by + bh * 0.5, {
        scale: active ? 4.2 : 3.8,
        tone: active ? 'gold' : d.textTone,
        align: 'center'
      });

      this.addButton(`SET_DIFF_${d.id}`, bx, by, diffW, bh);
    }

    // 3. Giant Crimson-Gold `OYNA` Button (`01-hedef-sonsuz-menu.jpg`)
    const playW = 576;
    const playH = 196;
    const playX = Math.round((CANVAS_WIDTH - playW) * 0.5);
    const playY = 1158;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 208, 64, 0.55)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#FFF078';
    ctx.fillRect(playX - 8, playY - 8, playW + 16, playH + 16);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#080810';
    ctx.fillRect(playX, playY, playW, playH);

    // Rich crimson arcade button face
    ctx.fillStyle = '#E01818';
    ctx.fillRect(playX + 8, playY + 8, playW - 16, playH - 16);
    ctx.fillStyle = '#B40C10';
    ctx.fillRect(playX + 14, playY + playH * 0.52, playW - 28, playH * 0.48 - 14);
    ctx.strokeStyle = '#FF7868';
    ctx.lineWidth = 4;
    ctx.strokeRect(playX + 12, playY + 12, playW - 24, playH - 24);
    ctx.restore();

    drawPixelText(ctx, 'OYNA', CANVAS_WIDTH * 0.5, playY + playH * 0.5, {
      scale: 8.6,
      tone: 'gold',
      align: 'center'
    });
    this.addButton('START_ENDLESS_RUN', playX, playY, playW, playH);

    // 4. Bottom Riveted Brushed-Steel `GEMİLER` & `AYARLAR` Buttons (`01-hedef-sonsuz-menu.jpg`)
    const botY = 1432;
    const botH = 104;
    const botW = 324;

    this.drawPixelPanel(ctx, 108, botY, botW, botH, 'brushedSteel');
    drawPixelText(ctx, 'GEMİLER', 108 + botW * 0.5, botY + botH * 0.5, {
      scale: 3.9,
      tone: 'white',
      align: 'center'
    });
    this.addButton('OPEN_SHIPS', 108, botY, botW, botH);

    this.drawPixelPanel(ctx, 468, botY, botW, botH, 'brushedSteel');
    drawPixelText(ctx, 'AYARLAR', 468 + botW * 0.5, botY + botH * 0.5, {
      scale: 3.9,
      tone: 'white',
      align: 'center'
    });
    this.addButton('GOTO_SETTINGS', 468, botY, botW, botH);
  }

  // ============================================================================
  // CLEAN 4-SHIP `GEMİLER` SCREEN (UNLOCKED VIA ENDLESS WAVE DEPTH / SCORE!)
  // ============================================================================
  private renderShipsScreen(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    this.drawCabinetOuterBezel(ctx);
    const bestWave = Math.max(1, StorageService.getBestWaveOverall(save));

    drawPixelText(ctx, 'GEMİLER', CANVAS_WIDTH * 0.5, 96, {
      scale: 4.9,
      tone: 'gold',
      align: 'center'
    });

    drawPixelText(ctx, `EN DERİN DALGA: ${String(bestWave).padStart(2, '0')}`, CANVAS_WIDTH * 0.5, 168, {
      scale: 3.4,
      tone: 'cyan',
      align: 'center'
    });

    const cardW = 356;
    const cardH = 420;
    const startX = 76;
    const startY = 236;
    const gapX = 36;
    const gapY = 36;

    for (let i = 0; i < SHIP_SKINS.length; i++) {
      const skin = SHIP_SKINS[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const unlocked = StorageService.isShipUnlocked(skin, save);
      const selected = save.selectedShip === skin.id;

      this.drawPixelPanel(
        ctx,
        cx,
        cy,
        cardW,
        cardH,
        selected ? 'goldSelected' : unlocked ? 'steel' : 'locked'
      );

      const shipSprite = getPlayerShipSprite(skin, 'UP');
      blitPixelSprite(ctx, shipSprite, cx + cardW * 0.5, cy + 145, 6);

      drawPixelText(ctx, skin.nameTr, cx + cardW * 0.5, cy + 275, {
        scale: 4.1,
        tone: selected ? 'gold' : 'white',
        align: 'center'
      });

      const statusText = selected
        ? 'SEÇİLİ'
        : unlocked
          ? 'SEÇ'
          : `DALGA ${String(skin.waveRequired).padStart(2, '0')}`;
      const statusTone = selected ? 'green' : unlocked ? 'gold' : 'muted';

      drawPixelText(ctx, statusText, cx + cardW * 0.5, cy + 350, {
        scale: 3.4,
        tone: statusTone,
        align: 'center'
      });

      this.addButton(`SELECT_SHIP_${skin.id}`, cx, cy, cardW, cardH);
    }

    this.drawPixelPanel(ctx, 250, 1250, 400, 104, 'navyBtn');
    drawPixelText(ctx, 'GERİ', CANVAS_WIDTH * 0.5, 1302, {
      scale: 4.0,
      tone: 'white',
      align: 'center'
    });
    this.addButton('BACK_MAIN', 250, 1250, 400, 104);
  }

  // ============================================================================
  // CLEAN `AYARLAR` SCREEN (V7 ZERO-INERTIA 3 CONTROL MODES + LIVE PREVIEW!)
  // ============================================================================
  private renderSettingsScreen(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    this.drawCabinetOuterBezel(ctx);
    drawPixelText(ctx, 'AYARLAR', CANVAS_WIDTH * 0.5, 96, {
      scale: 4.9,
      tone: 'gold',
      align: 'center'
    });

    const rowX = 66;
    const rowW = 768;
    const rowH = 108;

    // 1. KONTROL ŞEMASI: KLASİK ATARİ / ATARİ KOLU + KES / TEK EL SÜRÜKLE
    const y0 = 166;
    const ctrlLabel =
      save.settings.controlMode === 'CLASSIC_ARCADE'
        ? 'KLASİK ATARİ'
        : save.settings.controlMode === 'JOYSTICK_KES'
          ? 'ATARİ KOLU + KES'
          : 'TEK EL SÜRÜKLE';
    this.drawPixelPanel(ctx, rowX, y0, rowW, rowH, 'goldSelected');
    drawPixelText(ctx, `KONTROL: ${ctrlLabel} ⇄`, CANVAS_WIDTH * 0.5, y0 + rowH * 0.5, {
      scale: 3.3,
      tone: 'gold',
      align: 'center'
    });
    this.addButton('CYCLE_CONTROL_MODE', rowX, y0, rowW, rowH);

    // 2. KONTROL KONUMU: SOL / SAĞ (veya TEK EL modunda SOL / ORTA / SAĞ)
    const y1 = y0 + rowH + 18;
    const sideLabel =
      save.settings.controlMode === 'SINGLE_HAND_DRAG'
        ? save.settings.joystickSide === 'LEFT'
          ? 'SOL'
          : save.settings.joystickSide === 'RIGHT'
            ? 'SAĞ'
            : 'ORTA'
        : save.settings.joystickSide === 'RIGHT'
          ? 'SAĞ YÖN / SOL KES'
          : 'SOL YÖN / SAĞ KES';
    this.drawPixelPanel(ctx, rowX, y1, rowW, rowH, 'goldSelected');
    drawPixelText(ctx, `KONUM: ${sideLabel} ⇄`, CANVAS_WIDTH * 0.5, y1 + rowH * 0.5, {
      scale: 3.2,
      tone: 'cyan',
      align: 'center'
    });
    this.addButton('TOGGLE_JOYSTICK_SIDE', rowX, y1, rowW, rowH);

    // 3. LIVE CONTROLLER MINI-PREVIEW DECK + PC KEYBOARD BINDING HINT
    const prevY = y1 + rowH + 20;
    const prevH = 216;
    this.drawPixelPanel(ctx, rowX, prevY, rowW, prevH, 'steel');
    drawPixelText(ctx, 'CANLI KONTROL ÖNİZLEME', CANVAS_WIDTH * 0.5, prevY + 30, {
      scale: 2.5,
      tone: 'silver',
      align: 'center'
    });

    const previewCy = prevY + 114;
    ctx.save();
    if (save.settings.controlMode === 'SINGLE_HAND_DRAG') {
      const padCx =
        save.settings.joystickSide === 'LEFT'
          ? rowX + 180
          : save.settings.joystickSide === 'RIGHT'
            ? rowX + rowW - 180
            : CANVAS_WIDTH * 0.5;
      ctx.beginPath();
      ctx.arc(padCx, previewCy, 50, 0, Math.PI * 2);
      ctx.fillStyle = '#0A0F1C';
      ctx.fill();
      ctx.strokeStyle = '#3E5274';
      ctx.lineWidth = 4;
      ctx.stroke();
      drawPixelText(ctx, '▲', padCx, previewCy - 28, { scale: 2.6, tone: 'orange', align: 'center' });
      drawPixelText(ctx, '▼', padCx, previewCy + 28, { scale: 2.4, tone: 'silver', align: 'center' });
      drawPixelText(ctx, '◄', padCx - 28, previewCy, { scale: 2.4, tone: 'silver', align: 'center' });
      drawPixelText(ctx, '►', padCx + 28, previewCy, { scale: 2.4, tone: 'silver', align: 'center' });
    } else {
      const leftPad = save.settings.joystickSide !== 'RIGHT';
      const padCx = leftPad ? rowX + 185 : rowX + rowW - 185;
      const kesCx = leftPad ? rowX + rowW - 165 : rowX + 165;

      if (save.settings.controlMode === 'CLASSIC_ARCADE') {
        const arm = 44;
        const half = 16;
        ctx.fillStyle = '#1A2842';
        ctx.fillRect(padCx - half, previewCy - arm, half * 2, arm * 2);
        ctx.fillRect(padCx - arm, previewCy - half, arm * 2, half * 2);
        ctx.strokeStyle = '#EAF2FF';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(padCx - half, previewCy - arm, half * 2, arm * 2);
        ctx.strokeRect(padCx - arm, previewCy - half, arm * 2, half * 2);
      } else {
        ctx.beginPath();
        ctx.arc(padCx, previewCy, 46, 0, Math.PI * 2);
        ctx.fillStyle = '#0E1728';
        ctx.fill();
        ctx.strokeStyle = PALETTE.CUT_ORANGE;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(padCx, previewCy, 19, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE.CUT_ORANGE;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(kesCx, previewCy, 40, 0, Math.PI * 2);
      ctx.fillStyle = '#B81418';
      ctx.fill();
      ctx.strokeStyle = '#FFF088';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      drawPixelText(ctx, 'KES', kesCx, previewCy, { scale: 2.7, tone: 'gold', align: 'center' });
    }
    ctx.restore();

    drawPixelText(
      ctx,
      'PC KLAVYE: OK TUŞLARI  •  KESİM: BOŞLUK',
      CANVAS_WIDTH * 0.5,
      prevY + prevH - 22,
      { scale: 2.1, tone: 'gold', align: 'center' }
    );

    // 4. ZORLUK: KOLAY / ORTA / ZOR
    const y2 = prevY + prevH + 20;
    const diffName =
      save.difficulty === 'EXPLORER'
        ? 'KOLAY'
        : save.difficulty === 'LEGEND'
          ? 'ZOR'
          : 'ORTA';
    const diffTone =
      save.difficulty === 'EXPLORER'
        ? 'green'
        : save.difficulty === 'LEGEND'
          ? 'red'
          : 'gold';
    this.drawPixelPanel(ctx, rowX, y2, rowW, rowH, 'steel');
    drawPixelText(ctx, `ZORLUK: ${diffName} ⇄`, CANVAS_WIDTH * 0.5, y2 + rowH * 0.5, {
      scale: 3.8,
      tone: diffTone,
      align: 'center'
    });
    this.addButton('CYCLE_DIFFICULTY', rowX, y2, rowW, rowH);

    // 5. SES & TİTREŞİM
    const y3 = y2 + rowH + 18;
    const halfW = 374;
    const soundOn = !save.settings.muted;
    this.drawPixelPanel(ctx, rowX, y3, halfW, rowH, 'steel');
    drawPixelText(
      ctx,
      `SES: ${soundOn ? 'AÇIK' : 'KAPALI'}`,
      rowX + halfW * 0.5,
      y3 + rowH * 0.5,
      { scale: 3.3, tone: soundOn ? 'green' : 'muted', align: 'center' }
    );
    this.addButton('TOGGLE_MUTE', rowX, y3, halfW, rowH);

    const hapOn = save.settings.hapticsEnabled;
    const rightColX = rowX + halfW + 20;
    this.drawPixelPanel(ctx, rightColX, y3, halfW, rowH, 'steel');
    drawPixelText(
      ctx,
      `TİTREŞİM: ${hapOn ? 'AÇIK' : 'KAPALI'}`,
      rightColX + halfW * 0.5,
      y3 + rowH * 0.5,
      { scale: 3.1, tone: hapOn ? 'green' : 'muted', align: 'center' }
    );
    this.addButton('TOGGLE_HAPTICS', rightColX, y3, halfW, rowH);

    // Bottom `GERİ` Button
    this.drawPixelPanel(ctx, 250, 1280, 400, 104, 'navyBtn');
    drawPixelText(ctx, 'GERİ', CANVAS_WIDTH * 0.5, 1332, {
      scale: 4.0,
      tone: 'white',
      align: 'center'
    });
    this.addButton('BACK_MAIN', 250, 1280, 400, 104);
  }

  // ============================================================================
  // IN-GAME PIXEL MODALS (`PAUSED`, `LEVEL_CLEAR`, `GAME_OVER`)
  // ============================================================================
  private renderPauseModal(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    this.drawPixelPanel(ctx, 76, 286, 748, 800, 'steel');

    drawPixelText(ctx, 'DURAKLATILDI', CANVAS_WIDTH * 0.5, 362, {
      scale: 4.3,
      tone: 'gold',
      align: 'center'
    });

    const ctrlShort =
      save.settings.controlMode === 'CLASSIC_ARCADE'
        ? 'KLASİK ATARİ'
        : save.settings.controlMode === 'JOYSTICK_KES'
          ? 'ATARİ KOLU + KES'
          : 'TEK EL SÜRÜKLE';
    const sideLabel =
      save.settings.controlMode === 'SINGLE_HAND_DRAG'
        ? save.settings.joystickSide === 'LEFT'
          ? 'SOL'
          : save.settings.joystickSide === 'RIGHT'
            ? 'SAĞ'
            : 'ORTA'
        : save.settings.joystickSide === 'RIGHT'
          ? 'SAĞ YÖN'
          : 'SOL YÖN';

    this.drawModalActionBtn(ctx, 'DEVAM ET', 432, 'goldRed', 'RESUME_GAME', 94);
    this.drawModalActionBtn(
      ctx,
      `KONTROL: ${ctrlShort} ⇄`,
      544,
      'navyBtn',
      'CYCLE_CONTROL_MODE',
      92
    );
    this.drawModalActionBtn(
      ctx,
      `KONUM: ${sideLabel} ⇄`,
      654,
      'navyBtn',
      'TOGGLE_JOYSTICK_SIDE',
      92
    );
    this.drawModalActionBtn(ctx, 'YENİDEN BAŞLA', 764, 'navyBtn', 'RESTART_RUN', 92);
    this.drawModalActionBtn(ctx, 'ANA MENÜ', 874, 'navyBtn', 'QUIT_TO_MENU', 92);
  }

  private renderSecondChanceModal(ctx: CanvasRenderingContext2D): void {
    this.drawPixelPanel(ctx, 84, 450, 732, 540, 'steel');

    drawPixelText(ctx, 'SON ŞANS', CANVAS_WIDTH * 0.5, 538, {
      scale: 4.5,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(ctx, 'EKSTRA GEMİ İLE DEVAM?', CANVAS_WIDTH * 0.5, 622, {
      scale: 3.2,
      tone: 'white',
      align: 'center'
    });

    this.drawModalActionBtn(ctx, 'DEVAM ET', 715, 'goldRed', 'ACCEPT_REVIVE');
    this.drawModalActionBtn(ctx, 'VAZGEÇ', 845, 'navyBtn', 'DECLINE_REVIVE');
  }

  private renderRewardedSimModal(ctx: CanvasRenderingContext2D, countdown: number): void {
    this.drawPixelPanel(ctx, 110, 550, 680, 340, 'steel');
    drawPixelText(ctx, 'GEMİ HAZIRLANIYOR', CANVAS_WIDTH * 0.5, 670, {
      scale: 3.6,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(ctx, `${Math.ceil(Math.max(1, countdown))}`, CANVAS_WIDTH * 0.5, 768, {
      scale: 5.4,
      tone: 'cyan',
      align: 'center'
    });
  }

  private renderLevelClearModal(
    ctx: CanvasRenderingContext2D,
    bd: LevelClearBreakdown,
    currentScore: number,
    waveNumber: number
  ): void {
    this.drawPixelPanel(ctx, 72, 310, 756, 880, 'steel');

    const title = `DALGA ${String(waveNumber).padStart(2, '0')} TAMAM`;
    drawPixelText(ctx, title, CANVAS_WIDTH * 0.5, 398, {
      scale: 4.2,
      tone: 'gold',
      align: 'center'
    });

    for (let i = 0; i < 3; i++) {
      const star = getPixelStarSprite(i < bd.stars);
      blitPixelSprite(ctx, star, CANVAS_WIDTH * 0.5 + (i - 1) * 90, 484, 5);
    }

    const rowLeft = 128;
    const rowRight = 772;
    const shownPct =
      bd.winReason === 'TWIN_SPLIT' || bd.winReason === 'BOSS_DESTROYED'
        ? 'TAM ZAFER'
        : `${bd.claimedPercent.toFixed(1)}%`;

    const bonusRows: Array<[string, string, 'white' | 'gold' | 'green' | 'cyan']> = [
      ['ALAN', shownPct, 'green'],
      ['DALGA BONUSU', `+${bd.baseBonus}`, 'white']
    ];
    if (bd.over80Bonus > 0) {
      bonusRows.push(['ÜSTÜN KESİM', `+${bd.over80Bonus}`, 'gold']);
    }
    bonusRows.push(['KALKAN BONUSU', `+${bd.shieldBonus}`, 'cyan']);
    if (bd.specialBonus > 0) {
      bonusRows.push(['BOSS İMHA', `+${bd.specialBonus}`, 'gold']);
    }
    if (bd.firstCutMillionBonus > 0) {
      bonusRows.push(['TEK ÇİZGİ', `+${bd.firstCutMillionBonus}`, 'gold']);
    }

    const rowStep = bonusRows.length <= 4 ? 58 : bonusRows.length === 5 ? 50 : 44;
    let ry = 568;
    for (const [label, val, tone] of bonusRows) {
      drawPixelText(ctx, label, rowLeft, ry, { scale: 3.1, tone: 'silver', align: 'left' });
      drawPixelText(ctx, val, rowRight, ry, { scale: 3.2, tone, align: 'right' });
      ry += rowStep;
    }

    drawPixelText(ctx, `SKOR ${formatScoreDigits(currentScore, 7)}`, CANVAS_WIDTH * 0.5, 932, {
      scale: 3.9,
      tone: 'gold',
      align: 'center'
    });

    this.drawModalActionBtn(ctx, 'SONRAKİ DALGA', 994, 'goldRed', 'NEXT_SECTOR');
    this.drawModalActionBtn(ctx, 'ANA MENÜ', 1108, 'navyBtn', 'QUIT_TO_MENU', 90);
  }

  private renderGameOverModal(
    ctx: CanvasRenderingContext2D,
    currentScore: number,
    waveNumber: number,
    isNewRecord: boolean
  ): void {
    this.drawPixelPanel(ctx, 84, 390, 732, 680, 'steel');

    drawPixelText(ctx, 'OYUN BİTTİ', CANVAS_WIDTH * 0.5, 480, {
      scale: 4.8,
      tone: 'red',
      align: 'center'
    });

    drawPixelText(
      ctx,
      `ULAŞILAN DERİNLİK: DALGA ${String(waveNumber).padStart(2, '0')}`,
      CANVAS_WIDTH * 0.5,
      566,
      { scale: 3.3, tone: 'cyan', align: 'center' }
    );

    drawPixelText(
      ctx,
      `SKOR ${formatGroupedScore(currentScore)}`,
      CANVAS_WIDTH * 0.5,
      640,
      { scale: 3.9, tone: 'gold', align: 'center' }
    );

    if (isNewRecord) {
      drawPixelText(ctx, '★ YENİ KİŞİSEL REKOR! ★', CANVAS_WIDTH * 0.5, 706, {
        scale: 3.1,
        tone: 'green',
        align: 'center'
      });
    }

    this.drawModalActionBtn(ctx, 'TEKRAR OYNA', 766, 'goldRed', 'RESTART_RUN');
    this.drawModalActionBtn(ctx, 'ANA MENÜ', 896, 'navyBtn', 'QUIT_TO_MENU');
  }

  private drawModalActionBtn(
    ctx: CanvasRenderingContext2D,
    label: string,
    y: number,
    style: 'goldRed' | 'navyBtn',
    id: string,
    h = 98
  ): void {
    const w = 584;
    const x = Math.round((CANVAS_WIDTH - w) * 0.5);
    this.drawPixelPanel(ctx, x, y, w, h, style);
    drawPixelText(ctx, label, CANVAS_WIDTH * 0.5, y + h * 0.5, {
      scale: 3.5,
      tone: style === 'goldRed' ? 'gold' : 'white',
      align: 'center'
    });
    this.addButton(id, x, y, w, h);
  }

  private drawPixelToast(ctx: CanvasRenderingContext2D, text: string): void {
    this.drawPixelPanel(ctx, 90, 104, 720, 72, 'navyBtn');
    drawPixelText(ctx, text, CANVAS_WIDTH * 0.5, 140, {
      scale: 3.0,
      tone: 'gold',
      align: 'center'
    });
  }
}
