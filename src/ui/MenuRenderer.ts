import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DEFAULT_ARCADE_HIGH_SCORE,
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
  getPadlockPixelSprite,
  getPixelStarSprite,
  getPlayerShipSprite
} from '../rendering/VolfiedSprites';
import { GameSaveData, StorageService } from '../services/StorageService';
import { ColumnTransform, getLayout } from '../core/ResponsiveLayout';
import {
  formatStageNumber,
  getTierForStage,
  isTierUnlocked,
  STAGES_PER_TIER,
  TIERS,
  TOTAL_STAGES
} from '../levels/CampaignGenerator';

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
    size: idx % 9 === 0 ? 6 : idx % 3 === 0 ? 3 : 3,
    speed: 9 + (idx % 4) * 6,
    phase: idx * 0.77,
    color: cols[idx % cols.length]
  };
});

function formatScoreDigits(val: number, len = 7): string {
  return Math.max(0, Math.floor(val)).toString().padStart(len, '0');
}

// Cached 16-Bit Chrome & Crimson-Beveled `VOID CARVER` Arcade Title Logo (`02-hedef-ana-menu.jpg`!)
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

  // Render `VOID CARVER` at 2x internal pixel thickness (`236 x 34` arcade pixels -> `708 x 102` screen px!)
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

  // Pass 1: Deep black drop shadow + Crimson/Orange 3D arcade extrusion
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

  // Pass 2: Metallic Chrome-Silver & Horizon Gold-Reflected Letter Faces
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

  // Subtle star gleam on `V` and `C`
  setPx(s, 10, 6, hexToU32('#FFFFFF'));
  setPx(s, 104, 6, hexToU32('#FFFFFF'));

  cachedTitleLogo = commitPixelSurface(s);
  return cachedTitleLogo;
}

export class MenuRenderer {
  public readonly activeButtons: UiButtonRect[] = [];
  private selectedSector = 1;
  private selectedTier = 0;
  private lastSyncedUnlocked = -1;
  private cur: ColumnTransform = { tx: 0, ty: 0, s: 1 };

  public setSelectedSector(sectorId: number): void {
    this.selectedSector = Math.max(1, Math.min(TOTAL_STAGES, Math.round(sectorId)));
    this.selectedTier = getTierForStage(this.selectedSector).index;
  }

  public getSelectedSector(): number {
    return this.selectedSector;
  }

  public setSelectedTier(tierIndex: number, unlockedSector: number): boolean {
    const idx = Math.max(0, Math.min(3, Math.round(tierIndex)));
    if (!isTierUnlocked(idx, unlockedSector)) return false;
    this.selectedTier = idx;
    return true;
  }

  public hitTest(vx: number, vy: number): string | null {
    for (let i = this.activeButtons.length - 1; i >= 0; i--) {
      const b = this.activeButtons[i];
      if (vx >= b.x && vx <= b.x + b.w && vy >= b.y && vy <= b.y + b.h) {
        return b.id;
      }
    }
    return null;
  }

  /** Records a hit rect given in legacy column coords, mapped through the active transform. */
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
      currentSector: number;
      isEndless: boolean;
      clearBreakdown: LevelClearBreakdown | null;
      adCountdown: number;
      statusToast: string | null;
    }
  ): void {
    this.activeButtons.length = 0;
    const layout = getLayout();

    if (this.lastSyncedUnlocked !== save.unlockedSector) {
      this.setSelectedSector(save.unlockedSector);
      this.lastSyncedUnlocked = save.unlockedSector;
    }
    if (this.selectedSector > save.unlockedSector) {
      this.setSelectedSector(save.unlockedSector);
    }
    if (!isTierUnlocked(this.selectedTier, save.unlockedSector)) {
      this.selectedTier = getTierForStage(save.unlockedSector).index;
    }

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
      // Landscape: 2-column main menu (logo + continue | tier tabs + 5x5 grid)
      this.withTransform(ctx, layout.menuHero, () => this.renderMenuHero(ctx, save));
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
      currentSector: number;
      isEndless: boolean;
      clearBreakdown: LevelClearBreakdown | null;
      adCountdown: number;
      statusToast: string | null;
    }
  ): void {
    switch (screen) {
      case 'MAIN_MENU':
      case 'SECTOR_SELECT':
        this.renderCleanMainMenu(ctx, save, timeSeconds);
        break;
      case 'HANGAR':
        this.renderShipsScreen(ctx, save);
        break;
      case 'SETTINGS':
      case 'ACHIEVEMENTS':
        this.renderSettingsScreen(ctx, save);
        break;
      case 'PAUSED':
        this.renderPauseModal(ctx);
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
            overlayData.currentSector,
            overlayData.isEndless
          );
        }
        break;
      case 'GAME_OVER':
        this.renderGameOverModal(ctx, overlayData.currentScore, overlayData.currentSector);
        break;
      case 'CAMPAIGN_VICTORY':
        this.renderCampaignVictoryModal(ctx, overlayData.currentScore);
        break;
      default:
        break;
    }
  }

  // ============================================================================
  // 16-BIT PIXEL SPACE BACKDROP & RIVETED PANEL HELPERS
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

  private drawPixelPanel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    style: 'goldRed' | 'steel' | 'goldSelected' | 'locked' | 'navyBtn'
  ): void {
    const rx = Math.round(x);
    const ry = Math.round(y);
    const rw = Math.round(w);
    const rh = Math.round(h);

    let fill = '#161E30';
    let topRim = '#98ACC8';
    let botRim = '#384660';
    let outerBorder = PALETTE.PIXEL_BLACK;

    if (style === 'goldRed') {
      fill = '#5A1416';
      topRim = '#FFF088';
      botRim = '#B87814';
    } else if (style === 'goldSelected') {
      fill = '#2C2618';
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
    }

    // Outer 3px pixel black contour
    ctx.fillStyle = outerBorder;
    ctx.fillRect(rx - 3, ry - 3, rw + 6, rh + 6);

    // Bevel border (`6px` thick)
    ctx.fillStyle = topRim;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = botRim;
    ctx.fillRect(rx + 6, ry + 6, rw - 6, rh - 6);

    // Inner fill
    ctx.fillStyle = fill;
    ctx.fillRect(rx + 6, ry + 6, rw - 12, rh - 12);

    // 4 Corner Pixel Rivets!
    const rivetCol = style === 'locked' ? '#38445A' : '#E8F2FF';
    ctx.fillStyle = rivetCol;
    ctx.fillRect(rx + 9, ry + 9, 4, 4);
    ctx.fillRect(rx + rw - 13, ry + 9, 4, 4);
    ctx.fillRect(rx + 9, ry + rh - 13, 4, 4);
    ctx.fillRect(rx + rw - 13, ry + rh - 13, 4, 4);
  }

  // ============================================================================
  // ULTRA-CLEAN MAIN MENU (`02-hedef-ana-menu.jpg` EXACT MATCH!)
  // ============================================================================
  private renderCleanMainMenu(
    ctx: CanvasRenderingContext2D,
    save: GameSaveData,
    _timeSeconds: number
  ): void {
    this.renderMenuHero(ctx, save);
    this.renderMenuSelector(ctx, save);
  }

  /**
   * Legacy column y `0..610`: `REKOR`, wireframe planet + chrome `VOID CARVER`,
   * and the big `DEVAM ET • BÖLÜM 034` button (`02-hedef-100-bolum-kademeli-menu.jpg`).
   */
  private renderMenuHero(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    const bestScore = Math.max(DEFAULT_ARCADE_HIGH_SCORE, save.highScoreCampaign, save.highScoreEndless);
    drawPixelText(ctx, `REKOR ${formatScoreDigits(bestScore, 7)}`, CANVAS_WIDTH * 0.5, 50, {
      scale: 3.4,
      tone: 'gold',
      align: 'center'
    });

    const planetHero = getMenuPlanetHeroSprite();
    blitPixelSprite(ctx, planetHero, CANVAS_WIDTH * 0.5, 282, PIXEL_SCALE);
    const titleLogo = getVoidCarverLogoSprite();
    blitPixelSprite(ctx, titleLogo, CANVAS_WIDTH * 0.5, 294, PIXEL_SCALE);

    const btnX = 76;
    const btnY = 498;
    const btnW = 748;
    const btnH = 96;
    const isFrontier = this.selectedSector === save.unlockedSector;
    const verb = isFrontier ? 'DEVAM ET' : 'OYNA';

    this.drawPixelPanel(ctx, btnX, btnY, btnW, btnH, 'goldRed');
    drawPixelText(
      ctx,
      `${verb} • BÖLÜM ${formatStageNumber(this.selectedSector)}`,
      CANVAS_WIDTH * 0.5,
      btnY + btnH * 0.5,
      { scale: 3.6, tone: 'gold', align: 'center' }
    );
    this.addButton(`LAUNCH_SECTOR_${this.selectedSector}`, btnX, btnY, btnW, btnH);
  }

  /**
   * Legacy column y `610..1440`: 4 tier tabs (`KOLAY 1-25`, `ORTA 26-50`, `ZOR 51-75`,
   * `USTA 76-100`), the selected tier's `5x5` riveted stage grid and `GEMİLER` / `AYARLAR`.
   */
  private renderMenuSelector(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    // 1. Tier tab bar
    const tabY = 618;
    const tabH = 100;
    const tabGap = 12;
    const tabW = (748 - tabGap * 3) / 4;
    for (let i = 0; i < 4; i++) {
      const tier = TIERS[i];
      const tx = 76 + i * (tabW + tabGap);
      const unlocked = isTierUnlocked(i, save.unlockedSector);
      const completed = save.sectors[tier.end]?.cleared === true;
      const active = i === this.selectedTier;

      const style = active ? 'goldSelected' : unlocked ? 'steel' : 'locked';
      this.drawPixelPanel(ctx, tx, tabY, tabW, tabH, style);
      if (tier.id === 'USTA' && !active) {
        ctx.fillStyle = unlocked ? '#4A1420' : '#2A0E16';
        ctx.fillRect(tx + 6, tabY + 6, tabW - 12, tabH - 12);
      }

      const nameTone = !unlocked ? 'muted' : active ? 'gold' : tier.id === 'USTA' ? 'crimson' : completed ? 'green' : 'white';
      drawPixelText(ctx, tier.nameTr, tx + tabW * 0.5, tabY + 34, {
        scale: 2.8,
        tone: nameTone,
        align: 'center'
      });
      drawPixelText(ctx, `${tier.start}-${tier.end}`, tx + tabW * 0.5, tabY + 72, {
        scale: 2.4,
        tone: unlocked ? (active ? 'gold' : 'silver') : 'muted',
        align: 'center'
      });
      if (!unlocked) {
        blitPixelSprite(ctx, getPadlockPixelSprite(), tx + tabW - 24, tabY + 26, 2);
      } else if (completed) {
        drawPixelText(ctx, '✔', tx + tabW - 22, tabY + 74, { scale: 2.2, tone: 'green', align: 'center' });
      }
      if (unlocked) {
        this.addButton(`SELECT_TIER_${i}`, tx, tabY, tabW, tabH);
      }
    }

    // Gold underline joining the active tab to the grid
    ctx.fillStyle = '#C88414';
    ctx.fillRect(40, tabY + tabH + 6, CANVAS_WIDTH - 80, 4);

    // 2. 5x5 riveted stage grid for the selected tier
    const tier = TIERS[this.selectedTier];
    const cols = 5;
    const gapX = 14;
    const gapY = 12;
    const cellW = (748 - gapX * (cols - 1)) / cols;
    const cellH = 100;
    const gridX = 76;
    const gridY = 742;
    const padlock = getPadlockPixelSprite();

    for (let k = 0; k < STAGES_PER_TIER; k++) {
      const id = tier.start + k;
      const col = k % cols;
      const row = Math.floor(k / cols);
      const bx = gridX + col * (cellW + gapX);
      const by = gridY + row * (cellH + gapY);

      const unlocked = id <= save.unlockedSector;
      const prog = save.sectors[id];
      const cleared = Boolean(prog?.cleared);
      const stars = Math.max(0, Math.min(3, prog?.stars ?? 0));
      const isSelected = id === this.selectedSector;
      const isFrontier = id === save.unlockedSector && !cleared;

      const style = !unlocked ? 'locked' : isSelected || isFrontier ? 'goldSelected' : 'steel';
      this.drawPixelPanel(ctx, bx, by, cellW, cellH, style);
      if (isSelected) {
        ctx.strokeStyle = '#FFE058';
        ctx.lineWidth = 4;
        ctx.strokeRect(bx - 7, by - 7, cellW + 14, cellH + 14);
      }

      drawPixelText(ctx, String(id).padStart(2, '0'), bx + cellW * 0.5, by + (unlocked && !cleared ? 50 : 40), {
        scale: id >= 100 ? 3.0 : 3.6,
        tone: !unlocked ? 'muted' : isSelected || isFrontier ? 'gold' : 'white',
        align: 'center'
      });

      if (!unlocked) {
        blitPixelSprite(ctx, padlock, bx + cellW * 0.5, by + 76, 2);
      } else if (cleared || stars > 0) {
        for (let sIdx = 0; sIdx < 3; sIdx++) {
          blitPixelSprite(ctx, getPixelStarSprite(sIdx < stars), bx + cellW * 0.5 + (sIdx - 1) * 28, by + 76, 2);
        }
      }

      if (unlocked) {
        const action = isSelected ? `LAUNCH_SECTOR_${id}` : `SELECT_SECTOR_${id}`;
        this.addButton(action, bx, by, cellW, cellH);
      }
    }

    // 3. Bottom `GEMİLER` & `AYARLAR`
    const botY = 1326;
    const botH = 98;
    const botW = 362;
    this.drawPixelPanel(ctx, 76, botY, botW, botH, 'navyBtn');
    drawPixelText(ctx, 'GEMİLER', 76 + botW * 0.5, botY + botH * 0.5, {
      scale: 3.4,
      tone: 'silver',
      align: 'center'
    });
    this.addButton('OPEN_SHIPS', 76, botY, botW, botH);

    this.drawPixelPanel(ctx, 462, botY, botW, botH, 'navyBtn');
    drawPixelText(ctx, 'AYARLAR', 462 + botW * 0.5, botY + botH * 0.5, {
      scale: 3.4,
      tone: 'silver',
      align: 'center'
    });
    this.addButton('GOTO_SETTINGS', 462, botY, botW, botH);
  }

  // ============================================================================
  // CLEAN 4-SHIP `GEMİLER` SCREEN (`GÜMÜŞ`, `KIZIL`, `ALTIN`, `GÖLGE`)
  // ============================================================================
  private renderShipsScreen(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    const totalStars = StorageService.getTotalStars();

    drawPixelText(ctx, 'GEMİLER', CANVAS_WIDTH * 0.5, 96, {
      scale: 4.5,
      tone: 'gold',
      align: 'center'
    });

    drawPixelText(ctx, `TOPLAM ★ ${totalStars}`, CANVAS_WIDTH * 0.5, 168, {
      scale: 3.0,
      tone: 'silver',
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

      const unlocked = totalStars >= skin.starsRequired;
      const selected = save.selectedShip === skin.id;

      this.drawPixelPanel(
        ctx,
        cx,
        cy,
        cardW,
        cardH,
        selected ? 'goldSelected' : unlocked ? 'steel' : 'locked'
      );

      // Large 16-bit Pixel Twin-Prong Ship Preview (`6x` pixel scale!)
      const shipSprite = getPlayerShipSprite(skin, 'UP');
      blitPixelSprite(ctx, shipSprite, cx + cardW * 0.5, cy + 145, 6);

      // Single-word Ship Name (`GÜMÜŞ` / `KIZIL` / `ALTIN` / `GÖLGE`)
      drawPixelText(ctx, skin.nameTr, cx + cardW * 0.5, cy + 275, {
        scale: 3.6,
        tone: selected ? 'gold' : 'white',
        align: 'center'
      });

      // Single clean status pill (`SEÇİLİ` / `SEÇ` / `15 ★`)
      const statusText = selected
        ? 'SEÇİLİ'
        : unlocked
          ? 'SEÇ'
          : `${skin.starsRequired} ★`;
      const statusTone = selected ? 'green' : unlocked ? 'gold' : 'muted';

      drawPixelText(ctx, statusText, cx + cardW * 0.5, cy + 350, {
        scale: 3.2,
        tone: statusTone,
        align: 'center'
      });

      this.addButton(`SELECT_SHIP_${skin.id}`, cx, cy, cardW, cardH);
    }

    // Bottom `GERİ` button
    this.drawPixelPanel(ctx, 250, 1230, 400, 98, 'navyBtn');
    drawPixelText(ctx, 'GERİ', CANVAS_WIDTH * 0.5, 1279, {
      scale: 3.6,
      tone: 'white',
      align: 'center'
    });
    this.addButton('BACK_MAIN', 250, 1230, 400, 98);
  }

  // ============================================================================
  // CLEAN `AYARLAR` SCREEN (4 CRISP ROWS + OPTIONAL `SONSUZ MOD`)
  // ============================================================================
  private renderSettingsScreen(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    drawPixelText(ctx, 'AYARLAR', CANVAS_WIDTH * 0.5, 108, {
      scale: 4.5,
      tone: 'gold',
      align: 'center'
    });

    const rowX = 76;
    const rowW = 748;
    const rowH = 112;
    const startY = 196;
    const gapY = 22;

    // 1. ZORLUK: NORMAL / ZOR
    const isHard = save.difficulty === 'LEGEND';
    this.drawPixelPanel(ctx, rowX, startY, rowW, rowH, 'steel');
    drawPixelText(
      ctx,
      `ZORLUK: ${isHard ? 'ZOR' : 'NORMAL'}`,
      CANVAS_WIDTH * 0.5,
      startY + rowH * 0.5,
      {
        scale: 3.4,
        tone: isHard ? 'orange' : 'gold',
        align: 'center'
      }
    );
    this.addButton('CYCLE_DIFFICULTY', rowX, startY, rowW, rowH);

    // 2. KONTROL: TUŞ+KES / KES KİLİT / KAYDIR
    const y2 = startY + (rowH + gapY);
    const ctrlLabel =
      save.settings.controlMode === 'SWIPE'
        ? 'KAYDIR'
        : save.settings.carveButtonMode === 'TOGGLE'
          ? 'KES KİLİT'
          : 'TUŞ+KES';
    this.drawPixelPanel(ctx, rowX, y2, rowW, rowH, 'steel');
    drawPixelText(ctx, `KONTROL: ${ctrlLabel}`, CANVAS_WIDTH * 0.5, y2 + rowH * 0.5, {
      scale: 3.4,
      tone: 'cyan',
      align: 'center'
    });
    this.addButton('CYCLE_CONTROL_MODE', rowX, y2, rowW, rowH);

    // 2b. [OTOMATİK] one-hand cut mode
    const y2b = startY + (rowH + gapY) * 2;
    const autoOn = save.settings.autoCut;
    this.drawPixelPanel(ctx, rowX, y2b, rowW, rowH, 'steel');
    drawPixelText(ctx, `OTOMATİK: ${autoOn ? 'AÇIK' : 'KAPALI'}`, CANVAS_WIDTH * 0.5, y2b + rowH * 0.5, {
      scale: 3.4,
      tone: autoOn ? 'green' : 'muted',
      align: 'center'
    });
    this.addButton('TOGGLE_AUTO_CUT', rowX, y2b, rowW, rowH);

    // 3. SES: AÇIK / KAPALI
    const y3 = startY + (rowH + gapY) * 3;
    const soundOn = !save.settings.muted;
    this.drawPixelPanel(ctx, rowX, y3, rowW, rowH, 'steel');
    drawPixelText(
      ctx,
      `SES: ${soundOn ? 'AÇIK' : 'KAPALI'}`,
      CANVAS_WIDTH * 0.5,
      y3 + rowH * 0.5,
      {
        scale: 3.4,
        tone: soundOn ? 'green' : 'muted',
        align: 'center'
      }
    );
    this.addButton('TOGGLE_MUTE', rowX, y3, rowW, rowH);

    // 4. TİTREŞİM: AÇIK / KAPALI
    const y4 = startY + (rowH + gapY) * 4;
    const hapOn = save.settings.hapticsEnabled;
    this.drawPixelPanel(ctx, rowX, y4, rowW, rowH, 'steel');
    drawPixelText(
      ctx,
      `TİTREŞİM: ${hapOn ? 'AÇIK' : 'KAPALI'}`,
      CANVAS_WIDTH * 0.5,
      y4 + rowH * 0.5,
      {
        scale: 3.4,
        tone: hapOn ? 'green' : 'muted',
        align: 'center'
      }
    );
    this.addButton('TOGGLE_HAPTICS', rowX, y4, rowW, rowH);

    // 5. Optional `SONSUZ MOD` once the final stage (100) is cleared!
    if (save.sectors[TOTAL_STAGES]?.cleared) {
      const y5 = startY + (rowH + gapY) * 5;
      this.drawPixelPanel(ctx, rowX, y5, rowW, 114, 'goldRed');
      drawPixelText(ctx, 'SONSUZ MOD', CANVAS_WIDTH * 0.5, y5 + 57, {
        scale: 3.6,
        tone: 'gold',
        align: 'center'
      });
      this.addButton('START_ENDLESS', rowX, y5, rowW, 114);
    }

    // Bottom `GERİ` Button
    this.drawPixelPanel(ctx, 250, 1240, 400, 98, 'navyBtn');
    drawPixelText(ctx, 'GERİ', CANVAS_WIDTH * 0.5, 1289, {
      scale: 3.6,
      tone: 'white',
      align: 'center'
    });
    this.addButton('BACK_MAIN', 250, 1240, 400, 98);
  }

  // ============================================================================
  // IN-GAME PIXEL MODALS (`PAUSED`, `LEVEL_CLEAR`, `GAME_OVER`, `VICTORY`)
  // ============================================================================
  private renderPauseModal(ctx: CanvasRenderingContext2D): void {
    this.drawPixelPanel(ctx, 110, 410, 680, 620, 'steel');

    drawPixelText(ctx, 'DURAKLATILDI', CANVAS_WIDTH * 0.5, 495, {
      scale: 4.0,
      tone: 'gold',
      align: 'center'
    });

    this.drawModalActionBtn(ctx, 'DEVAM ET', 595, 'goldRed', 'RESUME_GAME');
    this.drawModalActionBtn(ctx, 'TEKRAR BAŞLA', 725, 'navyBtn', 'RESTART_SECTOR');
    this.drawModalActionBtn(ctx, 'ANA MENÜ', 855, 'navyBtn', 'QUIT_TO_MENU');
  }

  private renderSecondChanceModal(ctx: CanvasRenderingContext2D): void {
    this.drawPixelPanel(ctx, 100, 460, 700, 520, 'steel');

    drawPixelText(ctx, 'SON ŞANS', CANVAS_WIDTH * 0.5, 545, {
      scale: 4.2,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(ctx, 'EKSTRA GEMİ İLE DEVAM?', CANVAS_WIDTH * 0.5, 625, {
      scale: 2.8,
      tone: 'white',
      align: 'center'
    });

    this.drawModalActionBtn(ctx, 'DEVAM ET', 715, 'goldRed', 'ACCEPT_REVIVE');
    this.drawModalActionBtn(ctx, 'VAZGEÇ', 845, 'navyBtn', 'DECLINE_REVIVE');
  }

  private renderRewardedSimModal(ctx: CanvasRenderingContext2D, countdown: number): void {
    this.drawPixelPanel(ctx, 130, 560, 640, 320, 'steel');
    drawPixelText(ctx, 'GEMİ HAZIRLANIYOR', CANVAS_WIDTH * 0.5, 675, {
      scale: 3.2,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(ctx, `${Math.ceil(Math.max(1, countdown))}`, CANVAS_WIDTH * 0.5, 765, {
      scale: 5.0,
      tone: 'cyan',
      align: 'center'
    });
  }

  private renderLevelClearModal(
    ctx: CanvasRenderingContext2D,
    bd: LevelClearBreakdown,
    currentScore: number,
    sectorId: number,
    isEndless: boolean
  ): void {
    this.drawPixelPanel(ctx, 84, 320, 732, 860, 'steel');

    const title = isEndless
      ? `DALGA ${String(sectorId).padStart(3, '0')} TAMAM`
      : `BÖLÜM ${formatStageNumber(sectorId)} TAMAM`;

    drawPixelText(ctx, title, CANVAS_WIDTH * 0.5, 405, {
      scale: 3.8,
      tone: 'gold',
      align: 'center'
    });

    // 3 Large Earned Pixel Stars!
    for (let i = 0; i < 3; i++) {
      const star = getPixelStarSprite(i < bd.stars);
      blitPixelSprite(ctx, star, CANVAS_WIDTH * 0.5 + (i - 1) * 86, 488, 5);
    }

    const rowLeft = 148;
    const rowRight = 752;
    let ry = 580;

    const drawBonusLine = (label: string, val: string, tone: 'white' | 'gold' | 'green' | 'cyan'): void => {
      drawPixelText(ctx, label, rowLeft, ry, { scale: 2.7, tone: 'silver', align: 'left' });
      drawPixelText(ctx, val, rowRight, ry, { scale: 2.8, tone, align: 'right' });
      ry += 56;
    };

    const shownPct =
      bd.winReason === 'TWIN_SPLIT' || bd.winReason === 'BOSS_DESTROYED'
        ? 'TAM ZAFER'
        : `${bd.claimedPercent.toFixed(1)}%`;

    drawBonusLine('ALAN', shownPct, 'green');
    drawBonusLine('BÖLÜM BONUSU', `+${bd.baseBonus}`, 'white');
    if (bd.over80Bonus > 0) {
      drawBonusLine('ÜSTÜN KESİM', `+${bd.over80Bonus}`, 'gold');
    }
    drawBonusLine('KALKAN BONUSU', `+${bd.shieldBonus}`, 'cyan');
    if (bd.specialBonus > 0) {
      drawBonusLine('BOSS İMHA', `+${bd.specialBonus}`, 'gold');
    }
    if (bd.firstCutMillionBonus > 0) {
      drawBonusLine('TEK ÇİZGİ', `+${bd.firstCutMillionBonus}`, 'gold');
    }

    drawPixelText(ctx, `SKOR ${formatScoreDigits(currentScore, 7)}`, CANVAS_WIDTH * 0.5, 922, {
      scale: 3.4,
      tone: 'gold',
      align: 'center'
    });

    this.drawModalActionBtn(ctx, 'SONRAKİ BÖLÜM', 990, 'goldRed', 'NEXT_SECTOR');
    this.drawModalActionBtn(ctx, 'ANA MENÜ', 1104, 'navyBtn', 'QUIT_TO_MENU', 88);
  }

  private renderGameOverModal(
    ctx: CanvasRenderingContext2D,
    currentScore: number,
    sectorId: number
  ): void {
    this.drawPixelPanel(ctx, 100, 420, 700, 620, 'steel');

    drawPixelText(ctx, 'OYUN BİTTİ', CANVAS_WIDTH * 0.5, 510, {
      scale: 4.4,
      tone: 'red',
      align: 'center'
    });

    drawPixelText(
      ctx,
      `BÖLÜM ${formatStageNumber(sectorId)}`,
      CANVAS_WIDTH * 0.5,
      595,
      {
        scale: 3.2,
        tone: 'silver',
        align: 'center'
      }
    );

    drawPixelText(
      ctx,
      `SKOR ${formatScoreDigits(currentScore, 7)}`,
      CANVAS_WIDTH * 0.5,
      668,
      {
        scale: 3.5,
        tone: 'gold',
        align: 'center'
      }
    );

    this.drawModalActionBtn(ctx, 'TEKRAR DENE', 760, 'goldRed', 'RESTART_SECTOR');
    this.drawModalActionBtn(ctx, 'ANA MENÜ', 890, 'navyBtn', 'QUIT_TO_MENU');
  }

  private renderCampaignVictoryModal(ctx: CanvasRenderingContext2D, currentScore: number): void {
    this.drawPixelPanel(ctx, 84, 380, 732, 680, 'goldSelected');

    drawPixelText(ctx, 'GEZEGEN KURTARILDI', CANVAS_WIDTH * 0.5, 475, {
      scale: 3.6,
      tone: 'gold',
      align: 'center'
    });

    for (let i = 0; i < 3; i++) {
      const star = getPixelStarSprite(true);
      blitPixelSprite(ctx, star, CANVAS_WIDTH * 0.5 + (i - 1) * 90, 565, 5);
    }

    drawPixelText(ctx, '100 BÖLÜM TAMAMLANDI', CANVAS_WIDTH * 0.5, 655, {
      scale: 3.0,
      tone: 'green',
      align: 'center'
    });

    drawPixelText(
      ctx,
      `SKOR ${formatScoreDigits(currentScore, 7)}`,
      CANVAS_WIDTH * 0.5,
      735,
      {
        scale: 3.6,
        tone: 'gold',
        align: 'center'
      }
    );

    this.drawModalActionBtn(ctx, 'SONSUZ MOD', 825, 'goldRed', 'START_ENDLESS');
    this.drawModalActionBtn(ctx, 'ANA MENÜ', 950, 'navyBtn', 'QUIT_TO_MENU');
  }

  private drawModalActionBtn(
    ctx: CanvasRenderingContext2D,
    label: string,
    y: number,
    style: 'goldRed' | 'navyBtn',
    id: string,
    h = 98
  ): void {
    const w = 540;
    const x = Math.round((CANVAS_WIDTH - w) * 0.5);
    this.drawPixelPanel(ctx, x, y, w, h, style);
    drawPixelText(ctx, label, CANVAS_WIDTH * 0.5, y + h * 0.5, {
      scale: 3.3,
      tone: style === 'goldRed' ? 'gold' : 'white',
      align: 'center'
    });
    this.addButton(id, x, y, w, h);
  }

  private drawPixelToast(ctx: CanvasRenderingContext2D, text: string): void {
    this.drawPixelPanel(ctx, 120, 108, 660, 64, 'navyBtn');
    drawPixelText(ctx, text, CANVAS_WIDTH * 0.5, 140, {
      scale: 2.5,
      tone: 'gold',
      align: 'center'
    });
  }
}
