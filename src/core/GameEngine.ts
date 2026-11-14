import { SoundEngine } from '../audio/SoundEngine';
import { BaseBoss } from '../entities/bosses/BaseBoss';
import { createBossesForEndlessWave } from '../entities/bosses/BossFactory';
import { CentipedeBoss } from '../entities/bosses/CentipedeBoss';
import { TwinNexus } from '../entities/bosses/TwinNexus';
import {
  AlienBrainBoss,
  BioWheelBoss,
  CyberSkullBoss,
  LobsterMechaBoss,
  OpticNerveBoss
} from '../entities/bosses/VolfiedBosses';
import { InteriorMinion } from '../entities/enemies/BaseMinion';
import { BorderCrawler } from '../entities/enemies/BorderCrawler';
import { DroneBouncer } from '../entities/enemies/DroneBouncer';
import { LineHunter } from '../entities/enemies/LineHunter';
import { PrismSplitter } from '../entities/enemies/PrismSplitter';
import { HomingMissileMinion, YellowSwarmer } from '../entities/enemies/VolfiedMinions';
import { PlayerShip } from '../entities/PlayerShip';
import {
  ARMOR_PILLAR_BONUS,
  BlockRewardType,
  CollectiblePowerUpType,
  EMPTY_BLOCK_POINTS_BONUS,
  PowerUpBox,
  PowerUpBoxConfig,
  PowerUpCapsule,
  PowerUpType
} from '../entities/PowerUpBox';
import { ProjectileManager } from '../entities/Projectiles';
import { TrailFuse } from '../entities/TrailFuse';
import {
  bounceCircleOffSolidBoxes,
  circleHitsSolidBox,
  SOLID_BOX_HALF
} from '../geometry/SolidBoxes';
import {
  computeArea,
  createInitialArenaPolygon,
  getActivePerimeterBarriers,
  getPolygonEdges,
  getTotalPerimeter,
  pointInPolygonStrict,
  pointToArcLength,
  projectPointToPolygon,
  projectPointToPolyline,
  projectPointToSegment,
  resolvePolygonPenetration
} from '../geometry/PolygonMath';
import { PolygonSplitter } from '../geometry/PolygonSplitter';
import { Barrier, Point } from '../geometry/Types';
import { InputManager, InputState } from '../input/InputManager';
import {
  BossCombatPhase,
  EndlessBossDirector,
  WaveEncounterSpec
} from '../levels/EndlessBossDirector';
import { NativeBridge } from '../native/NativeBridge';
import { LayerRenderer } from '../rendering/LayerRenderer';
import { ParticlePool } from '../rendering/ParticlePool';
import {
  ARENA_PIXEL_SCALE,
  blitPixelSprite,
  drawPixelText,
  measurePixelText
} from '../rendering/PixelArtEngine';
import { getMiniShipHudSprite } from '../rendering/VolfiedSprites';
import { MonetizationService } from '../services/MonetizationService';
import {
  difficultyIdToRunDifficulty,
  StorageService
} from '../services/StorageService';
import { isShipSkinId, MenuRenderer, ScreenState } from '../ui/MenuRenderer';
import {
  ARENA_HEIGHT,
  ARENA_VIEW_SCALE,
  ARENA_VIEW_X,
  ARENA_VIEW_Y,
  CANVAS_WIDTH,
  CHAPTER_THEMES,
  ChapterThemeId,
  DEFAULT_ARCADE_HIGH_SCORE,
  DIFFICULTIES,
  DifficultyId,
  EXTRA_LIFE_SCORE_STEP,
  HUD_BOTTOM_HEIGHT,
  HUD_BOTTOM_Y,
  HUD_TOP_HEIGHT,
  INITIAL_ARENA_AREA,
  JUICE_HITSTOP_DURATION,
  JUICE_HITSTOP_THRESHOLD,
  MIDDLE_ZONE_Y,
  PALETTE,
  PIXEL_SCALE,
  SHIP_SKINS,
  ShipSkinConfig
} from './Config';
import { GameLoop } from './GameLoop';
import { getLayout, pointInRect } from './ResponsiveLayout';
import {
  ACHIEVEMENTS,
  LevelClearBreakdown,
  LevelWinReason,
  ScoreSystem
} from './ScoreSystem';

const CHAPTER_THEME_IDS = Object.keys(CHAPTER_THEMES) as ChapterThemeId[];

export class GameEngine {
  public screen: ScreenState = 'MAIN_MENU';

  private readonly input = new InputManager();
  private readonly layerRenderer = new LayerRenderer();
  private readonly particles = new ParticlePool();
  private readonly projectiles = new ProjectileManager();
  private readonly ship = new PlayerShip();
  private readonly menuRenderer = new MenuRenderer();
  private readonly endlessDirector = new EndlessBossDirector();
  private readonly gameLoop: GameLoop;

  private currentWave = 1;
  private currentWaveSpec: WaveEncounterSpec;
  private activeCombatPhase: BossCombatPhase = 1;
  private phaseAwakeningTimer = 0;
  private phaseAwakeningLabel: string | null = null;
  private waveBarrierDefs: Barrier[] = [];

  private activePolygon: Point[] = createInitialArenaPolygon();
  private activeBarriers: Barrier[] = [];
  private claimedPercent = 0;

  private bosses: BaseBoss[] = [];
  private minions: InteriorMinion[] = [];
  private crawlers: BorderCrawler[] = [];
  private powerBoxes: PowerUpBox[] = [];
  private activeSolidBoxes: PowerUpBox[] = [];
  private capsules: PowerUpCapsule[] = [];
  private fuses: TrailFuse[] = [];

  private score = 0;
  private nextExtraLifeScore = EXTRA_LIFE_SCORE_STEP;
  private lives = 4;
  private runBaselineHighScore = 0;
  private runBaselineBestWave = 0;
  private runIsNewRecord = false;

  private timeFreezeTimer = 0;
  private crawlerSpawnTimer = 42;
  private dynamicPodTimer = 24;
  private roundIntroTimer = 0;
  private cutStallTimer = 0;
  private hesitationFuseLit = false;
  private shieldZeroBeepTimer = 0;
  private shieldPulseTimer = 0;
  private trapEnrageTimer = 0;
  private cutsThisLevel = 0;
  private lastInputSnapshot: InputState = {
    direction: null,
    carveHeld: false,
    autoCarveSwipe: false,
    pauseJustPressed: false,
    debugSectorSelect: null
  };

  private reviveUsedThisLevel = false;
  private deathsThisLevel = 0;
  private clearBreakdown: LevelClearBreakdown | null = null;

  private timeSeconds = 0;
  private adCountdown = 0;
  private statusToast: string | null = null;
  private statusToastTimer = 0;
  private firstFrameDrawn = false;
  private renderTargetCtx: CanvasRenderingContext2D | null = null;
  private boxContactSfxCooldown = 0;

  constructor() {
    this.currentWaveSpec = this.endlessDirector.buildWave(1, 'MEDIUM');
    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      (alpha, frameDt) => this.render(alpha, frameDt)
    );

    this.input.touch.setOnSwapSide(() => {
      void this.toggleJoystickSide();
    });
    this.input.touch.setOnGearTap(() => {
      if (this.screen === 'PLAYING') {
        SoundEngine.playUiClick();
        this.screen = 'PAUSED';
        this.input.resetActiveInputs();
      }
    });
  }

  public syncViewportLayout(): void {
    this.input.touch.syncViewportFromLayout(getLayout());
  }

  public async boot(ctx: CanvasRenderingContext2D): Promise<void> {
    this.renderTargetCtx = ctx;

    const save = await StorageService.load();
    this.applySavedSettings();
    this.syncViewportLayout();

    SoundEngine.bindAutoUnlock();
    await MonetizationService.prepareAdsIfEnabled();

    await NativeBridge.initialize({
      onAppPause: () => {
        if (this.screen === 'PLAYING') {
          this.screen = 'PAUSED';
          this.input.resetActiveInputs();
        }
        void StorageService.save();
        SoundEngine.suspend();
      },
      onAppResume: () => {
        SoundEngine.resume();
        this.gameLoop.resetTiming();
      },
      onBackButton: () => {
        this.handleHardwareBack();
      }
    });

    const previewWave = Math.max(1, StorageService.getBestWaveOverall(save) || 1);
    const previewTheme = CHAPTER_THEME_IDS[(previewWave - 1) % CHAPTER_THEME_IDS.length];
    this.layerRenderer.initializeFloor({
      chapterTheme: previewTheme,
      floorMotif: 'architectural-miter',
      stageNumber: previewWave
    });

    this.applyShowcaseFromUrl();

    this.gameLoop.start();
  }

  /**
   * Store-screenshot & visual QA showcase (`?shot=menu|faz2|kolay|orta|zor`):
   * Uses an in-memory-only save (`StorageService.persistenceDisabled = true`).
   */
  private applyShowcaseFromUrl(): void {
    if (typeof window === 'undefined') return;
    const shot = new URLSearchParams(window.location.search).get('shot');
    if (!shot) return;

    StorageService.persistenceDisabled = true;
    const save = StorageService.getCurrent();
    save.difficultyRecords = {
      EASY: { highScore: 684_200, bestWave: 12 },
      MEDIUM: { highScore: 3_423_594, bestWave: 19 },
      HARD: { highScore: 3_423_594, bestWave: 19 }
    };
    save.highScoreEndless = 3_423_594;
    save.bestEndlessWave = 19;

    if (shot === 'menu') {
      save.difficulty = 'COMMANDER';
      return;
    }

    const diffMap: Record<string, DifficultyId> = {
      kolay: 'EXPLORER',
      orta: 'COMMANDER',
      zor: 'LEGEND',
      faz2: 'LEGEND'
    };
    save.difficulty = diffMap[shot] ?? 'LEGEND';

    const targetWave = shot === 'kolay' ? 3 : shot === 'orta' ? 8 : 14;
    this.startEndlessRun(targetWave);
    this.roundIntroTimer = 0;
    this.score = shot === 'kolay' ? 128_400 : shot === 'orta' ? 412_600 : 842_500;
    this.lives = 3;

    const cuts: Point[][] =
      shot === 'kolay'
        ? [[{ x: 0, y: 920 }, { x: 260, y: 920 }, { x: 260, y: 1200 }]]
        : [
            [{ x: 0, y: 380 }, { x: 220, y: 380 }, { x: 220, y: 0 }],
            [{ x: 0, y: 740 }, { x: 380, y: 740 }, { x: 380, y: 1200 }],
            [{ x: 900, y: 840 }, { x: 560, y: 840 }, { x: 560, y: 1200 }]
          ];

    for (const trail of cuts) {
      this.processCompletedCut(trail, 1);
    }

    if (shot === 'faz2' || shot === 'zor') {
      const nextPhase: BossCombatPhase = 2;
      this.activeCombatPhase = nextPhase;
      this.phaseAwakeningTimer = 0;
      for (const boss of this.bosses) {
        if (boss.alive) {
          boss.applyPhaseBehavior(this.currentWaveSpec.phases[nextPhase]);
        }
      }
    }

    this.particles.clear();
    this.capsules = [];
    this.statusToast = null;
    this.statusToastTimer = 0;
    this.ship.snapOntoUpdatedPolygon(this.activePolygon);
  }

  public handlePointerDown(
    pointerId: number,
    vx: number,
    vy: number,
    cssX?: number,
    cssY?: number
  ): void {
    const layout = getLayout();
    if (this.screen === 'PLAYING' && pointInRect(vx, vy, layout.pauseButton, 14)) {
      SoundEngine.playUiClick();
      this.screen = 'PAUSED';
      this.input.resetActiveInputs();
      return;
    }

    if (this.screen === 'PLAYING') {
      const s = layout.cssScale || 1;
      this.input.touch.handleTouchDownCss(
        pointerId,
        cssX ?? vx * s,
        cssY ?? vy * s,
        vx,
        vy,
        true
      );
      return;
    }

    const hitId = this.menuRenderer.hitTest(vx, vy);
    if (hitId) {
      SoundEngine.playUiClick();
      void this.handleUiAction(hitId);
    }
  }

  public handlePointerMove(
    pointerId: number,
    vx: number,
    vy: number,
    cssX?: number,
    cssY?: number
  ): void {
    if (this.screen === 'PLAYING') {
      const s = getLayout().cssScale || 1;
      this.input.touch.handleTouchMoveCss(pointerId, cssX ?? vx * s, cssY ?? vy * s);
    }
  }

  public handlePointerUp(pointerId: number): void {
    this.input.touch.handlePointerUp(pointerId);
  }

  private handleHardwareBack(): void {
    if (this.screen === 'PLAYING') {
      this.screen = 'PAUSED';
      this.input.resetActiveInputs();
    } else if (this.screen === 'PAUSED') {
      this.screen = 'PLAYING';
    } else if (
      this.screen === 'SECTOR_SELECT' ||
      this.screen === 'HANGAR' ||
      this.screen === 'ACHIEVEMENTS' ||
      this.screen === 'SETTINGS'
    ) {
      this.screen = 'MAIN_MENU';
    }
  }

  private applySavedSettings(): void {
    const s = StorageService.getCurrent().settings;
    this.input.configure(s.controlMode, s.carveButtonMode, s.autoCut, s.joystickSide);
    SoundEngine.setVolumes(s.sfxVolume, s.ambientVolume, s.muted);
    NativeBridge.setHapticsEnabled(s.hapticsEnabled);
  }

  public resetPointerInputs(): void {
    this.input.resetActiveInputs();
  }

  private async toggleJoystickSide(): Promise<void> {
    await StorageService.save((d) => {
      const cur = d.settings.joystickSide;
      if (d.settings.controlMode === 'SINGLE_HAND_DRAG') {
        d.settings.joystickSide = cur === 'LEFT' ? 'CENTER' : cur === 'CENTER' ? 'RIGHT' : 'LEFT';
      } else {
        d.settings.joystickSide = cur === 'RIGHT' ? 'LEFT' : 'RIGHT';
      }
    });
    this.applySavedSettings();
    SoundEngine.playUiClick();
    NativeBridge.hapticPowerUp();
    const s = StorageService.getCurrent().settings;
    const label =
      s.controlMode === 'SINGLE_HAND_DRAG'
        ? s.joystickSide === 'RIGHT'
          ? 'SAĞ'
          : s.joystickSide === 'LEFT'
            ? 'SOL'
            : 'ORTA'
        : s.joystickSide === 'RIGHT'
          ? 'SAĞ YÖN / SOL KES'
          : 'SOL YÖN / SAĞ KES';
    this.showToast(`KONUM: ${label}`);
  }

  private showToast(msgTr: string): void {
    this.statusToast = msgTr;
    this.statusToastTimer = 2.0;
  }

  private tryUnlockAchievement(id: string): void {
    if (StorageService.unlockAchievement(id)) {
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def) {
        this.showToast(`★ ${def.titleTr}`);
      }
    }
  }

  private async handleUiAction(actionId: string): Promise<void> {
    const save = StorageService.getCurrent();

    if (actionId === 'OPEN_SHIPS') {
      this.screen = 'HANGAR';
      return;
    }

    if (actionId === 'GOTO_CAMPAIGN' || actionId === 'BACK_MAIN' || actionId === 'QUIT_TO_MENU') {
      SoundEngine.stopLaserCutLoop();
      void StorageService.save();
      this.screen = 'MAIN_MENU';
      return;
    }

    if (actionId === 'GOTO_SETTINGS') {
      this.screen = 'SETTINGS';
      return;
    }

    if (actionId === 'START_ENDLESS_RUN' || actionId === 'START_ENDLESS') {
      this.startEndlessRun(1);
      return;
    }

    if (actionId.startsWith('SET_DIFF_')) {
      const diff = actionId.replace('SET_DIFF_', '') as DifficultyId;
      if (DIFFICULTIES[diff]) {
        await StorageService.save((d) => {
          d.difficulty = diff;
        });
      }
      return;
    }

    if (actionId === 'CYCLE_DIFFICULTY') {
      const nextDiff: DifficultyId =
        save.difficulty === 'EXPLORER'
          ? 'COMMANDER'
          : save.difficulty === 'COMMANDER'
            ? 'LEGEND'
            : 'EXPLORER';
      await StorageService.save((d) => {
        d.difficulty = nextDiff;
      });
      this.showToast(`ZORLUK: ${DIFFICULTIES[nextDiff].nameTr}`);
      return;
    }

    if (actionId === 'TOGGLE_JOYSTICK_SIDE') {
      await this.toggleJoystickSide();
      return;
    }

    if (actionId === 'CYCLE_CONTROL_MODE') {
      await StorageService.save((d) => {
        const cur = d.settings.controlMode;
        d.settings.controlMode =
          cur === 'CLASSIC_ARCADE'
            ? 'JOYSTICK_KES'
            : cur === 'JOYSTICK_KES'
              ? 'SINGLE_HAND_DRAG'
              : 'CLASSIC_ARCADE';
        if (d.settings.controlMode !== 'SINGLE_HAND_DRAG' && d.settings.joystickSide === 'CENTER') {
          d.settings.joystickSide = 'LEFT';
        }
      });
      this.applySavedSettings();
      NativeBridge.hapticPowerUp();
      const m = StorageService.getCurrent().settings.controlMode;
      const mLabel =
        m === 'CLASSIC_ARCADE'
          ? 'KLASİK ATARİ'
          : m === 'JOYSTICK_KES'
            ? 'ATARİ KOLU + KES'
            : 'TEK EL SÜRÜKLE';
      this.showToast(`KONTROL: ${mLabel}`);
      return;
    }

    if (actionId.startsWith('SELECT_SHIP_')) {
      const skinId = actionId.replace('SELECT_SHIP_', '');
      if (isShipSkinId(skinId)) {
        const skin = SHIP_SKINS.find((s) => s.id === skinId);
        if (!skin) return;
        if (StorageService.isShipUnlocked(skin, save)) {
          await StorageService.save((d) => {
            d.selectedShip = skinId;
          });
          this.showToast(`GEMİ: ${skin.nameTr}`);
        } else {
          this.showToast(`DALGA ${skin.waveRequired} GEREKLİ`);
        }
      }
      return;
    }

    if (actionId === 'TOGGLE_MUTE') {
      await StorageService.save((d) => {
        d.settings.muted = !d.settings.muted;
      });
      this.applySavedSettings();
      return;
    }

    if (actionId === 'TOGGLE_HAPTICS') {
      await StorageService.save((d) => {
        d.settings.hapticsEnabled = !d.settings.hapticsEnabled;
      });
      this.applySavedSettings();
      NativeBridge.hapticPowerUp();
      return;
    }

    if (actionId === 'RESUME_GAME') {
      this.screen = 'PLAYING';
      this.gameLoop.resetTiming();
      return;
    }

    if (actionId === 'RESTART_RUN' || actionId === 'RESTART_SECTOR') {
      this.startEndlessRun(1);
      return;
    }

    if (actionId === 'ACCEPT_REVIVE') {
      this.reviveUsedThisLevel = true;
      if (save.premiumUnlocked) {
        this.completeReviveGrant();
      } else {
        const ready = await MonetizationService.triggerRewardedRevive();
        if (ready) {
          this.adCountdown = 2.2;
          this.screen = 'REWARDED_AD_SIM';
        }
      }
      return;
    }

    if (actionId === 'DECLINE_REVIVE') {
      this.persistRunRecords();
      this.screen = 'GAME_OVER';
      return;
    }

    if (actionId === 'NEXT_SECTOR') {
      this.loadWave(this.currentWave + 1);
      this.screen = 'PLAYING';
    }
  }

  private completeReviveGrant(): void {
    this.lives = 1;
    this.ship.shieldTimer = this.ship.maxShieldDuration;
    this.ship.respawnAtCutStart(this.activePolygon);
    this.fuses = [];
    this.projectiles.clearEnemyBullets();
    this.screen = 'PLAYING';
    SoundEngine.playExtraLife();
  }

  private startEndlessRun(startWave = 1): void {
    const save = StorageService.getCurrent();
    const diff = DIFFICULTIES[save.difficulty];
    const rec = StorageService.getDifficultyRecord(save.difficulty, save);

    this.endlessDirector.resetRun();
    this.score = 0;
    this.nextExtraLifeScore = EXTRA_LIFE_SCORE_STEP;
    this.lives = diff.startingLives;
    this.runBaselineHighScore = rec.highScore;
    this.runBaselineBestWave = rec.bestWave;
    this.runIsNewRecord = false;

    void StorageService.save((d) => {
      d.stats.gamesPlayed += 1;
    });

    this.loadWave(startWave);
    this.screen = 'PLAYING';
  }

  private buildWaveBarriers(ratio: number, waveNumber: number): Barrier[] {
    if (ratio <= 0.01) return [];
    const totalLen = Math.min(1560, Math.round(4200 * ratio));
    const segLen = Math.max(120, Math.min(340, Math.round(totalLen / 3 / 20) * 20));
    const shift = ((waveNumber * 60) % 160) - 80;
    const topStart = Math.max(120, Math.min(780 - segLen, 450 - Math.round(segLen * 0.5) + shift));
    const sideY = Math.max(200, Math.min(920 - segLen, 460 + shift));

    return [
      { x1: topStart, y1: 0, x2: topStart + segLen, y2: 0 },
      { x1: 0, y1: sideY, x2: 0, y2: sideY + segLen },
      { x1: 900, y1: sideY, x2: 900, y2: sideY + segLen }
    ];
  }

  private buildWaveBoxes(spec: WaveEncounterSpec): PowerUpBoxConfig[] {
    const configs: PowerUpBoxConfig[] = [];

    const pickSlot = (seedSlot: number): Point | null => {
      for (let attempt = 0; attempt < 56; attempt++) {
        const seedA = (spec.waveNumber * 173 + seedSlot * 251 + attempt * 97) % 1000;
        const seedB = (spec.waveNumber * 131 + seedSlot * 193 + attempt * 83) % 1000;
        const x = Math.round((140 + (seedA / 1000) * 620) / 20) * 20;
        const y = Math.round((190 + (seedB / 1000) * 810) / 20) * 20;

        // Keep central boss spawn pocket & player bottom-center spawn corridor clear
        if (x > 300 && x < 600 && y > 370 && y < 630) continue;
        if (Math.hypot(x - 450, y - ARENA_HEIGHT) < 230) continue;
        if (configs.some((c) => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) < 145)) continue;

        return { x, y };
      }
      return null;
    };

    // 1. Law 6 Tier 1: Solid Standard Blocks (`S`, `L`, `C`, `P`, `EMPTY_POINTS`, or `ENRAGE_TRAP` on `ZOR`)
    const stdRewards: BlockRewardType[] = spec.rules.enrageTrapEnabled
      ? ['S', 'L', 'C', 'EMPTY_POINTS', 'ENRAGE_TRAP']
      : ['S', 'L', 'P', 'C', 'EMPTY_POINTS'];

    let slotIdx = 0;
    for (let i = 0; i < spec.powerUpBoxCount; i++) {
      const pos = pickSlot(slotIdx++);
      if (!pos) continue;
      const reward = stdRewards[(spec.waveNumber * 3 + i * 2) % stdRewards.length];
      const baseType: PowerUpType =
        reward === 'EMPTY_POINTS' || reward === 'ENRAGE_TRAP' ? 'S' : reward;
      configs.push({
        x: pos.x,
        y: pos.y,
        type: baseType,
        blockKind: 'SOLID_STANDARD',
        rewardType: reward
      });
    }

    // 2. Law 6 Tier 2: Blinking Disappearing Blocks (carries rare `T` Time Freeze at most 1 per wave!)
    for (let i = 0; i < spec.disappearingBoxCount; i++) {
      const pos = pickSlot(slotIdx++);
      if (!pos) continue;
      const type: PowerUpType = i === 0 ? 'T' : i % 2 === 1 ? 'C' : 'L';
      configs.push({
        x: pos.x,
        y: pos.y,
        type,
        blinking: true,
        blockKind: 'DISAPPEARING',
        rewardType: type,
        onDurationSec: spec.rules.disappearOnSec,
        offDurationSec: spec.rules.disappearOffSec,
        phaseOffsetSec: i * 1.9
      });
    }

    // 3. Law 6 Tier 3: 2-Stage Boss Cannon Unlock (`SPECIAL_STAGE_1_RED` -> spawns `SPECIAL_STAGE_2_GOLD`!)
    if (spec.hasSpecialStage1RedBlock) {
      const pos = pickSlot(slotIdx++);
      if (pos) {
        configs.push({
          x: pos.x,
          y: pos.y,
          type: 'BOSS_CANNON',
          blockKind: 'SPECIAL_STAGE_1_RED',
          rewardType: 'BOSS_CANNON'
        });
      }
    }

    // 4. Impassable Steel Armor Pillars
    for (let i = 0; i < spec.solidArmorPillarCount; i++) {
      const pos = pickSlot(slotIdx++);
      if (!pos) continue;
      configs.push({
        x: pos.x,
        y: pos.y,
        type: 'ARMOR_PILLAR',
        blockKind: 'ARMOR_PILLAR',
        rewardType: 'ARMOR_PILLAR'
      });
    }

    return configs;
  }

  private spawnPermanentShellObstacle(pos: Point): void {
    const safe = resolvePolygonPenetration(pos, SOLID_BOX_HALF + 28, this.activePolygon).position;
    const gx = Math.round(safe.x / 2) * 2;
    const gy = Math.round(safe.y / 2) * 2;
    this.powerBoxes.push(
      new PowerUpBox({
        x: gx,
        y: gy,
        type: 'ARMOR_PILLAR',
        blockKind: 'ARMOR_PILLAR',
        rewardType: 'ARMOR_PILLAR'
      })
    );
    this.syncSolidBoxes();
    this.particles.spawnShockwave(gx, gy, 140, '#DCE6F4', 0.34);
    this.particles.spawnFloatingText(gx, gy - 26, 'ZIRH ENGELİ!', '#FFE068', 22);
  }

  private spawnStage2GoldSpecialBlock(): void {
    for (let attempt = 0; attempt < 36; attempt++) {
      const cand = {
        x: Math.round((150 + ((attempt * 179 + this.currentWave * 97) % 600)) / 20) * 20,
        y: Math.round((200 + ((attempt * 151 + this.currentWave * 83) % 780)) / 20) * 20
      };
      if (!pointInPolygonStrict(cand, this.activePolygon)) continue;
      const safe = resolvePolygonPenetration(cand, SOLID_BOX_HALF + 46, this.activePolygon);
      if (Math.hypot(safe.position.x - cand.x, safe.position.y - cand.y) > 6) continue;
      if (Math.hypot(this.ship.x - cand.x, this.ship.y - cand.y) < 150) continue;
      if (
        this.powerBoxes.some(
          (b) => !b.collected && Math.max(Math.abs(b.x - cand.x), Math.abs(b.y - cand.y)) < 130
        )
      ) {
        continue;
      }

      this.powerBoxes.push(
        new PowerUpBox({
          x: cand.x,
          y: cand.y,
          type: 'BOSS_CANNON',
          blockKind: 'SPECIAL_STAGE_2_GOLD',
          rewardType: 'BOSS_CANNON'
        })
      );
      this.syncSolidBoxes();
      this.particles.spawnShockwave(cand.x, cand.y, 180, '#FFE048', 0.42);
      this.particles.spawnFloatingText(cand.x, cand.y - 28, '★ ALTIN BLOK!', '#FFE048', 24);
      return;
    }

    // Fallback if remaining polygon is very tight: drop Boss Cannon capsule directly!
    this.capsules.push(new PowerUpCapsule({ x: this.ship.x, y: this.ship.y - 40 }, 'BOSS_CANNON'));
  }

  private loadWave(waveNumber: number): void {
    const save = StorageService.getCurrent();
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const spec = this.endlessDirector.buildWave(waveNumber, runDiff);

    this.currentWave = waveNumber;
    this.currentWaveSpec = spec;
    this.activeCombatPhase = 1;
    this.phaseAwakeningTimer = 0;
    this.phaseAwakeningLabel = null;

    this.activePolygon = createInitialArenaPolygon();
    this.waveBarrierDefs = this.buildWaveBarriers(spec.borderBarrierRatio, waveNumber);
    this.activeBarriers = getActivePerimeterBarriers(this.activePolygon, this.waveBarrierDefs);
    this.claimedPercent = 0;

    const themeId = CHAPTER_THEME_IDS[spec.terrainThemeIndex % CHAPTER_THEME_IDS.length];
    const hueShift = Math.floor((waveNumber - 1) / 16) * 32;
    this.layerRenderer.initializeFloor({
      chapterTheme: themeId,
      floorMotif: 'architectural-miter',
      stageNumber: waveNumber,
      paletteHueShift: hueShift
    });

    this.particles.clear();
    this.projectiles.clearAll();
    this.fuses = [];
    this.capsules = [];
    this.crawlers = [];
    this.clearBreakdown = null;
    this.timeFreezeTimer = 0;
    this.dynamicPodTimer = 24;
    this.roundIntroTimer = 0.95;
    this.cutStallTimer = 0;
    this.hesitationFuseLit = false;
    this.shieldZeroBeepTimer = 0;
    this.shieldPulseTimer = 0.4;
    this.trapEnrageTimer = 0;
    this.cutsThisLevel = 0;
    this.reviveUsedThisLevel = false;
    this.deathsThisLevel = 0;
    this.crawlerSpawnTimer = spec.rules.crawlerDelaySec;

    // 1. Initialize Twin-Prong Fighter at bottom center (450, 1200)
    const shieldUnits = Math.max(200, Math.min(999, Math.round(spec.shieldSeconds * 10)));
    this.ship.initForLevel({ x: 450, y: ARENA_HEIGHT }, spec.shieldSeconds, shieldUnits);

    // 2. Spawn 3-Tier Energy Blocks first so bosses & minions never spawn embedded inside a wall
    const boxDefs = this.buildWaveBoxes(spec);
    this.powerBoxes = boxDefs.map((cfg) => new PowerUpBox(cfg));
    this.syncSolidBoxes();

    // 3. Spawn Authentic 1989 Bosses
    this.bosses = createBossesForEndlessWave(spec);

    // 4. Spawn collision-free Interior Minions from `spec.minionComposition`
    this.minions = [];
    const pickSafeMinionPos = (baseX: number, baseY: number, seedIdx: number): Point => {
      for (let attempt = 0; attempt < 36; attempt++) {
        const px =
          attempt === 0 ? baseX : 150 + ((baseX + attempt * 137 + seedIdx * 89) % 600);
        const py =
          attempt === 0 ? baseY : 180 + ((baseY + attempt * 149 + seedIdx * 73) % 720);
        const pt = { x: px, y: py };
        if (!pointInPolygonStrict(pt, this.activePolygon)) continue;
        if (Math.hypot(px - 450, py - ARENA_HEIGHT) < 230) continue;
        if (this.powerBoxes.some((b) => Math.hypot(b.x - px, b.y - py) < SOLID_BOX_HALF + 58)) {
          continue;
        }
        if (this.bosses.some((b) => Math.hypot(b.x - px, b.y - py) < b.boundingRadius + 50)) {
          continue;
        }
        return pt;
      }
      return { x: baseX, y: baseY };
    };

    for (let i = 0; i < spec.minionComposition.length; i++) {
      const mKind = spec.minionComposition[i];
      const pos = pickSafeMinionPos(185 + ((i * 235) % 540), 255 + ((i * 195) % 490), i);
      if (mKind === 'SWARMER') {
        this.minions.push(new YellowSwarmer(pos, 205));
      } else if (mKind === 'MISSILE') {
        this.minions.push(new HomingMissileMinion(pos, 192));
      } else if (mKind === 'HUNTER') {
        this.minions.push(new LineHunter(pos, 166));
      } else if (mKind === 'PRISM') {
        this.minions.push(new PrismSplitter(pos, false, 138));
      } else {
        this.minions.push(
          new DroneBouncer(pos, 174, Math.PI * 0.25 + (i % 4) * (Math.PI * 0.5))
        );
      }
    }

    this.persistRunRecords();
    this.input.resetActiveInputs();
  }

  private syncSolidBoxes(): void {
    this.activeSolidBoxes = this.powerBoxes.filter(
      (b) => !b.collected && b.isMaterialized(this.timeSeconds)
    );
    this.ship.solidBoxes = this.activeSolidBoxes;
  }

  private getActiveSolidBoxes(): readonly PowerUpBox[] {
    return this.activeSolidBoxes;
  }

  private getPrimaryBosses(): BaseBoss[] {
    return this.bosses.filter((b) => !b.isEscort);
  }

  private getPrimaryBossHpRatio(): number {
    const primary = this.getPrimaryBosses();
    if (primary.length === 0) return 0;
    let hpSum = 0;
    let maxSum = 0;
    for (const b of primary) {
      maxSum += Math.max(1, b.maxHp);
      if (b.alive) {
        hpSum += Math.max(0, b.hp);
      }
    }
    return maxSum > 0 ? Math.max(0, Math.min(1, hpSum / maxSum)) : 0;
  }

  private persistRunRecords(): void {
    const save = StorageService.getCurrent();
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const prevRec = save.difficultyRecords[runDiff] ?? { highScore: 0, bestWave: 0 };

    const nextHigh = Math.max(prevRec.highScore, this.score);
    const nextWave = Math.max(prevRec.bestWave, this.currentWave);
    save.difficultyRecords[runDiff] = {
      highScore: nextHigh,
      bestWave: nextWave
    };

    if (this.score > save.highScoreEndless) {
      save.highScoreEndless = this.score;
    }
    if (this.currentWave > save.bestEndlessWave) {
      save.bestEndlessWave = this.currentWave;
    }

    if (
      (this.score > 0 && this.score > this.runBaselineHighScore) ||
      this.currentWave > Math.max(1, this.runBaselineBestWave)
    ) {
      this.runIsNewRecord = true;
    }
  }

  private addScore(points: number): void {
    if (points <= 0) return;
    this.score += points;

    while (this.score >= this.nextExtraLifeScore) {
      this.lives += 1;
      this.nextExtraLifeScore += EXTRA_LIFE_SCORE_STEP;
      SoundEngine.playExtraLife();
      this.particles.spawnFloatingText(this.ship.x, this.ship.y - 30, '+1 GEMİ', '#28E038', 24);
    }

    if (this.score >= 1_000_000) {
      this.tryUnlockAchievement('HIGH_ROLLER');
    }

    this.persistRunRecords();
  }

  private triggerBossPhaseAwakening(nextPhase: BossCombatPhase): void {
    this.activeCombatPhase = nextPhase;
    this.phaseAwakeningTimer = 0.85;
    this.phaseAwakeningLabel = nextPhase === 3 ? 'FAZ III • AŞIRI YÜK!' : 'FAZ II • EVRİM!';

    // Fairness guarantee: wipe mid-air bullets during awakening slow-mo so player can read new phase
    this.projectiles.clearEnemyBullets();
    SoundEngine.playBossHit(false);
    NativeBridge.hapticPolygonShatter(22);
    this.particles.triggerShake(10, 0.34);

    const phaseSpec = this.currentWaveSpec.phases[nextPhase];
    const newlySpawnedBosses: BaseBoss[] = [];
    const newlySummonedMinions: InteriorMinion[] = [];

    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      boss.applyPhaseBehavior(phaseSpec);
      this.particles.spawnShockwave(
        boss.x,
        boss.y,
        360,
        nextPhase === 3 ? '#FF3820' : '#FFB028',
        0.48
      );
      this.particles.spawnBurst(
        boss.x,
        boss.y,
        28,
        nextPhase === 3 ? '#FF3820' : PALETTE.CUT_ORANGE,
        70,
        250,
        7,
        0.42
      );

      if (boss instanceof CentipedeBoss && nextPhase === 2) {
        const debris = boss.triggerElderArmorShed(this.activePolygon);
        for (const pt of debris) {
          this.particles.spawnBurst(pt.x, pt.y, 8, '#FFD040', 55, 180, 5, 0.34);
        }
        if (debris.length > 0) {
          this.phaseAwakeningLabel = 'KABUK KIRILDI • KIZIL PARAZİT!';
        }
      } else if (boss instanceof LobsterMechaBoss && nextPhase === 2) {
        const dropped = boss.triggerShellDrop({
          spawnSolidObstacle: (p) => this.spawnPermanentShellObstacle(p)
        });
        if (dropped) {
          this.phaseAwakeningLabel = 'ZIRH BIRAKILDI • MAKAS HÜCUMU!';
        }
      } else if (boss instanceof CyberSkullBoss && nextPhase === 2) {
        if (boss.triggerLastStand(10.0)) {
          this.phaseAwakeningTimer = 1.5;
          this.phaseAwakeningLabel = 'SON DİRENİŞ: 10 SN VEYA %90!';
        }
      } else if (boss instanceof AlienBrainBoss && nextPhase === 2) {
        const spawned = boss.detachArmorSawBlades({
          summonMinion: (m) => newlySummonedMinions.push(m)
        });
        if (spawned > 0) {
          this.phaseAwakeningLabel = 'TESTERE KAPAKLAR SERBEST!';
        }
      } else if (
        boss instanceof AlienBrainBoss &&
        nextPhase === 3 &&
        this.bosses.filter((b) => b.alive).length + newlySpawnedBosses.length < 2
      ) {
        const escortOrigin = resolvePolygonPenetration(
          { x: boss.x + 80, y: boss.y + 60 },
          44,
          this.activePolygon
        ).position;
        const escort = new BioWheelBoss(escortOrigin, 6);
        escort.isEscort = true;
        escort.applyPhaseBehavior(phaseSpec);
        escort.onPolygonShrunk(this.activePolygon);
        newlySpawnedBosses.push(escort);
      }
    }

    if (newlySummonedMinions.length > 0) {
      this.minions.push(...newlySummonedMinions);
    }
    if (newlySpawnedBosses.length > 0) {
      this.bosses.push(...newlySpawnedBosses);
    }
  }

  private update(dt: number): void {
    this.timeSeconds += dt;
    this.particles.update(dt);

    if (this.roundIntroTimer > 0) {
      this.roundIntroTimer = Math.max(0, this.roundIntroTimer - dt);
    }

    if (this.phaseAwakeningTimer > 0) {
      this.phaseAwakeningTimer = Math.max(0, this.phaseAwakeningTimer - dt);
      if (this.phaseAwakeningTimer <= 0) {
        this.phaseAwakeningLabel = null;
      }
    }

    if (this.statusToastTimer > 0) {
      this.statusToastTimer = Math.max(0, this.statusToastTimer - dt);
      if (this.statusToastTimer <= 0) {
        this.statusToast = null;
      }
    }

    if (this.screen === 'REWARDED_AD_SIM') {
      this.adCountdown -= dt;
      if (this.adCountdown <= 0) {
        this.completeReviveGrant();
      }
      return;
    }

    const input = this.input.poll(dt);
    this.lastInputSnapshot = input;

    if (input.debugSectorSelect !== null && import.meta.env.DEV) {
      this.startEndlessRun(input.debugSectorSelect);
      return;
    }

    if (input.pauseJustPressed) {
      if (this.screen === 'PLAYING') {
        this.screen = 'PAUSED';
        SoundEngine.stopLaserCutLoop();
        return;
      } else if (this.screen === 'PAUSED') {
        this.screen = 'PLAYING';
        return;
      }
    }

    if (this.screen !== 'PLAYING') {
      SoundEngine.stopLaserCutLoop();
      return;
    }

    const save = StorageService.getCurrent();
    const diff = DIFFICULTIES[save.difficulty];
    const spec = this.currentWaveSpec;

    if (this.trapEnrageTimer > 0) {
      this.trapEnrageTimer = Math.max(0, this.trapEnrageTimer - dt);
    }

    // 1. Update Twin-Prong Fighter with zero-inertia stop & Cut-First Priority (`BorderAndCutNavigator`)
    this.syncSolidBoxes();
    const prevX = this.ship.x;
    const prevY = this.ship.y;
    const completedCut = this.ship.update(dt, input, this.activePolygon, this.activeBarriers);
    const movedDist = Math.hypot(this.ship.x - prevX, this.ship.y - prevY);

    if (this.ship.turnedCornerThisStep) {
      SoundEngine.playCornerClick();
    }

    if (this.boxContactSfxCooldown > 0) {
      this.boxContactSfxCooldown = Math.max(0, this.boxContactSfxCooldown - dt);
    }
    for (const b of this.powerBoxes) b.update(dt);
    if (this.ship.boxContactThisStep && this.boxContactSfxCooldown <= 0) {
      this.boxContactSfxCooldown = 0.35;
      SoundEngine.playCornerClick();
      this.particles.spawnBurst(this.ship.x, this.ship.y, 2, '#FFF0A0', 30, 90, 4, 0.16);
      const touched = this.getActiveSolidBoxes().find(
        (b) =>
          Math.abs(b.x - this.ship.x) <= SOLID_BOX_HALF + 12 &&
          Math.abs(b.y - this.ship.y) <= SOLID_BOX_HALF + 12
      );
      if (touched) touched.contactFlash = 0.22;
    }

    // V7 Law 2 + Audio Signature 1: Burglar-Alarm Shield Tick ONLY while `ON_BORDER`; silenced in `CUTTING`!
    if (this.ship.state === 'ON_BORDER') {
      const shieldUnitsNow = this.ship.getShieldUnits();
      if (this.ship.isShieldInZeroWarning()) {
        this.shieldZeroBeepTimer -= dt;
        if (this.shieldZeroBeepTimer <= 0) {
          this.shieldZeroBeepTimer = 0.24;
          SoundEngine.playShieldZeroWarning();
        }
      } else if (shieldUnitsNow > 0 && this.ship.shieldLockTimer <= 0) {
        this.shieldZeroBeepTimer = 0;
        this.shieldPulseTimer -= dt;
        if (this.shieldPulseTimer <= 0) {
          this.shieldPulseTimer = shieldUnitsNow < 200 ? 0.24 : 0.64;
          SoundEngine.playShieldPulseTick(shieldUnitsNow);
        }
      }
    } else {
      this.shieldZeroBeepTimer = 0;
      this.shieldPulseTimer = 0.25;
    }

    // V7 Law 4: Cumulative Mid-Cut Stall Spark (`4.0s` KOLAY / `2.0s` ORTA / `0.9s` ZOR)
    if (this.ship.state === 'CUTTING') {
      if (movedDist > 0.25) {
        SoundEngine.playLaserCutLoop(this.ship.getActiveTrailLength(), this.ship.isBacktracking);
      } else {
        SoundEngine.stopLaserCutLoop();
        if (!this.ship.boxContactThisStep) {
          this.cutStallTimer += dt;
        }
      }

      const activeTrailNow = this.ship.getActiveTrail();
      if (
        !this.hesitationFuseLit &&
        activeTrailNow.length >= 2 &&
        this.cutStallTimer >= spec.rules.stallSparkLimitSec
      ) {
        this.hesitationFuseLit = true;
        this.fuses.push(new TrailFuse(0, activeTrailNow));
        SoundEngine.playElectricShock();
        SoundEngine.playFuseAlarm();
      }
    } else {
      SoundEngine.stopLaserCutLoop();
      this.cutStallTimer = 0;
      this.hesitationFuseLit = false;
      this.fuses = [];
      if (movedDist > 0.1) {
        SoundEngine.playBorderHum();
      }
    }

    // Auto-Fire Twin Laser (`L`) or 3-Way Super Plasma (`★`) while on safe border
    const weaponReady = this.ship.canFireWeapon(dt);
    if (weaponReady) {
      const inwardDir = this.ship.getInwardBorderDirection(this.activePolygon);
      if (inwardDir) {
        const isHeavy = weaponReady === 'BOSS_CANNON';
        this.projectiles.spawnPlayerBolt({ x: this.ship.x, y: this.ship.y }, inwardDir, isHeavy);
        SoundEngine.playLaserShot(isHeavy);
      }
    }

    if (completedCut) {
      const waveScoreMult = diff.scoreMultiplier * (1 + (spec.threatIndex - 1) * 0.14);
      this.processCompletedCut(completedCut.trail, waveScoreMult);
      if (this.screen !== 'PLAYING') {
        return;
      }
    }

    // Check Rare Group C Boss Phase Awakening (`FAZ II` / `FAZ III`)
    const resolvedPhase = this.endlessDirector.resolveActivePhase(
      this.claimedPercent,
      this.getPrimaryBossHpRatio(),
      this.currentWaveSpec
    );
    if (resolvedPhase > this.activeCombatPhase && this.getPrimaryBosses().some((b) => b.alive)) {
      this.triggerBossPhaseAwakening(resolvedPhase);
    }

    // Update homing Power-Up Capsules (`S`, `T`, `P`, `L`, `C`, `★`)
    if (this.capsules.length > 0) {
      for (const cap of this.capsules) {
        if (!cap.alive) continue;
        const collected = cap.update(dt, { x: this.ship.x, y: this.ship.y });
        if (collected) {
          this.activateCollectedPowerUp(cap.type, this.ship.x, this.ship.y);
        }
      }
      this.capsules = this.capsules.filter((c) => c.alive);
    }

    // Periodic Mystery Wall Block Spawner on early/medium threat waves while ship is safely on border
    if (spec.threatIndex < 6.5 && this.ship.state === 'ON_BORDER') {
      this.dynamicPodTimer -= dt;
      if (this.dynamicPodTimer <= 0) {
        this.dynamicPodTimer = 24;
        const remainingPods = this.powerBoxes.filter((p) => !p.collected).length;
        if (remainingPods < 2) {
          this.trySpawnDynamicMysteryPod();
        }
      }
    }

    const timeFrozen = this.timeFreezeTimer > 0;
    if (this.timeFreezeTimer > 0) {
      this.timeFreezeTimer = Math.max(0, this.timeFreezeTimer - dt);
    }

    const activeTrail = this.ship.getActiveTrail();
    const enemyDt = this.phaseAwakeningTimer > 0 ? dt * 0.28 : dt;
    const enrageBoost = this.trapEnrageTimer > 0 ? 1.38 : 1.0;
    const minionSpeedScale = Math.min(1.95, 0.92 + spec.threatIndex * 0.065) * enrageBoost;

    // 3. Update Authentic 1989 Bosses, Swarm Aggro Minions, Border Crawlers & Electric Shocks
    if (!timeFrozen) {
      const spawnedMinions: InteriorMinion[] = [];
      let pocketCrushTriggered = false;

      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        boss.update({
          dt: enemyDt,
          timeSeconds: this.timeSeconds,
          activePolygon: this.activePolygon,
          claimedPercent: this.claimedPercent,
          playerPos: { x: this.ship.x, y: this.ship.y },
          playerVel: { x: this.ship.vx, y: this.ship.vy },
          playerState: this.ship.state,
          activeTrail,
          speedScale: 1.0,
          aimMode: spec.rules.bossAimMode,
          projectiles: this.projectiles,
          summonMinion: (m) => spawnedMinions.push(m),
          spawnSolidObstacle: (pos) => this.spawnPermanentShellObstacle(pos),
          currentMinionCount: this.minions.length + spawnedMinions.length
        });

        // CyberTitanSkull Last Stand survival completion (`10.0s` survived OR `>= 90%` claimed!)
        if (boss instanceof CyberSkullBoss && boss.inLastStand && boss.lastStandCompleted) {
          this.triggerLevelVictory('AREA_THRESHOLD');
          return;
        }

        const solidBoxesNow = this.getActiveSolidBoxes();
        if (bounceCircleOffSolidBoxes(boss, boss.boundingRadius * 0.8, solidBoxesNow)) {
          const clamped = resolvePolygonPenetration(
            { x: boss.x, y: boss.y },
            boss.boundingRadius * 0.75,
            this.activePolygon
          );
          boss.x = clamped.position.x;
          boss.y = clamped.position.y;
        }
        if (boss instanceof CentipedeBoss) {
          boss.bounceSegmentsOffBoxes(solidBoxesNow, this.activePolygon);
        } else if (boss instanceof OpticNerveBoss) {
          boss.bounceTailOffBoxes(solidBoxesNow, this.activePolygon);
        }

        if (!boss.alive && boss.crushedInPocket) {
          pocketCrushTriggered = true;
          SoundEngine.playBossHit(false);
          this.particles.spawnShockwave(boss.x, boss.y, 480, '#FFE058', 0.5);
          this.particles.spawnBurst(boss.x, boss.y, 36, PALETTE.CUT_ORANGE, 80, 280, 8, 0.45);
        }
      }

      if (pocketCrushTriggered && this.getPrimaryBosses().every((b) => !b.alive)) {
        save.stats.bossesDestroyed += 1;
        this.tryUnlockAchievement('BOSS_SLAYER');
        this.triggerLevelVictory('BOSS_DESTROYED');
        return;
      }

      // V7 Law 3: Determine which alive minions enter Unshielded Swarm Aggro during `CUTTING`
      const aggroAllowed = new Set<InteriorMinion>();
      if (this.ship.state === 'CUTTING') {
        const aliveSorted = this.minions
          .filter((m) => m.alive)
          .slice()
          .sort(
            (a, b) =>
              Math.hypot(a.x - this.ship.x, a.y - this.ship.y) -
              Math.hypot(b.x - this.ship.x, b.y - this.ship.y)
          );
        const cap = Math.max(1, spec.rules.aggroMaxMinions);
        for (let i = 0; i < Math.min(cap, aliveSorted.length); i++) {
          aggroAllowed.add(aliveSorted[i]);
        }
      }

      for (const m of this.minions) {
        if (!m.alive) continue;
        m.update({
          dt: enemyDt,
          activePolygon: this.activePolygon,
          playerState: this.ship.state,
          playerPos: { x: this.ship.x, y: this.ship.y },
          playerVel: { x: this.ship.vx, y: this.ship.vy },
          activeTrail,
          speedScale: minionSpeedScale,
          aggroActive: aggroAllowed.has(m),
          aggroSpeedMult: spec.rules.swarmAggroSpeedMult,
          interceptLead: spec.rules.swarmInterceptLead,
          projectiles: this.projectiles,
          spawnChildMinion: (child) => spawnedMinions.push(child),
          currentMinionCount: this.minions.length + spawnedMinions.length
        });
        if (bounceCircleOffSolidBoxes(m, m.radius, this.getActiveSolidBoxes())) {
          m.enforcePolygonBounds(this.activePolygon);
        }
      }

      if (spawnedMinions.length > 0) {
        this.minions.push(...spawnedMinions);
      }

      this.crawlerSpawnTimer -= enemyDt;
      if (this.crawlerSpawnTimer <= 0 && this.crawlers.length < 2) {
        this.crawlerSpawnTimer = spec.rules.crawlerDelaySec;
        const edges = getPolygonEdges(this.activePolygon);
        const totalPerim = getTotalPerimeter(edges);
        if (totalPerim > 0) {
          const playerProj = projectPointToPolygon(
            { x: this.ship.x, y: this.ship.y },
            this.activePolygon
          );
          const playerS = pointToArcLength(playerProj.point, this.activePolygon) ?? 0;
          const oppositeS = (playerS + totalPerim * 0.5) % totalPerim;
          this.crawlers.push(new BorderCrawler(this.activePolygon, oppositeS, 138));
        }
      }

      for (const c of this.crawlers) {
        c.update(
          enemyDt,
          this.activePolygon,
          { x: this.ship.x, y: this.ship.y },
          minionSpeedScale
        );
      }

      if (this.ship.state === 'CUTTING' && activeTrail.length >= 2) {
        const fuseSpeed = spec.rules.electricShockSpeed;
        for (const fuse of this.fuses) {
          const res = fuse.update(enemyDt, activeTrail, fuseSpeed);
          if (res.playAlarmPulse) {
            SoundEngine.playFuseAlarm();
          }
          if (res.caughtShip) {
            this.killPlayerShip();
            return;
          }
        }
      } else {
        this.fuses = [];
      }
    }

    // 4. Update Projectiles & Check Collisions (including Bullet-vs-Trail Electric Shock!)
    this.projectiles.update(enemyDt, this.activePolygon, timeFrozen, {
      x: this.ship.x,
      y: this.ship.y
    });
    this.resolveProjectileWallImpacts();
    this.evaluateCombatAndHazards();
  }

  private resolveProjectileWallImpacts(): void {
    const boxes = this.getActiveSolidBoxes();
    if (boxes.length === 0) return;
    const bulletsRicochet = this.currentWaveSpec.threatIndex >= 4.5;

    for (const bolt of this.projectiles.playerBolts) {
      if (!bolt.active) continue;
      if (circleHitsSolidBox(bolt.x, bolt.y, bolt.radius, boxes)) {
        bolt.active = false;
        this.particles.spawnBurst(bolt.x, bolt.y, 4, '#FFF0A0', 30, 110, 4, 0.16);
      }
    }

    for (const eb of this.projectiles.enemyBullets) {
      if (!eb.active) continue;
      if (!circleHitsSolidBox(eb.x, eb.y, eb.radius, boxes)) continue;
      if (bulletsRicochet && eb.ricochets < 1) {
        eb.ricochets += 1;
        bounceCircleOffSolidBoxes(eb, eb.radius, boxes);
      } else {
        eb.active = false;
        this.particles.spawnBurst(eb.x, eb.y, 4, '#C8D2E4', 30, 110, 4, 0.16);
      }
    }
  }

  private trySpawnDynamicMysteryPod(): void {
    const pool: PowerUpType[] = ['S', 'P', 'L', 'C'];
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    for (let attempt = 0; attempt < 24; attempt++) {
      const cand = {
        x: Math.round((140 + Math.random() * 620) / 10) * 10,
        y: Math.round((170 + Math.random() * 860) / 10) * 10
      };
      if (!pointInPolygonStrict(cand, this.activePolygon)) continue;
      const safe = resolvePolygonPenetration(cand, SOLID_BOX_HALF * 1.5 + 60, this.activePolygon);
      if (Math.hypot(safe.position.x - cand.x, safe.position.y - cand.y) > 4) continue;
      const clashBox = this.getActiveSolidBoxes().some(
        (b) => Math.max(Math.abs(b.x - cand.x), Math.abs(b.y - cand.y)) < 160
      );
      if (clashBox) continue;
      if (Math.hypot(this.ship.x - cand.x, this.ship.y - cand.y) < 160) continue;
      const clashEnemy =
        this.bosses.some(
          (b) => b.alive && Math.hypot(b.x - cand.x, b.y - cand.y) < b.boundingRadius + 70
        ) ||
        this.minions.some(
          (m) => m.alive && Math.hypot(m.x - cand.x, m.y - cand.y) < m.radius + 60
        );
      if (clashEnemy) continue;

      this.powerBoxes.push(
        new PowerUpBox({
          x: cand.x,
          y: cand.y,
          type: chosen,
          blinking: true,
          blockKind: 'DISAPPEARING',
          rewardType: chosen,
          onDurationSec: this.currentWaveSpec.rules.disappearOnSec,
          offDurationSec: this.currentWaveSpec.rules.disappearOffSec
        })
      );
      this.particles.spawnShockwave(cand.x, cand.y, 48, '#50E8FF', 0.28);
      return;
    }
  }

  private processCompletedCut(trail: readonly Point[], diffMultiplier: number): void {
    this.fuses = [];
    this.cutStallTimer = 0;
    this.hesitationFuseLit = false;

    const split = PolygonSplitter.split(this.activePolygon, trail);
    if (!split) {
      this.ship.snapOntoUpdatedPolygon(this.activePolygon);
      return;
    }

    this.cutsThisLevel += 1;

    const aliveBossPositions = this.getPrimaryBosses()
      .filter((b) => b.alive)
      .map((b) => b.position);
    const classified = PolygonSplitter.classifySplit(split, aliveBossPositions);

    const prevPercent = this.claimedPercent;
    this.activePolygon = classified.activePolygon;
    this.activeBarriers = getActivePerimeterBarriers(this.activePolygon, this.waveBarrierDefs);

    const remainingArea = computeArea(this.activePolygon);
    this.claimedPercent = Math.min(
      99.9,
      Math.max(0, ((INITIAL_ARENA_AREA - remainingArea) / INITIAL_ARENA_AREA) * 100)
    );
    const percentDelta = Math.max(0.1, this.claimedPercent - prevPercent);

    this.ship.snapOntoUpdatedPolygon(this.activePolygon);
    for (const c of this.crawlers) {
      c.snapOntoUpdatedPolygon(this.activePolygon);
    }
    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      if (boss.isEscort && !pointInPolygonStrict(boss.position, this.activePolygon)) {
        boss.alive = false;
        this.addScore(20_000);
        SoundEngine.playBossHit(false);
        this.particles.spawnShockwave(boss.x, boss.y, 320, '#FFE058', 0.42);
        this.particles.spawnBurst(boss.x, boss.y, 28, PALETTE.CUT_ORANGE, 70, 240, 7, 0.4);
        this.particles.spawnFloatingText(boss.x, boss.y, '+20000', '#FFD040', 26);
        continue;
      }
      boss.onPolygonShrunk(this.activePolygon);
    }

    this.particles.spawnPolygonShatter(classified.claimedPolygon, {
      x: this.ship.x,
      y: this.ship.y
    });
    SoundEngine.playPolygonShatter(percentDelta);
    NativeBridge.hapticPolygonShatter(percentDelta);

    if (percentDelta >= JUICE_HITSTOP_THRESHOLD) {
      this.gameLoop.triggerHitStop(JUICE_HITSTOP_DURATION);
      this.particles.triggerShake(9, 0.24);
    } else if (percentDelta >= 8) {
      this.particles.triggerShake(4, 0.15);
    }

    if (percentDelta >= 25.0) {
      this.tryUnlockAchievement('MEGA_SLICE');
    }

    const cutScore = ScoreSystem.computeCutScore(percentDelta, diffMultiplier);
    this.addScore(cutScore.points);
    this.particles.spawnFloatingText(
      this.ship.x,
      this.ship.y - 26,
      `+${cutScore.points}`,
      cutScore.isBigCut ? '#FFD040' : '#FFFFFF',
      cutScore.isBigCut ? 28 : 22
    );

    let trappedCount = 0;
    for (const m of this.minions) {
      if (!m.alive) continue;
      if (!pointInPolygonStrict(m.position, this.activePolygon)) {
        m.alive = false;
        const comboPts = ScoreSystem.computeMinionTrapScore(trappedCount);
        trappedCount++;
        this.addScore(comboPts);
        this.particles.spawnBurst(m.x, m.y, 18, PALETTE.CUT_ORANGE, 60, 220, 6, 0.34);
        this.particles.spawnFloatingText(m.x, m.y, `+${comboPts}`, '#FFD040', 22);
      }
    }
    this.minions = this.minions.filter((m) => m.alive);
    if (trappedCount >= 3) {
      this.tryUnlockAchievement('COMBO_HUNTER');
    }

    for (const eb of this.projectiles.enemyBullets) {
      if (eb.active && !pointInPolygonStrict({ x: eb.x, y: eb.y }, this.activePolygon)) {
        eb.active = false;
      }
    }

    for (const box of this.powerBoxes) {
      if (box.collected) continue;
      if (!pointInPolygonStrict(box.center, this.activePolygon)) {
        // V7 Law 6: Disappearing block enclosed while invisible grants NOTHING!
        const materializedAtCut = box.isMaterialized(this.timeSeconds);
        box.collected = true;
        if (!materializedAtCut) {
          this.particles.spawnFloatingText(box.x, box.y, 'BOŞ', '#8A98B4', 20);
          continue;
        }

        if (box.blockKind === 'ARMOR_PILLAR') {
          this.addScore(ARMOR_PILLAR_BONUS);
          this.particles.spawnBurst(box.x, box.y, 18, '#C8D2E4', 55, 200, 7, 0.32);
          this.particles.spawnFloatingText(box.x, box.y, `+${ARMOR_PILLAR_BONUS}`, '#FFFFFF', 22);
          continue;
        }

        if (box.blockKind === 'SPECIAL_STAGE_1_RED') {
          this.addScore(4_000);
          this.particles.spawnBurst(box.x, box.y, 20, '#FF4838', 65, 210, 6, 0.34);
          this.particles.spawnFloatingText(box.x, box.y, 'ALTIN BLOK AÇILDI!', '#FFE048', 22);
          this.spawnStage2GoldSpecialBlock();
          continue;
        }

        if (box.rewardType === 'EMPTY_POINTS') {
          this.addScore(EMPTY_BLOCK_POINTS_BONUS);
          this.particles.spawnBurst(box.x, box.y, 12, '#FFE068', 50, 170, 5, 0.26);
          this.particles.spawnFloatingText(
            box.x,
            box.y,
            `+${EMPTY_BLOCK_POINTS_BONUS}`,
            '#FFE068',
            22
          );
          continue;
        }

        if (box.rewardType === 'ENRAGE_TRAP') {
          this.addScore(2_000);
          this.trapEnrageTimer = 3.5;
          this.particles.spawnShockwave(box.x, box.y, 150, '#FF2838', 0.32);
          this.particles.spawnFloatingText(box.x, box.y, 'TUZAK • SÜRÜ ÖFKESİ!', '#FF3848', 22);
          continue;
        }

        const resolved = box.resolveType(this.timeSeconds);
        if (resolved === 'ARMOR_PILLAR') {
          this.addScore(ARMOR_PILLAR_BONUS);
          continue;
        }
        const collectible: CollectiblePowerUpType = resolved;
        const blockPts =
          collectible === 'BOSS_CANNON' ? ScoreSystem.computeSpecialBlockBonus() : 1000;
        this.addScore(blockPts);
        this.particles.spawnBurst(
          box.x,
          box.y,
          14,
          collectible === 'BOSS_CANNON' ? '#FFD040' : '#50E8FF',
          55,
          190,
          6,
          0.28
        );
        this.capsules.push(new PowerUpCapsule({ x: box.x, y: box.y }, collectible));
      }
    }
    this.syncSolidBoxes();

    const save = StorageService.getCurrent();
    save.stats.totalCuts += 1;
    if (percentDelta > save.stats.biggestSingleCut) {
      save.stats.biggestSingleCut = Math.round(percentDelta * 10) / 10;
    }

    if (classified.outcome === 'TWIN_BOSS_SEPARATED') {
      save.stats.twinSplits += 1;
      this.tryUnlockAchievement('TWIN_SPLITTER');
      this.triggerLevelVictory('TWIN_SPLIT');
      return;
    }

    if (this.claimedPercent >= this.currentWaveSpec.targetPercent) {
      // V7 Group C #3 (`CyberTitanSkull`): False Victory / 10-Second Last Stand!
      const skull = this.bosses.find(
        (b): b is CyberSkullBoss =>
          b instanceof CyberSkullBoss && b.alive && b.canEvolveLastStand && !b.lastStandCompleted
      );
      if (skull && this.claimedPercent < 90) {
        if (!skull.inLastStand) {
          this.triggerBossPhaseAwakening(2);
          skull.triggerLastStand(10.0);
          this.phaseAwakeningLabel = 'SON DİRENİŞ: 10 SN VEYA %90!';
          this.phaseAwakeningTimer = 1.6;
        }
        return;
      }

      this.triggerLevelVictory('AREA_THRESHOLD');
    }
  }

  private activateCollectedPowerUp(type: CollectiblePowerUpType, px: number, py: number): void {
    const save = StorageService.getCurrent();
    save.stats.powerUpsCollected += 1;

    SoundEngine.playPowerUp(type);
    NativeBridge.hapticPowerUp();

    switch (type) {
      case 'S':
        this.ship.applySpeedUp();
        this.particles.spawnFloatingText(px, py - 24, 'HIZ', '#50E8FF', 26);
        break;
      case 'T':
        this.timeFreezeTimer = this.currentWaveSpec.rules.timeFreezeDurationSec;
        this.particles.spawnFloatingText(px, py - 24, 'DONDUR', '#50E8FF', 26);
        break;
      case 'P':
        this.ship.applyShieldLock();
        this.particles.spawnFloatingText(px, py - 24, 'KALKAN', '#28E038', 26);
        break;
      case 'L':
        this.ship.laserTimer = 12.0;
        this.particles.spawnFloatingText(px, py - 24, 'LAZER', '#FFD040', 26);
        break;
      case 'C': {
        this.particles.spawnShockwave(px, py, 760, '#FFB833', 0.42);
        this.particles.triggerShake(8, 0.22);
        this.projectiles.clearEnemyBullets();
        for (const m of this.minions) {
          if (!m.alive) continue;
          m.alive = false;
          this.addScore(500);
          this.particles.spawnBurst(m.x, m.y, 16, PALETTE.CUT_ORANGE, 60, 210, 6, 0.32);
        }
        this.minions = [];
        this.particles.spawnFloatingText(px, py - 24, 'TEMİZLE', '#FF7810', 26);
        break;
      }
      case 'BOSS_CANNON':
        this.ship.bossCannonTimer = 11.0;
        this.particles.spawnShockwave(px, py, 360, '#FFD040', 0.34);
        this.particles.spawnFloatingText(px, py - 24, 'SÜPER ATIŞ', '#FFD040', 28);
        break;
    }
  }

  private evaluateCombatAndHazards(): void {
    // 1. Player Twin Lasers (`L`) & 3-Way Super Plasma (`★`) vs Bullets, Minions & Bosses
    for (const bolt of this.projectiles.playerBolts) {
      if (!bolt.active) continue;

      for (const eb of this.projectiles.enemyBullets) {
        if (!eb.active) continue;
        if (Math.hypot(bolt.x - eb.x, bolt.y - eb.y) <= bolt.radius + eb.radius + 4) {
          eb.active = false;
          if (!bolt.heavyPlasma) {
            bolt.active = false;
          }
          this.particles.spawnBurst(eb.x, eb.y, 6, '#FFD040', 40, 120, 4, 0.18);
          break;
        }
      }
      if (!bolt.active) continue;

      for (const m of this.minions) {
        if (!m.alive) continue;
        if (Math.hypot(bolt.x - m.x, bolt.y - m.y) <= bolt.radius + m.radius) {
          bolt.active = false;
          m.alive = false;
          this.addScore(400);
          this.particles.spawnBurst(m.x, m.y, 14, PALETTE.CUT_ORANGE, 50, 180, 5.5, 0.3);
          this.particles.spawnFloatingText(m.x, m.y, '+400', '#FFD040', 20);
          break;
        }
      }
      if (!bolt.active) continue;

      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        const circles = boss.getHitCircles();
        let hitBoss = false;
        for (const c of circles) {
          if (Math.hypot(bolt.x - c.x, bolt.y - c.y) <= bolt.radius + c.radius) {
            hitBoss = true;
            break;
          }
        }

        if (hitBoss) {
          bolt.active = false;
          if (!bolt.heavyPlasma) {
            SoundEngine.playBossHit(true);
            this.addScore(20);
            this.particles.spawnBurst(bolt.x, bolt.y, 5, '#50E8FF', 45, 130, 4, 0.18);
          } else {
            SoundEngine.playBossHit(false);
            this.addScore(1000);
            this.particles.triggerShake(6, 0.16);
            this.particles.spawnBurst(bolt.x, bolt.y, 16, PALETTE.CUT_ORANGE, 65, 220, 6, 0.3);
            const destroyed = boss.takeCannonHit();
            if (destroyed) {
              this.particles.spawnShockwave(boss.x, boss.y, 520, '#FFE04C', 0.52);
              this.particles.spawnBurst(boss.x, boss.y, 38, PALETTE.CUT_ORANGE, 80, 290, 8, 0.45);
            }
            if (this.getPrimaryBosses().every((b) => !b.alive)) {
              const save = StorageService.getCurrent();
              save.stats.bossesDestroyed += 1;
              this.tryUnlockAchievement('BOSS_SLAYER');
              this.triggerLevelVictory('BOSS_DESTROYED');
              return;
            }
          }
          break;
        }
      }
    }
    this.minions = this.minions.filter((m) => m.alive);

    // 2. V7 Law 4: Enemy Body OR Enemy Projectile Touching `activeTrail` -> Electric Line Shock!
    // On `ZOR` (`bossHitTrailInstantDetonation === true`), Boss body or Boss bullet (`fromBoss`) detonates in `0ms`!
    const activeTrail = this.ship.getActiveTrail();
    const instantBossDetonation = this.currentWaveSpec.rules.bossHitTrailInstantDetonation;
    if (this.ship.state === 'CUTTING' && activeTrail.length >= 2 && this.timeFreezeTimer <= 0) {
      const totalTrailLen = this.ship.getActiveTrailLength();
      const igniteTrailShock = (
        ex: number,
        ey: number,
        er: number,
        isBossSource: boolean
      ): boolean => {
        const proj = projectPointToPolyline({ x: ex, y: ey }, activeTrail);
        if (proj.distance <= er + 2.5) {
          SoundEngine.playElectricShock();
          this.particles.spawnBurst(
            proj.point.x,
            proj.point.y,
            12,
            '#38E8FF',
            55,
            175,
            5,
            0.24
          );

          if (isBossSource && instantBossDetonation) {
            this.killPlayerShip();
            return true;
          }

          const safeInitialArc = Math.min(proj.arcLength, Math.max(0, totalTrailLen - 54));
          const alreadyLit = this.fuses.some((f) => f.arcDistance >= safeInitialArc - 36);
          if (!alreadyLit) {
            this.fuses.push(new TrailFuse(safeInitialArc, activeTrail));
            SoundEngine.playFuseAlarm();
          }
          return true;
        }
        return false;
      };

      // Check all Enemy Projectiles against `activeTrail`!
      for (const eb of this.projectiles.enemyBullets) {
        if (!eb.active) continue;
        const proj = projectPointToPolyline({ x: eb.x, y: eb.y }, activeTrail);
        if (proj.distance <= eb.radius + 3) {
          eb.active = false;
          igniteTrailShock(eb.x, eb.y, eb.radius + 1, eb.fromBoss);
          if (this.screen !== 'PLAYING' || this.ship.state !== 'CUTTING') {
            return;
          }
        }
      }

      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        for (const c of boss.getHitCircles()) {
          if (igniteTrailShock(c.x, c.y, c.radius, true)) {
            if (this.screen !== 'PLAYING' || this.ship.state !== 'CUTTING') {
              return;
            }
          }
        }
      }

      for (const m of this.minions) {
        if (m.alive) {
          igniteTrailShock(m.x, m.y, m.radius, false);
        }
      }

      // TwinNexus electrified tether arc ignites trail along 5 sample points
      if (
        this.bosses.length >= 2 &&
        this.bosses[0] instanceof TwinNexus &&
        this.bosses[1] instanceof TwinNexus &&
        this.bosses[0].alive &&
        this.bosses[1].alive &&
        !this.bosses[0].isDocked
      ) {
        const a = this.bosses[0];
        const b = this.bosses[1];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 280) {
          for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
            igniteTrailShock(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 9, true);
            if (this.screen !== 'PLAYING' || this.ship.state !== 'CUTTING') {
              return;
            }
          }
        }
      }
    }

    // 3. Direct Hazards vs Player Ship
    if (this.ship.invulnerableTimer > 0 || this.phaseAwakeningTimer > 0) return;

    const shipRadius = 9;

    for (const c of this.crawlers) {
      if (Math.hypot(c.x - this.ship.x, c.y - this.ship.y) <= shipRadius + 11) {
        if (this.ship.isPerimeterShieldActive()) {
          this.ship.shieldHitFlash = 0.24;
          c.deflectFromShield();
          SoundEngine.playShieldDeflect();
        } else {
          this.killPlayerShip();
          return;
        }
      }
    }

    if (this.ship.state === 'CUTTING') {
      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        for (const hc of boss.getHitCircles()) {
          if (Math.hypot(hc.x - this.ship.x, hc.y - this.ship.y) <= shipRadius + hc.radius) {
            this.killPlayerShip();
            return;
          }
        }
      }

      for (const m of this.minions) {
        if (!m.alive) continue;
        if (Math.hypot(m.x - this.ship.x, m.y - this.ship.y) <= shipRadius + m.radius) {
          this.killPlayerShip();
          return;
        }
      }

      // TwinNexus Phase 2+ electrified tether vs cutting ship
      if (
        this.activeCombatPhase >= 2 &&
        this.bosses.length >= 2 &&
        this.bosses[0] instanceof TwinNexus &&
        this.bosses[1] instanceof TwinNexus &&
        this.bosses[0].alive &&
        this.bosses[1].alive &&
        !this.bosses[0].isDocked
      ) {
        const a = this.bosses[0];
        const b = this.bosses[1];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 280) {
          const arcProj = projectPointToSegment(
            { x: this.ship.x, y: this.ship.y },
            { x: a.x, y: a.y },
            { x: b.x, y: b.y }
          );
          if (arcProj.distance <= shipRadius + 6) {
            this.killPlayerShip();
            return;
          }
        }
      }
    }

    for (const eb of this.projectiles.enemyBullets) {
      if (!eb.active) continue;
      if (Math.hypot(eb.x - this.ship.x, eb.y - this.ship.y) <= shipRadius + eb.radius) {
        eb.active = false;
        if (this.ship.isPerimeterShieldActive()) {
          this.ship.shieldHitFlash = 0.24;
          SoundEngine.playShieldDeflect();
          this.particles.spawnBurst(eb.x, eb.y, 8, '#28E038', 40, 130, 4, 0.2);
        } else {
          this.killPlayerShip();
          return;
        }
      }
    }
  }

  private killPlayerShip(): void {
    SoundEngine.playShipExplode();
    NativeBridge.hapticDanger();
    this.particles.triggerShake(12, 0.32);
    this.particles.spawnBurst(
      this.ship.x,
      this.ship.y,
      32,
      PALETTE.CUT_ORANGE,
      70,
      260,
      7,
      0.4
    );

    this.fuses = [];
    this.cutStallTimer = 0;
    this.hesitationFuseLit = false;
    this.projectiles.clearEnemyBullets();
    this.deathsThisLevel += 1;
    this.lives -= 1;

    this.persistRunRecords();

    if (this.lives <= 0) {
      if (MonetizationService.canOfferSecondChance(this.reviveUsedThisLevel)) {
        this.screen = 'SECOND_CHANCE';
      } else {
        void StorageService.save();
        this.screen = 'GAME_OVER';
      }
      return;
    }

    this.ship.respawnAtCutStart(this.activePolygon);
  }

  private triggerLevelVictory(reason: LevelWinReason): void {
    const save = StorageService.getCurrent();
    const diff = DIFFICULTIES[save.difficulty];
    const spec = this.currentWaveSpec;

    SoundEngine.playWaveClearExplosionChain();
    SoundEngine.playLevelClear();
    NativeBridge.hapticPolygonShatter(30);

    for (const boss of this.bosses) {
      if (boss.alive) {
        this.particles.spawnShockwave(boss.x, boss.y, 440, '#FFE058', 0.48);
        this.particles.spawnBurst(boss.x, boss.y, 32, PALETTE.CUT_ORANGE, 75, 260, 8, 0.44);
      }
    }
    for (const m of this.minions) {
      if (m.alive) {
        this.particles.spawnBurst(m.x, m.y, 16, PALETTE.CUT_ORANGE, 60, 220, 6, 0.35);
      }
    }
    this.minions = [];
    this.capsules = [];
    this.projectiles.clearEnemyBullets();

    const clearedInSingleCut =
      reason === 'AREA_THRESHOLD' &&
      this.cutsThisLevel === 1 &&
      this.claimedPercent >= spec.targetPercent;

    const breakdown = ScoreSystem.computeLevelClearBreakdown(
      reason,
      this.claimedPercent,
      this.ship.getShieldUnits(),
      diff.scoreMultiplier * (1 + (spec.threatIndex - 1) * 0.14),
      clearedInSingleCut,
      spec.targetPercent
    );
    this.clearBreakdown = breakdown;
    this.addScore(breakdown.totalLevelBonus);

    this.tryUnlockAchievement('FIRST_CARVE');
    if (this.claimedPercent >= 99.0) {
      this.tryUnlockAchievement('MASTER_99');
    }
    if (this.deathsThisLevel === 0) {
      this.tryUnlockAchievement('UNTOUCHABLE');
    }
    if (this.currentWave >= 10) {
      this.tryUnlockAchievement('MIDWAY_HERO');
    }
    if (this.currentWave >= 20) {
      this.tryUnlockAchievement('SECTOR_80_SAVIOR');
    }

    this.persistRunRecords();
    void StorageService.save((d) => {
      d.stats.totalScore += breakdown.totalLevelBonus;
    });

    this.screen = 'LEVEL_CLEAR';
  }

  private getCurrentSkin(): ShipSkinConfig {
    const id = StorageService.getCurrent().selectedShip;
    return SHIP_SKINS.find((s) => s.id === id) ?? SHIP_SKINS[0];
  }

  private render(alpha: number, _frameDt: number): void {
    const ctx = this.renderTargetCtx;
    if (!ctx) return;

    const save = StorageService.getCurrent();
    const layout = getLayout();

    ctx.clearRect(0, 0, layout.width, layout.height);
    ctx.fillStyle = PALETTE.APP_BG;
    ctx.fillRect(0, 0, layout.width, layout.height);

    const isGameplayVisible =
      this.screen === 'PLAYING' ||
      this.screen === 'PAUSED' ||
      this.screen === 'SECOND_CHANCE' ||
      this.screen === 'REWARDED_AD_SIM' ||
      this.screen === 'LEVEL_CLEAR' ||
      this.screen === 'GAME_OVER' ||
      this.screen === 'CAMPAIGN_VICTORY';

    if (isGameplayVisible) {
      if (layout.mode === 'LANDSCAPE_SPLIT') {
        this.renderCabinetWings(ctx);
      }

      ctx.save();
      ctx.translate(layout.arenaOffsetX, layout.arenaOffsetY);
      this.renderArenaWorld(ctx, alpha);
      this.renderArenaTopBars(ctx);
      ctx.restore();

      if (layout.topBarOffset && layout.statusOffset) {
        ctx.save();
        ctx.translate(layout.topBarOffset.x, layout.topBarOffset.y);
        this.renderTopArcadeScoreBar(ctx, save);
        ctx.restore();

        ctx.save();
        ctx.translate(layout.statusOffset.x, layout.statusOffset.y);
        this.renderBottomArcadeStatusBar(ctx, save);
        ctx.restore();
      } else {
        this.renderLandscapeHud(ctx, save);
      }

      this.input.touch.renderControls(
        ctx,
        this.ship.state === 'CUTTING',
        this.ship.isBacktracking
      );
      this.renderPauseButton(ctx);
    }

    if (this.screen !== 'PLAYING') {
      this.menuRenderer.renderScreen(ctx, this.screen, save, this.timeSeconds, {
        currentScore: this.score,
        currentWave: this.currentWave,
        isNewRecord: this.runIsNewRecord,
        clearBreakdown: this.clearBreakdown,
        adCountdown: this.adCountdown,
        statusToast: this.statusToast
      });
    } else if (this.statusToast) {
      const f = layout.arenaFrame;
      const w = Math.min(600, f.w - 40);
      const x = f.x + (f.w - w) * 0.5;
      const y = f.y + 62;
      ctx.save();
      ctx.fillStyle = PALETTE.PIXEL_BLACK;
      ctx.fillRect(x, y, w, 46);
      ctx.strokeStyle = PALETTE.GOLD_LIGHT;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, w - 4, 42);
      drawPixelText(ctx, this.statusToast, x + w * 0.5, y + 23, {
        scale: 3.0,
        tone: 'gold',
        align: 'center'
      });
      ctx.restore();
    }

    if (!this.firstFrameDrawn) {
      this.firstFrameDrawn = true;
      void NativeBridge.hideSplashOnceReady();
    }
  }

  private getDifficultyHudPrefix(save: ReturnType<typeof StorageService.getCurrent>): {
    prefix: string;
    isImpossible: boolean;
  } {
    if (this.currentWaveSpec.threatLabelTr === 'İMKÂNSIZ') {
      return { prefix: 'İMKÂNSIZ', isImpossible: true };
    }
    return {
      prefix: DIFFICULTIES[save.difficulty].shortTr,
      isImpossible: false
    };
  }

  private getShieldTone(): 'white' | 'green' | 'red' | 'gold' {
    const shieldUnits = this.ship.getShieldUnits();
    const inZeroGrace = this.ship.isShieldInZeroWarning();
    const lowWarning = shieldUnits < 150 || inZeroGrace;
    const blinkAlt = Math.floor(this.timeSeconds * 12) % 2 === 0;
    if (shieldUnits === 0 && !inZeroGrace) return 'red';
    if (this.ship.shieldLockTimer > 0) return 'green';
    if (lowWarning) return blinkAlt ? 'red' : 'gold';
    return 'gold';
  }

  /**
   * Renders ONLY the recessed Top-Bezel Territory Progress Bar (`MIDDLE_ZONE_Y + 3`, strictly inside
   * the outer Gold Bezel — 0px overlap with `ARENA_VIEW_Y`!) and brief Phase Awakening banner.
   * The persistent Boss Vitality / Phase Bar now lives in the Top HUD Header ABOVE the arena frame
   * so the entire top border of the playable arena is 100% unobstructed!
   */
  private renderArenaTopBars(ctx: CanvasRenderingContext2D): void {
    const target = Math.max(1, this.currentWaveSpec.targetPercent);
    const areaRatio = Math.max(0, Math.min(1, this.claimedPercent / target));

    // Recessed amber territory progress bar inside top gold bezel (strictly above ARENA_VIEW_Y!)
    const topSlotX = 190;
    const topSlotY = MIDDLE_ZONE_Y + 3;
    const topSlotW = 520;
    const topSlotH = 12;
    ctx.save();
    ctx.fillStyle = '#05070E';
    ctx.fillRect(topSlotX - 2, topSlotY - 1, topSlotW + 4, topSlotH + 2);
    ctx.strokeStyle = '#6E4C0A';
    ctx.lineWidth = 2;
    ctx.strokeRect(topSlotX - 1, topSlotY, topSlotW + 2, topSlotH);
    if (areaRatio > 0.005) {
      const fillW = Math.round((topSlotW - 4) * areaRatio);
      ctx.fillStyle = '#F6B426';
      ctx.fillRect(topSlotX + 2, topSlotY + 2, fillW, topSlotH - 4);
      ctx.fillStyle = '#FFE884';
      ctx.fillRect(topSlotX + 2, topSlotY + 2, fillW, 2);
    }

    // Brief dramatic Phase Awakening callout banner (centered safely below top border)
    if (this.phaseAwakeningLabel && this.phaseAwakeningTimer > 0) {
      const flashAlt = Math.floor(this.timeSeconds * 18) % 2 === 0;
      ctx.fillStyle = 'rgba(6, 8, 18, 0.92)';
      ctx.fillRect(216, ARENA_VIEW_Y + 54, 468, 44);
      ctx.strokeStyle = flashAlt ? '#FFF088' : '#FF5820';
      ctx.lineWidth = 3;
      ctx.strokeRect(216, ARENA_VIEW_Y + 54, 468, 44);
      drawPixelText(ctx, this.phaseAwakeningLabel, 450, ARENA_VIEW_Y + 76, {
        scale: 2.8,
        tone: flashAlt ? 'gold' : 'crimson',
        align: 'center'
      });
    }

    ctx.restore();
  }

  private renderBossVitalityStrip(
    ctx: CanvasRenderingContext2D,
    barX: number,
    barY: number,
    barW: number,
    barH: number
  ): void {
    const target = Math.max(1, this.currentWaveSpec.targetPercent);
    const areaRatio = Math.max(0, Math.min(1, this.claimedPercent / target));
    const hpRatio = this.getPrimaryBossHpRatio();
    const territoryRemaining = Math.max(0.04, 1 - areaRatio * 0.92);
    const bossVitality = Math.max(0, Math.min(1, Math.min(hpRatio, territoryRemaining)));
    const activeSkull = this.bosses.find(
      (b): b is CyberSkullBoss => b instanceof CyberSkullBoss && b.alive && b.inLastStand
    );
    const phaseText = activeSkull
      ? `DİRENİŞ ${Math.ceil(activeSkull.lastStandRemainingSec)}S`
      : this.activeCombatPhase === 3
        ? 'FAZ III'
        : this.activeCombatPhase === 2
          ? 'FAZ II'
          : 'BOSS';

    ctx.fillStyle = '#04060C';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
    ctx.fillStyle = '#C88E1A';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#FFF094';
    ctx.fillRect(barX, barY, barW, 2);
    ctx.fillStyle = '#6E4608';
    ctx.fillRect(barX, barY + barH - 2, barW, 2);

    const innerX = barX + 4;
    const innerY = barY + 4;
    const innerW = barW - 8;
    const innerH = barH - 8;
    ctx.fillStyle = '#070A14';
    ctx.fillRect(innerX, innerY, innerW, innerH);

    const labelSlotW = Math.min(168, Math.max(118, Math.round(barW * 0.24)));
    const maxFillW = Math.max(24, innerW - labelSlotW);
    const vitW = Math.max(0, Math.round(maxFillW * bossVitality));
    if (vitW > 0) {
      const grad = ctx.createLinearGradient(innerX + 2, 0, innerX + 2 + maxFillW, 0);
      if (this.activeCombatPhase === 3) {
        grad.addColorStop(0, '#D82018');
        grad.addColorStop(1, '#FF8C24');
      } else if (this.activeCombatPhase === 2) {
        grad.addColorStop(0, '#E87814');
        grad.addColorStop(1, '#FFD048');
      } else {
        grad.addColorStop(0, '#C88818');
        grad.addColorStop(1, '#FFE268');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(innerX + 2, innerY + 2, vitW, innerH - 4);
      ctx.fillStyle = 'rgba(255, 248, 190, 0.55)';
      ctx.fillRect(innerX + 2, innerY + 2, vitW, 3);
    }

    drawPixelText(ctx, phaseText, barX + barW - 12, barY + barH * 0.5 + 1, {
      scale: 2.35,
      tone: this.activeCombatPhase === 3 ? 'crimson' : 'gold',
      align: 'right',
      letterGap: 0.5
    });
  }

  private renderPauseButton(ctx: CanvasRenderingContext2D): void {
    const r = getLayout().pauseButton;
    const pw = Math.min(68, r.w - 6);
    const ph = Math.min(58, r.h - 6);
    const px = Math.round(r.x + (r.w - pw) * 0.5);
    const py = Math.round(r.y + (r.h - ph) * 0.5);
    ctx.save();
    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(px - 3, py - 3, pw + 6, ph + 6);
    ctx.fillStyle = '#6A7A96';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#121A2C';
    ctx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    ctx.fillStyle = '#D8E2F4';
    const barH = Math.round(ph * 0.46);
    ctx.fillRect(Math.round(px + pw * 0.31), Math.round(py + (ph - barH) * 0.5), 8, barH);
    ctx.fillRect(Math.round(px + pw * 0.57), Math.round(py + (ph - barH) * 0.5), 8, barH);
    ctx.restore();
  }

  private renderCabinetWings(ctx: CanvasRenderingContext2D): void {
    const layout = getLayout();
    ctx.save();
    ctx.fillStyle = '#0B0F18';
    ctx.fillRect(0, 0, layout.width, layout.height);
    for (const wing of [layout.leftWing, layout.rightWing]) {
      if (!wing) continue;
      ctx.fillStyle = '#05070C';
      ctx.fillRect(wing.x - 4, wing.y - 4, wing.w + 8, wing.h + 8);
      ctx.fillStyle = '#161C2A';
      ctx.fillRect(wing.x, wing.y, wing.w, wing.h);
      ctx.fillStyle = '#222A3C';
      ctx.fillRect(wing.x, wing.y, wing.w, 4);
      ctx.fillStyle = '#7A889E';
      for (const [rx, ry] of [
        [wing.x + 10, wing.y + 10],
        [wing.x + wing.w - 16, wing.y + 10],
        [wing.x + 10, wing.y + wing.h - 16],
        [wing.x + wing.w - 16, wing.y + wing.h - 16]
      ]) {
        ctx.fillRect(rx, ry, 6, 6);
      }
    }
    ctx.restore();
  }

  private renderLandscapeHud(
    ctx: CanvasRenderingContext2D,
    save: ReturnType<typeof StorageService.getCurrent>
  ): void {
    const layout = getLayout();
    const lw = layout.leftWing;
    const rw = layout.rightWing;
    if (!lw || !rw) return;

    const panelScale = Math.max(2.6, Math.min(4.2, lw.w / 84));
    const { prefix, isImpossible } = this.getDifficultyHudPrefix(save);

    ctx.save();
    const lPanelH = panelScale * 64;
    ctx.fillStyle = '#05070C';
    ctx.fillRect(lw.x + 14, lw.y + 14, lw.w - 28, lPanelH);
    ctx.strokeStyle = '#364460';
    ctx.lineWidth = 3;
    ctx.strokeRect(lw.x + 14, lw.y + 14, lw.w - 28, lPanelH);
    const lcx = lw.x + lw.w * 0.5;
    drawPixelText(ctx, prefix, lcx, lw.y + 14 + panelScale * 12, {
      scale: panelScale * 0.92,
      tone: isImpossible ? 'crimson' : 'gold',
      align: 'center'
    });
    drawPixelText(ctx, `DALGA ${this.currentWave}`, lcx, lw.y + 14 + panelScale * 28, {
      scale: panelScale * 0.92,
      tone: 'white',
      align: 'center'
    });
    const miniShip = getMiniShipHudSprite();
    const shownLives = Math.max(0, Math.min(this.lives, 5));
    const shipStep = panelScale * 12;
    for (let i = 0; i < shownLives; i++) {
      blitPixelSprite(
        ctx,
        miniShip,
        lcx + (i - (shownLives - 1) * 0.5) * shipStep,
        lw.y + 14 + panelScale * 47,
        Math.max(2, Math.round(panelScale * 0.9))
      );
    }
    this.renderBossVitalityStrip(ctx, lw.x + 14, lw.y + 14 + lPanelH + 12, lw.w - 28, 30);

    const rs = Math.max(2.6, Math.min(4.2, rw.w / 84));
    const rPanelTop = layout.pauseButton.y + layout.pauseButton.h + 12;
    const rPanelH = rs * 96;
    ctx.fillStyle = '#05070C';
    ctx.fillRect(rw.x + 14, rPanelTop, rw.w - 28, rPanelH);
    ctx.strokeRect(rw.x + 14, rPanelTop, rw.w - 28, rPanelH);
    const rx = rw.x + 26;
    const rec = StorageService.getDifficultyRecord(save.difficulty, save);
    const displayHi = Math.max(DEFAULT_ARCADE_HIGH_SCORE, rec.highScore, this.score);
    const target = this.currentWaveSpec.targetPercent;
    const lines: Array<[string, 'white' | 'gold' | 'green' | 'red' | 'cyan' | 'silver', number]> = [
      ['SKOR', 'silver', 10],
      [String(this.score).padStart(7, '0'), 'white', 22],
      ['REKOR', 'gold', 38],
      [String(displayHi).padStart(7, '0'), 'gold', 50],
      [
        `ALAN ${Math.floor(this.claimedPercent)}%/${target}%`,
        this.claimedPercent >= target ? 'green' : 'gold',
        66
      ],
      ['KALKAN', 'silver', 80],
      [String(this.ship.getShieldUnits()).padStart(3, '0'), this.getShieldTone(), 91]
    ];
    for (const [text, tone, off] of lines) {
      drawPixelText(ctx, text, rx, rPanelTop + rs * off, { scale: rs * 0.9, tone, align: 'left' });
    }
    ctx.restore();
  }

  private renderArenaWorld(ctx: CanvasRenderingContext2D, alpha: number): void {
    const shake = this.particles.getShakeOffset();
    const skin = this.getCurrentSkin();
    const bossCannonArmed = this.ship.bossCannonTimer > 0;

    this.layerRenderer.renderUnderFloor(ctx, shake.x, shake.y, this.timeFreezeTimer);

    ctx.save();
    ctx.translate(ARENA_VIEW_X + shake.x, ARENA_VIEW_Y + shake.y);
    ctx.scale(ARENA_VIEW_SCALE, ARENA_VIEW_SCALE);

    const shieldLowWarning =
      this.ship.getShieldUnits() < 150 || this.ship.isShieldInZeroWarning();
    this.layerRenderer.renderUncutSlab(
      ctx,
      this.activePolygon,
      this.timeFreezeTimer,
      shieldLowWarning,
      this.timeSeconds
    );
    this.layerRenderer.renderSteelBarriers(ctx, this.activeBarriers);

    for (const box of this.powerBoxes) {
      box.render(ctx, this.timeSeconds);
    }
    for (const cap of this.capsules) {
      cap.render(ctx);
    }

    // TwinNexus energy tether (electrified crimson-gold in Phase 2+)
    if (
      this.bosses.length >= 2 &&
      this.bosses[0] instanceof TwinNexus &&
      this.bosses[1] instanceof TwinNexus &&
      this.bosses[0].alive &&
      this.bosses[1].alive
    ) {
      const p1 = this.bosses[0].getRenderPos(alpha);
      const p2 = this.bosses[1].getRenderPos(alpha);
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (dist < 280) {
        ctx.save();
        const alt = Math.floor(this.timeSeconds * 18) % 2 === 0;
        ctx.strokeStyle =
          this.activeCombatPhase >= 2
            ? alt
              ? '#FF5820'
              : '#FFF088'
            : alt
              ? '#50E8FF'
              : '#FFF088';
        ctx.lineWidth = this.activeCombatPhase >= 2 ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(Math.round(p1.x), Math.round(p1.y));
        ctx.lineTo(Math.round(p2.x), Math.round(p2.y));
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const m of this.minions) {
      if (m.alive) m.render(ctx, alpha, this.timeSeconds);
    }
    for (const boss of this.bosses) {
      if (boss.alive) boss.render(ctx, alpha, this.timeSeconds, bossCannonArmed);
    }
    for (const crawler of this.crawlers) {
      crawler.render(ctx, alpha, this.timeSeconds);
    }

    this.projectiles.render(ctx, alpha);

    const carveArmed =
      this.lastInputSnapshot.carveHeld || this.input.touch.isCarveVisuallyPressed();
    this.ship.render(
      ctx,
      alpha,
      skin,
      this.timeSeconds,
      this.activePolygon,
      carveArmed,
      this.activeBarriers
    );

    for (const fuse of this.fuses) {
      fuse.render(ctx, alpha, this.timeSeconds);
    }

    this.particles.renderArenaEffects(ctx);

    if (this.roundIntroTimer > 0 && this.screen === 'PLAYING') {
      const stageLabel = `DALGA ${this.currentWave}`;
      ctx.save();
      ctx.fillStyle = 'rgba(6, 8, 16, 0.90)';
      ctx.fillRect(210, 526, 480, 112);
      ctx.strokeStyle = PALETTE.GOLD_LIGHT;
      ctx.lineWidth = 4;
      ctx.strokeRect(210, 526, 480, 112);
      drawPixelText(ctx, stageLabel, 450, 582, {
        scale: ARENA_PIXEL_SCALE * 1.8,
        tone: 'gold',
        align: 'center'
      });
      ctx.restore();
    }

    ctx.restore();
  }

  private renderTopArcadeScoreBar(
    ctx: CanvasRenderingContext2D,
    save: ReturnType<typeof StorageService.getCurrent>
  ): void {
    ctx.save();
    ctx.fillStyle = '#03050A';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_TOP_HEIGHT);

    drawPixelText(ctx, 'SKOR', 18, 18, { scale: 3.5, tone: 'silver', align: 'left' });
    drawPixelText(ctx, String(this.score).padStart(7, '0'), 18, 54, {
      scale: 4.55,
      tone: 'white',
      align: 'left'
    });

    const rec = StorageService.getDifficultyRecord(save.difficulty, save);
    const displayHi = Math.max(DEFAULT_ARCADE_HIGH_SCORE, rec.highScore, this.score);
    drawPixelText(ctx, 'REKOR', 456, 18, { scale: 3.5, tone: 'gold', align: 'center' });
    drawPixelText(ctx, String(displayHi).padStart(7, '0'), 456, 54, {
      scale: 4.55,
      tone: 'gold',
      align: 'center'
    });

    // Dedicated Boss Vitality & Phase Bar sits cleanly ABOVE the arena frame (y = 78..110)!
    this.renderBossVitalityStrip(ctx, 14, 78, CANVAS_WIDTH - 28, 32);
    ctx.restore();
  }

  /**
   * V8 Full-Width Single-Row Status Strip:
   * `KOLAY • DALGA 2 | mini ships | ALAN 73% / 80% | KALKAN 645`
   * Enlarged readable typography with zero overlap on the control deck (`y = 1310..1374`).
   */
  private renderBottomArcadeStatusBar(
    ctx: CanvasRenderingContext2D,
    save: ReturnType<typeof StorageService.getCurrent>
  ): void {
    ctx.save();
    const stripX = 2;
    const stripW = CANVAS_WIDTH - 4;
    ctx.fillStyle = '#040710';
    ctx.fillRect(stripX, HUD_BOTTOM_Y, stripW, HUD_BOTTOM_HEIGHT);
    ctx.strokeStyle = '#384868';
    ctx.lineWidth = 3;
    ctx.strokeRect(stripX, HUD_BOTTOM_Y, stripW, HUD_BOTTOM_HEIGHT);
    ctx.fillStyle = 'rgba(248, 200, 48, 0.35)';
    ctx.fillRect(stripX + 2, HUD_BOTTOM_Y, stripW - 4, 2);

    const { prefix, isImpossible } = this.getDifficultyHudPrefix(save);
    const waveLabel = `${prefix} • DALGA `;
    const waveNum = String(this.currentWave);
    const shownLives = Math.max(0, Math.min(this.lives, 5));
    const target = this.currentWaveSpec.targetPercent;
    const areaLabel = 'ALAN ';
    const areaVal = `${Math.floor(this.claimedPercent)}%/${target}%`;
    const shieldLabel = 'KALKAN ';
    const shieldVal = String(this.ship.getShieldUnits()).padStart(3, '0');

    const gap = 0.4;
    let sc = 2.68;
    const shipStep = 28;
    const shipsBlockW = Math.max(24, shownLives * shipStep);
    const measureTotal = (s: number): number =>
      measurePixelText(waveLabel, s, gap) +
      measurePixelText(waveNum, s, gap) +
      shipsBlockW +
      measurePixelText(areaLabel, s, gap) +
      measurePixelText(areaVal, s, gap) +
      measurePixelText(shieldLabel, s, gap) +
      measurePixelText(shieldVal, s, gap) +
      3 * 22;

    const maxInnerW = CANVAS_WIDTH - 36;
    const rawW = measureTotal(sc);
    if (rawW > maxInnerW) {
      sc = Math.max(1.9, sc * (maxInnerW / rawW));
    }
    const finalW = measureTotal(sc);
    const extraSpace = Math.max(0, maxInnerW - finalW);
    const sepPad = 10 + extraSpace / 6;

    const cy = HUD_BOTTOM_Y + HUD_BOTTOM_HEIGHT * 0.5 + 1;
    let x = 14;

    const drawDivider = (dx: number): void => {
      ctx.fillStyle = '#4A5C80';
      ctx.fillRect(Math.round(dx), HUD_BOTTOM_Y + 12, 3, HUD_BOTTOM_HEIGHT - 24);
    };

    // Group 1: `ZOR • DALGA 14` (or crimson `İMKÂNSIZ • DALGA 18`)
    drawPixelText(ctx, waveLabel, x, cy, {
      scale: sc,
      tone: isImpossible ? 'crimson' : 'silver',
      align: 'left',
      letterGap: gap
    });
    x += measurePixelText(waveLabel, sc, gap);
    drawPixelText(ctx, waveNum, x, cy, {
      scale: sc,
      tone: isImpossible ? 'crimson' : 'gold',
      align: 'left',
      letterGap: gap
    });
    x += measurePixelText(waveNum, sc, gap) + sepPad;

    drawDivider(x);
    x += 3 + sepPad;

    // Group 2: Mini Ship Lives
    const miniShip = getMiniShipHudSprite();
    for (let i = 0; i < shownLives; i++) {
      blitPixelSprite(ctx, miniShip, x + 12 + i * shipStep, cy, PIXEL_SCALE * 0.92);
    }
    x += shipsBlockW + sepPad;

    drawDivider(x);
    x += 3 + sepPad;

    // Group 3: `ALAN 54% / 85%`
    drawPixelText(ctx, areaLabel, x, cy, {
      scale: sc,
      tone: 'silver',
      align: 'left',
      letterGap: gap
    });
    x += measurePixelText(areaLabel, sc, gap);
    drawPixelText(ctx, areaVal, x, cy, {
      scale: sc,
      tone: this.claimedPercent >= target ? 'green' : 'gold',
      align: 'left',
      letterGap: gap
    });
    x += measurePixelText(areaVal, sc, gap) + sepPad;

    drawDivider(x);
    x += 3 + sepPad;

    // Group 4: `KALKAN 610`
    drawPixelText(ctx, shieldLabel, x, cy, {
      scale: sc,
      tone: 'silver',
      align: 'left',
      letterGap: gap
    });
    x += measurePixelText(shieldLabel, sc, gap);
    drawPixelText(ctx, shieldVal, x, cy, {
      scale: sc,
      tone: this.getShieldTone(),
      align: 'left',
      letterGap: gap
    });

    ctx.restore();
  }
}
