import {
  DIFFICULTY_UI_PROFILES,
  FIXED_CAMPAIGN_STAGES,
  GameDifficulty
} from '../core/CampaignProgressionV12';
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
  measurePixelText,
  PixelSurface,
  setPx
} from '../rendering/PixelArtEngine';
import {
  getMenuPlanetHeroSprite,
  getPixelStarSprite,
  getPlayerShipSprite
} from '../rendering/VolfiedSprites';
import {
  difficultyIdToRunDifficulty,
  GameSaveData,
  StorageService
} from '../services/StorageService';
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
  public stageStripStart = 1;
  private lastSyncedDiff: GameDifficulty | null = null;
  private lastSyncedSelStage = -1;
  private cur: ColumnTransform = { tx: 0, ty: 0, s: 1 };

  public shiftStageStrip(delta: number): void {
    this.stageStripStart = Math.max(1, Math.min(22, this.stageStripStart + delta));
  }

  public centerStageStripOn(stageNum: number): void {
    this.stageStripStart = Math.max(1, Math.min(22, stageNum - 1));
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

    if (screen === 'MAIN_MENU' && layout.menuHero && layout.menuSelector) {
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
        this.renderEndlessMainMenu(ctx, save, timeSeconds);
        break;
      case 'SECTOR_SELECT':
        this.renderCampaignStageGridScreen(ctx, save);
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
   * Hero section (`y: 36..588`):
   * Green wireframe planet + diagonal twin-prong fighter + chrome `VOID CARVER` logo + personal best strip!
   */
  private renderMenuHero(
    ctx: CanvasRenderingContext2D,
    save: GameSaveData,
    timeSeconds = 0
  ): void {
    const planetHero = getMenuPlanetHeroSprite();
    blitPixelSprite(ctx, planetHero, CANVAS_WIDTH * 0.5, 286, PIXEL_SCALE * 1.18);

    const titleLogo = getVoidCarverLogoSprite();
    blitPixelSprite(ctx, titleLogo, CANVAS_WIDTH * 0.5, 168, PIXEL_SCALE * 1.06);

    const skin = SHIP_SKINS.find((s) => s.id === save.selectedShip) ?? SHIP_SKINS[0];
    const shipSprite = getPlayerShipSprite(skin, 'UP');
    const bob = Math.sin(timeSeconds * 3.2) * 5;
    const sx = CANVAS_WIDTH * 0.5 + 18;
    const sy = 372 + bob;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(1.12);

    const flameLen = 74 + Math.round(Math.sin(timeSeconds * 22) * 9);
    for (const exOff of [-22, 22]) {
      ctx.fillStyle = 'rgba(255, 160, 48, 0.35)';
      ctx.fillRect(exOff - 12, 46, 24, flameLen + 16);
      ctx.fillStyle = '#FF9828';
      ctx.fillRect(exOff - 8, 44, 16, flameLen);
      ctx.fillStyle = '#FFF4A8';
      ctx.fillRect(exOff - 5, 44, 10, Math.round(flameLen * 0.65));
    }

    ctx.imageSmoothingEnabled = false;
    const scale = 5.6;
    const dw = shipSprite.width * scale;
    const dh = shipSprite.height * scale;
    ctx.drawImage(shipSprite, -dw * 0.5, -dh * 0.5, dw, dh);
    ctx.restore();

    // Compact Personal Record Ribbon
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const rec = StorageService.getDifficultyRecord(save.difficulty, save);
    const maxUnlocked = StorageService.getHighestUnlockedStage(runDiff, save);
    const totalStars = StorageService.getTotalCampaignStarsV12(save);

    ctx.save();
    ctx.fillStyle = 'rgba(7, 11, 22, 0.9)';
    ctx.fillRect(66, 502, 768, 86);
    ctx.strokeStyle = '#3E5278';
    ctx.lineWidth = 3;
    ctx.strokeRect(66, 502, 768, 86);
    ctx.restore();

    drawPixelText(
      ctx,
      `REKOR: ${formatGroupedScore(Math.max(0, rec.highScore))}  •  ★ ${totalStars}/72`,
      CANVAS_WIDTH * 0.5,
      528,
      { scale: 2.75, tone: 'gold', align: 'center' }
    );
    drawPixelText(
      ctx,
      `ULAŞILAN DERİNLİK: BÖLÜM ${String(maxUnlocked).padStart(2, '0')} / 24`,
      CANVAS_WIDTH * 0.5,
      564,
      { scale: 2.65, tone: 'cyan', align: 'center' }
    );
  }

  private shortenBossTitle(nameTr: string): string {
    if (nameTr.length <= 16) return nameTr;
    const map: Record<string, string> = {
      'ÇELİK PEYGAMBERDEVESİ': 'ÇELİK PEYGAMBER',
      'ELEKTRİK DENİZANASI': 'ELEKT. DENİZANASI',
      'GÜNEŞ FIRTINASI ÇEKİRDEĞİ': 'GÜNEŞ ÇEKİRDEĞİ'
    };
    return map[nameTr] ?? nameTr.slice(0, 16);
  }

  /**
   * Build 12 Crystal-Clear Difficulty Selector + Live Summary Box + 24-Stage Strip + `OYNA` (`y: 610..1548`)
   */
  private renderMenuSelector(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const activeProf = DIFFICULTY_UI_PROFILES[runDiff];
    const maxUnlocked = StorageService.getHighestUnlockedStage(runDiff, save);
    const selectedStage = StorageService.getSelectedStartStage(runDiff, save);

    if (this.lastSyncedDiff !== runDiff || this.lastSyncedSelStage !== selectedStage) {
      this.lastSyncedDiff = runDiff;
      this.lastSyncedSelStage = selectedStage;
      this.centerStageStripOn(selectedStage);
    }

    // =========================================================================
    // 1. ZORLUK SEÇİMİ — 100% UNMISTAKABLE HIGH-CONTRAST ACTIVE PILL + BADGE
    // =========================================================================
    drawPixelText(ctx, 'ZORLUK SEÇİMİ', CANVAS_WIDTH * 0.5, 622, {
      scale: 2.95,
      tone: 'silver',
      align: 'center'
    });

    const rowX = 66;
    const rowW = 768;
    const diffGap = 21;
    const diffW = Math.floor((rowW - diffGap * 2) / 3); // 242
    const baseDiffY = 660;
    const baseDiffH = 104;

    const diffs: Array<{
      saveId: 'EXPLORER' | 'COMMANDER' | 'LEGEND';
      runId: GameDifficulty;
      topBevel: string;
      botShade: string;
    }> = [
      { saveId: 'EXPLORER', runId: 'EASY', topBevel: '#6EE7B7', botShade: '#047857' },
      { saveId: 'COMMANDER', runId: 'MEDIUM', topBevel: '#FDE68A', botShade: '#B45309' },
      { saveId: 'LEGEND', runId: 'HARD', topBevel: '#FCA5A5', botShade: '#B91C1C' }
    ];

    let activeCenterX = CANVAS_WIDTH * 0.5;

    for (let i = 0; i < diffs.length; i++) {
      const d = diffs[i]!;
      const prof = DIFFICULTY_UI_PROFILES[d.runId];
      const active = save.difficulty === d.saveId;

      // Selected card scales up (`scale(1.06)` feel) while unselected cards sit recessed & matte!
      const bx = active ? rowX + i * (diffW + diffGap) - 6 : rowX + i * (diffW + diffGap) + 4;
      const bw = active ? diffW + 12 : diffW - 8;
      const by = active ? baseDiffY - 10 : baseDiffY + 4;
      const bh = active ? baseDiffH + 22 : baseDiffH - 6;

      if (active) {
        activeCenterX = bx + bw * 0.5;
      }

      ctx.save();
      if (active) {
        ctx.shadowColor = prof.glowRgba;
        ctx.shadowBlur = 26;
        ctx.fillStyle = prof.accentHex;
        ctx.fillRect(bx, by, bw, bh);
        ctx.shadowBlur = 0;

        // Top specular highlight + lower bevel for tactile arcade punch
        ctx.fillStyle = d.topBevel;
        ctx.fillRect(bx + 4, by + 4, bw - 8, 6);
        ctx.fillStyle = d.botShade;
        ctx.fillRect(bx + 4, by + bh - 12, bw - 8, 8);

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);

        drawPixelText(ctx, prof.titleTr, bx + bw * 0.5, by + 46, {
          scale: 4.35,
          tone: 'white',
          align: 'center'
        });

        // Crisp dark pill badge inside active card: `✓ SEÇİLİ`
        const badgeW = 166;
        const badgeH = 34;
        const badgeX = Math.round(bx + (bw - badgeW) * 0.5);
        const badgeY = by + bh - 46;
        ctx.fillStyle = 'rgba(6, 10, 18, 0.86)';
        ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        ctx.strokeStyle = d.topBevel;
        ctx.lineWidth = 2;
        ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
        drawPixelText(ctx, '✓ SEÇİLİ', bx + bw * 0.5, badgeY + 18, {
          scale: 2.35,
          tone: d.runId === 'EASY' ? 'green' : d.runId === 'MEDIUM' ? 'gold' : 'white',
          align: 'center'
        });
      } else {
        // Matte low-distraction unselected button (`rgba(18, 24, 34, 0.65)`, `#7C8B9E` muted label)
        ctx.fillStyle = 'rgba(18, 24, 34, 0.68)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);
        // Subtle colored bottom indicator strip so player knows each button's tier color
        ctx.fillStyle = prof.accentHex;
        ctx.globalAlpha = 0.42;
        ctx.fillRect(bx + 12, by + bh - 6, bw - 24, 3);
        ctx.globalAlpha = 1;

        drawPixelText(ctx, prof.titleTr, bx + bw * 0.5, by + bh * 0.5, {
          scale: 3.45,
          tone: 'muted',
          align: 'center'
        });
      }
      ctx.restore();

      this.addButton(`SET_DIFF_${d.saveId}`, bx, by, bw, bh);
    }

    // =========================================================================
    // 2. LIVE DIFFICULTY SUMMARY BOX (Framed in `activeProf.accentHex` + Pointer)
    // =========================================================================
    const infoX = 66;
    const infoY = 796;
    const infoW = 768;
    const infoH = 96;

    ctx.save();
    ctx.shadowColor = activeProf.glowRgba;
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#070C18';
    ctx.fillRect(infoX, infoY, infoW, infoH);
    ctx.strokeStyle = activeProf.accentHex;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(infoX, infoY, infoW, infoH);
    ctx.shadowBlur = 0;

    // Upward pointer triangle pointing straight to the selected difficulty button!
    ctx.fillStyle = activeProf.accentHex;
    ctx.beginPath();
    ctx.moveTo(activeCenterX - 14, infoY);
    ctx.lineTo(activeCenterX + 14, infoY);
    ctx.lineTo(activeCenterX, infoY - 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const headerTone =
      runDiff === 'EASY' ? 'green' : runDiff === 'MEDIUM' ? 'gold' : 'crimson';
    const headerLine = `✓ SEÇİLEN: ${activeProf.titleTr} • ${activeProf.badgeTr}`;
    const rawHdrW = measurePixelText(headerLine, 2.3, 0.45);
    const hdrScale = rawHdrW > infoW - 32 ? 2.3 * ((infoW - 32) / rawHdrW) : 2.3;
    drawPixelText(ctx, headerLine, CANVAS_WIDTH * 0.5, infoY + 31, {
      scale: hdrScale,
      tone: headerTone,
      align: 'center',
      letterGap: 0.45
    });

    const rawSumW = measurePixelText(activeProf.summaryLineTr, 2.05, 0.35);
    const sumScale = rawSumW > infoW - 32 ? 2.05 * ((infoW - 32) / rawSumW) : 2.05;
    drawPixelText(ctx, activeProf.summaryLineTr, CANVAS_WIDTH * 0.5, infoY + 68, {
      scale: sumScale,
      tone: 'white',
      align: 'center',
      letterGap: 0.35
    });

    // =========================================================================
    // 3. HORIZONTAL 24-STAGE SELECTOR STRIP (`BÖLÜM 1..24`) + `TÜMÜ 24` GRID BTN
    // =========================================================================
    drawPixelText(ctx, 'BÖLÜM SEÇİCİ (SABİT 1-24)', 68, 926, {
      scale: 2.55,
      tone: 'silver',
      align: 'left',
      letterGap: 0.5
    });

    // `[TÜM 24 BÖLÜM]` quick grid button on right of header
    const allBtnX = 626;
    const allBtnY = 904;
    const allBtnW = 208;
    const allBtnH = 42;
    ctx.save();
    ctx.fillStyle = '#121E36';
    ctx.fillRect(allBtnX, allBtnY, allBtnW, allBtnH);
    ctx.strokeStyle = '#58C8FF';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(allBtnX, allBtnY, allBtnW, allBtnH);
    ctx.restore();
    drawPixelText(ctx, 'TÜM 24 BÖLÜM >', allBtnX + allBtnW * 0.5, allBtnY + 22, {
      scale: 2.05,
      tone: 'cyan',
      align: 'center',
      letterGap: 0.4
    });
    this.addButton('OPEN_STAGE_GRID', allBtnX, allBtnY, allBtnW, allBtnH);

    const stripY = 956;
    const stripH = 172;
    const navW = 58;

    // Left `<` pager button
    const canPrev = this.stageStripStart > 1;
    ctx.save();
    ctx.fillStyle = canPrev ? '#142038' : '#0A0E18';
    ctx.fillRect(54, stripY, navW, stripH);
    ctx.strokeStyle = canPrev ? '#7A92B8' : '#263044';
    ctx.lineWidth = 3;
    ctx.strokeRect(54, stripY, navW, stripH);
    ctx.restore();
    drawPixelText(ctx, '◄', 54 + navW * 0.5, stripY + stripH * 0.5, {
      scale: 3.4,
      tone: canPrev ? 'white' : 'muted',
      align: 'center'
    });
    this.addButton('STAGE_STRIP_PREV', 54, stripY, navW, stripH);

    // Right `>` pager button
    const canNext = this.stageStripStart < 22;
    ctx.save();
    ctx.fillStyle = canNext ? '#142038' : '#0A0E18';
    ctx.fillRect(788, stripY, navW, stripH);
    ctx.strokeStyle = canNext ? '#7A92B8' : '#263044';
    ctx.lineWidth = 3;
    ctx.strokeRect(788, stripY, navW, stripH);
    ctx.restore();
    drawPixelText(ctx, '►', 788 + navW * 0.5, stripY + stripH * 0.5, {
      scale: 3.4,
      tone: canNext ? 'white' : 'muted',
      align: 'center'
    });
    this.addButton('STAGE_STRIP_NEXT', 788, stripY, navW, stripH);

    // 3 visible Stage Cards in `[stageStripStart .. stageStripStart + 2]`
    const cardsAreaX = 122;
    const cardGap = 12;
    const stageCardW = 210; // 3 * 210 + 2 * 12 = 654 (122 + 654 = 776)

    for (let slot = 0; slot < 3; slot++) {
      const stageNum = this.stageStripStart + slot;
      const spec = FIXED_CAMPAIGN_STAGES[stageNum - 1];
      if (!spec) continue;

      const cx = cardsAreaX + slot * (stageCardW + cardGap);
      const unlocked = stageNum <= maxUnlocked;
      const isSelected = stageNum === selectedStage;
      const stars = StorageService.getCampaignStageStars(runDiff, stageNum, save);

      ctx.save();
      if (isSelected) {
        ctx.shadowColor = activeProf.glowRgba;
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#141B2E';
        ctx.fillRect(cx, stripY - 4, stageCardW, stripH + 8);
        ctx.strokeStyle = activeProf.accentHex;
        ctx.lineWidth = 4.5;
        ctx.strokeRect(cx, stripY - 4, stageCardW, stripH + 8);
      } else if (unlocked) {
        ctx.fillStyle = '#0D1424';
        ctx.fillRect(cx, stripY, stageCardW, stripH);
        ctx.strokeStyle = '#4A5E82';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(cx, stripY, stageCardW, stripH);
      } else {
        ctx.fillStyle = 'rgba(10, 14, 24, 0.72)';
        ctx.fillRect(cx, stripY, stageCardW, stripH);
        ctx.strokeStyle = '#242E42';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, stripY, stageCardW, stripH);
      }
      ctx.restore();

      const midX = cx + stageCardW * 0.5;
      drawPixelText(
        ctx,
        unlocked ? `BÖLÜM ${stageNum}` : `BÖLÜM ${stageNum} 🔒`,
        midX,
        stripY + 32,
        {
          scale: 2.55,
          tone: isSelected ? headerTone : unlocked ? 'white' : 'muted',
          align: 'center'
        }
      );

      drawPixelText(
        ctx,
        unlocked ? this.shortenBossTitle(spec.bossNameTr) : 'KİLİTLİ BOSS',
        midX,
        stripY + 76,
        {
          scale: 1.85,
          tone: isSelected ? 'gold' : unlocked ? 'cyan' : 'muted',
          align: 'center',
          letterGap: 0.35
        }
      );

      if (unlocked) {
        const starStr =
          stars >= 3 ? '★★★' : stars === 2 ? '★★☆' : stars === 1 ? '★☆☆' : '☆☆☆';
        drawPixelText(ctx, starStr, midX, stripY + 116, {
          scale: 2.6,
          tone: stars > 0 ? 'gold' : 'muted',
          align: 'center'
        });
        drawPixelText(
          ctx,
          isSelected ? '✓ BAŞLANGIÇ' : 'DOKUN SEÇ',
          midX,
          stripY + 150,
          {
            scale: 1.85,
            tone: isSelected ? 'green' : 'silver',
            align: 'center',
            letterGap: 0.4
          }
        );
      } else {
        drawPixelText(ctx, `BÖLÜM ${stageNum - 1} GEREKLİ`, midX, stripY + 132, {
          scale: 1.75,
          tone: 'muted',
          align: 'center',
          letterGap: 0.35
        });
      }

      this.addButton(`SELECT_STAGE_${stageNum}`, cx, stripY, stageCardW, stripH);
    }

    // =========================================================================
    // 4. GIANT ARCADE `OYNA` BUTTON (`BÖLÜM X: <BOSS>`)
    // =========================================================================
    const chosenSpec = FIXED_CAMPAIGN_STAGES[selectedStage - 1] ?? FIXED_CAMPAIGN_STAGES[0]!;
    const playW = 636;
    const playH = 174;
    const playX = Math.round((CANVAS_WIDTH - playW) * 0.5);
    const playY = 1156;

    ctx.save();
    ctx.shadowColor = 'rgba(255, 208, 64, 0.55)';
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#FFF078';
    ctx.fillRect(playX - 6, playY - 6, playW + 12, playH + 12);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#080810';
    ctx.fillRect(playX, playY, playW, playH);

    ctx.fillStyle = '#E01818';
    ctx.fillRect(playX + 6, playY + 6, playW - 12, playH - 12);
    ctx.fillStyle = '#B40C10';
    ctx.fillRect(playX + 12, playY + playH * 0.54, playW - 24, playH * 0.46 - 12);
    ctx.strokeStyle = '#FF7868';
    ctx.lineWidth = 4;
    ctx.strokeRect(playX + 10, playY + 10, playW - 20, playH - 20);
    ctx.restore();

    drawPixelText(ctx, 'OYUNA BAŞLA', CANVAS_WIDTH * 0.5, playY + 66, {
      scale: 5.5,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(
      ctx,
      `BÖLÜM ${selectedStage}: ${chosenSpec.bossNameTr} • ${activeProf.titleTr}`,
      CANVAS_WIDTH * 0.5,
      playY + 132,
      { scale: 2.3, tone: 'white', align: 'center', letterGap: 0.45 }
    );
    this.addButton('START_ENDLESS_RUN', playX, playY, playW, playH);

    // =========================================================================
    // 5. BOTTOM `GEMİLER` & `AYARLAR` BUTTONS
    // =========================================================================
    const botY = 1366;
    const botH = 100;
    const botW = 342;

    this.drawPixelPanel(ctx, 90, botY, botW, botH, 'brushedSteel');
    drawPixelText(ctx, 'GEMİLER', 90 + botW * 0.5, botY + botH * 0.5, {
      scale: 3.7,
      tone: 'white',
      align: 'center'
    });
    this.addButton('OPEN_SHIPS', 90, botY, botW, botH);

    this.drawPixelPanel(ctx, 468, botY, botW, botH, 'brushedSteel');
    drawPixelText(ctx, 'AYARLAR', 468 + botW * 0.5, botY + botH * 0.5, {
      scale: 3.7,
      tone: 'white',
      align: 'center'
    });
    this.addButton('GOTO_SETTINGS', 468, botY, botW, botH);
  }

  /**
   * Full 24-Stage Fixed Campaign Grid (`Bölüm 1..24` across 4 Sectors)
   */
  private renderCampaignStageGridScreen(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    this.drawCabinetOuterBezel(ctx);
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const prof = DIFFICULTY_UI_PROFILES[runDiff];
    const maxUnlocked = StorageService.getHighestUnlockedStage(runDiff, save);
    const selectedStage = StorageService.getSelectedStartStage(runDiff, save);

    drawPixelText(ctx, `24 SABİT BÖLÜM • ${prof.titleTr}`, CANVAS_WIDTH * 0.5, 86, {
      scale: 4.1,
      tone: runDiff === 'EASY' ? 'green' : runDiff === 'MEDIUM' ? 'gold' : 'crimson',
      align: 'center'
    });
    drawPixelText(
      ctx,
      `AÇIK BÖLÜMLER: 1 - ${maxUnlocked} / 24  •  DOKUN VE HEMEN BAŞLA`,
      CANVAS_WIDTH * 0.5,
      142,
      { scale: 2.35, tone: 'cyan', align: 'center', letterGap: 0.45 }
    );

    const cols = 4;
    const cardW = 186;
    const cardH = 166;
    const gapX = 16;
    const gapY = 18;
    const startX = Math.round((CANVAS_WIDTH - (cols * cardW + (cols - 1) * gapX)) * 0.5);
    const startY = 186;

    for (let idx = 0; idx < FIXED_CAMPAIGN_STAGES.length; idx++) {
      const st = FIXED_CAMPAIGN_STAGES[idx]!;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const unlocked = st.levelNumber <= maxUnlocked;
      const isSelected = st.levelNumber === selectedStage;
      const stars = StorageService.getCampaignStageStars(runDiff, st.levelNumber, save);

      this.drawPixelPanel(
        ctx,
        cx,
        cy,
        cardW,
        cardH,
        isSelected ? 'goldSelected' : unlocked ? 'steel' : 'locked'
      );

      drawPixelText(
        ctx,
        unlocked ? `BÖLÜM ${st.levelNumber}` : `BÖLÜM ${st.levelNumber} 🔒`,
        cx + cardW * 0.5,
        cy + 34,
        {
          scale: 2.35,
          tone: isSelected ? 'gold' : unlocked ? 'white' : 'muted',
          align: 'center'
        }
      );

      drawPixelText(
        ctx,
        unlocked ? this.shortenBossTitle(st.bossNameTr) : 'KİLİTLİ',
        cx + cardW * 0.5,
        cy + 80,
        {
          scale: 1.65,
          tone: unlocked ? 'cyan' : 'muted',
          align: 'center',
          letterGap: 0.3
        }
      );

      const starStr = unlocked
        ? stars >= 3
          ? '★★★'
          : stars === 2
            ? '★★☆'
            : stars === 1
              ? '★☆☆'
              : '☆☆☆'
        : '---';
      drawPixelText(ctx, starStr, cx + cardW * 0.5, cy + 126, {
        scale: 2.45,
        tone: stars > 0 ? 'gold' : 'muted',
        align: 'center'
      });

      this.addButton(`LAUNCH_STAGE_${st.levelNumber}`, cx, cy, cardW, cardH);
    }

    this.drawPixelPanel(ctx, 250, 1320, 400, 104, 'navyBtn');
    drawPixelText(ctx, 'ANA MENÜYE DÖN', CANVAS_WIDTH * 0.5, 1372, {
      scale: 3.3,
      tone: 'white',
      align: 'center'
    });
    this.addButton('BACK_MAIN', 250, 1320, 400, 104);
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
    this.drawModalActionBtn(ctx, 'BU BÖLÜMÜ TEKRARLA', 764, 'navyBtn', 'RETRY_CURRENT_STAGE', 92);
    this.drawModalActionBtn(ctx, 'ANA MENÜ / BÖLÜM SEÇ', 874, 'navyBtn', 'QUIT_TO_MENU', 92);
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
    this.drawPixelPanel(ctx, 64, 270, 772, 956, 'steel');

    const title =
      waveNumber === 24
        ? 'BÖLÜM 24 FİNAL ZAFERİ!'
        : `BÖLÜM ${String(waveNumber).padStart(2, '0')} TAMAMLANDI!`;
    drawPixelText(ctx, title, CANVAS_WIDTH * 0.5, 348, {
      scale: 3.9,
      tone: 'gold',
      align: 'center'
    });

    for (let i = 0; i < 3; i++) {
      const star = getPixelStarSprite(i < bd.stars);
      blitPixelSprite(ctx, star, CANVAS_WIDTH * 0.5 + (i - 1) * 90, 430, 5);
    }

    const rowLeft = 118;
    const rowRight = 782;
    const shownPct =
      bd.winReason === 'TWIN_SPLIT' || bd.winReason === 'BOSS_DESTROYED'
        ? 'TAM ZAFER'
        : `${bd.claimedPercent.toFixed(1)}%`;

    const bonusRows: Array<[string, string, 'white' | 'gold' | 'green' | 'cyan']> = [
      ['ALAN', shownPct, 'green'],
      ['BÖLÜM BONUSU', `+${bd.baseBonus}`, 'white']
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

    const rowStep = bonusRows.length <= 4 ? 50 : bonusRows.length === 5 ? 44 : 38;
    let ry = 508;
    for (const [label, val, tone] of bonusRows) {
      drawPixelText(ctx, label, rowLeft, ry, { scale: 2.9, tone: 'silver', align: 'left' });
      drawPixelText(ctx, val, rowRight, ry, { scale: 3.0, tone, align: 'right' });
      ry += rowStep;
    }

    // Next Stage Fixed Boss Preview Card!
    const nextStageIdx = waveNumber % FIXED_CAMPAIGN_STAGES.length;
    const nextSpec = FIXED_CAMPAIGN_STAGES[nextStageIdx]!;
    ctx.save();
    ctx.fillStyle = '#091020';
    ctx.fillRect(108, 770, 684, 96);
    ctx.strokeStyle = '#48C8FF';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(108, 770, 684, 96);
    ctx.restore();

    drawPixelText(
      ctx,
      `SIRADAKİ BÖLÜM ${waveNumber + 1}: ${nextSpec.bossNameTr}`,
      CANVAS_WIDTH * 0.5,
      798,
      { scale: 2.45, tone: 'cyan', align: 'center' }
    );
    drawPixelText(
      ctx,
      nextSpec.bossMechanicHintTr.slice(0, 52),
      CANVAS_WIDTH * 0.5,
      838,
      { scale: 1.75, tone: 'silver', align: 'center', letterGap: 0.35 }
    );

    drawPixelText(ctx, `SKOR ${formatScoreDigits(currentScore, 7)}`, CANVAS_WIDTH * 0.5, 916, {
      scale: 3.8,
      tone: 'gold',
      align: 'center'
    });

    this.drawModalActionBtn(ctx, 'SONRAKİ BÖLÜM >', 974, 'goldRed', 'NEXT_SECTOR');
    this.drawModalActionBtn(ctx, 'ANA MENÜ / BÖLÜM SEÇ', 1090, 'navyBtn', 'QUIT_TO_MENU', 90);
  }

  private renderGameOverModal(
    ctx: CanvasRenderingContext2D,
    currentScore: number,
    waveNumber: number,
    isNewRecord: boolean
  ): void {
    this.drawPixelPanel(ctx, 72, 360, 756, 730, 'steel');
    const stageIdx = (Math.max(1, waveNumber) - 1) % FIXED_CAMPAIGN_STAGES.length;
    const stageSpec = FIXED_CAMPAIGN_STAGES[stageIdx]!;

    drawPixelText(ctx, 'OYUN BİTTİ', CANVAS_WIDTH * 0.5, 444, {
      scale: 4.8,
      tone: 'red',
      align: 'center'
    });

    drawPixelText(
      ctx,
      `BÖLÜM ${String(waveNumber).padStart(2, '0')}: ${stageSpec.bossNameTr}`,
      CANVAS_WIDTH * 0.5,
      528,
      { scale: 3.0, tone: 'cyan', align: 'center' }
    );

    drawPixelText(
      ctx,
      `SKOR ${formatGroupedScore(currentScore)}`,
      CANVAS_WIDTH * 0.5,
      604,
      { scale: 3.9, tone: 'gold', align: 'center' }
    );

    if (isNewRecord) {
      drawPixelText(ctx, '★ YENİ KİŞİSEL REKOR! ★', CANVAS_WIDTH * 0.5, 668, {
        scale: 3.0,
        tone: 'green',
        align: 'center'
      });
    }

    // Build 12 Rule: Retry directly from current fixed level (`BÖLÜM X`) with full lives!
    this.drawModalActionBtn(
      ctx,
      `TEKRAR DENE (BÖLÜM ${waveNumber})`,
      732,
      'goldRed',
      'RETRY_CURRENT_STAGE',
      104
    );
    this.drawModalActionBtn(ctx, 'ANA MENÜ / BÖLÜM SEÇ', 858, 'navyBtn', 'QUIT_TO_MENU', 96);
    this.drawModalActionBtn(ctx, 'TÜM 24 BÖLÜM LİSTESİ', 972, 'navyBtn', 'OPEN_STAGE_GRID', 86);
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
