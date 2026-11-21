import {
  FIXED_CAMPAIGN_STAGES,
  GameDifficulty
} from '../core/CampaignProgressionV12';
import {
  CleanJetonEconomyAndStore,
  JETON_IAP_PACKS,
  SHIPS_STORE_CATALOG,
  TRAILS_STORE_CATALOG
} from '../core/CleanJetonEconomyAndStore';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  PALETTE,
  PIXEL_SCALE,
  SHIP_SKINS,
  ShipSkinId,
  STORE_SHIP_SKINS
} from '../core/Config';
import { CleanEndlessPerk } from '../core/EndUserPolishAndControlsV15';
import { HONEST_DIFFICULTIES_V15 } from '../core/HonestDifficultyAndProgressionV15';
import { ColumnTransform, getLayout } from '../core/ResponsiveLayout';
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
import {
  difficultyIdToRunDifficulty,
  GameSaveData,
  StorageService
} from '../services/StorageService';

export type ScreenState =
  | 'MAIN_MENU'
  | 'SECTOR_SELECT'
  | 'HANGAR'
  | 'ACHIEVEMENTS'
  | 'SETTINGS'
  | 'PLAYING'
  | 'PAUSED'
  | 'ROGUELITE_DRAFT'
  | 'CONTINUE_PROMPT'
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

export interface MenuOverlayData {
  currentScore: number;
  currentWave: number;
  isNewRecord: boolean;
  clearBreakdown: LevelClearBreakdown | null;
  adCountdown: number;
  statusToast: string | null;
  canOfferRevive?: boolean;
  reviveAdLoading?: boolean;
  activeGameMode?: 'CAMPAIGN' | 'ENDLESS';
  jetonStore?: CleanJetonEconomyAndStore;
  endlessPerkChoices?: readonly [CleanEndlessPerk, CleanEndlessPerk, CleanEndlessPerk] | null;
  endlessPerkStacks?: Map<string, number>;
  claimedPercent?: number;
  lastEarnedJeton?: number;
  maxComboReached?: number;
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
    color: cols[idx % cols.length]!
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
        if (glyph[gy]![gx] !== '#') continue;
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
        if (glyph[gy]![gx] !== '#') continue;
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
      const col = chromeRows[gy]!;
      for (let gx = 0; gx < 8; gx++) {
        if (glyph[gy]![gx] !== '#') continue;
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

function getStageBossNameTr(stageNum: number): string {
  const fixed = FIXED_CAMPAIGN_STAGES[stageNum - 1];
  if (fixed) return fixed.bossNameTr;
  const extraNames: Record<number, string> = {
    25: 'KARA DELİK MİMARI',
    26: 'PLAZMA LEJİSYONU',
    27: 'KRİSTAL HÜKÜMDAR',
    28: 'KIZIL HİDRA ÇEKİRDEĞİ',
    29: 'OMEGA SENTEZÖRÜ',
    30: 'SONSUZ YARIK İMPARATORU'
  };
  return extraNames[stageNum] ?? `KİMERİK BOSS ${stageNum}`;
}

export class MenuRenderer {
  public readonly activeButtons: UiButtonRect[] = [];
  public storeTab: 'SHIPS' | 'TRAILS' | 'BUY_JETON' = 'SHIPS';
  public stageStripStart = 1;
  private lastSyncedDiff: GameDifficulty | null = null;
  private lastSyncedSelStage = -1;
  private cur: ColumnTransform = { tx: 0, ty: 0, s: 1 };

  public shiftStageStrip(delta: number): void {
    this.stageStripStart = Math.max(1, Math.min(28, this.stageStripStart + delta));
  }

  public centerStageStripOn(stageNum: number): void {
    this.stageStripStart = Math.max(1, Math.min(28, stageNum - 1));
  }

  public hitTest(vx: number, vy: number): string | null {
    for (let i = this.activeButtons.length - 1; i >= 0; i--) {
      const b = this.activeButtons[i]!;
      if (vx >= b.x && vx <= b.x + b.w && vy >= b.y && vy <= b.y + b.h) {
        return b.id;
      }
    }
    return null;
  }

  private addButton(id: string, x: number, y: number, w: number, h: number): void {
    const t = this.cur;
    this.activeButtons.push({
      id,
      x: t.tx + x * t.s,
      y: t.ty + y * t.s,
      w: w * t.s,
      h: h * t.s
    });
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
    overlayData: MenuOverlayData
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
      this.withTransform(ctx, layout.menuHero, () =>
        this.renderMenuHero(ctx, save, timeSeconds, overlayData)
      );
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
    overlayData: MenuOverlayData
  ): void {
    switch (screen) {
      case 'MAIN_MENU':
        this.renderEndlessMainMenu(ctx, save, timeSeconds, overlayData);
        break;
      case 'SECTOR_SELECT':
        this.renderCampaignStageGridScreen(ctx, save);
        break;
      case 'HANGAR':
        this.renderStoreScreen(ctx, save, overlayData);
        break;
      case 'SETTINGS':
      case 'ACHIEVEMENTS':
        this.renderSettingsScreen(ctx, save);
        break;
      case 'PAUSED':
        this.renderPauseModal(ctx, save);
        break;
      case 'ROGUELITE_DRAFT':
        this.renderEndlessPerkDraftModal(ctx, overlayData);
        break;
      case 'CONTINUE_PROMPT':
        this.renderContinueModal(ctx, overlayData);
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
            overlayData.currentWave,
            overlayData.lastEarnedJeton ?? 0,
            overlayData.maxComboReached ?? 1
          );
        }
        break;
      case 'GAME_OVER':
      case 'CAMPAIGN_VICTORY':
        this.renderGameOverModal(
          ctx,
          overlayData.currentScore,
          overlayData.currentWave,
          overlayData.isNewRecord,
          Boolean(overlayData.canOfferRevive),
          Boolean(overlayData.reviveAdLoading),
          overlayData.activeGameMode ?? 'CAMPAIGN'
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

    // Subtle deep-space cobalt horizon band for richer 16-bit depth
    ctx.fillStyle = 'rgba(20, 38, 82, 0.16)';
    ctx.fillRect(0, Math.round(height * 0.18), width, Math.round(height * 0.34));

    const tilesX = Math.ceil(width / CANVAS_WIDTH);
    const tilesY = Math.ceil(height / CANVAS_HEIGHT);
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        for (let i = 0; i < SPACE_STARS.length; i++) {
          const st = SPACE_STARS[i]!;
          const py =
            Math.floor((st.y + timeSeconds * st.speed) % CANVAS_HEIGHT) + ty * CANVAS_HEIGHT;
          const tw = Math.sin(timeSeconds * 3.4 + st.phase + tx * 1.7);
          if (tw <= -0.35) continue;
          const sx = st.x + tx * CANVAS_WIDTH;
          ctx.fillStyle = st.color;
          ctx.fillRect(sx, py, st.size, st.size);
          // Crisp 16-bit cross-glint on bright hero stars
          if (st.size >= 6 && tw > 0.55) {
            ctx.fillRect(sx - 3, py + 2, 12, 2);
            ctx.fillRect(sx + 2, py - 3, 2, 12);
          }
        }
      }
    }

    // Periodic 16-bit pixel shooting star across deep space
    const meteorCycle = (timeSeconds * 0.22) % 1;
    if (meteorCycle < 0.18) {
      const t = meteorCycle / 0.18;
      const mx = Math.round(width * 0.85 - t * width * 0.65);
      const my = Math.round(height * 0.08 + t * height * 0.24);
      ctx.fillStyle = 'rgba(136, 224, 255, 0.35)';
      ctx.fillRect(mx + 12, my - 6, 28, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(mx, my, 6, 4);
    }
  }

  private drawCabinetOuterBezel(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const m = 10;
    const w = CANVAS_WIDTH - m * 2;
    const h = CANVAS_HEIGHT - m * 2;

    ctx.strokeStyle = '#5C687E';
    ctx.lineWidth = 10;
    ctx.strokeRect(m, m, w, h);
    ctx.strokeStyle = '#9AA8C0';
    ctx.lineWidth = 3;
    ctx.strokeRect(m + 4, m + 4, w - 8, h - 8);

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
    style:
      | 'goldRed'
      | 'emeraldGold'
      | 'steel'
      | 'goldSelected'
      | 'locked'
      | 'navyBtn'
      | 'brushedSteel'
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
    } else if (style === 'emeraldGold') {
      fill = '#0E7C4B';
      topRim = '#78FFB8';
      botRim = '#07462A';
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
  // 1. ORIGINAL VOID CARVER ARCADE MAIN MENU (CLEANED & ULTRA-READABLE!)
  // ============================================================================
  private renderEndlessMainMenu(
    ctx: CanvasRenderingContext2D,
    save: GameSaveData,
    timeSeconds: number,
    overlayData?: MenuOverlayData
  ): void {
    this.drawCabinetOuterBezel(ctx);
    this.renderMenuHero(ctx, save, timeSeconds, overlayData);
    this.renderMenuSelector(ctx, save);
  }

  private renderMenuHero(
    ctx: CanvasRenderingContext2D,
    save: GameSaveData,
    timeSeconds = 0,
    overlayData?: MenuOverlayData
  ): void {
    const store = overlayData?.jetonStore;
    const jeton = store ? store.jetonBalance : (save.v15Store?.jetonBalance ?? 50);
    const rec = StorageService.getDifficultyRecord(save.difficulty, save);

    // Clean Top Bar (`y: 40..98`) — Jeton on Left, Personal Best on Right (zero overlap with Logo/Planet!)
    this.drawPixelPanel(ctx, 56, 40, 252, 58, 'goldSelected');
    drawPixelText(ctx, `${formatGroupedScore(jeton)} JETON`, 56 + 126, 69, {
      scale: 2.95,
      tone: 'gold',
      align: 'center',
      maxWidth: 222
    });
    this.addButton('OPEN_SHIPS', 56, 40, 252, 58);

    this.drawPixelPanel(ctx, 560, 40, 284, 58, 'navyBtn');
    drawPixelText(ctx, `REKOR ${formatGroupedScore(Math.max(0, rec.highScore))}`, 560 + 142, 69, {
      scale: 2.75,
      tone: 'cyan',
      align: 'center',
      maxWidth: 254
    });

    // Spacious Hero Centerpiece (`y: 112..556` — pure starry void around Logo, Planet & Fighter!)
    const planetHero = getMenuPlanetHeroSprite();
    blitPixelSprite(ctx, planetHero, CANVAS_WIDTH * 0.5, 382, PIXEL_SCALE * 1.04);

    const titleLogo = getVoidCarverLogoSprite();
    blitPixelSprite(ctx, titleLogo, CANVAS_WIDTH * 0.5, 166, PIXEL_SCALE * 1.05);

    const equippedShipId = store?.equippedShipId ?? save.v15Store?.equippedShipId ?? 'SHIP_VANGUARD';
    const skin =
      STORE_SHIP_SKINS[equippedShipId] ??
      SHIP_SKINS.find((s) => s.id === save.selectedShip) ??
      SHIP_SKINS[0]!;
    const shipSprite = getPlayerShipSprite(skin, 'UP');
    const bob = Math.sin(timeSeconds * 3.2) * 5;
    const sx = CANVAS_WIDTH * 0.5 + 18;
    const sy = 436 + bob;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(1.12);

    const flameLen = 72 + Math.round(Math.sin(timeSeconds * 22) * 9);
    for (const exOff of [-22, 22]) {
      ctx.fillStyle = 'rgba(255, 160, 48, 0.35)';
      ctx.fillRect(exOff - 12, 46, 24, flameLen + 16);
      ctx.fillStyle = '#FF9828';
      ctx.fillRect(exOff - 8, 44, 16, flameLen);
      ctx.fillStyle = '#FFF4A8';
      ctx.fillRect(exOff - 5, 44, 10, Math.round(flameLen * 0.65));
    }

    ctx.imageSmoothingEnabled = false;
    const scale = 5.5;
    const dw = shipSprite.width * scale;
    const dh = shipSprite.height * scale;
    ctx.drawImage(shipSprite, -dw * 0.5, -dh * 0.5, dw, dh);
    ctx.restore();
  }

  private renderMenuSelector(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const diffSpec = HONEST_DIFFICULTIES_V15[runDiff];
    const maxUnlocked = StorageService.getHighestUnlockedStage(runDiff, save);
    const selectedStage = StorageService.getSelectedStartStage(runDiff, save);
    const stars = StorageService.getCampaignStageStars(runDiff, selectedStage, save);

    if (this.lastSyncedDiff !== runDiff || this.lastSyncedSelStage !== selectedStage) {
      this.lastSyncedDiff = runDiff;
      this.lastSyncedSelStage = selectedStage;
      this.centerStageStripOn(selectedStage);
    }

    // 1. ZORLUK SEÇİMİ (`y: 604..718`) — Tactile Beveled Arcade Cards with Embedded Spec Badge!
    const rowX = 66;
    const rowW = 768;
    const diffGap = 21;
    const diffW = Math.floor((rowW - diffGap * 2) / 3);
    const baseDiffY = 608;
    const baseDiffH = 108;

    const diffs: Array<{
      saveId: 'EXPLORER' | 'COMMANDER' | 'LEGEND';
      runId: GameDifficulty;
      topBevel: string;
      botShade: string;
      shortBadge: string;
    }> = [
      {
        saveId: 'EXPLORER',
        runId: 'EASY',
        topBevel: '#6EE7B7',
        botShade: '#047857',
        shortBadge: '4 GEMİ • %75'
      },
      {
        saveId: 'COMMANDER',
        runId: 'MEDIUM',
        topBevel: '#FDE68A',
        botShade: '#B45309',
        shortBadge: '3 GEMİ • %78'
      },
      {
        saveId: 'LEGEND',
        runId: 'HARD',
        topBevel: '#FCA5A5',
        botShade: '#B91C1C',
        shortBadge: '3 GEMİ • %80'
      }
    ];

    for (let i = 0; i < diffs.length; i++) {
      const d = diffs[i]!;
      const spec = HONEST_DIFFICULTIES_V15[d.runId];
      const active = save.difficulty === d.saveId;

      const bx = active ? rowX + i * (diffW + diffGap) - 6 : rowX + i * (diffW + diffGap) + 4;
      const bw = active ? diffW + 12 : diffW - 8;
      const by = active ? baseDiffY - 8 : baseDiffY + 4;
      const bh = active ? baseDiffH + 16 : baseDiffH - 8;

      ctx.save();
      if (active) {
        ctx.fillStyle = spec.accentHex;
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = d.topBevel;
        ctx.fillRect(bx + 4, by + 4, bw - 8, 6);
        ctx.fillStyle = d.botShade;
        ctx.fillRect(bx + 4, by + bh - 12, bw - 8, 8);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);

        drawPixelText(ctx, spec.labelTr, bx + bw * 0.5, by + 42, {
          scale: 4.1,
          tone: 'white',
          align: 'center'
        });

        const badgeW = bw - 26;
        const badgeH = 34;
        const badgeX = Math.round(bx + (bw - badgeW) * 0.5);
        const badgeY = by + bh - 46;
        ctx.fillStyle = 'rgba(6, 10, 18, 0.90)';
        ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
        ctx.strokeStyle = d.topBevel;
        ctx.lineWidth = 2;
        ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);
        drawPixelText(ctx, d.shortBadge, bx + bw * 0.5, badgeY + 17, {
          scale: 2.35,
          tone: d.runId === 'EASY' ? 'green' : d.runId === 'MEDIUM' ? 'gold' : 'white',
          align: 'center',
          maxWidth: badgeW - 12
        });
      } else {
        ctx.fillStyle = 'rgba(18, 24, 38, 0.84)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#3E5278';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillStyle = spec.accentHex;
        ctx.fillRect(bx + 14, by + bh - 6, bw - 28, 3);

        drawPixelText(ctx, spec.labelTr, bx + bw * 0.5, by + bh * 0.5, {
          scale: 3.5,
          tone: 'silver',
          align: 'center'
        });
      }
      ctx.restore();

      this.addButton(`SET_DIFF_${d.saveId}`, bx, by, bw, bh);
    }

    // 2. SLEEK SINGLE-ROW INTEGRATED STAGE SELECTOR (`y: 762..872` — 40px breathing room!)
    const deckY = 762;
    const deckH = 110;
    const navW = 72;
    const canPrev = selectedStage > 1;
    const canNext = selectedStage < maxUnlocked;

    this.drawPixelPanel(ctx, rowX, deckY, navW, deckH, canPrev ? 'navyBtn' : 'locked');
    drawPixelText(ctx, '◄', rowX + navW * 0.5, deckY + deckH * 0.5, {
      scale: 3.6,
      tone: canPrev ? 'white' : 'muted',
      align: 'center'
    });
    this.addButton('PREV_STAGE_MAIN', rowX, deckY, navW, deckH);

    const nextX = rowX + rowW - navW;
    this.drawPixelPanel(ctx, nextX, deckY, navW, deckH, canNext ? 'navyBtn' : 'locked');
    drawPixelText(ctx, '►', nextX + navW * 0.5, deckY + deckH * 0.5, {
      scale: 3.6,
      tone: canNext ? 'white' : 'muted',
      align: 'center'
    });
    this.addButton('NEXT_STAGE_MAIN', nextX, deckY, navW, deckH);

    const midCardX = rowX + navW + 14;
    const midCardW = rowW - (navW + 14) * 2;
    const chosenBoss = getStageBossNameTr(selectedStage);
    const starTag =
      stars >= 3 ? ' ★★★' : stars === 2 ? ' ★★☆' : stars === 1 ? ' ★☆☆' : '';
    this.drawPixelPanel(ctx, midCardX, deckY, midCardW, deckH, 'steel');
    drawPixelText(
      ctx,
      `BÖLÜM ${String(selectedStage).padStart(2, '0')}: ${chosenBoss}${starTag}`,
      midCardX + midCardW * 0.5,
      deckY + 38,
      {
        scale: 2.9,
        tone: 'gold',
        align: 'center',
        maxWidth: midCardW - 28
      }
    );
    drawPixelText(
      ctx,
      `AÇIK: 1-${maxUnlocked}/30  •  TÜM BÖLÜMLER >`,
      midCardX + midCardW * 0.5,
      deckY + 80,
      {
        scale: 2.35,
        tone: 'cyan',
        align: 'center',
        maxWidth: midCardW - 28
      }
    );
    this.addButton('OPEN_STAGE_GRID', midCardX, deckY, midCardW, deckH);

    // 3. GIANT ICONIC RED-GOLD ARCADE `OYUNA BAŞLA` BUTTON (`y: 912..1074` — 40px gap!)
    const playW = 768;
    const playH = 162;
    const playX = rowX;
    const playY = 912;

    ctx.save();
    ctx.fillStyle = '#FFF078';
    ctx.fillRect(playX - 5, playY - 5, playW + 10, playH + 10);
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

    drawPixelText(ctx, 'OYUNA BAŞLA', CANVAS_WIDTH * 0.5, playY + 58, {
      scale: 5.4,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(
      ctx,
      `BÖLÜM ${selectedStage} • ${diffSpec.labelTr} MOD`,
      CANVAS_WIDTH * 0.5,
      playY + 118,
      { scale: 2.85, tone: 'white', align: 'center', maxWidth: playW - 44 }
    );
    this.addButton('START_ENDLESS_RUN', playX, playY, playW, playH);

    // 4. EMERALD-GOLD `SONSUZ MOD` ARCADE BUTTON (`y: 1110..1234` — 36px gap!)
    const endY = 1110;
    const endH = 124;
    const bestEndless = save.v15Store?.bestEndlessWave?.[runDiff] ?? 0;
    this.drawPixelPanel(ctx, playX, endY, playW, endH, 'emeraldGold');
    drawPixelText(ctx, 'SONSUZ MOD', CANVAS_WIDTH * 0.5, endY + 44, {
      scale: 4.2,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(
      ctx,
      bestEndless > 0
        ? `EN İYİ DALGA: ${bestEndless}  •  KİMERİK BOSS VE GÜÇ SEÇİMİ`
        : 'KİMERİK BOSS DALGALARI VE GÜÇ SEÇİMİ',
      CANVAS_WIDTH * 0.5,
      endY + 90,
      {
        scale: 2.45,
        tone: 'white',
        align: 'center',
        maxWidth: playW - 44
      }
    );
    this.addButton('START_ENDLESS_MODE', playX, endY, playW, endH);

    // 5. BOTTOM `MAĞAZA` & `AYARLAR` BRUSHED-STEEL RIVETED BUTTONS (`y: 1272..1384` — 38px gap!)
    const botY = 1272;
    const botH = 112;
    const botW = 370;

    this.drawPixelPanel(ctx, playX, botY, botW, botH, 'brushedSteel');
    drawPixelText(ctx, 'MAĞAZA', playX + botW * 0.5, botY + botH * 0.5, {
      scale: 3.9,
      tone: 'gold',
      align: 'center'
    });
    this.addButton('OPEN_SHIPS', playX, botY, botW, botH);

    const setX = playX + playW - botW;
    this.drawPixelPanel(ctx, setX, botY, botW, botH, 'brushedSteel');
    drawPixelText(ctx, 'AYARLAR', setX + botW * 0.5, botY + botH * 0.5, {
      scale: 3.9,
      tone: 'white',
      align: 'center'
    });
    this.addButton('GOTO_SETTINGS', setX, botY, botW, botH);
  }

  // ============================================================================
  // 2. 3-TAB ARCADE `MAĞAZA` (`GEMİLER | İZLER | JETON AL`)
  // ============================================================================
  private renderStoreScreen(
    ctx: CanvasRenderingContext2D,
    save: GameSaveData,
    overlayData: MenuOverlayData
  ): void {
    this.drawCabinetOuterBezel(ctx);
    const store = overlayData.jetonStore ?? new CleanJetonEconomyAndStore();
    if (!overlayData.jetonStore) {
      StorageService.hydrateV15Store(store, save);
    }

    drawPixelText(ctx, 'MAĞAZA', 220, 82, {
      scale: 4.8,
      tone: 'gold',
      align: 'center'
    });

    this.drawPixelPanel(ctx, 520, 46, 316, 72, 'goldSelected');
    drawPixelText(ctx, `${formatGroupedScore(store.jetonBalance)} JETON`, 520 + 158, 82, {
      scale: 3.2,
      tone: 'gold',
      align: 'center',
      maxWidth: 286
    });

    // 3 Arcade Tabs: `GEMİLER` | `İZLER` | `JETON AL`
    const tabs: Array<{ id: 'SHIPS' | 'TRAILS' | 'BUY_JETON'; label: string }> = [
      { id: 'SHIPS', label: 'GEMİLER' },
      { id: 'TRAILS', label: 'İZLER' },
      { id: 'BUY_JETON', label: 'JETON AL' }
    ];
    const tabStartX = 64;
    const tabGap = 14;
    const tabW = Math.floor((772 - tabGap * 2) / 3);
    const tabY = 142;
    const tabH = 82;

    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i]!;
      const tx = tabStartX + i * (tabW + tabGap);
      const active = this.storeTab === t.id;
      this.drawPixelPanel(ctx, tx, tabY, tabW, tabH, active ? 'goldRed' : 'navyBtn');
      drawPixelText(ctx, t.label, tx + tabW * 0.5, tabY + tabH * 0.5, {
        scale: 3.2,
        tone: active ? 'gold' : 'silver',
        align: 'center'
      });
      this.addButton(`SET_STORE_TAB_${t.id}`, tx, tabY, tabW, tabH);
    }

    if (this.storeTab === 'SHIPS') {
      this.renderArcadeShipsTab(ctx, store);
    } else if (this.storeTab === 'TRAILS') {
      this.renderArcadeTrailsTab(ctx, store);
    } else {
      this.renderArcadeBuyJetonTab(ctx, store);
    }

    this.drawPixelPanel(ctx, 250, 1416, 400, 96, 'navyBtn');
    drawPixelText(ctx, 'GERİ', CANVAS_WIDTH * 0.5, 1464, {
      scale: 3.8,
      tone: 'white',
      align: 'center'
    });
    this.addButton('BACK_MAIN', 250, 1416, 400, 96);
  }

  private renderArcadeShipsTab(
    ctx: CanvasRenderingContext2D,
    store: CleanJetonEconomyAndStore
  ): void {
    const startX = 64;
    const startY = 250;
    const cardW = 372;
    const cardH = 266;
    const gapX = 28;
    const gapY = 20;

    for (let i = 0; i < SHIPS_STORE_CATALOG.length; i++) {
      const item = SHIPS_STORE_CATALOG[i]!;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const owned = store.ownedShips.has(item.id);
      const equipped = store.equippedShipId === item.id;
      const affordable = store.jetonBalance >= item.jetonCost;

      this.drawPixelPanel(
        ctx,
        cx,
        cy,
        cardW,
        cardH,
        equipped ? 'goldSelected' : owned ? 'steel' : affordable ? 'navyBtn' : 'locked'
      );

      const skin = STORE_SHIP_SKINS[item.id] ?? SHIP_SKINS[0]!;
      const sprite = getPlayerShipSprite(skin, 'UP');
      blitPixelSprite(ctx, sprite, cx + cardW * 0.5, cy + 78, 4.5);

      drawPixelText(ctx, item.nameTr.toUpperCase(), cx + cardW * 0.5, cy + 158, {
        scale: 3.3,
        tone: equipped ? 'gold' : 'white',
        align: 'center',
        maxWidth: cardW - 32
      });

      const statusText = equipped
        ? '✓ SEÇİLİ'
        : owned
          ? 'KUŞAN'
          : `${formatGroupedScore(item.jetonCost)} JETON`;
      const statusTone = equipped ? 'green' : owned ? 'cyan' : affordable ? 'gold' : 'muted';

      drawPixelText(ctx, statusText, cx + cardW * 0.5, cy + 216, {
        scale: 2.9,
        tone: statusTone,
        align: 'center',
        maxWidth: cardW - 32
      });

      this.addButton(`BUY_OR_EQUIP_SHIP_${item.id}`, cx, cy, cardW, cardH);
    }
  }

  private renderArcadeTrailsTab(
    ctx: CanvasRenderingContext2D,
    store: CleanJetonEconomyAndStore
  ): void {
    const startX = 64;
    const startY = 266;
    const cardW = 372;
    const cardH = 340;
    const gapX = 28;
    const gapY = 28;

    for (let i = 0; i < TRAILS_STORE_CATALOG.length; i++) {
      const item = TRAILS_STORE_CATALOG[i]!;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const owned = store.ownedTrails.has(item.id);
      const equipped = store.equippedTrailId === item.id;
      const affordable = store.jetonBalance >= item.jetonCost;

      this.drawPixelPanel(
        ctx,
        cx,
        cy,
        cardW,
        cardH,
        equipped ? 'goldSelected' : owned ? 'steel' : affordable ? 'navyBtn' : 'locked'
      );

      ctx.save();
      const lx1 = cx + 56;
      const lx2 = cx + cardW - 56;
      const ly = cy + 96;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (item.vfxType === 'LIGHTNING') {
        ctx.moveTo(lx1, ly + 8);
        ctx.lineTo(lx1 + 64, ly - 12);
        ctx.lineTo(lx1 + 128, ly + 12);
        ctx.lineTo(lx1 + 192, ly - 10);
        ctx.lineTo(lx2, ly + 6);
      } else {
        ctx.moveTo(lx1, ly);
        ctx.lineTo(lx2, ly);
      }
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = item.primaryHex;
      ctx.lineWidth = 18;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = item.primaryHex;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = item.glowHex;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      drawPixelText(ctx, item.nameTr.toUpperCase(), cx + cardW * 0.5, cy + 194, {
        scale: 3.4,
        tone: equipped ? 'gold' : 'white',
        align: 'center',
        maxWidth: cardW - 32
      });

      const statusText = equipped
        ? '✓ SEÇİLİ'
        : owned
          ? 'KUŞAN'
          : `${formatGroupedScore(item.jetonCost)} JETON`;
      const statusTone = equipped ? 'green' : owned ? 'cyan' : affordable ? 'gold' : 'muted';

      drawPixelText(ctx, statusText, cx + cardW * 0.5, cy + 266, {
        scale: 3.0,
        tone: statusTone,
        align: 'center',
        maxWidth: cardW - 32
      });

      this.addButton(`BUY_OR_EQUIP_TRAIL_${item.id}`, cx, cy, cardW, cardH);
    }
  }

  private renderArcadeBuyJetonTab(
    ctx: CanvasRenderingContext2D,
    store: CleanJetonEconomyAndStore
  ): void {
    const startX = 64;
    const startY = 266;
    const cardW = 372;
    const cardH = 440;
    const gapX = 28;
    const gapY = 30;

    for (let i = 0; i < JETON_IAP_PACKS.length; i++) {
      const pack = JETON_IAP_PACKS[i]!;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const isStarter = pack.productId === 'com.tahafirat.voidcarver.starter_x2';
      const starterOwned = isStarter && store.hasPermanentDoubleJeton;
      const priceStr = store.localizedPrices[pack.productId] || pack.defaultDisplayPriceTr;

      this.drawPixelPanel(
        ctx,
        cx,
        cy,
        cardW,
        cardH,
        starterOwned ? 'emeraldGold' : isStarter ? 'goldSelected' : 'steel'
      );

      const midX = cx + cardW * 0.5;
      if (!isStarter) {
        drawPixelText(ctx, formatGroupedScore(pack.jetonAmount), midX, cy + 114, {
          scale: 5.8,
          tone: 'gold',
          align: 'center',
          maxWidth: cardW - 36
        });
        drawPixelText(ctx, 'JETON', midX, cy + 188, {
          scale: 3.4,
          tone: 'white',
          align: 'center'
        });
        drawPixelText(ctx, pack.detailTr.toUpperCase(), midX, cy + 252, {
          scale: 2.35,
          tone: 'cyan',
          align: 'center',
          maxWidth: cardW - 36
        });
      } else {
        drawPixelText(ctx, 'BAŞLANGIÇ PAKETİ', midX, cy + 86, {
          scale: 3.4,
          tone: 'gold',
          align: 'center',
          maxWidth: cardW - 32
        });
        drawPixelText(ctx, 'KALICI x2 JETON', midX, cy + 154, {
          scale: 3.1,
          tone: 'green',
          align: 'center',
          maxWidth: cardW - 32
        });
        drawPixelText(ctx, '+ PHANTOM GEMİSİ', midX, cy + 206, {
          scale: 2.6,
          tone: 'cyan',
          align: 'center',
          maxWidth: cardW - 32
        });
        drawPixelText(ctx, '+ 750 JETON', midX, cy + 252, {
          scale: 2.8,
          tone: 'white',
          align: 'center',
          maxWidth: cardW - 32
        });
      }

      // Bottom price button strip inside card
      this.drawPixelPanel(
        ctx,
        cx + 26,
        cy + 318,
        cardW - 52,
        90,
        starterOwned ? 'emeraldGold' : 'goldRed'
      );
      drawPixelText(ctx, starterOwned ? 'AKTİF ✓' : priceStr, midX, cy + 363, {
        scale: 3.5,
        tone: starterOwned ? 'white' : 'gold',
        align: 'center',
        maxWidth: cardW - 76
      });

      this.addButton(`BUY_JETON_PACK_${pack.productId}`, cx, cy, cardW, cardH);
    }

    // Restore Purchases Arcade Button
    this.drawPixelPanel(ctx, 170, 1218, 560, 82, 'brushedSteel');
    drawPixelText(ctx, 'SATIN ALIMLARI GERİ YÜKLE', CANVAS_WIDTH * 0.5, 1259, {
      scale: 2.85,
      tone: 'white',
      align: 'center',
      maxWidth: 520
    });
    this.addButton('RESTORE_IAP_PURCHASES', 170, 1218, 560, 82);
  }

  // ============================================================================
  // 3. 30-STAGE CAMPAIGN GRID (`BÖLÜM 1..30`)
  // ============================================================================
  private renderCampaignStageGridScreen(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    this.drawCabinetOuterBezel(ctx);
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const diffSpec = HONEST_DIFFICULTIES_V15[runDiff];
    const maxUnlocked = StorageService.getHighestUnlockedStage(runDiff, save);
    const selectedStage = StorageService.getSelectedStartStage(runDiff, save);

    drawPixelText(ctx, `30 BÖLÜM • ${diffSpec.labelTr}`, CANVAS_WIDTH * 0.5, 82, {
      scale: 4.3,
      tone: runDiff === 'EASY' ? 'green' : runDiff === 'MEDIUM' ? 'gold' : 'crimson',
      align: 'center'
    });
    drawPixelText(
      ctx,
      `ULAŞILAN DERİNLİK: BÖLÜM ${maxUnlocked} / 30  •  DOKUN VE BAŞLA`,
      CANVAS_WIDTH * 0.5,
      138,
      { scale: 2.5, tone: 'cyan', align: 'center', maxWidth: 800 }
    );

    const cols = 5;
    const cardW = 144;
    const cardH = 166;
    const gapX = 14;
    const gapY = 16;
    const startX = Math.round((CANVAS_WIDTH - (cols * cardW + (cols - 1) * gapX)) * 0.5);
    const startY = 184;

    for (let stNum = 1; stNum <= 30; stNum++) {
      const idx = stNum - 1;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const unlocked = stNum <= maxUnlocked;
      const isSelected = stNum === selectedStage;
      const stars = StorageService.getCampaignStageStars(runDiff, stNum, save);

      this.drawPixelPanel(
        ctx,
        cx,
        cy,
        cardW,
        cardH,
        isSelected ? 'goldSelected' : unlocked ? 'steel' : 'locked'
      );

      drawPixelText(ctx, `${stNum}`, cx + cardW * 0.5, cy + 56, {
        scale: 3.9,
        tone: isSelected ? 'gold' : unlocked ? 'white' : 'muted',
        align: 'center'
      });

      const starStr = unlocked
        ? stars >= 3
          ? '★★★'
          : stars === 2
            ? '★★☆'
            : stars === 1
              ? '★☆☆'
              : 'AÇIK'
        : 'KİLİTLİ';
      drawPixelText(ctx, starStr, cx + cardW * 0.5, cy + 122, {
        scale: 2.25,
        tone: stars > 0 ? 'gold' : unlocked ? 'cyan' : 'muted',
        align: 'center',
        maxWidth: cardW - 20
      });

      this.addButton(`LAUNCH_STAGE_${stNum}`, cx, cy, cardW, cardH);
    }

    this.drawPixelPanel(ctx, 250, 1320, 400, 100, 'navyBtn');
    drawPixelText(ctx, 'ANA MENÜYE DÖN', CANVAS_WIDTH * 0.5, 1370, {
      scale: 3.3,
      tone: 'white',
      align: 'center'
    });
    this.addButton('BACK_MAIN', 250, 1320, 400, 100);
  }

  // ============================================================================
  // 4. ORIGINAL `AYARLAR` SCREEN WITH LIVE CONTROLLER PREVIEW
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
      align: 'center',
      maxWidth: rowW - 36
    });
    this.addButton('CYCLE_CONTROL_MODE', rowX, y0, rowW, rowH);

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
      align: 'center',
      maxWidth: rowW - 36
    });
    this.addButton('TOGGLE_JOYSTICK_SIDE', rowX, y1, rowW, rowH);

    const prevY = y1 + rowH + 20;
    const prevH = 216;
    this.drawPixelPanel(ctx, rowX, prevY, rowW, prevH, 'steel');
    drawPixelText(ctx, 'CANLI KONTROL ÖNİZLEME', CANVAS_WIDTH * 0.5, prevY + 32, {
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
      { scale: 2.2, tone: 'gold', align: 'center' }
    );

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

    this.drawPixelPanel(ctx, 250, 1280, 400, 104, 'navyBtn');
    drawPixelText(ctx, 'GERİ', CANVAS_WIDTH * 0.5, 1332, {
      scale: 4.0,
      tone: 'white',
      align: 'center'
    });
    this.addButton('BACK_MAIN', 250, 1280, 400, 104);
  }

  // ============================================================================
  // 5. ENDLESS MODE 3-CARD PERK DRAFT & CONTINUE MODALS (ARCADE STEEL STYLE!)
  // ============================================================================
  private renderEndlessPerkDraftModal(
    ctx: CanvasRenderingContext2D,
    overlayData: MenuOverlayData
  ): void {
    const cards = overlayData.endlessPerkChoices ?? [];
    const stacks = overlayData.endlessPerkStacks;
    const earned = overlayData.lastEarnedJeton ?? 0;

    this.drawPixelPanel(ctx, 56, 200, 788, 1140, 'steel');

    drawPixelText(ctx, `DALGA ${overlayData.currentWave} TAMAMLANDI!`, CANVAS_WIDTH * 0.5, 274, {
      scale: 4.2,
      tone: 'gold',
      align: 'center'
    });
    drawPixelText(
      ctx,
      earned > 0 ? `+${earned} JETON KAZANILDI  •  BİR GÜÇ SEÇ` : 'DEVAM İÇİN BİR GÜÇ SEÇ',
      CANVAS_WIDTH * 0.5,
      336,
      { scale: 2.9, tone: 'cyan', align: 'center', maxWidth: 720 }
    );

    const cardX = 94;
    const cardW = 712;
    const cardH = 264;
    const gapY = 26;
    const startY = 398;

    for (let i = 0; i < cards.length; i++) {
      const c = cards[i]!;
      const cy = startY + i * (cardH + gapY);
      const curLv = stacks?.get(c.id) ?? 0;

      this.drawPixelPanel(ctx, cardX, cy, cardW, cardH, 'goldSelected');

      drawPixelText(ctx, c.titleTr.toUpperCase(), cardX + 38, cy + 72, {
        scale: 3.8,
        tone: 'gold',
        align: 'left',
        maxWidth: cardW - 220
      });

      drawPixelText(ctx, c.shortDescTr, cardX + 38, cy + 144, {
        scale: 2.9,
        tone: 'white',
        align: 'left',
        maxWidth: cardW - 220
      });

      drawPixelText(ctx, `KADEME ${curLv + 1} / ${c.maxStacks}`, cardX + 38, cy + 206, {
        scale: 2.5,
        tone: 'cyan',
        align: 'left'
      });

      this.drawPixelPanel(ctx, cardX + cardW - 178, cy + 84, 146, 96, 'goldRed');
      drawPixelText(ctx, 'SEÇ', cardX + cardW - 105, cy + 132, {
        scale: 3.5,
        tone: 'gold',
        align: 'center'
      });

      this.addButton(`PICK_PERK_${i}`, cardX, cy, cardW, cardH);
    }
  }

  private renderContinueModal(ctx: CanvasRenderingContext2D, overlayData: MenuOverlayData): void {
    const store = overlayData.jetonStore;
    const balance = store ? store.jetonBalance : 0;
    const canAfford = balance >= CleanJetonEconomyAndStore.CONTINUE_COST_JETON;
    const pct = Math.floor(overlayData.claimedPercent ?? 0);
    const canAd = Boolean(overlayData.canOfferRevive);
    const adLoading = Boolean(overlayData.reviveAdLoading);

    this.drawPixelPanel(ctx, 76, 320, 748, 840, 'steel');

    drawPixelText(ctx, 'SON ŞANS • DEVAM ET?', CANVAS_WIDTH * 0.5, 408, {
      scale: 4.3,
      tone: 'gold',
      align: 'center',
      maxWidth: 680
    });

    drawPixelText(
      ctx,
      `KESİLEN ALAN: %${pct}  •  MEVCUT: ${formatGroupedScore(balance)} JETON`,
      CANVAS_WIDTH * 0.5,
      484,
      { scale: 2.8, tone: 'cyan', align: 'center', maxWidth: 680 }
    );

    const btnW = 616;
    const btnX = Math.round((CANVAS_WIDTH - btnW) * 0.5);

    this.drawPixelPanel(ctx, btnX, 558, btnW, 118, canAfford ? 'goldRed' : 'locked');
    drawPixelText(
      ctx,
      canAfford ? 'DEVAM ET • 100 JETON' : 'YETERSİZ JETON (100 GEREKLİ)',
      CANVAS_WIDTH * 0.5,
      558 + 59,
      {
        scale: 3.4,
        tone: canAfford ? 'gold' : 'muted',
        align: 'center',
        maxWidth: btnW - 36
      }
    );
    if (canAfford) {
      this.addButton('USE_JETON_CONTINUE', btnX, 558, btnW, 118);
    }

    let nextY = 706;
    if (canAd) {
      this.drawPixelPanel(ctx, btnX, nextY, btnW, 114, adLoading ? 'locked' : 'emeraldGold');
      drawPixelText(
        ctx,
        adLoading ? 'REKLAM YÜKLENİYOR...' : 'VİDEO İZLE • +1 GEMİ HAKKI',
        CANVAS_WIDTH * 0.5,
        nextY + 57,
        {
          scale: 3.2,
          tone: adLoading ? 'silver' : 'gold',
          align: 'center',
          maxWidth: btnW - 36
        }
      );
      if (!adLoading) {
        this.addButton('ACCEPT_REVIVE', btnX, nextY, btnW, 114);
      }
      nextY += 142;
    }

    this.drawPixelPanel(ctx, btnX, nextY, btnW, 102, 'navyBtn');
    drawPixelText(ctx, 'VAZGEÇ', CANVAS_WIDTH * 0.5, nextY + 51, {
      scale: 3.4,
      tone: 'white',
      align: 'center'
    });
    this.addButton('DECLINE_REVIVE', btnX, nextY, btnW, 102);
  }

  // ============================================================================
  // 6. ORIGINAL IN-GAME ARCADE MODALS (`PAUSED`, `LEVEL_CLEAR`, `GAME_OVER`)
  // ============================================================================
  private renderPauseModal(ctx: CanvasRenderingContext2D, save: GameSaveData): void {
    this.drawPixelPanel(ctx, 76, 286, 748, 800, 'steel');

    drawPixelText(ctx, 'DURAKLATILDI', CANVAS_WIDTH * 0.5, 362, {
      scale: 4.4,
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

    this.drawModalActionBtn(ctx, 'DEVAM ET', 432, 'goldRed', 'RESUME_GAME', 96);
    this.drawModalActionBtn(
      ctx,
      `KONTROL: ${ctrlShort} ⇄`,
      546,
      'navyBtn',
      'CYCLE_CONTROL_MODE',
      92
    );
    this.drawModalActionBtn(
      ctx,
      `KONUM: ${sideLabel} ⇄`,
      656,
      'navyBtn',
      'TOGGLE_JOYSTICK_SIDE',
      92
    );
    this.drawModalActionBtn(ctx, 'BU BÖLÜMÜ TEKRARLA', 766, 'navyBtn', 'RETRY_CURRENT_STAGE', 92);
    this.drawModalActionBtn(ctx, 'ANA MENÜYE DÖN', 876, 'navyBtn', 'QUIT_TO_MENU', 92);
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
    waveNumber: number,
    earnedJeton: number,
    maxComboReached = 1
  ): void {
    this.drawPixelPanel(ctx, 64, 270, 772, 960, 'steel');

    const title =
      waveNumber >= 30
        ? 'BÖLÜM 30 FİNAL ZAFERİ!'
        : `BÖLÜM ${String(waveNumber).padStart(2, '0')} TAMAMLANDI!`;
    drawPixelText(ctx, title, CANVAS_WIDTH * 0.5, 348, {
      scale: 4.0,
      tone: 'gold',
      align: 'center',
      maxWidth: 700
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
        : `%${bd.claimedPercent.toFixed(1)}`;

    const bonusRows: Array<[string, string, 'white' | 'gold' | 'green' | 'cyan']> = [
      ['KESİLEN ALAN', shownPct, 'green'],
      ['BÖLÜM BONUSU', `+${formatGroupedScore(bd.baseBonus)}`, 'white'],
      ['KALKAN BONUSU', `+${formatGroupedScore(bd.shieldBonus)}`, 'cyan'],
      ['JETON ÖDÜLÜ', `+${formatGroupedScore(earnedJeton)} JETON`, 'gold']
    ];
    if (maxComboReached >= 2) {
      bonusRows.splice(2, 0, ['MAKS KOMBO', `x${maxComboReached}`, 'gold']);
    } else if (bd.over80Bonus > 0) {
      bonusRows.splice(2, 0, ['ÜSTÜN HÂKİMİYET', `+${formatGroupedScore(bd.over80Bonus)}`, 'gold']);
    }

    let ry = 514;
    for (const [label, val, tone] of bonusRows) {
      drawPixelText(ctx, label, rowLeft, ry, { scale: 2.9, tone: 'silver', align: 'left' });
      drawPixelText(ctx, val, rowRight, ry, { scale: 3.0, tone, align: 'right' });
      ry += 50;
    }

    const nextStageNum = waveNumber >= 30 ? 1 : waveNumber + 1;
    const nextBoss = getStageBossNameTr(nextStageNum);
    ctx.save();
    ctx.fillStyle = '#091020';
    ctx.fillRect(108, 782, 684, 78);
    ctx.strokeStyle = '#48C8FF';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(108, 782, 684, 78);
    ctx.restore();

    drawPixelText(
      ctx,
      `SIRADAKİ BÖLÜM ${nextStageNum}: ${nextBoss}`,
      CANVAS_WIDTH * 0.5,
      821,
      { scale: 2.65, tone: 'cyan', align: 'center', maxWidth: 650 }
    );

    drawPixelText(ctx, `SKOR ${formatScoreDigits(currentScore, 7)}`, CANVAS_WIDTH * 0.5, 912, {
      scale: 3.9,
      tone: 'gold',
      align: 'center'
    });

    this.drawModalActionBtn(ctx, 'SONRAKİ BÖLÜM >', 974, 'goldRed', 'NEXT_SECTOR');
    this.drawModalActionBtn(ctx, 'ANA MENÜYE DÖN', 1090, 'navyBtn', 'QUIT_TO_MENU', 90);
  }

  private renderGameOverModal(
    ctx: CanvasRenderingContext2D,
    currentScore: number,
    waveNumber: number,
    isNewRecord: boolean,
    canOfferRevive = false,
    reviveAdLoading = false,
    mode: 'CAMPAIGN' | 'ENDLESS' = 'CAMPAIGN'
  ): void {
    const subLabel =
      mode === 'ENDLESS'
        ? `SONSUZ MOD • DALGA ${waveNumber}`
        : `BÖLÜM ${String(waveNumber).padStart(2, '0')}: ${getStageBossNameTr(waveNumber)}`;

    if (canOfferRevive) {
      this.drawPixelPanel(ctx, 72, 290, 756, 860, 'steel');

      drawPixelText(ctx, 'OYUN BİTTİ', CANVAS_WIDTH * 0.5, 368, {
        scale: 4.8,
        tone: 'red',
        align: 'center'
      });

      drawPixelText(ctx, subLabel, CANVAS_WIDTH * 0.5, 446, {
        scale: 2.9,
        tone: 'cyan',
        align: 'center',
        maxWidth: 690
      });

      drawPixelText(
        ctx,
        `SKOR ${formatGroupedScore(currentScore)}`,
        CANVAS_WIDTH * 0.5,
        516,
        { scale: 3.8, tone: 'gold', align: 'center' }
      );

      if (isNewRecord) {
        drawPixelText(ctx, '★ YENİ KİŞİSEL REKOR! ★', CANVAS_WIDTH * 0.5, 574, {
          scale: 2.8,
          tone: 'green',
          align: 'center'
        });
      }

      const btnW = 620;
      const btnX = Math.round((CANVAS_WIDTH - btnW) * 0.5);
      const btnY = 622;
      const btnH = 114;
      this.drawPixelPanel(
        ctx,
        btnX,
        btnY,
        btnW,
        btnH,
        reviveAdLoading ? 'locked' : 'emeraldGold'
      );
      drawPixelText(
        ctx,
        reviveAdLoading ? 'REKLAM YÜKLENİYOR...' : 'VİDEO İZLE: +1 GEMİ HAKKI',
        CANVAS_WIDTH * 0.5,
        btnY + 42,
        {
          scale: 3.15,
          tone: reviveAdLoading ? 'silver' : 'gold',
          align: 'center',
          maxWidth: btnW - 36
        }
      );
      drawPixelText(
        ctx,
        reviveAdLoading ? 'LÜTFEN BEKLEYİN...' : 'AYNI BOSS + 3 SN KALKANLA DEVAM ET',
        CANVAS_WIDTH * 0.5,
        btnY + 84,
        {
          scale: 2.1,
          tone: 'white',
          align: 'center',
          maxWidth: btnW - 36
        }
      );
      if (!reviveAdLoading) {
        this.addButton('ACCEPT_REVIVE', btnX, btnY, btnW, btnH);
      }

      this.drawModalActionBtn(ctx, 'TEKRAR DENE', 764, 'goldRed', 'RETRY_CURRENT_STAGE', 98);
      this.drawModalActionBtn(ctx, 'ANA MENÜYE DÖN', 884, 'navyBtn', 'QUIT_TO_MENU', 92);
      this.drawModalActionBtn(ctx, 'TÜM BÖLÜMLER', 994, 'navyBtn', 'OPEN_STAGE_GRID', 84);
      return;
    }

    this.drawPixelPanel(ctx, 72, 360, 756, 720, 'steel');

    drawPixelText(ctx, 'OYUN BİTTİ', CANVAS_WIDTH * 0.5, 444, {
      scale: 4.8,
      tone: 'red',
      align: 'center'
    });

    drawPixelText(ctx, subLabel, CANVAS_WIDTH * 0.5, 528, {
      scale: 2.9,
      tone: 'cyan',
      align: 'center',
      maxWidth: 690
    });

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

    this.drawModalActionBtn(ctx, 'TEKRAR DENE', 732, 'goldRed', 'RETRY_CURRENT_STAGE', 104);
    this.drawModalActionBtn(ctx, 'ANA MENÜYE DÖN', 858, 'navyBtn', 'QUIT_TO_MENU', 96);
    this.drawModalActionBtn(ctx, 'TÜM BÖLÜMLER', 972, 'navyBtn', 'OPEN_STAGE_GRID', 86);
  }

  private drawModalActionBtn(
    ctx: CanvasRenderingContext2D,
    label: string,
    y: number,
    style: 'goldRed' | 'navyBtn',
    id: string,
    h = 98
  ): void {
    const w = 596;
    const x = Math.round((CANVAS_WIDTH - w) * 0.5);
    this.drawPixelPanel(ctx, x, y, w, h, style);
    drawPixelText(ctx, label, CANVAS_WIDTH * 0.5, y + h * 0.5, {
      scale: 3.5,
      tone: style === 'goldRed' ? 'gold' : 'white',
      align: 'center',
      maxWidth: w - 40
    });
    this.addButton(id, x, y, w, h);
  }

  private drawPixelToast(ctx: CanvasRenderingContext2D, text: string): void {
    this.drawPixelPanel(ctx, 90, 104, 720, 72, 'navyBtn');
    drawPixelText(ctx, text, CANVAS_WIDTH * 0.5, 140, {
      scale: 3.0,
      tone: 'gold',
      align: 'center',
      maxWidth: 676
    });
  }
}
