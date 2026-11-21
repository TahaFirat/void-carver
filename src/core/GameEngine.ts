import { SoundEngine } from '../audio/SoundEngine';
import { ArenaHazardManager } from '../entities/ArenaHazards';
import { BaseBoss } from '../entities/bosses/BaseBoss';
import { FrostLeviathanBoss, MagmaSerpentBoss } from '../entities/bosses/BestiaryBosses';
import {
  createBossesForChimeraBlueprint,
  createBossesForFixedLevelPlan,
  instantiateBossBySpeciesId
} from '../entities/bosses/BossFactory';
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
import { HomingSeekerMinion } from '../entities/enemies/BestiaryMinions';
import { BorderCrawler } from '../entities/enemies/BorderCrawler';
import {
  createMinionBySpecies,
  createMinionForChimeraSquad
} from '../entities/enemies/MinionFactory';
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
  SOLID_BOX_HALF,
  SolidRect
} from '../geometry/SolidBoxes';
import {
  computeArea,
  createInitialArenaPolygon,
  getActivePerimeterBarriers,
  getPolygonEdges,
  getTotalPerimeter,
  isPointOnBarrier,
  isPointOnPolygonBoundary,
  pointInPolygonStrict,
  pointToArcLength,
  projectPointToPolygon,
  projectPointToPolyline,
  projectPointToSegment,
  resolvePolygonPenetration
} from '../geometry/PolygonMath';
import { PolygonSplitter } from '../geometry/PolygonSplitter';
import { Barrier, DIR_VECTORS, Point } from '../geometry/Types';
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
import { createCapacitorStoreDriver } from '../services/CapacitorBillingAdapter';
import { MonetizationService } from '../services/MonetizationService';
import {
  ActiveRunCheckpointV15,
  difficultyIdToRunDifficulty,
  StorageService
} from '../services/StorageService';
import { isShipSkinId, MenuRenderer, ScreenState } from '../ui/MenuRenderer';
import {
  ArenaBounds,
  AutonomousMinionEcology,
  AutonomousMinionState
} from './AutonomousMinionEcology';
import {
  ALL_BOSS_IDS_V12,
  BossSpeciesId,
  FIXED_CAMPAIGN_STAGES,
  getFixedLevelPlan,
  recordLevelCompletion,
  ResolvedLevelPlan
} from './CampaignProgressionV12';
import {
  CleanJetonEconomyAndStore,
  SHIPS_STORE_CATALOG,
  StoreIapProductId,
  TRAILS_STORE_CATALOG
} from './CleanJetonEconomyAndStore';
import {
  ARENA_HEIGHT,
  ARENA_VIEW_SCALE,
  ARENA_VIEW_X,
  ARENA_VIEW_Y,
  BASE_CUT_SPEED,
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
  MAX_PLAYER_LIVES,
  MIDDLE_ZONE_Y,
  PALETTE,
  PIXEL_SCALE,
  SHIP_SKINS,
  ShipSkinConfig,
  STORE_SHIP_SKINS
} from './Config';
import {
  CardinalDir,
  CleanEndlessPerk,
  EndUserPolishControllerV15
} from './EndUserPolishAndControlsV15';
import { GameLoop } from './GameLoop';
import {
  HONEST_DIFFICULTIES_V15,
  HonestDifficultyGovernorV15
} from './HonestDifficultyAndProgressionV15';
import { PowerUpAndJuiceSystem } from './PowerUpAndJuiceSystem';
import {
  ChimeraBossBlueprint,
  ProceduralChimeraBossEngine
} from './ProceduralChimeraBossEngine';
import { getLayout, pointInRect } from './ResponsiveLayout';
import {
  ACHIEVEMENTS,
  LevelClearBreakdown,
  LevelWinReason,
  ScoreSystem
} from './ScoreSystem';

const CHAPTER_THEME_IDS = Object.keys(CHAPTER_THEMES) as ChapterThemeId[];
const CHECKPOINT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export class GameEngine {
  public screen: ScreenState = 'MAIN_MENU';

  private readonly input = new InputManager();
  private readonly layerRenderer = new LayerRenderer();
  private readonly particles = new ParticlePool();
  private readonly projectiles = new ProjectileManager();
  private readonly ship = new PlayerShip();
  private readonly menuRenderer = new MenuRenderer();
  private readonly endlessDirector = new EndlessBossDirector();
  private readonly minionEcology = new AutonomousMinionEcology(0x51f2a9c3);
  private readonly juiceSystem = new PowerUpAndJuiceSystem();
  private readonly honestGovernor = new HonestDifficultyGovernorV15();
  private readonly chimeraEngine = new ProceduralChimeraBossEngine();
  private readonly jetonStore = new CleanJetonEconomyAndStore(50, createCapacitorStoreDriver());
  private readonly polishController = new EndUserPolishControllerV15();
  private readonly hazards = new ArenaHazardManager();
  private readonly gameLoop: GameLoop;

  private activeGameMode: 'CAMPAIGN' | 'ENDLESS' = 'CAMPAIGN';
  private activeRunSeed = 0x51f2a9c3;
  public activeChimeraBlueprint: ChimeraBossBlueprint | null = null;
  private endlessPerkChoices: [CleanEndlessPerk, CleanEndlessPerk, CleanEndlessPerk] | null = null;
  private readonly endlessPerkStacks = new Map<string, number>();
  private lastEarnedJeton = 0;
  private crushSlowTimer = 0;
  private hardEnrageTriggeredThisStage = false;
  private megaCutsThisLevel = 0;
  private crushedMinionsThisLevel = 0;
  private comboCount = 1;
  private comboTimer = 0;
  private maxComboThisLevel = 1;
  private grazeCooldownTimer = 0;

  private currentWave = 1;
  private currentWaveSpec: WaveEncounterSpec;
  private currentLevelPlan: ResolvedLevelPlan;
  private autonomousMinionStates: AutonomousMinionState[] = [];
  private minionSeqCounter = 0;
  private activeCutDurationSec = 0;
  private waveElapsedSec = 0;
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
  private combinedSolidRects: SolidRect[] = [];
  private capsules: PowerUpCapsule[] = [];
  private fuses: TrailFuse[] = [];

  private score = 0;
  private nextExtraLifeScore = EXTRA_LIFE_SCORE_STEP;
  private lives = 3;
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
  private cutsThisLevel = 0;
  private lastInputSnapshot: InputState = {
    direction: null,
    carveHeld: false,
    autoCarveSwipe: false,
    pauseJustPressed: false,
    debugSectorSelect: null
  };

  private reviveUsedThisLevel = false;
  private reviveAdLoading = false;
  private deathsThisLevel = 0;
  private clearBreakdown: LevelClearBreakdown | null = null;

  private timeSeconds = 0;
  private adCountdown = 0;
  private statusToast: string | null = null;
  private statusToastTimer = 0;
  private firstFrameDrawn = false;
  private renderTargetCtx: CanvasRenderingContext2D | null = null;
  private boxContactSfxCooldown = 0;
  private reconcileInFlight = false;

  constructor() {
    this.currentWaveSpec = this.endlessDirector.buildWave(1, 'MEDIUM');
    this.currentLevelPlan = getFixedLevelPlan(1, 'MEDIUM');
    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      (alpha, frameDt) => this.render(alpha, frameDt)
    );

    // Every single Jeton / Ship / Trail / IAP entitlement mutation persists immediately!
    this.jetonStore.setPersistenceHook(() => {
      this.persistV15State();
    });

    this.input.touch.setOnSwapSide(() => {
      void this.toggleJoystickSide();
    });
    this.input.touch.setOnGearTap(() => {
      if (this.screen === 'PLAYING') {
        SoundEngine.playUiClick();
        this.screen = 'PAUSED';
        this.polishController.isPaused = true;
        this.input.resetActiveInputs();
        this.persistV15State();
      }
    });
  }

  public syncViewportLayout(): void {
    this.input.touch.syncViewportFromLayout(getLayout());
  }

  public notifyUserInteraction(): void {
    this.gameLoop.wakeFromIdle(1.8);
  }

  private buildCurrentRunCheckpoint(): ActiveRunCheckpointV15 | null {
    const inActiveSession =
      this.screen === 'PLAYING' ||
      this.screen === 'PAUSED' ||
      this.screen === 'ROGUELITE_DRAFT' ||
      this.screen === 'LEVEL_CLEAR' ||
      this.screen === 'CONTINUE_PROMPT';
    if (!inActiveSession || this.lives <= 0) {
      return null;
    }
    const save = StorageService.getCurrent();
    return {
      mode: this.activeGameMode,
      wave: this.currentWave,
      score: this.score,
      lives: this.lives,
      difficulty: save.difficulty,
      runSeed: this.activeRunSeed,
      perkStacks: Array.from(this.endlessPerkStacks.entries()),
      usedContinue: this.jetonStore.usedContinueInCurrentRun,
      savedAtMs: Date.now()
    };
  }

  private persistV15State(explicitCheckpoint?: ActiveRunCheckpointV15 | null): void {
    const checkpoint =
      explicitCheckpoint !== undefined ? explicitCheckpoint : this.buildCurrentRunCheckpoint();
    const seenHint = !this.polishController.showFirstLaunchSwipeHint;
    StorageService.captureV15Store(
      this.jetonStore,
      seenHint,
      StorageService.getCurrent(),
      checkpoint
    );
    void StorageService.save();
  }

  /**
   * Reconciles any interrupted StoreKit 2 / Play Billing transactions on cold boot & foreground resume
   * so a player who paid NEVER misses an item even after a crash, network drop, or Ask-to-Buy approval.
   */
  private async reconcileStoreTransactionsQuietly(): Promise<void> {
    if (this.reconcileInFlight) return;
    this.reconcileInFlight = true;
    try {
      const { recoveredCount } = await this.jetonStore.reconcilePendingEntitlements();
      if (recoveredCount > 0) {
        this.persistV15State();
        this.showToast('Satın alım hesabına tanımlandı ✓');
      }
    } finally {
      this.reconcileInFlight = false;
    }
  }

  public async boot(ctx: CanvasRenderingContext2D): Promise<void> {
    this.renderTargetCtx = ctx;

    const save = await StorageService.load();
    StorageService.hydrateV15Store(this.jetonStore, save);
    this.polishController.showFirstLaunchSwipeHint = !save.v15Store.hasSeenSwipeHint;

    void this.jetonStore.syncStorePrices();
    void this.reconcileStoreTransactionsQuietly();

    this.applySavedSettings();
    this.syncViewportLayout();

    SoundEngine.bindAutoUnlock();

    await NativeBridge.initialize({
      onAppPause: (fullyHidden = false) => {
        if (this.screen === 'PLAYING') {
          this.polishController.onAppBackgroundOrBlur();
          this.screen = 'PAUSED';
          this.input.resetActiveInputs();
          SoundEngine.stopLaserCutLoop();
        }
        this.persistV15State();
        StorageService.flushSyncMirror();
        if (fullyHidden) {
          SoundEngine.suspend();
          this.gameLoop.suspend();
        }
      },
      onAppResume: () => {
        this.gameLoop.resume();
        SoundEngine.resume();
        void this.reconcileStoreTransactionsQuietly();
        if (!MonetizationService.isRewardedAdReady() && !MonetizationService.isPremiumUnlocked()) {
          void MonetizationService.preloadRewardedRevive();
        }
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

    const hasShowcaseUrl = this.hasShowcaseUrlParams();
    if (hasShowcaseUrl) {
      this.applyShowcaseFromUrl();
    } else {
      this.tryRestoreInterruptedRunCheckpoint(save.v15Store.activeRunCheckpoint);
    }

    this.gameLoop.start();
  }

  private hasShowcaseUrlParams(): boolean {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('shot') || params.get('boss') || params.get('wave'));
  }

  /**
   * Restores an interrupted Endless or multi-stage session if the OS terminated the background WebView.
   */
  private tryRestoreInterruptedRunCheckpoint(cp: ActiveRunCheckpointV15 | null): void {
    if (!cp || StorageService.persistenceDisabled) return;
    if (Date.now() - cp.savedAtMs > CHECKPOINT_MAX_AGE_MS) {
      this.persistV15State(null);
      return;
    }
    if (cp.wave < 2 && cp.score <= 0) return;

    const save = StorageService.getCurrent();
    save.difficulty = cp.difficulty;
    this.activeGameMode = cp.mode;
    this.activeRunSeed = cp.runSeed;
    this.endlessPerkStacks.clear();
    for (const [k, v] of cp.perkStacks) {
      this.endlessPerkStacks.set(k, v);
    }
    this.jetonStore.usedContinueInCurrentRun = cp.usedContinue;

    this.loadWave(cp.wave);
    this.roundIntroTimer = 0;
    this.score = cp.score;
    this.lives = Math.max(1, Math.min(MAX_PLAYER_LIVES, cp.lives));
    this.screen = 'PAUSED';
    this.polishController.isPaused = true;
  }

  /**
   * Visual QA showcase (`?shot=menu|store|jeton|draft|continue|kolay|orta|zor|faz2`, `?boss=<id>`, `?wave=<N>`):
   * Strictly isolated from persistent user save (`StorageService.persistenceDisabled = true`).
   */
  private applyShowcaseFromUrl(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const bossParam = params.get('boss');
    const waveParam = params.get('wave');
    if (!shot && !bossParam && !waveParam) return;

    StorageService.persistenceDisabled = true;
    const save = StorageService.getCurrent();
    save.difficultyRecords = {
      EASY: { highScore: 684_200, bestWave: 12 },
      MEDIUM: { highScore: 3_423_594, bestWave: 19 },
      HARD: { highScore: 3_423_594, bestWave: 19 }
    };
    save.campaignV12 = {
      selectedDifficulty: 'MEDIUM',
      highestUnlockedLevel: { EASY: 12, MEDIUM: 14, HARD: 9 },
      starsByLevel: {
        MEDIUM_1: 3,
        MEDIUM_2: 3,
        MEDIUM_3: 2,
        MEDIUM_4: 3
      }
    };
    save.v15Store.highestUnlockedStage = { EASY: 12, MEDIUM: 14, HARD: 9 };
    save.selectedStageByDifficulty = { EASY: 5, MEDIUM: 4, HARD: 9 };
    this.jetonStore.jetonBalance = 1450;
    save.v15Store.jetonBalance = 1450;

    if (!shot) {
      const startWave = waveParam ? Math.max(1, Math.min(99, Number(waveParam) || 1)) : 1;
      this.activeGameMode = 'CAMPAIGN';
      this.startRunSession(startWave);
      this.roundIntroTimer = 0;
      if (bossParam && (ALL_BOSS_IDS_V12 as readonly string[]).includes(bossParam)) {
        const forcedBossId = bossParam as BossSpeciesId;
        const matchedStage = FIXED_CAMPAIGN_STAGES.find((s) => s.bossId === forcedBossId);
        this.currentLevelPlan = {
          ...this.currentLevelPlan,
          bossId: forcedBossId,
          bossDisplayNameTr: matchedStage ? matchedStage.bossNameTr : forcedBossId
        };
        this.bosses = instantiateBossBySpeciesId(forcedBossId, { x: 450, y: 500 }, 10, true);
        for (const b of this.bosses) {
          b.applyPhaseBehavior(this.currentWaveSpec.phases[1]);
        }
      }
      return;
    }

    if (shot === 'menu') {
      save.difficulty = 'COMMANDER';
      save.selectedStageByDifficulty.MEDIUM = 4;
      this.screen = 'MAIN_MENU';
      return;
    }

    if (shot === 'store' || shot === 'hangar' || shot === 'jeton' || shot === 'iap') {
      this.jetonStore.ownedShips.add('SHIP_PHANTOM');
      this.jetonStore.ownedTrails.add('TRAIL_LIGHTNING');
      this.menuRenderer.storeTab = shot === 'jeton' || shot === 'iap' ? 'BUY_JETON' : 'SHIPS';
      this.screen = 'HANGAR';
      return;
    }

    if (shot === 'draft') {
      this.activeGameMode = 'ENDLESS';
      this.currentWave = 4;
      this.lastEarnedJeton = 46;
      this.endlessPerkChoices = this.polishController.rollThreeCleanPerks(
        this.endlessPerkStacks,
        77
      );
      this.screen = 'ROGUELITE_DRAFT';
      return;
    }

    if (shot === 'continue') {
      this.activeGameMode = 'ENDLESS';
      this.startRunSession(5);
      this.roundIntroTimer = 0;
      this.claimedPercent = 68;
      this.screen = 'CONTINUE_PROMPT';
      return;
    }

    const diffMap: Record<string, DifficultyId> = {
      kolay: 'EXPLORER',
      orta: 'COMMANDER',
      zor: 'LEGEND',
      faz2: 'LEGEND'
    };
    save.difficulty = diffMap[shot] ?? 'COMMANDER';
    this.polishController.showFirstLaunchSwipeHint = false;

    const targetWave = shot === 'kolay' ? 5 : shot === 'orta' ? 8 : shot === 'faz2' ? 24 : 15;
    this.activeGameMode = shot === 'zor' ? 'ENDLESS' : 'CAMPAIGN';
    this.startRunSession(targetWave);
    this.roundIntroTimer = 0;

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

    this.juiceSystem.crystals = [];
    if (shot === 'orta') {
      this.juiceSystem.powerState.hasOneHitTrailShield = true;
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
    this.notifyUserInteraction();
    const layout = getLayout();
    if (this.screen === 'PLAYING' && pointInRect(vx, vy, layout.pauseButton, 14)) {
      SoundEngine.playUiClick();
      this.screen = 'PAUSED';
      this.polishController.isPaused = true;
      this.input.resetActiveInputs();
      this.persistV15State();
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
    this.notifyUserInteraction();
    if (this.screen === 'PLAYING') {
      const s = getLayout().cssScale || 1;
      this.input.touch.handleTouchMoveCss(pointerId, cssX ?? vx * s, cssY ?? vy * s);
    }
  }

  public handlePointerUp(pointerId: number): void {
    this.notifyUserInteraction();
    this.input.touch.handlePointerUp(pointerId);
  }

  private handleHardwareBack(): void {
    this.notifyUserInteraction();
    if (this.screen === 'PLAYING') {
      this.screen = 'PAUSED';
      this.polishController.isPaused = true;
      this.input.resetActiveInputs();
      this.persistV15State();
    } else if (this.screen === 'PAUSED') {
      this.polishController.requestSmoothResume();
      this.screen = 'PLAYING';
      this.gameLoop.resetTiming();
    } else if (this.screen === 'SECTOR_SELECT') {
      this.screen = 'SETTINGS';
    } else if (
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
          ? 'Sağ'
          : s.joystickSide === 'LEFT'
            ? 'Sol'
            : 'Orta'
        : s.joystickSide === 'RIGHT'
          ? 'Sağ Joystick / Sol Kes'
          : 'Sol Joystick / Sağ Kes';
    this.showToast(`Yerleşim: ${label}`);
  }

  private showToast(msgTr: string): void {
    this.statusToast = msgTr;
    this.statusToastTimer = 2.0;
    this.notifyUserInteraction();
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
      void this.reconcileStoreTransactionsQuietly();
      return;
    }

    if (actionId === 'SET_STORE_TAB_SHIPS') {
      this.menuRenderer.storeTab = 'SHIPS';
      return;
    }

    if (actionId === 'SET_STORE_TAB_TRAILS') {
      this.menuRenderer.storeTab = 'TRAILS';
      return;
    }

    if (actionId === 'SET_STORE_TAB_BUY_JETON') {
      this.menuRenderer.storeTab = 'BUY_JETON';
      void this.jetonStore.syncStorePrices();
      return;
    }

    if (actionId.startsWith('BUY_OR_EQUIP_SHIP_')) {
      const shipId = actionId.replace('BUY_OR_EQUIP_SHIP_', '');
      const res = this.jetonStore.buyOrEquipShip(shipId);
      const item = SHIPS_STORE_CATALOG.find((s) => s.id === shipId);
      if (res === 'BOUGHT_AND_EQUIPPED' || res === 'EQUIPPED') {
        NativeBridge.hapticPowerUp();
        SoundEngine.playExtraLife();
        this.persistV15State();
        this.showToast(
          res === 'BOUGHT_AND_EQUIPPED'
            ? `${item?.nameTr ?? 'Gemi'} açıldı ve seçildi ✓`
            : `${item?.nameTr ?? 'Gemi'} seçildi ✓`
        );
      } else {
        this.showToast('Yetersiz Jeton');
      }
      return;
    }

    if (actionId.startsWith('BUY_OR_EQUIP_TRAIL_')) {
      const trailId = actionId.replace('BUY_OR_EQUIP_TRAIL_', '');
      const res = this.jetonStore.buyOrEquipTrail(trailId);
      const item = TRAILS_STORE_CATALOG.find((t) => t.id === trailId);
      if (res === 'BOUGHT_AND_EQUIPPED' || res === 'EQUIPPED') {
        NativeBridge.hapticPowerUp();
        SoundEngine.playExtraLife();
        this.persistV15State();
        this.showToast(
          res === 'BOUGHT_AND_EQUIPPED'
            ? `${item?.nameTr ?? 'İz'} açıldı ve seçildi ✓`
            : `${item?.nameTr ?? 'İz'} seçildi ✓`
        );
      } else {
        this.showToast('Yetersiz Jeton');
      }
      return;
    }

    if (actionId.startsWith('BUY_JETON_PACK_')) {
      const productId = actionId.replace('BUY_JETON_PACK_', '') as StoreIapProductId;
      const res = await this.jetonStore.purchaseJetonPack(productId);
      if (res.ok) {
        NativeBridge.hapticPowerUp();
        SoundEngine.playExtraLife();
        this.persistV15State();
        StorageService.flushSyncMirror();
        this.showToast(
          res.restoredExisting
            ? 'Mevcut paket hesabına tanımlandı ✓'
            : 'Satın alım tamamlandı ✓'
        );
      } else if (res.alreadyOwned) {
        this.showToast('Başlangıç Paketi zaten aktif ✓');
      } else if (res.busy) {
        this.showToast('İşlem devam ediyor, lütfen bekle...');
      } else if (!res.cancelled) {
        this.showToast('Satın alım tamamlanamadı');
      }
      return;
    }

    if (actionId === 'RESTORE_IAP_PURCHASES') {
      const ok = await this.jetonStore.restorePurchases();
      this.persistV15State();
      StorageService.flushSyncMirror();
      NativeBridge.hapticPowerUp();
      this.showToast(
        ok ? 'Satın alımlar geri yüklendi ✓' : 'Geri yüklenecek paket bulunamadı'
      );
      return;
    }

    if (actionId.startsWith('PICK_PERK_')) {
      const slotIdx = Number(actionId.replace('PICK_PERK_', '')) || 0;
      const chosen = this.endlessPerkChoices?.[slotIdx];
      if (chosen) {
        const nextRank = Math.min(chosen.maxStacks, (this.endlessPerkStacks.get(chosen.id) ?? 0) + 1);
        this.endlessPerkStacks.set(chosen.id, nextRank);
        if (chosen.id === 'EXTRA_LIFE') {
          this.lives = Math.min(MAX_PLAYER_LIVES, this.lives + 1);
        }
        NativeBridge.hapticPowerUp();
        SoundEngine.playExtraLife();
        this.showToast(`${chosen.titleTr} seçildi ✓`);
      }
      this.endlessPerkChoices = null;
      this.loadWave(this.currentWave + 1);
      this.screen = 'PLAYING';
      this.persistV15State();
      this.gameLoop.resetTiming();
      return;
    }

    if (actionId === 'USE_JETON_CONTINUE') {
      if (this.jetonStore.spendJetonForContinue()) {
        this.reviveUsedThisLevel = true;
        this.persistV15State();
        this.completeReviveGrant();
        this.showToast('Devam ediliyor • +1 Can');
      } else {
        this.showToast('Yetersiz Jeton');
      }
      return;
    }

    if (actionId === 'GOTO_CAMPAIGN' || actionId === 'BACK_MAIN' || actionId === 'QUIT_TO_MENU') {
      SoundEngine.stopLaserCutLoop();
      this.polishController.isPaused = false;
      this.polishController.resumeCountdownSec = 0;
      this.screen = 'MAIN_MENU';
      this.persistV15State(null);
      return;
    }

    if (actionId === 'GOTO_SETTINGS') {
      this.screen = 'SETTINGS';
      return;
    }

    if (actionId === 'OPEN_STAGE_GRID') {
      this.screen = 'SECTOR_SELECT';
      return;
    }

    if (actionId === 'PREV_STAGE_MAIN') {
      const runDiff = difficultyIdToRunDifficulty(save.difficulty);
      const curStage = StorageService.getSelectedStartStage(runDiff, save);
      if (curStage > 1) {
        await StorageService.save((d) => {
          d.selectedStageByDifficulty[runDiff] = curStage - 1;
        });
        NativeBridge.hapticPowerUp();
      }
      return;
    }

    if (actionId === 'NEXT_STAGE_MAIN') {
      const runDiff = difficultyIdToRunDifficulty(save.difficulty);
      const curStage = StorageService.getSelectedStartStage(runDiff, save);
      const maxUnlocked = StorageService.getHighestUnlockedStage(runDiff, save);
      if (curStage < maxUnlocked) {
        await StorageService.save((d) => {
          d.selectedStageByDifficulty[runDiff] = curStage + 1;
        });
        NativeBridge.hapticPowerUp();
      } else if (curStage < 30) {
        this.showToast(`ÖNCE BÖLÜM ${curStage} TAMAMLANMALI`);
      }
      return;
    }

    if (actionId === 'STAGE_STRIP_PREV') {
      this.menuRenderer.shiftStageStrip(-1);
      return;
    }

    if (actionId === 'STAGE_STRIP_NEXT') {
      this.menuRenderer.shiftStageStrip(1);
      return;
    }

    if (actionId.startsWith('SELECT_STAGE_')) {
      const stageNum = Math.max(1, Math.min(30, Number(actionId.replace('SELECT_STAGE_', '')) || 1));
      const runDiff = difficultyIdToRunDifficulty(save.difficulty);
      const maxUnlocked = StorageService.getHighestUnlockedStage(runDiff, save);
      if (stageNum <= maxUnlocked) {
        await StorageService.save((d) => {
          d.selectedStageByDifficulty[runDiff] = stageNum;
        });
        NativeBridge.hapticPowerUp();
      } else {
        this.showToast(`ÖNCE BÖLÜM ${stageNum - 1} AÇILMALI`);
      }
      return;
    }

    if (actionId.startsWith('LAUNCH_STAGE_')) {
      const stageNum = Math.max(1, Math.min(30, Number(actionId.replace('LAUNCH_STAGE_', '')) || 1));
      const runDiff = difficultyIdToRunDifficulty(save.difficulty);
      const maxUnlocked = StorageService.getHighestUnlockedStage(runDiff, save);
      if (stageNum <= maxUnlocked) {
        await StorageService.save((d) => {
          d.selectedStageByDifficulty[runDiff] = stageNum;
        });
        NativeBridge.hapticPowerUp();
        this.activeGameMode = 'CAMPAIGN';
        this.startRunSession(stageNum);
      } else {
        this.showToast(`Bölüm ${stageNum} kilitli`);
      }
      return;
    }

    if (
      actionId === 'START_ENDLESS_RUN' ||
      actionId === 'START_ENDLESS' ||
      actionId === 'START_CAMPAIGN_RUN'
    ) {
      const runDiff = difficultyIdToRunDifficulty(save.difficulty);
      const startStage = StorageService.getSelectedStartStage(runDiff, save);
      this.activeGameMode = 'CAMPAIGN';
      this.startRunSession(startStage);
      return;
    }

    if (actionId === 'START_ENDLESS_MODE' || actionId === 'START_ENDLESS_RIFT') {
      this.activeGameMode = 'ENDLESS';
      this.activeRunSeed = (Date.now() ^ 0x9e3779b9) >>> 0;
      this.endlessPerkStacks.clear();
      this.startRunSession(1);
      return;
    }

    if (actionId === 'RETRY_CURRENT_STAGE') {
      if (this.activeGameMode === 'ENDLESS') {
        this.activeRunSeed = (Date.now() ^ 0x9e3779b9) >>> 0;
        this.endlessPerkStacks.clear();
        this.startRunSession(1);
      } else {
        this.startRunSession(Math.max(1, this.currentWave));
      }
      return;
    }

    if (actionId.startsWith('SET_DIFF_')) {
      const diff = actionId.replace('SET_DIFF_', '') as DifficultyId;
      if (DIFFICULTIES[diff]) {
        const runDiff = difficultyIdToRunDifficulty(diff);
        await StorageService.save((d) => {
          d.difficulty = diff;
          d.campaignV12.selectedDifficulty = runDiff;
        });
        NativeBridge.hapticPowerUp();
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
      const runDiff = difficultyIdToRunDifficulty(nextDiff);
      await StorageService.save((d) => {
        d.difficulty = nextDiff;
        d.campaignV12.selectedDifficulty = runDiff;
      });
      NativeBridge.hapticPowerUp();
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
          ? 'Yön Tuşları + Kes'
          : m === 'JOYSTICK_KES'
            ? 'Joystick + Kes'
            : 'Tek Parmak Kaydır';
      this.showToast(`Kontrol: ${mLabel}`);
      return;
    }

    if (actionId.startsWith('SELECT_SHIP_')) {
      const skinId = actionId.replace('SELECT_SHIP_', '');
      if (isShipSkinId(skinId)) {
        const skin = SHIP_SKINS.find((s) => s.id === skinId);
        if (skin && StorageService.isShipUnlocked(skin, save)) {
          await StorageService.save((d) => {
            d.selectedShip = skinId;
          });
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
      this.polishController.requestSmoothResume();
      this.screen = 'PLAYING';
      this.gameLoop.resetTiming();
      return;
    }

    if (actionId === 'RESTART_RUN' || actionId === 'RESTART_SECTOR') {
      this.startRunSession(Math.max(1, this.currentWave));
      return;
    }

    if (actionId === 'ACCEPT_REVIVE') {
      if (this.reviveAdLoading || this.reviveUsedThisLevel) {
        return;
      }
      if (save.premiumUnlocked || this.jetonStore.hasPermanentDoubleJeton) {
        this.reviveUsedThisLevel = true;
        this.completeReviveGrant();
        return;
      }

      this.reviveAdLoading = true;
      SoundEngine.suspend();
      try {
        const result = await MonetizationService.triggerRewardedReviveWithResult();
        if (result.outcome === 'REWARDED') {
          this.reviveUsedThisLevel = true;
          this.completeReviveGrant();
          this.showToast('+1 Can kazanıldı ✓');
        } else if (result.outcome === 'DISMISSED_EARLY') {
          this.showToast('Ödül için videoyu sonuna kadar izle');
        } else if (result.errorMessage === 'NATIVE_PLATFORM_REQUIRED') {
          this.showToast('Video reklam yalnızca iOS/Android uygulamada açılır');
        } else {
          this.showToast('Reklam şu an doldurulamadı, biraz sonra tekrar dene');
        }
      } finally {
        this.reviveAdLoading = false;
        SoundEngine.resume();
        this.gameLoop.resetTiming();
      }
      return;
    }

    if (actionId === 'DECLINE_REVIVE') {
      this.persistRunRecords();
      this.screen = 'GAME_OVER';
      this.persistV15State(null);
      return;
    }

    if (actionId === 'NEXT_SECTOR') {
      const nextStage = this.currentWave >= 30 ? 1 : this.currentWave + 1;
      this.loadWave(nextStage);
      this.screen = 'PLAYING';
      this.persistV15State();
      this.gameLoop.resetTiming();
    }
  }

  private completeReviveGrant(): void {
    this.lives = 1;
    this.ship.shieldTimer = this.ship.maxShieldDuration;
    this.ship.respawnAtCutStart(this.activePolygon);
    this.ship.invulnerableTimer = 3.0;
    this.fuses = [];
    this.cutStallTimer = 0;
    this.hesitationFuseLit = false;
    this.activeCutDurationSec = 0;
    this.hazards.staticArcs = [];
    this.projectiles.clearEnemyBullets();

    this.juiceSystem.triggerRespawnShockwave(
      { x: this.ship.x, y: this.ship.y },
      this.autonomousMinionStates,
      145
    );
    const stateMap = new Map(this.autonomousMinionStates.map((st) => [st.id, st]));
    for (const m of this.minions) {
      if (!m.alive || !m.autonomousId) continue;
      const st = stateMap.get(m.autonomousId);
      if (st) {
        m.x = st.pos.x;
        m.y = st.pos.y;
        m.vx = st.vel.x;
        m.vy = st.vel.y;
        m.enforcePolygonBounds(this.activePolygon);
        st.pos.x = m.x;
        st.pos.y = m.y;
      }
    }
    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      const dx = boss.x - this.ship.x;
      const dy = boss.y - this.ship.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 155) {
        const pushed = resolvePolygonPenetration(
          { x: this.ship.x + (dx / dist) * 160, y: this.ship.y + (dy / dist) * 160 },
          boss.boundingRadius,
          this.activePolygon
        ).position;
        boss.x = pushed.x;
        boss.y = pushed.y;
      }
    }
    this.particles.spawnShockwave(this.ship.x, this.ship.y, 260, '#38BDF8', 0.42);
    this.hazards.spaceMines = this.hazards.spaceMines.filter(
      (m) => Math.hypot(m.x - this.ship.x, m.y - this.ship.y) > 130
    );

    this.input.resetActiveInputs();
    this.polishController.requestSmoothResume();
    this.screen = 'PLAYING';
    this.persistV15State();
    this.gameLoop.resetTiming();
    SoundEngine.playExtraLife();
  }

  private startRunSession(startWave = 1): void {
    const save = StorageService.getCurrent();
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const diffSpec = HONEST_DIFFICULTIES_V15[runDiff];
    const rec = StorageService.getDifficultyRecord(save.difficulty, save);

    this.jetonStore.onNewRunStart();
    if (this.activeGameMode === 'CAMPAIGN') {
      this.endlessPerkStacks.clear();
    }
    this.endlessPerkChoices = null;
    this.lastEarnedJeton = 0;

    this.endlessDirector.resetRun();
    this.score = 0;
    this.nextExtraLifeScore = EXTRA_LIFE_SCORE_STEP;
    this.lives = Math.min(MAX_PLAYER_LIVES, diffSpec.startingLives);
    this.runBaselineHighScore = rec.highScore;
    this.runBaselineBestWave = rec.bestWave;
    this.runIsNewRecord = false;

    void StorageService.save((d) => {
      d.stats.gamesPlayed += 1;
    });

    this.loadWave(startWave);
    this.screen = 'PLAYING';
    this.persistV15State();
    this.gameLoop.resetTiming();
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

        if (x > 300 && x < 600 && y > 370 && y < 630) continue;
        if (Math.hypot(x - 450, y - ARENA_HEIGHT) < 230) continue;
        if (configs.some((c) => Math.max(Math.abs(c.x - x), Math.abs(c.y - y)) < 145)) continue;

        return { x, y };
      }
      return null;
    };

    const stdRewards: BlockRewardType[] = spec.rules.enrageTrapEnabled
      ? ['S', 'L', 'T', 'C', 'EMPTY_POINTS', 'ENRAGE_TRAP']
      : ['S', 'L', 'P', 'T', 'C', 'EMPTY_POINTS'];

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
      return;
    }

    this.capsules.push(new PowerUpCapsule({ x: this.ship.x, y: this.ship.y - 40 }, 'BOSS_CANNON'));
  }

  private computePolygonBounds(poly: readonly Point[]): ArenaBounds {
    let minX = 900;
    let minY = 1200;
    let maxX = 0;
    let maxY = 0;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return {
      minX: Math.min(minX, maxX - 40),
      minY: Math.min(minY, maxY - 40),
      maxX: Math.max(maxX, minX + 40),
      maxY: Math.max(maxY, minY + 40)
    };
  }

  private attachAutonomousMinion(minion: InteriorMinion, speedScale: number): void {
    const id = `auto_m_${++this.minionSeqCounter}`;
    minion.autonomousId = id;
    const bounds = this.computePolygonBounds(this.activePolygon);
    const anchor = this.bosses[0] ? { x: this.bosses[0].x, y: this.bosses[0].y } : { x: 450, y: 500 };
    const st = this.minionEcology.spawnMinion(
      id,
      minion.speciesId ?? 'SCARAB_BEETLE',
      bounds,
      anchor,
      speedScale
    );
    st.pos = { x: minion.x, y: minion.y };
    st.vel = { x: minion.vx, y: minion.vy };
    this.autonomousMinionStates.push(st);
  }

  private loadWave(waveNumber: number): void {
    const save = StorageService.getCurrent();
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const diffSpec = HONEST_DIFFICULTIES_V15[runDiff];
    const spec = this.endlessDirector.buildWave(waveNumber, runDiff);
    const plan = getFixedLevelPlan(waveNumber, runDiff);

    // Guarantee clean active timing — never leave pause/countdown stuck across waves!
    this.polishController.isPaused = false;
    this.polishController.resumeCountdownSec = 0;

    this.honestGovernor.onStageStart();
    this.crushSlowTimer = 0;
    this.hardEnrageTriggeredThisStage = false;
    this.megaCutsThisLevel = 0;
    this.crushedMinionsThisLevel = 0;
    this.comboCount = 1;
    this.comboTimer = 0;
    this.maxComboThisLevel = 1;
    this.grazeCooldownTimer = 0;

    const stageParams = this.honestGovernor.resolveStageParameters({
      mode: this.activeGameMode,
      stageOrWave: waveNumber,
      difficulty: runDiff,
      capturedPercent: 0,
      playerSpeedPerkBonusRatio: (this.endlessPerkStacks.get('FAST_ENGINE') ?? 0) * 0.15
    });

    const targetTrim = (this.endlessPerkStacks.get('TARGET_TRIM') ?? 0) * 2;

    spec.terrainThemeIndex =
      this.activeGameMode === 'CAMPAIGN'
        ? (waveNumber - 1) % 16
        : (waveNumber * 5 + (this.activeRunSeed % 16)) % 16;
    spec.targetPercent = Math.max(60, stageParams.targetPercent - targetTrim);
    spec.shieldSeconds = stageParams.borderShieldTimerSec;
    spec.rules = {
      ...spec.rules,
      bossHitTrailInstantDetonation: false
    };

    const chimeraBlueprint =
      this.activeGameMode === 'CAMPAIGN'
        ? this.chimeraEngine.buildFixedCampaignEncounter(waveNumber, stageParams.minionCount)
        : this.chimeraEngine.buildEndlessRiftEncounter(
            this.activeRunSeed,
            waveNumber,
            stageParams.minionCount
          );
    this.activeChimeraBlueprint = chimeraBlueprint;

    const isMilestoneWave = this.activeGameMode === 'ENDLESS' && waveNumber % 5 === 0;
    if (this.activeGameMode === 'ENDLESS') {
      plan.bossDisplayNameTr = chimeraBlueprint.displayNameTr;
      plan.sectorNameTr = `Sonsuz Mod • Dalga ${waveNumber}`;
    } else if (waveNumber > 24) {
      plan.bossDisplayNameTr = chimeraBlueprint.displayNameTr;
      plan.sectorNameTr = `Bölüm ${waveNumber}`;
    }

    this.currentWave = waveNumber;
    this.currentWaveSpec = spec;
    this.currentLevelPlan = plan;
    this.waveElapsedSec = 0;
    this.activeCombatPhase = 1;
    this.phaseAwakeningTimer = 0;
    this.phaseAwakeningLabel = null;
    this.activeCutDurationSec = 0;

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
    this.projectiles.governorCaps = {
      maxActiveEnemyBullets: stageParams.maxActiveBullets,
      maxBulletSpeedPx: stageParams.bulletSpeedPx,
      minDodgeGapPx: diffSpec.minBulletCorridorGapPx
    };
    this.hazards.clear();
    this.fuses = [];
    this.capsules = [];
    this.crawlers = [];
    this.minions = [];
    this.autonomousMinionStates = [];
    this.juiceSystem.crystals = [];

    const aegisStacks = this.endlessPerkStacks.get('AEGIS_PULSE') ?? 0;
    const startWithAegis = aegisStacks > 0 && (aegisStacks >= 2 || waveNumber % 2 === 1);

    this.juiceSystem.powerState = {
      hasOneHitTrailShield: startWithAegis,
      speedBoostRemainingSec: 0,
      timeFreezeRemainingSec: 0,
      laserCannonRemainingSec: 0,
      respawnInvulnRemainingSec: 0
    };
    this.clearBreakdown = null;
    this.timeFreezeTimer = 0;
    this.dynamicPodTimer = 24;
    this.roundIntroTimer = 0.85;
    this.cutStallTimer = 0;
    this.hesitationFuseLit = false;
    this.shieldZeroBeepTimer = 0;
    this.shieldPulseTimer = 0.4;
    this.cutsThisLevel = 0;
    this.reviveUsedThisLevel = false;
    this.reviveAdLoading = false;
    this.deathsThisLevel = 0;
    this.crawlerSpawnTimer = Math.max(36, spec.rules.crawlerDelaySec);

    const shieldUnits = Math.max(200, Math.min(999, Math.round(spec.shieldSeconds * 10)));
    this.ship.initForLevel({ x: 450, y: ARENA_HEIGHT }, spec.shieldSeconds, shieldUnits);

    const boxDefs = this.buildWaveBoxes(spec);
    this.powerBoxes = boxDefs.map((cfg) => new PowerUpBox(cfg));
    this.syncSolidBoxes();

    if (this.activeGameMode === 'CAMPAIGN' && waveNumber <= 24) {
      this.bosses = createBossesForFixedLevelPlan(plan, spec.phases[1]);
      for (const b of this.bosses) {
        b.chimeraBlueprint = chimeraBlueprint;
      }
    } else {
      this.bosses = createBossesForChimeraBlueprint(
        chimeraBlueprint,
        waveNumber,
        runDiff,
        spec.phases[1],
        isMilestoneWave
      );
    }

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

    let seedIdx = 0;
    const maxMinionsNow = stageParams.minionCount;
    if (this.activeGameMode === 'CAMPAIGN' && waveNumber <= 24) {
      for (let gi = 0; gi < plan.minionSpawns.length; gi++) {
        const group = plan.minionSpawns[gi]!;
        const squadTrait =
          chimeraBlueprint.minionSquads[gi % chimeraBlueprint.minionSquads.length]?.synergyTrait ??
          'STANDARD';
        for (let c = 0; c < group.count && seedIdx < maxMinionsNow; c++) {
          const pos = pickSafeMinionPos(
            185 + ((seedIdx * 235) % 540),
            255 + ((seedIdx * 195) % 490),
            seedIdx
          );
          const m = createMinionBySpecies(group.species, pos, seedIdx);
          m.speciesId = group.species;
          m.synergyTrait = c === 0 && waveNumber >= 3 ? squadTrait : 'STANDARD';
          this.minions.push(m);
          this.attachAutonomousMinion(m, plan.minionSpeedScale);
          seedIdx++;
        }
      }
    } else {
      for (const squad of chimeraBlueprint.minionSquads) {
        for (let c = 0; c < squad.count && seedIdx < maxMinionsNow; c++) {
          const pos = pickSafeMinionPos(
            185 + ((seedIdx * 235) % 540),
            255 + ((seedIdx * 195) % 490),
            seedIdx
          );
          const m = createMinionForChimeraSquad(
            squad.archetype,
            isMilestoneWave && c === 0 ? 'GOLD_PINATA' : squad.synergyTrait,
            pos,
            seedIdx
          );
          this.minions.push(m);
          this.attachAutonomousMinion(m, plan.minionSpeedScale);
          seedIdx++;
        }
      }
    }

    this.persistRunRecords();
    this.input.resetActiveInputs();
    if (!MonetizationService.isRewardedAdReady() && !MonetizationService.isPremiumUnlocked()) {
      void MonetizationService.preloadRewardedRevive();
    }
  }

  private syncSolidBoxes(): void {
    this.activeSolidBoxes = this.powerBoxes.filter(
      (b) => !b.collected && b.isMaterialized(this.timeSeconds)
    );
    const petrifiedBarnacles = this.minions
      .filter((m) => m.alive && m.isPetrifiedObstacle)
      .map((m) => ({ x: m.x, y: m.y, half: 17 }));
    this.combinedSolidRects =
      petrifiedBarnacles.length > 0
        ? [...this.activeSolidBoxes, ...petrifiedBarnacles]
        : this.activeSolidBoxes;
    this.ship.solidBoxes = this.combinedSolidRects;
  }

  private getActiveSolidBoxes(): readonly PowerUpBox[] {
    return this.activeSolidBoxes;
  }

  private getAllSolidRects(): readonly SolidRect[] {
    return this.combinedSolidRects;
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

    if (this.activeGameMode === 'ENDLESS') {
      this.jetonStore.bestEndlessWave[runDiff] = Math.max(
        this.jetonStore.bestEndlessWave[runDiff],
        this.currentWave
      );
      save.v15Store.bestEndlessWave[runDiff] = this.jetonStore.bestEndlessWave[runDiff];
    }

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

  private spawnSafeArenaText(
    rawX: number,
    rawY: number,
    text: string,
    color: string,
    size: number
  ): void {
    const safeX = Math.max(175, Math.min(725, rawX));
    const safeY = Math.max(92, Math.min(1124, rawY));
    this.particles.spawnFloatingText(safeX, safeY, text, color, size);
  }

  private addScore(points: number): void {
    if (points <= 0) return;
    this.score += points;

    // Strictly cap maximum ships at MAX_PLAYER_LIVES (5) even when extra ships are earned!
    while (this.score >= this.nextExtraLifeScore) {
      this.nextExtraLifeScore += EXTRA_LIFE_SCORE_STEP;
      if (this.lives < MAX_PLAYER_LIVES) {
        this.lives = Math.min(MAX_PLAYER_LIVES, this.lives + 1);
        SoundEngine.playExtraLife();
        this.spawnSafeArenaText(this.ship.x, this.ship.y - 30, '+1 GEMİ', '#28E038', 24);
      }
    }

    if (this.score >= 1_000_000) {
      this.tryUnlockAchievement('HIGH_ROLLER');
    }

    this.persistRunRecords();
  }

  private triggerBossPhaseAwakening(nextPhase: BossCombatPhase, customLabel?: string): void {
    this.activeCombatPhase = nextPhase;
    this.phaseAwakeningTimer = 0.85;
    this.phaseAwakeningLabel =
      customLabel ?? (nextPhase === 3 ? 'FAZ III • AŞIRI YÜK!' : 'FAZ II • ÖFKE!');

    this.projectiles.clearEnemyBullets();
    SoundEngine.playBossHit(false);
    NativeBridge.hapticPolygonShatter(22);
    this.particles.triggerShake(9, 0.3);

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
        nextPhase === 3 ? '#EF4444' : '#F59E0B',
        0.46
      );

      if (boss instanceof CentipedeBoss && nextPhase === 2) {
        const debris = boss.triggerElderArmorShed(this.activePolygon);
        for (const pt of debris) {
          this.particles.spawnBurst(pt.x, pt.y, 8, '#FFD040', 55, 180, 5, 0.34);
        }
      } else if (boss instanceof LobsterMechaBoss && nextPhase === 2) {
        boss.triggerShellDrop({
          spawnSolidObstacle: (p) => this.spawnPermanentShellObstacle(p)
        });
      } else if (boss instanceof CyberSkullBoss && nextPhase === 2) {
        if (boss.triggerLastStand(10.0)) {
          this.phaseAwakeningTimer = 1.4;
          this.phaseAwakeningLabel = 'SON DİRENİŞ • 10 SN!';
        }
      } else if (boss instanceof AlienBrainBoss && nextPhase === 2) {
        boss.detachArmorSawBlades({
          summonMinion: (m) => newlySummonedMinions.push(m)
        });
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
      for (const sm of newlySummonedMinions) {
        this.minions.push(sm);
        this.attachAutonomousMinion(sm, this.currentLevelPlan.minionSpeedScale);
      }
    }
    if (newlySpawnedBosses.length > 0) {
      this.bosses.push(...newlySpawnedBosses);
    }
  }

  private update(dt: number): void {
    this.timeSeconds += dt;
    this.particles.update(dt);

    // Enable battery-saving 24 FPS idle pacer ONLY when resting on static menus!
    const isStaticMenu = this.screen !== 'PLAYING' && this.screen !== 'REWARDED_AD_SIM';
    this.gameLoop.setLowPowerIdleCandidate(isStaticMenu);

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

    const rawInput = this.input.poll(dt);
    this.lastInputSnapshot = rawInput;

    if (rawInput.debugSectorSelect !== null && import.meta.env.DEV) {
      this.startRunSession(rawInput.debugSectorSelect);
      return;
    }

    if (rawInput.pauseJustPressed) {
      if (this.screen === 'PLAYING') {
        this.screen = 'PAUSED';
        this.polishController.isPaused = true;
        SoundEngine.stopLaserCutLoop();
        this.persistV15State();
        return;
      } else if (this.screen === 'PAUSED') {
        this.polishController.requestSmoothResume();
        this.screen = 'PLAYING';
        this.gameLoop.resetTiming();
        return;
      }
    }

    if (this.screen !== 'PLAYING') {
      SoundEngine.stopLaserCutLoop();
      return;
    }

    // 1.2s Gentle Resume Breath (`"HAZIR..."`) after returning from Pause / Background!
    this.polishController.isPaused = false;
    if (!this.polishController.stepResumeCountdown(dt)) {
      SoundEngine.stopLaserCutLoop();
      return;
    }

    const save = StorageService.getCurrent();
    const diff = DIFFICULTIES[save.difficulty];
    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    const diffSpec = HONEST_DIFFICULTIES_V15[runDiff];
    const spec = this.currentWaveSpec;

    // 115ms Corner Turn Buffer + 180-Degree Self-Reverse Guard (`EndUserPolishControllerV15`)
    const nowMs = this.timeSeconds * 1000;
    const isCuttingNow = this.ship.state === 'CUTTING';
    const currentCardinal: CardinalDir | null = isCuttingNow
      ? (this.ship.cutDirection as CardinalDir)
      : null;

    let effectiveDir = rawInput.direction;
    if (rawInput.direction) {
      const hadSwipeHint = this.polishController.showFirstLaunchSwipeHint;
      effectiveDir = this.polishController.queueDirectionInput(
        rawInput.direction as CardinalDir,
        currentCardinal,
        isCuttingNow,
        nowMs
      );
      if (hadSwipeHint && !this.polishController.showFirstLaunchSwipeHint) {
        save.v15Store.hasSeenSwipeHint = true;
        void StorageService.save();
      }
    } else {
      const buffered = this.polishController.consumeBufferedDirection(nowMs);
      if (buffered) {
        effectiveDir = buffered;
      }
    }
    const input: InputState =
      effectiveDir === rawInput.direction ? rawInput : { ...rawInput, direction: effectiveDir };

    // Honest Difficulty Parameters (`HonestDifficultyGovernorV15` — zero secret softening on Hard!)
    const speedPerkBonus = (this.endlessPerkStacks.get('FAST_ENGINE') ?? 0) * 0.15;
    const stageParams = this.honestGovernor.resolveStageParameters({
      mode: this.activeGameMode,
      stageOrWave: this.currentWave,
      difficulty: runDiff,
      capturedPercent: this.claimedPercent,
      playerSpeedPerkBonusRatio: speedPerkBonus
    });

    this.projectiles.governorCaps = {
      maxActiveEnemyBullets: stageParams.maxActiveBullets,
      maxBulletSpeedPx: stageParams.bulletSpeedPx,
      minDodgeGapPx: diffSpec.minBulletCorridorGapPx
    };

    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) {
        this.comboCount = 1;
      }
    }
    if (this.grazeCooldownTimer > 0) {
      this.grazeCooldownTimer = Math.max(0, this.grazeCooldownTimer - dt);
    }

    if (this.crushSlowTimer > 0) {
      this.crushSlowTimer = Math.max(0, this.crushSlowTimer - dt);
    }

    // Step Power-Up & Juice Timers + Calibrated Player Cutting Speed
    this.juiceSystem.stepTimers(dt);
    if (this.juiceSystem.powerState.laserCannonRemainingSec > 0) {
      this.ship.laserTimer = Math.max(
        this.ship.laserTimer,
        this.juiceSystem.powerState.laserCannonRemainingSec
      );
    }

    this.syncSolidBoxes();
    const prevX = this.ship.x;
    const prevY = this.ship.y;
    const inWebZone = this.hazards.isPointInWebZone({ x: this.ship.x, y: this.ship.y });
    const inFrostZone = this.hazards.isPointInFrostZone({ x: this.ship.x, y: this.ship.y });
    const savedSpeedMult = this.ship.speedMultiplier;
    const isActivelyCutting =
      this.ship.state === 'CUTTING' || Boolean(input.carveHeld || input.autoCarveSwipe);
    if (isActivelyCutting) {
      const calibratedCutRatio = stageParams.playerSpeedPx / BASE_CUT_SPEED;
      const turboBoost = this.juiceSystem.powerState.speedBoostRemainingSec > 0 ? 1.55 : 1.0;
      const hazardSlow = inWebZone ? 0.6 : inFrostZone ? 0.74 : 1.0;
      this.ship.speedMultiplier = Math.max(
        0.45,
        savedSpeedMult * calibratedCutRatio * turboBoost * hazardSlow
      );
    }
    let completedCut = this.ship.update(dt, input, this.activePolygon, this.activeBarriers);
    this.ship.speedMultiplier = savedSpeedMult;

    // Ergonomic Wall Auto-Close Magnet (`14px / 11px / 9px` + `WIDE_SNAP` perk)
    const wideSnapBonus = (this.endlessPerkStacks.get('WIDE_SNAP') ?? 0) * 5;
    const maxWallSnapPx = Math.round(diffSpec.wallSnapClosePx + wideSnapBonus);
    if (
      !completedCut &&
      this.ship.state === 'CUTTING' &&
      !this.ship.isBacktracking &&
      this.ship.getActiveTrailLength() >= 24
    ) {
      const trailNow = this.ship.getActiveTrail();
      const dirVec = DIR_VECTORS[this.ship.cutDirection];
      const allRects = this.getAllSolidRects();
      for (let snapDist = 2; snapDist <= maxWallSnapPx; snapDist += 2) {
        const probe = {
          x: this.ship.x + dirVec.dx * snapDist,
          y: this.ship.y + dirVec.dy * snapDist
        };
        if (circleHitsSolidBox(probe.x, probe.y, 4, allRects)) break;
        if (
          isPointOnPolygonBoundary(probe, this.activePolygon, 0.75) &&
          !isPointOnBarrier(probe, this.activeBarriers, 0.75) &&
          trailNow.length >= 2 &&
          Math.hypot(probe.x - trailNow[0].x, probe.y - trailNow[0].y) >= 14
        ) {
          const snappedTrail = trailNow.map((p) => ({ x: p.x, y: p.y }));
          snappedTrail[snappedTrail.length - 1] = { x: probe.x, y: probe.y };
          this.ship.x = probe.x;
          this.ship.y = probe.y;
          completedCut = { trail: snappedTrail };
          break;
        }
      }
    }

    if (this.ship.state === 'CUTTING') {
      this.activeCutDurationSec += dt;
    } else {
      this.activeCutDurationSec = 0;
    }

    const movedDist = Math.hypot(this.ship.x - prevX, this.ship.y - prevY);
    if (
      this.ship.state === 'CUTTING' &&
      movedDist > 0.4 &&
      this.comboCount >= 2 &&
      Math.floor(this.timeSeconds * 60) % 4 === 0
    ) {
      this.particles.spawnBurst(
        this.ship.x,
        this.ship.y,
        2,
        this.comboCount >= 4 ? '#FF7848' : '#FFE058',
        25,
        85,
        3.5,
        0.14
      );
    }

    if (this.ship.state === 'ON_BORDER') {
      const hasLatchedSapper = this.minions.some((m) => m.alive && m.isLatchedToBorder);
      if (hasLatchedSapper && this.ship.shieldLockTimer <= 0 && this.ship.shieldTimer > 0) {
        this.ship.shieldTimer = Math.max(0, this.ship.shieldTimer - 2.0 * dt);
      }

      if (this.ship.invulnerableTimer <= 0 && this.phaseAwakeningTimer <= 0) {
        for (const arc of this.hazards.staticArcs) {
          const arcProj = projectPointToSegment({ x: this.ship.x, y: this.ship.y }, arc.p1, arc.p2);
          if (arcProj.distance <= 14) {
            if (this.ship.isPerimeterShieldActive()) {
              this.ship.shieldTimer = Math.max(0, this.ship.shieldTimer - 3.2 * dt);
              this.ship.shieldHitFlash = 0.18;
            } else {
              this.killPlayerShip();
              return;
            }
          }
        }
      }
    }

    if (this.ship.turnedCornerThisStep) {
      SoundEngine.playCornerClick();
      if (this.ship.state === 'CUTTING') {
        this.particles.spawnBurst(this.ship.x, this.ship.y, 4, '#FFE878', 35, 115, 4, 0.16);
        const ghostStacks = this.endlessPerkStacks.get('GHOST_CORNER') ?? 0;
        if (ghostStacks > 0) {
          this.ship.invulnerableTimer = Math.max(this.ship.invulnerableTimer, 0.5 * ghostStacks);
        }
      }
    }

    if (this.boxContactSfxCooldown > 0) {
      this.boxContactSfxCooldown = Math.max(0, this.boxContactSfxCooldown - dt);
    }
    for (const b of this.powerBoxes) b.update(dt);
    if (this.ship.boxContactThisStep && this.boxContactSfxCooldown <= 0) {
      this.boxContactSfxCooldown = 0.35;
      SoundEngine.playCornerClick();
      const touched = this.getActiveSolidBoxes().find(
        (b) =>
          Math.abs(b.x - this.ship.x) <= SOLID_BOX_HALF + 12 &&
          Math.abs(b.y - this.ship.y) <= SOLID_BOX_HALF + 12
      );
      if (touched) touched.contactFlash = 0.22;
    }

    // Border Shield Audio Warning while `ON_BORDER`
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

    // Mid-Cut Stall Spark
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

    // Hard Mode Phase-2 Boss Enrage at >= 50% area OR Rare Boss Phase Evolution (`FAZ II`)
    if (
      stageParams.isBossEnraged &&
      !this.hardEnrageTriggeredThisStage &&
      this.getPrimaryBosses().some((b) => b.alive)
    ) {
      this.hardEnrageTriggeredThisStage = true;
      if (this.activeCombatPhase < 2) {
        this.triggerBossPhaseAwakening(2, 'FAZ II • ÖFKE!');
      }
    } else {
      const resolvedPhase = this.endlessDirector.resolveActivePhase(
        this.claimedPercent,
        this.getPrimaryBossHpRatio(),
        this.currentWaveSpec
      );
      if (resolvedPhase > this.activeCombatPhase && this.getPrimaryBosses().some((b) => b.alive)) {
        this.triggerBossPhaseAwakening(resolvedPhase);
      }
    }

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

    const timeFrozen =
      this.timeFreezeTimer > 0 || this.juiceSystem.powerState.timeFreezeRemainingSec > 0;
    if (this.timeFreezeTimer > 0) {
      this.timeFreezeTimer = Math.max(0, this.timeFreezeTimer - dt);
    }

    const activeTrail = this.ship.getActiveTrail();
    const enemyDt = this.phaseAwakeningTimer > 0 ? dt * 0.28 : dt;
    const crushSlowMult = this.crushSlowTimer > 0 ? 0.58 : 1.0;
    const maxBossSpeedNow = stageParams.bossSpeedPx * crushSlowMult;
    const maxMinionSpeedNow = stageParams.minionSpeedPx * crushSlowMult;
    const bossEffectiveScale = (maxBossSpeedNow / 155) * crushSlowMult;

    if (!timeFrozen) {
      this.waveElapsedSec += enemyDt;
      const spawnedMinions: InteriorMinion[] = [];
      const spawnedEscortBosses: BaseBoss[] = [];
      let pocketCrushTriggered = false;

      const readySeekers = this.hazards.update(enemyDt);
      if (readySeekers > 0) {
        const hostBoss =
          this.getPrimaryBosses().find((b) => b.alive) ?? this.bosses.find((b) => b.alive);
        for (let s = 0; s < readySeekers; s++) {
          if (
            hostBoss &&
            this.minions.filter((m) => m.alive).length + spawnedMinions.length <
              stageParams.minionCount
          ) {
            spawnedMinions.push(
              new HomingSeekerMinion(
                { x: hostBoss.x, y: hostBoss.y },
                maxMinionSpeedNow,
                (this.timeSeconds + s) * 2.1
              )
            );
          }
        }
      }

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
          speedScale: bossEffectiveScale,
          maxBossSpeedPx: maxBossSpeedNow,
          minVolleyCooldownSec: stageParams.volleyCooldownSec,
          telegraphLeadSec: stageParams.telegraphLeadSec,
          aimMode: spec.rules.bossAimMode,
          projectiles: this.projectiles,
          summonMinion: (m) => spawnedMinions.push(m),
          spawnSolidObstacle: (pos) => this.spawnPermanentShellObstacle(pos),
          spawnEscortBoss: (escort) => {
            spawnedEscortBosses.push(escort);
            this.particles.spawnShockwave(escort.x, escort.y, 240, '#EF4444', 0.36);
          },
          hazards: this.hazards,
          currentMinionCount: this.minions.length + spawnedMinions.length
        });

        if (boss instanceof CyberSkullBoss && boss.inLastStand && boss.lastStandCompleted) {
          this.triggerLevelVictory('AREA_THRESHOLD');
          return;
        }

        const solidBoxesNow = this.getAllSolidRects();
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
        } else if (boss instanceof MagmaSerpentBoss) {
          boss.bounceSegmentsOffBoxes(solidBoxesNow, this.activePolygon);
        } else if (boss instanceof FrostLeviathanBoss) {
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

      if (spawnedEscortBosses.length > 0) {
        this.bosses.push(...spawnedEscortBosses);
      }

      if (pocketCrushTriggered && this.getPrimaryBosses().every((b) => !b.alive)) {
        save.stats.bossesDestroyed += 1;
        this.tryUnlockAchievement('BOSS_SLAYER');
        this.triggerLevelVictory('BOSS_DESTROYED');
        return;
      }

      const primaryBossAlive =
        this.getPrimaryBosses().find((b) => b.alive) ?? this.bosses.find((b) => b.alive);
      const bossCenter = primaryBossAlive
        ? { x: primaryBossAlive.x, y: primaryBossAlive.y }
        : { x: 450, y: 500 };
      const allSolidRectsNow = this.getAllSolidRects();
      const polyBounds = this.computePolygonBounds(this.activePolygon);

      const aliveIds = new Set<string>();
      for (const m of this.minions) {
        if (!m.alive) continue;
        if (!m.autonomousId) {
          this.attachAutonomousMinion(m, this.currentLevelPlan.minionSpeedScale);
        }
        aliveIds.add(m.autonomousId!);
      }
      this.autonomousMinionStates = this.autonomousMinionStates.filter((st) =>
        aliveIds.has(st.id)
      );

      let trailMidpoint: Point | undefined;
      if (activeTrail.length >= 2) {
        const midIdx = Math.floor(activeTrail.length * 0.5);
        trailMidpoint = activeTrail[midIdx];
      }

      this.minionEcology.stepMinions(
        this.autonomousMinionStates,
        enemyDt,
        polyBounds,
        bossCenter,
        {
          pos: { x: this.ship.x, y: this.ship.y },
          isCutting: this.ship.state === 'CUTTING',
          activeCuttingDurationSec: this.activeCutDurationSec,
          trailMidpoint
        },
        this.claimedPercent,
        this.currentLevelPlan.reactionGraceSec,
        (px, py) =>
          !pointInPolygonStrict({ x: px, y: py }, this.activePolygon) ||
          Boolean(circleHitsSolidBox(px, py, 12, allSolidRectsNow)),
        (px, py) => {
          const proj = projectPointToPolygon({ x: px, y: py }, this.activePolygon);
          if (proj.distance <= 0.01) return null;
          const dx = px - proj.point.x;
          const dy = py - proj.point.y;
          const len = Math.hypot(dx, dy) || 1;
          return { dist: proj.distance, normalX: dx / len, normalY: dy / len };
        }
      );

      const stateById = new Map<string, AutonomousMinionState>();
      for (const st of this.autonomousMinionStates) {
        stateById.set(st.id, st);
      }

      const shockTrailStacks = this.endlessPerkStacks.get('SHOCK_TRAIL') ?? 0;
      const shockRange = shockTrailStacks > 0 ? 34 + shockTrailStacks * 12 : 0;

      for (const m of this.minions) {
        if (!m.alive || !m.autonomousId) continue;
        const st = stateById.get(m.autonomousId);
        if (!st) continue;
        m.prevX = m.x;
        m.prevY = m.y;
        m.isLatchedToBorder = false;
        m.isBorderSparkActive = false;
        m.isPetrifiedObstacle = false;
        m.isTimeFrozen = st.frozenTimerSec > 0;

        const rawMspd = Math.hypot(st.vel.x, st.vel.y);
        if (rawMspd > maxMinionSpeedNow && rawMspd > 0.001) {
          const r = maxMinionSpeedNow / rawMspd;
          st.vel.x *= r;
          st.vel.y *= r;
        }

        if (shockRange > 0 && this.ship.state === 'CUTTING' && activeTrail.length >= 2) {
          const proj = projectPointToPolyline({ x: st.pos.x, y: st.pos.y }, activeTrail);
          if (proj.distance < shockRange + m.radius) {
            const rx = st.pos.x - proj.point.x;
            const ry = st.pos.y - proj.point.y;
            const rLen = Math.hypot(rx, ry) || 1;
            st.pos.x = proj.point.x + (rx / rLen) * (shockRange + m.radius + 8);
            st.pos.y = proj.point.y + (ry / rLen) * (shockRange + m.radius + 8);
            st.vel.x = (rx / rLen) * maxMinionSpeedNow;
            st.vel.y = (ry / rLen) * maxMinionSpeedNow;
            this.particles.spawnBurst(proj.point.x, proj.point.y, 3, '#60A5FA', 35, 95, 4, 0.14);
          }
        }

        m.x = st.pos.x;
        m.y = st.pos.y;
        m.vx = st.vel.x;
        m.vy = st.vel.y;
        m.currentSpeed = Math.hypot(st.vel.x, st.vel.y);
        m.enforcePolygonBounds(this.activePolygon);
        if (!m.ignoresSolidBoxes && bounceCircleOffSolidBoxes(m, m.radius, allSolidRectsNow)) {
          m.enforcePolygonBounds(this.activePolygon);
        }
        st.pos.x = m.x;
        st.pos.y = m.y;
        st.vel.x = m.vx;
        st.vel.y = m.vy;
      }

      if (spawnedMinions.length > 0) {
        const aliveNow = this.minions.filter((m) => m.alive).length;
        for (const sm of spawnedMinions) {
          if (aliveNow + 1 > stageParams.minionCount) break;
          this.minions.push(sm);
          this.attachAutonomousMinion(sm, this.currentLevelPlan.minionSpeedScale);
        }
      }
      this.syncSolidBoxes();

      this.crawlerSpawnTimer -= enemyDt;
      if (this.crawlerSpawnTimer <= 0 && this.crawlers.length < 1 && this.currentWave >= 6) {
        this.crawlerSpawnTimer = Math.max(38, spec.rules.crawlerDelaySec);
        const edges = getPolygonEdges(this.activePolygon);
        const totalPerim = getTotalPerimeter(edges);
        if (totalPerim > 0) {
          const playerProj = projectPointToPolygon(
            { x: this.ship.x, y: this.ship.y },
            this.activePolygon
          );
          const playerS = pointToArcLength(playerProj.point, this.activePolygon) ?? 0;
          const oppositeS = (playerS + totalPerim * 0.5) % totalPerim;
          this.crawlers.push(new BorderCrawler(this.activePolygon, oppositeS, 126));
        }
      }

      for (const c of this.crawlers) {
        c.update(
          enemyDt,
          this.activePolygon,
          { x: this.ship.x, y: this.ship.y },
          maxMinionSpeedNow / 130
        );
      }

      if (this.ship.state === 'CUTTING' && activeTrail.length >= 2) {
        const fuseSpeed = Math.min(340, spec.rules.electricShockSpeed);
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
    } else {
      for (const m of this.minions) {
        m.prevX = m.x;
        m.prevY = m.y;
        m.isTimeFrozen = true;
      }
      for (const b of this.bosses) {
        b.prevX = b.x;
        b.prevY = b.y;
      }
    }

    this.projectiles.update(enemyDt, this.activePolygon, timeFrozen, {
      x: this.ship.x,
      y: this.ship.y
    });
    this.resolveProjectileWallImpacts();
    this.evaluateCombatAndHazards();
  }

  private resolveProjectileWallImpacts(): void {
    const boxes = this.getAllSolidRects();
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
    const pool: PowerUpType[] = ['S', 'P', 'L', 'T', 'C'];
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
    this.activeCutDurationSec = 0;

    let nearestEnemyDistAtClosePx = 999;
    if (trail.length >= 2) {
      for (const eb of this.projectiles.enemyBullets) {
        if (!eb.active) continue;
        const d = projectPointToPolyline({ x: eb.x, y: eb.y }, trail).distance - eb.radius;
        if (d < nearestEnemyDistAtClosePx) nearestEnemyDistAtClosePx = Math.max(0, d);
      }
      for (const m of this.minions) {
        if (!m.alive) continue;
        const d = projectPointToPolyline({ x: m.x, y: m.y }, trail).distance - m.radius;
        if (d < nearestEnemyDistAtClosePx) nearestEnemyDistAtClosePx = Math.max(0, d);
      }
      for (const b of this.bosses) {
        if (!b.alive) continue;
        const d = projectPointToPolyline({ x: b.x, y: b.y }, trail).distance - b.boundingRadius;
        if (d < nearestEnemyDistAtClosePx) nearestEnemyDistAtClosePx = Math.max(0, d);
      }
    }

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
      this.megaCutsThisLevel += 1;
      this.tryUnlockAchievement('MEGA_SLICE');
    }

    // Arcade Combo Chain (`KOMBO x2`..`x5`): 7.5s momentum window on cuts >= 3%
    if (percentDelta >= 3.0) {
      if (this.comboTimer > 0) {
        this.comboCount = Math.min(5, this.comboCount + (percentDelta >= 18 ? 2 : 1));
      } else {
        this.comboCount = percentDelta >= 16 ? 2 : 1;
      }
      this.comboTimer = 7.5;
      this.maxComboThisLevel = Math.max(this.maxComboThisLevel, this.comboCount);
    }

    const cutScore = ScoreSystem.computeCutScore(percentDelta, diffMultiplier);
    const totalCutPoints = Math.round(cutScore.points * this.comboCount);
    this.addScore(totalCutPoints);

    if (percentDelta >= 25.0) {
      this.spawnSafeArenaText(
        this.ship.x,
        this.ship.y - 38,
        `DEV KESİM! %${Math.round(percentDelta)}`,
        '#FFE058',
        26
      );
    } else if (this.comboCount >= 2 && percentDelta >= 3.5) {
      this.spawnSafeArenaText(
        this.ship.x,
        this.ship.y - 34,
        `KOMBO x${this.comboCount}! +${totalCutPoints}`,
        this.comboCount >= 4 ? '#FF7848' : '#FFE058',
        23
      );
    }

    let trappedCount = 0;
    let vortexBonusSec = 0;
    for (const m of this.minions) {
      if (!m.alive) continue;
      if (!pointInPolygonStrict(m.position, this.activePolygon)) {
        m.alive = false;
        const comboPts = ScoreSystem.computeMinionTrapScore(trappedCount) * this.comboCount;
        trappedCount++;
        this.addScore(comboPts);
        this.particles.spawnBurst(m.x, m.y, 18, PALETTE.CUT_ORANGE, 60, 220, 6, 0.34);
        if (m.synergyTrait === 'SHIELD_BUBBLE' || m.speciesId === 'VORTEX_DRIFTER') {
          vortexBonusSec += 4;
        }
      }
    }
    this.minions = this.minions.filter((m) => m.alive);
    const remainingIds = new Set(this.minions.map((m) => m.autonomousId));
    this.autonomousMinionStates = this.autonomousMinionStates.filter((st) =>
      remainingIds.has(st.id)
    );
    if (trappedCount > 0) {
      this.crushedMinionsThisLevel += trappedCount;
      const crushSlowStacks = this.endlessPerkStacks.get('CRUSH_SLOW') ?? 0;
      if (crushSlowStacks > 0) {
        this.crushSlowTimer = 2.2 * crushSlowStacks;
        this.particles.spawnShockwave(this.ship.x, this.ship.y, 340, '#F43F5E', 0.34);
      }
    }
    if (trappedCount >= 3) {
      this.tryUnlockAchievement('COMBO_HUNTER');
    }

    const juiceRewards = this.juiceSystem.computeCutRewards(
      percentDelta,
      trappedCount,
      nearestEnemyDistAtClosePx
    );
    if (juiceRewards.bonusScore > 0) {
      this.addScore(juiceRewards.bonusScore);
    }
    const totalBonusShieldSec = juiceRewards.bonusShieldSec + vortexBonusSec;
    if (totalBonusShieldSec > 0) {
      this.ship.shieldTimer = Math.min(
        this.ship.maxShieldDuration * 1.2,
        this.ship.shieldTimer + totalBonusShieldSec
      );
    }
    if (juiceRewards.triggerHitStopMs > 0) {
      this.gameLoop.triggerHitStop(Math.min(0.095, juiceRewards.triggerHitStopMs / 1000));
    }

    this.hazards.pruneOutsidePolygon(this.activePolygon);

    for (const eb of this.projectiles.enemyBullets) {
      if (eb.active && !pointInPolygonStrict({ x: eb.x, y: eb.y }, this.activePolygon)) {
        eb.active = false;
      }
    }

    let enclosedBoxesThisCut = 0;
    let earnedBoxJeton = 0;
    const jetonMult = this.jetonStore.hasPermanentDoubleJeton ? 2 : 1;

    for (const box of this.powerBoxes) {
      if (box.collected) continue;
      if (!pointInPolygonStrict(box.center, this.activePolygon)) {
        const materializedAtCut = box.isMaterialized(this.timeSeconds);
        box.collected = true;
        if (!materializedAtCut) continue;

        enclosedBoxesThisCut += 1;

        if (box.blockKind === 'ARMOR_PILLAR') {
          const pts = ARMOR_PILLAR_BONUS * this.comboCount;
          this.addScore(pts);
          this.particles.spawnBurst(box.x, box.y, 18, '#C8D2E4', 55, 200, 7, 0.32);
          this.spawnSafeArenaText(box.x, box.y - 24, `ZIRH +${pts}`, '#DCE6F4', 22);
          continue;
        }

        if (box.blockKind === 'SPECIAL_STAGE_1_RED') {
          this.addScore(4_000 * this.comboCount);
          this.particles.spawnBurst(box.x, box.y, 20, '#FF4838', 65, 210, 6, 0.34);
          this.spawnSafeArenaText(box.x, box.y - 24, 'ALTIN KUTU AÇILDI!', '#FFE048', 24);
          this.spawnStage2GoldSpecialBlock();
          continue;
        }

        if (box.rewardType === 'EMPTY_POINTS') {
          const vaultJeton = 5 * jetonMult;
          earnedBoxJeton += vaultJeton;
          this.addScore(EMPTY_BLOCK_POINTS_BONUS * this.comboCount);
          this.particles.spawnShockwave(box.x, box.y, 140, '#FFE058', 0.3);
          this.particles.spawnBurst(box.x, box.y, 16, '#FFE068', 55, 185, 5.5, 0.28);
          this.spawnSafeArenaText(
            box.x,
            box.y - 24,
            `+${vaultJeton} JETON!`,
            '#FFE058',
            24
          );
          continue;
        }

        if (box.rewardType === 'ENRAGE_TRAP') {
          this.addScore(3_000 * this.comboCount);
          this.particles.spawnShockwave(box.x, box.y, 150, '#FF2838', 0.32);
          this.spawnSafeArenaText(box.x, box.y - 24, 'TUZAK KUTU! +3000', '#FF6858', 22);
          continue;
        }

        const resolved = box.resolveType(this.timeSeconds);
        if (resolved === 'ARMOR_PILLAR') {
          this.addScore(ARMOR_PILLAR_BONUS * this.comboCount);
          continue;
        }
        const collectible: CollectiblePowerUpType = resolved;
        const blockPts =
          (collectible === 'BOSS_CANNON' ? ScoreSystem.computeSpecialBlockBonus() : 1000) *
          this.comboCount;
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

    if (enclosedBoxesThisCut >= 2) {
      const multiBoxJeton = 8 * jetonMult;
      earnedBoxJeton += multiBoxJeton;
      this.addScore(4_000 * enclosedBoxesThisCut);
      this.particles.spawnShockwave(this.ship.x, this.ship.y, 260, '#FFE058', 0.38);
      this.spawnSafeArenaText(
        this.ship.x,
        this.ship.y - 54,
        `ÇİFTE KUTU! +${multiBoxJeton} JETON`,
        '#FFE058',
        25
      );
    }

    if (earnedBoxJeton > 0) {
      this.jetonStore.jetonBalance += earnedBoxJeton;
      this.persistV15State();
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
      const skull = this.bosses.find(
        (b): b is CyberSkullBoss =>
          b instanceof CyberSkullBoss && b.alive && b.canEvolveLastStand && !b.lastStandCompleted
      );
      if (skull && this.claimedPercent < 90) {
        if (!skull.inLastStand) {
          this.triggerBossPhaseAwakening(2, 'SON DİRENİŞ • 10 SN!');
          skull.triggerLastStand(10.0);
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
        this.spawnSafeArenaText(px, py - 24, 'HIZ', '#38BDF8', 26);
        break;
      case 'T':
        this.timeFreezeTimer = this.currentWaveSpec.rules.timeFreezeDurationSec;
        this.spawnSafeArenaText(px, py - 24, 'DONDUR', '#38BDF8', 26);
        break;
      case 'P':
        this.ship.applyShieldLock();
        this.spawnSafeArenaText(px, py - 24, 'KALKAN', '#10B981', 26);
        break;
      case 'L':
        this.ship.laserTimer = 12.0;
        this.spawnSafeArenaText(px, py - 24, 'LAZER', '#F59E0B', 26);
        break;
      case 'C': {
        this.particles.spawnShockwave(px, py, 760, '#F59E0B', 0.42);
        this.particles.triggerShake(8, 0.22);
        this.projectiles.clearEnemyBullets();
        this.hazards.spaceMines = [];
        this.hazards.webZones = [];
        for (const m of this.minions) {
          if (!m.alive) continue;
          m.alive = false;
          this.addScore(500);
          this.particles.spawnBurst(m.x, m.y, 16, PALETTE.CUT_ORANGE, 60, 210, 6, 0.32);
        }
        this.minions = [];
        this.syncSolidBoxes();
        this.spawnSafeArenaText(px, py - 24, 'TEMİZLE', '#F59E0B', 26);
        break;
      }
      case 'BOSS_CANNON':
        this.ship.bossCannonTimer = 11.0;
        this.particles.spawnShockwave(px, py, 360, '#F59E0B', 0.34);
        this.spawnSafeArenaText(px, py - 24, 'SÜPER ATIŞ', '#F59E0B', 28);
        break;
    }
  }

  private evaluateCombatAndHazards(): void {
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

      for (let i = this.hazards.spaceMines.length - 1; i >= 0; i--) {
        const mine = this.hazards.spaceMines[i];
        if (Math.hypot(bolt.x - mine.x, bolt.y - mine.y) <= bolt.radius + mine.radius + 2) {
          this.hazards.spaceMines.splice(i, 1);
          if (!bolt.heavyPlasma) {
            bolt.active = false;
          }
          this.addScore(150);
          this.particles.spawnBurst(mine.x, mine.y, 12, '#FF5828', 50, 160, 5, 0.24);
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
            boss.applyLaserStun(0.32);
            SoundEngine.playBossHit(true);
            this.addScore(35);
            this.particles.spawnBurst(bolt.x, bolt.y, 6, '#50E8FF', 45, 130, 4, 0.18);
          } else {
            const armoredShell = boss.armorDamageReduction >= 0.5;
            SoundEngine.playBossHit(armoredShell);
            this.addScore(armoredShell ? 350 : 1000);
            this.particles.triggerShake(armoredShell ? 3 : 6, 0.16);
            this.particles.spawnBurst(
              bolt.x,
              bolt.y,
              armoredShell ? 9 : 16,
              armoredShell ? '#FFE278' : PALETTE.CUT_ORANGE,
              65,
              220,
              6,
              0.3
            );
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

    const activeTrail = this.ship.getActiveTrail();
    if (this.ship.state === 'CUTTING' && activeTrail.length >= 2 && this.timeFreezeTimer <= 0) {
      const totalTrailLen = this.ship.getActiveTrailLength();
      const igniteTrailShock = (ex: number, ey: number, er: number): boolean => {
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

      for (const eb of this.projectiles.enemyBullets) {
        if (!eb.active) continue;
        const proj = projectPointToPolyline({ x: eb.x, y: eb.y }, activeTrail);
        if (proj.distance <= eb.radius + 3) {
          eb.active = false;
          igniteTrailShock(eb.x, eb.y, eb.radius + 1);
          if (this.screen !== 'PLAYING' || this.ship.state !== 'CUTTING') {
            return;
          }
        }
      }

      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        for (const c of boss.getHitCircles()) {
          if (igniteTrailShock(c.x, c.y, c.radius)) {
            if (this.screen !== 'PLAYING' || this.ship.state !== 'CUTTING') {
              return;
            }
          }
        }
      }

      for (const m of this.minions) {
        if (m.alive) {
          igniteTrailShock(m.x, m.y, m.radius);
        }
      }

      for (const pool of this.hazards.magmaPools) {
        if (igniteTrailShock(pool.x, pool.y, pool.radius * 0.85)) {
          if (this.screen !== 'PLAYING' || this.ship.state !== 'CUTTING') {
            return;
          }
        }
      }

      for (let i = this.hazards.spaceMines.length - 1; i >= 0; i--) {
        const mine = this.hazards.spaceMines[i];
        if (igniteTrailShock(mine.x, mine.y, mine.radius)) {
          this.hazards.spaceMines.splice(i, 1);
          this.particles.spawnBurst(mine.x, mine.y, 14, '#FF4820', 55, 180, 5, 0.28);
          if (this.screen !== 'PLAYING' || this.ship.state !== 'CUTTING') {
            return;
          }
        }
      }

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
            igniteTrailShock(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 9);
            if (this.screen !== 'PLAYING' || this.ship.state !== 'CUTTING') {
              return;
            }
          }
        }
      }
    }

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

    for (const m of this.minions) {
      if (!m.alive || !m.isBorderSparkActive) continue;
      if (Math.hypot(m.x - this.ship.x, m.y - this.ship.y) <= shipRadius + m.radius) {
        this.killPlayerShip();
        return;
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

      for (const pool of this.hazards.magmaPools) {
        if (
          Math.hypot(pool.x - this.ship.x, pool.y - this.ship.y) <=
          shipRadius + pool.radius * 0.85
        ) {
          this.killPlayerShip();
          return;
        }
      }

      for (let i = this.hazards.spaceMines.length - 1; i >= 0; i--) {
        const mine = this.hazards.spaceMines[i];
        if (Math.hypot(mine.x - this.ship.x, mine.y - this.ship.y) <= shipRadius + mine.radius) {
          this.hazards.spaceMines.splice(i, 1);
          this.killPlayerShip();
          return;
        }
      }

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
          this.particles.spawnBurst(eb.x, eb.y, 8, '#10B981', 40, 130, 4, 0.2);
        } else {
          this.killPlayerShip();
          return;
        }
      }
    }

    // Near-Miss ("KIL PAYI!") Graze Mastery while actively cutting in the open void!
    if (
      this.ship.state === 'CUTTING' &&
      this.grazeCooldownTimer <= 0 &&
      this.timeFreezeTimer <= 0 &&
      this.juiceSystem.powerState.timeFreezeRemainingSec <= 0
    ) {
      let minClearancePx = 999;
      for (const eb of this.projectiles.enemyBullets) {
        if (!eb.active) continue;
        const d = Math.hypot(eb.x - this.ship.x, eb.y - this.ship.y) - (shipRadius + eb.radius);
        if (d < minClearancePx) minClearancePx = d;
      }
      for (const m of this.minions) {
        if (!m.alive) continue;
        const d = Math.hypot(m.x - this.ship.x, m.y - this.ship.y) - (shipRadius + m.radius);
        if (d < minClearancePx) minClearancePx = d;
      }
      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        for (const hc of boss.getHitCircles()) {
          const d = Math.hypot(hc.x - this.ship.x, hc.y - this.ship.y) - (shipRadius + hc.radius);
          if (d < minClearancePx) minClearancePx = d;
        }
      }

      if (minClearancePx > 0 && minClearancePx <= 26) {
        this.grazeCooldownTimer = 1.25;
        const grazePts = 1500 * this.comboCount;
        this.addScore(grazePts);
        this.ship.shieldTimer = Math.min(
          this.ship.maxShieldDuration * 1.15,
          this.ship.shieldTimer + 1.5
        );
        if (this.comboTimer > 0) {
          this.comboTimer = Math.min(7.5, this.comboTimer + 1.4);
        }
        NativeBridge.hapticPowerUp();
        this.particles.spawnShockwave(this.ship.x, this.ship.y, 84, '#68F4FF', 0.24);
        this.particles.spawnBurst(this.ship.x, this.ship.y, 8, '#FFE878', 45, 150, 4.5, 0.22);
        this.spawnSafeArenaText(
          this.ship.x,
          this.ship.y - 30,
          `KIL PAYI! +${grazePts}`,
          '#78F8FF',
          22
        );
      }
    }
  }

  private killPlayerShip(): void {
    this.comboCount = 1;
    this.comboTimer = 0;
    const shieldCheck = this.juiceSystem.resolveIncomingPlayerHit(this.ship.cutStartPoint);
    if (!shieldCheck.playerDied) {
      if (shieldCheck.rewindToPos) {
        const savedLaser = this.ship.laserTimer;
        const savedCannon = this.ship.bossCannonTimer;
        this.fuses = [];
        this.cutStallTimer = 0;
        this.hesitationFuseLit = false;
        this.activeCutDurationSec = 0;
        this.projectiles.clearEnemyBullets();
        this.ship.respawnAtCutStart(this.activePolygon);
        this.ship.laserTimer = savedLaser;
        this.ship.bossCannonTimer = savedCannon;
        this.ship.invulnerableTimer = 1.6;
        SoundEngine.playShieldDeflect();
        NativeBridge.hapticPowerUp();
        this.particles.spawnShockwave(this.ship.x, this.ship.y, 280, '#38BDF8', 0.4);
      }
      return;
    }

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
    this.activeCutDurationSec = 0;
    this.hazards.staticArcs = [];
    this.projectiles.clearEnemyBullets();
    this.deathsThisLevel += 1;
    // Honest Difficulty: records death ONLY for Easy/Medium gentle assist; NEVER softens Hard!
    this.honestGovernor.onPlayerDeath();
    this.lives -= 1;

    this.persistRunRecords();

    if (this.lives <= 0) {
      if (MonetizationService.canOfferSecondChance(this.reviveUsedThisLevel)) {
        void MonetizationService.preloadRewardedRevive();
      }
      if (
        !this.reviveUsedThisLevel &&
        this.jetonStore.canOfferContinueModal(this.claimedPercent, this.currentWave)
      ) {
        this.screen = 'CONTINUE_PROMPT';
        this.persistV15State(null);
      } else {
        this.screen = 'GAME_OVER';
        this.persistV15State(null);
      }
      return;
    }

    this.ship.respawnAtCutStart(this.activePolygon);
    this.ship.invulnerableTimer = 3.0;
    this.juiceSystem.triggerRespawnShockwave(
      { x: this.ship.x, y: this.ship.y },
      this.autonomousMinionStates,
      145
    );
    const stateMap = new Map(this.autonomousMinionStates.map((st) => [st.id, st]));
    for (const m of this.minions) {
      if (!m.alive || !m.autonomousId) continue;
      const st = stateMap.get(m.autonomousId);
      if (st) {
        m.x = st.pos.x;
        m.y = st.pos.y;
        m.vx = st.vel.x;
        m.vy = st.vel.y;
        m.enforcePolygonBounds(this.activePolygon);
        st.pos.x = m.x;
        st.pos.y = m.y;
      }
    }
    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      const dx = boss.x - this.ship.x;
      const dy = boss.y - this.ship.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 155) {
        const pushed = resolvePolygonPenetration(
          { x: this.ship.x + (dx / dist) * 160, y: this.ship.y + (dy / dist) * 160 },
          boss.boundingRadius,
          this.activePolygon
        ).position;
        boss.x = pushed.x;
        boss.y = pushed.y;
      }
    }
    this.particles.spawnShockwave(this.ship.x, this.ship.y, 260, '#38BDF8', 0.42);
    this.hazards.spaceMines = this.hazards.spaceMines.filter(
      (m) => Math.hypot(m.x - this.ship.x, m.y - this.ship.y) > 130
    );
    this.persistV15State();
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
    this.hazards.clear();
    this.projectiles.clearEnemyBullets();

    const clearedInSingleCut =
      reason === 'AREA_THRESHOLD' &&
      this.cutsThisLevel === 1 &&
      this.claimedPercent >= spec.targetPercent;

    const runDiff = difficultyIdToRunDifficulty(save.difficulty);
    if (this.activeGameMode === 'CAMPAIGN') {
      const earnedStars = recordLevelCompletion(
        save.campaignV12,
        runDiff,
        Math.min(24, this.currentWave),
        this.claimedPercent,
        this.deathsThisLevel > 0
      );
      if (this.currentWave > 24) {
        const starKey = `${runDiff}_${this.currentWave}`;
        const prevSt = save.campaignV12.starsByLevel[starKey] ?? 0;
        save.campaignV12.starsByLevel[starKey] = Math.max(prevSt, earnedStars) as 1 | 2 | 3;
      }
      const nextUnlocked = Math.min(30, this.currentWave + 1);
      this.jetonStore.highestUnlockedStage[runDiff] = Math.max(
        this.jetonStore.highestUnlockedStage[runDiff],
        nextUnlocked
      );
      save.v15Store.highestUnlockedStage[runDiff] = this.jetonStore.highestUnlockedStage[runDiff];
      save.campaignV12.highestUnlockedLevel[runDiff] =
        this.jetonStore.highestUnlockedStage[runDiff];
      save.selectedStageByDifficulty[runDiff] = nextUnlocked;

      const breakdown = ScoreSystem.computeLevelClearBreakdown(
        reason,
        this.claimedPercent,
        this.ship.getShieldUnits(),
        diff.scoreMultiplier * (1 + (spec.threatIndex - 1) * 0.14),
        clearedInSingleCut,
        spec.targetPercent
      );
      breakdown.stars = Math.max(breakdown.stars, earnedStars) as 1 | 2 | 3;
      this.clearBreakdown = breakdown;
      this.addScore(breakdown.totalLevelBonus);
      save.stats.totalScore += breakdown.totalLevelBonus;
    } else {
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
      save.stats.totalScore += breakdown.totalLevelBonus;
    }

    // Award Unified Single-Currency (`JETON`) with balanced 1.0x / 1.75x / 3.0x difficulty scaling + Combo/Dominance Skill Bonus!
    const jetonPerkBonus = (this.endlessPerkStacks.get('JETON_MAGNET') ?? 0) * 0.25;
    const baseEarnedJeton = this.jetonStore.awardStageClearJeton({
      difficulty: runDiff,
      finalCapturedPercent: this.claimedPercent,
      megaCutsCount: this.megaCutsThisLevel,
      crushedMinionsCount: this.crushedMinionsThisLevel,
      noDeathClear: this.deathsThisLevel === 0,
      extraBonusRatio: jetonPerkBonus
    });
    const comboSkillJeton = this.maxComboThisLevel >= 2 ? (this.maxComboThisLevel - 1) * 3 : 0;
    const dominanceJeton =
      this.claimedPercent >= 90 ? 15 : this.claimedPercent >= spec.targetPercent + 5 ? 7 : 0;
    const singleCutJeton = clearedInSingleCut ? 20 : 0;
    const skillBonusJeton =
      (comboSkillJeton + dominanceJeton + singleCutJeton) *
      (this.jetonStore.hasPermanentDoubleJeton ? 2 : 1);
    if (skillBonusJeton > 0) {
      this.jetonStore.jetonBalance += skillBonusJeton;
    }
    this.lastEarnedJeton = baseEarnedJeton + skillBonusJeton;

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

    if (this.activeGameMode === 'ENDLESS') {
      this.endlessPerkChoices = this.polishController.rollThreeCleanPerks(
        this.endlessPerkStacks,
        this.activeRunSeed + this.currentWave * 131,
        this.lives
      );
      this.screen = 'ROGUELITE_DRAFT';
      this.persistV15State();
      StorageService.flushSyncMirror();
      return;
    }

    this.screen = 'LEVEL_CLEAR';
    this.persistV15State();
    StorageService.flushSyncMirror();
  }

  private getCurrentSkin(): ShipSkinConfig {
    const storeHull = STORE_SHIP_SKINS[this.jetonStore.equippedShipId];
    if (storeHull) return storeHull;
    const id = StorageService.getCurrent().selectedShip;
    return SHIP_SKINS.find((s) => s.id === id) ?? SHIP_SKINS[0]!;
  }

  // ============================================================================
  // ORIGINAL VOID CARVER ARCADE IN-GAME HUD (WITH ULTRA-READABLE TYPOGRAPHY!)
  // ============================================================================
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
      this.screen === 'ROGUELITE_DRAFT' ||
      this.screen === 'CONTINUE_PROMPT' ||
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

      if (this.screen === 'PLAYING' && this.polishController.resumeCountdownSec > 0) {
        this.renderGentleResumeBanner(ctx);
      }
    }

    if (this.screen !== 'PLAYING') {
      this.menuRenderer.renderScreen(ctx, this.screen, save, this.timeSeconds, {
        currentScore: this.score,
        currentWave: this.currentWave,
        isNewRecord: this.runIsNewRecord,
        clearBreakdown: this.clearBreakdown,
        adCountdown: this.adCountdown,
        statusToast: this.statusToast,
        canOfferRevive: MonetizationService.canOfferSecondChance(this.reviveUsedThisLevel),
        reviveAdLoading: this.reviveAdLoading,
        activeGameMode: this.activeGameMode,
        jetonStore: this.jetonStore,
        endlessPerkChoices: this.endlessPerkChoices,
        endlessPerkStacks: this.endlessPerkStacks,
        claimedPercent: this.claimedPercent,
        lastEarnedJeton: this.lastEarnedJeton,
        maxComboReached: this.maxComboThisLevel
      });
    } else if (this.statusToast) {
      const f = layout.arenaFrame;
      const w = Math.min(680, f.w - 32);
      const x = Math.round(f.x + (f.w - w) * 0.5);
      const y = Math.round(f.y + 62);
      ctx.save();
      ctx.fillStyle = PALETTE.PIXEL_BLACK;
      ctx.fillRect(x, y, w, 52);
      ctx.strokeStyle = PALETTE.GOLD_LIGHT;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, w - 4, 48);
      drawPixelText(ctx, this.statusToast, x + w * 0.5, y + 26, {
        scale: 3.0,
        tone: 'gold',
        align: 'center',
        maxWidth: w - 28
      });
      ctx.restore();
    }

    if (!this.firstFrameDrawn) {
      this.firstFrameDrawn = true;
      void NativeBridge.hideSplashOnceReady();
      // Request ATT & initialize AdMob safely AFTER the first active frame & splash dismissal!
      setTimeout(() => {
        void MonetizationService.prepareAdsIfEnabled();
      }, 950);
    }
  }

  private getDifficultyHudPrefix(save: ReturnType<typeof StorageService.getCurrent>): {
    prefix: string;
    isImpossible: boolean;
  } {
    return {
      prefix: DIFFICULTIES[save.difficulty].shortTr,
      isImpossible: save.difficulty === 'LEGEND'
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

  private renderArenaTopBars(ctx: CanvasRenderingContext2D): void {
    const target = Math.max(1, this.currentWaveSpec.targetPercent);
    const areaRatio = Math.max(0, Math.min(1, this.claimedPercent / target));

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

    if (this.phaseAwakeningLabel && this.phaseAwakeningTimer > 0) {
      const flashAlt = Math.floor(this.timeSeconds * 18) % 2 === 0;
      ctx.fillStyle = 'rgba(6, 8, 18, 0.92)';
      ctx.fillRect(216, ARENA_VIEW_Y + 54, 468, 48);
      ctx.strokeStyle = flashAlt ? '#FFF088' : '#FF5820';
      ctx.lineWidth = 3;
      ctx.strokeRect(216, ARENA_VIEW_Y + 54, 468, 48);
      drawPixelText(ctx, this.phaseAwakeningLabel, 450, ARENA_VIEW_Y + 78, {
        scale: 3.1,
        tone: flashAlt ? 'gold' : 'crimson',
        align: 'center',
        maxWidth: 440
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

    if (barW >= 520 && this.currentLevelPlan?.bossDisplayNameTr) {
      const bossName = this.currentLevelPlan.bossDisplayNameTr;
      const nameSc = 2.35;
      const nameW = measurePixelText(bossName, nameSc);
      ctx.fillStyle = 'rgba(4, 6, 14, 0.68)';
      ctx.fillRect(innerX + 6, innerY + 2, Math.min(maxFillW - 8, nameW + 16), innerH - 4);
      drawPixelText(ctx, bossName, innerX + 13, barY + barH * 0.5, {
        scale: nameSc,
        tone: 'white',
        align: 'left',
        maxWidth: maxFillW - 22
      });
    }

    drawPixelText(ctx, phaseText, barX + barW - 12, barY + barH * 0.5, {
      scale: 2.5,
      tone: this.activeCombatPhase === 3 ? 'crimson' : 'gold',
      align: 'right'
    });
  }

  private renderTopArcadeScoreBar(
    ctx: CanvasRenderingContext2D,
    save: ReturnType<typeof StorageService.getCurrent>
  ): void {
    ctx.save();
    ctx.fillStyle = '#03050A';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_TOP_HEIGHT);

    drawPixelText(ctx, 'SKOR', 18, 20, { scale: 3.1, tone: 'silver', align: 'left' });
    drawPixelText(ctx, String(this.score).padStart(7, '0'), 18, 54, {
      scale: 4.2,
      tone: 'white',
      align: 'left'
    });

    if (this.comboCount >= 2 && this.comboTimer > 0) {
      const cbX = 280;
      const cbY = 10;
      const cbW = 184;
      const cbH = 58;
      const hot = this.comboCount >= 4;
      ctx.fillStyle = '#080E1E';
      ctx.fillRect(cbX, cbY, cbW, cbH);
      ctx.strokeStyle = hot ? '#FF6838' : '#FFE058';
      ctx.lineWidth = 3;
      ctx.strokeRect(cbX, cbY, cbW, cbH);

      drawPixelText(ctx, `KOMBO x${this.comboCount}`, cbX + cbW * 0.5, cbY + 21, {
        scale: 2.65,
        tone: hot ? 'crimson' : 'gold',
        align: 'center',
        maxWidth: cbW - 14
      });

      const barX = cbX + 14;
      const barY = cbY + 41;
      const barW = cbW - 28;
      const barH = 9;
      const ratio = Math.max(0, Math.min(1, this.comboTimer / 7.5));
      ctx.fillStyle = '#04060C';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = hot ? '#FF5828' : '#F6C438';
      ctx.fillRect(barX + 1, barY + 1, Math.round((barW - 2) * ratio), barH - 2);
    }

    const rec = StorageService.getDifficultyRecord(save.difficulty, save);
    const displayHi = Math.max(DEFAULT_ARCADE_HIGH_SCORE, rec.highScore, this.score);
    const rekorCx = 606;
    drawPixelText(ctx, 'REKOR', rekorCx, 20, { scale: 3.1, tone: 'gold', align: 'center' });
    drawPixelText(ctx, String(displayHi).padStart(7, '0'), rekorCx, 54, {
      scale: 4.2,
      tone: 'gold',
      align: 'center'
    });

    this.renderBossVitalityStrip(ctx, 14, 78, CANVAS_WIDTH - 28, 32);
    ctx.restore();
  }

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
    const waveLabel =
      this.activeGameMode === 'ENDLESS' ? `${prefix} • DALGA ` : `${prefix} • BÖLÜM `;
    const waveNum = String(this.currentWave);
    const shownLives = Math.max(0, Math.min(this.lives, MAX_PLAYER_LIVES));
    const target = this.currentWaveSpec.targetPercent;
    const areaLabel = 'ALAN ';
    const areaVal = `%${Math.floor(this.claimedPercent)}/%${target}`;
    const shieldLabel = 'KALKAN ';
    const shieldVal = String(this.ship.getShieldUnits()).padStart(3, '0');

    let sc = 2.95;
    const shipStep = 28;
    const shipsBlockW = Math.max(24, shownLives * shipStep);
    const measureTotal = (s: number): number =>
      measurePixelText(waveLabel, s) +
      measurePixelText(waveNum, s) +
      shipsBlockW +
      measurePixelText(areaLabel, s) +
      measurePixelText(areaVal, s) +
      measurePixelText(shieldLabel, s) +
      measurePixelText(shieldVal, s) +
      3 * 22;

    const maxInnerW = CANVAS_WIDTH - 54;
    const rawW = measureTotal(sc);
    if (rawW > maxInnerW) {
      sc = Math.max(2.1, sc * (maxInnerW / rawW));
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

    drawPixelText(ctx, waveLabel, x, cy, {
      scale: sc,
      tone: isImpossible ? 'crimson' : 'silver',
      align: 'left'
    });
    x += measurePixelText(waveLabel, sc);
    drawPixelText(ctx, waveNum, x, cy, {
      scale: sc,
      tone: isImpossible ? 'crimson' : 'gold',
      align: 'left'
    });
    x += measurePixelText(waveNum, sc) + sepPad;

    drawDivider(x);
    x += 3 + sepPad;

    const miniShip = getMiniShipHudSprite();
    for (let i = 0; i < shownLives; i++) {
      blitPixelSprite(ctx, miniShip, x + 12 + i * shipStep, cy, PIXEL_SCALE * 0.92);
    }
    x += shipsBlockW + sepPad;

    drawDivider(x);
    x += 3 + sepPad;

    drawPixelText(ctx, areaLabel, x, cy, {
      scale: sc,
      tone: 'silver',
      align: 'left'
    });
    x += measurePixelText(areaLabel, sc);
    drawPixelText(ctx, areaVal, x, cy, {
      scale: sc,
      tone: this.claimedPercent >= target ? 'green' : 'gold',
      align: 'left'
    });
    x += measurePixelText(areaVal, sc) + sepPad;

    drawDivider(x);
    x += 3 + sepPad;

    drawPixelText(ctx, shieldLabel, x, cy, {
      scale: sc,
      tone: 'silver',
      align: 'left'
    });
    x += measurePixelText(shieldLabel, sc);
    drawPixelText(ctx, shieldVal, x, cy, {
      scale: sc,
      tone: this.getShieldTone(),
      align: 'left'
    });

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
    const modeLabel =
      this.activeGameMode === 'ENDLESS' ? `DALGA ${this.currentWave}` : `BÖLÜM ${this.currentWave}`;
    drawPixelText(ctx, modeLabel, lcx, lw.y + 14 + panelScale * 28, {
      scale: panelScale * 0.92,
      tone: 'white',
      align: 'center',
      maxWidth: lw.w - 36
    });
    const miniShip = getMiniShipHudSprite();
    const shownLives = Math.max(0, Math.min(this.lives, MAX_PLAYER_LIVES));
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
        `ALAN %${Math.floor(this.claimedPercent)}/%${target}`,
        this.claimedPercent >= target ? 'green' : 'gold',
        66
      ],
      ['KALKAN', 'silver', 80],
      [String(this.ship.getShieldUnits()).padStart(3, '0'), this.getShieldTone(), 91]
    ];
    for (const [text, tone, off] of lines) {
      drawPixelText(ctx, text, rx, rPanelTop + rs * off, {
        scale: rs * 0.9,
        tone,
        align: 'left',
        maxWidth: rw.w - 44
      });
    }
    ctx.restore();
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

  private renderGentleResumeBanner(ctx: CanvasRenderingContext2D): void {
    const f = getLayout().arenaFrame;
    const w = 340;
    const h = 88;
    const x = Math.round(f.x + (f.w - w) * 0.5);
    const y = Math.round(f.y + f.h * 0.44);

    ctx.save();
    ctx.fillStyle = 'rgba(6, 8, 18, 0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.GOLD_LIGHT;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(x, y, w, h);
    drawPixelText(ctx, 'HAZIR...', x + w * 0.5, y + h * 0.5, {
      scale: 4.2,
      tone: 'gold',
      align: 'center'
    });
    ctx.restore();
  }

  private renderArenaWorld(ctx: CanvasRenderingContext2D, alpha: number): void {
    const shake = this.particles.getShakeOffset();
    const skin = this.getCurrentSkin();
    const bossCannonArmed = this.ship.bossCannonTimer > 0;

    this.layerRenderer.renderUnderFloor(
      ctx,
      shake.x,
      shake.y,
      this.timeFreezeTimer,
      'FILL_DARK_GRID',
      this.timeSeconds
    );

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
    this.hazards.render(ctx, this.timeSeconds);

    for (const box of this.powerBoxes) {
      box.render(ctx, this.timeSeconds);
    }
    for (const cap of this.capsules) {
      cap.render(ctx);
    }

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
              ? '#EF4444'
              : '#FDE68A'
            : alt
              ? '#38BDF8'
              : '#FDE68A';
        ctx.lineWidth = this.activeCombatPhase >= 2 ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(Math.round(p1.x), Math.round(p1.y));
        ctx.lineTo(Math.round(p2.x), Math.round(p2.y));
        ctx.stroke();
        ctx.restore();
      }
    }

    for (const m of this.minions) {
      if (m.alive) {
        m.render(ctx, alpha, this.timeSeconds);
        m.renderSynergyOverlay(ctx, alpha, this.timeSeconds);
      }
    }
    for (const boss of this.bosses) {
      if (boss.alive) {
        boss.renderChimeraUnderlay(ctx, alpha, this.timeSeconds);
        boss.render(ctx, alpha, this.timeSeconds, bossCannonArmed);
        boss.renderChimeraOverlay(ctx, alpha, this.timeSeconds);
      }
    }
    for (const crawler of this.crawlers) {
      crawler.render(ctx, alpha, this.timeSeconds);
    }

    this.projectiles.render(ctx, alpha);

    this.renderEquippedCutTrailOverlay(ctx);

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

    const shipPos = this.ship.getRenderPosition(alpha);
    if (this.juiceSystem.powerState.hasOneHitTrailShield) {
      ctx.save();
      const pulse = 32 + Math.sin(this.timeSeconds * 10) * 3;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(Math.round(shipPos.x), Math.round(shipPos.y), pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.juiceSystem.powerState.respawnInvulnRemainingSec > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(Math.round(shipPos.x), Math.round(shipPos.y), 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const fuse of this.fuses) {
      fuse.render(ctx, alpha, this.timeSeconds);
    }

    this.particles.renderArenaEffects(ctx);

    // Wordless 5-Second First-Launch Finger Swipe Hint Animation (vanishes on first input!)
    if (
      this.screen === 'PLAYING' &&
      this.polishController.showFirstLaunchSwipeHint &&
      this.currentWave === 1 &&
      this.waveElapsedSec < 5.0
    ) {
      this.renderWordlessSwipeHint(ctx);
    }

    if (this.roundIntroTimer > 0 && this.screen === 'PLAYING') {
      const stageLabel =
        this.activeGameMode === 'CAMPAIGN'
          ? `BÖLÜM ${this.currentWave}`
          : `DALGA ${this.currentWave}`;
      const bossSubtitle = this.currentLevelPlan?.bossDisplayNameTr ?? '';
      ctx.save();
      ctx.fillStyle = 'rgba(6, 8, 16, 0.92)';
      ctx.fillRect(160, 504, 580, 150);
      ctx.strokeStyle = PALETTE.GOLD_LIGHT;
      ctx.lineWidth = 4;
      ctx.strokeRect(160, 504, 580, 150);
      drawPixelText(ctx, stageLabel, 450, 548, {
        scale: ARENA_PIXEL_SCALE * 1.65,
        tone: 'gold',
        align: 'center'
      });
      if (bossSubtitle) {
        drawPixelText(ctx, bossSubtitle, 450, 598, {
          scale: ARENA_PIXEL_SCALE * 1.0,
          tone: 'cyan',
          align: 'center',
          maxWidth: 540
        });
      }
      if (this.currentLevelPlan?.sectorNameTr) {
        drawPixelText(ctx, this.currentLevelPlan.sectorNameTr, 450, 634, {
          scale: ARENA_PIXEL_SCALE * 0.72,
          tone: 'silver',
          align: 'center',
          maxWidth: 540
        });
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Wordless animated finger-swipe tutorial ring (Stage 1 first 5 seconds; disappears on first move).
   */
  private renderWordlessSwipeHint(ctx: CanvasRenderingContext2D): void {
    const cycle = (this.timeSeconds * 0.95) % 1;
    const startY = 1090;
    const endY = 930;
    const curY = startY + (endY - startY) * cycle;
    const fade = cycle < 0.15 ? cycle / 0.15 : cycle > 0.8 ? (1 - cycle) / 0.2 : 1;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(0.88, fade));
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(450, startY);
    ctx.lineTo(450, curY);
    ctx.stroke();

    // Upward chevron
    ctx.beginPath();
    ctx.moveTo(432, endY + 22);
    ctx.lineTo(450, endY);
    ctx.lineTo(468, endY + 22);
    ctx.stroke();

    // Glowing touch circle
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(450, curY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(450, curY, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Build 15: Renders the 6 Clean Cutting Trails (`TRAILS_STORE_CATALOG`).
   */
  private renderEquippedCutTrailOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.ship.state !== 'CUTTING') return;
    const trailId = this.jetonStore.equippedTrailId;
    if (!trailId || trailId === 'TRAIL_CYAN') return;

    const trail = this.ship.getActiveTrail();
    if (trail.length < 2) return;

    const item = TRAILS_STORE_CATALOG.find((c) => c.id === trailId);
    if (!item) return;

    const phaseIdx = Math.floor(this.timeSeconds * 8) % 3;
    const prim =
      item.vfxType === 'PRISM'
        ? phaseIdx === 0
          ? '#EC4899'
          : phaseIdx === 1
            ? '#38BDF8'
            : '#A3E635'
        : item.primaryHex;
    const glow = item.glowHex;

    ctx.save();
    ctx.strokeStyle = prim;
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(trail[0]!.x, trail[0]!.y);
    for (let i = 1; i < trail.length; i++) {
      ctx.lineTo(trail[i]!.x, trail[i]!.y);
    }
    ctx.stroke();

    ctx.strokeStyle = glow;
    ctx.lineWidth = 3;
    ctx.stroke();

    for (let i = 0; i < trail.length - 1; i++) {
      const a = trail[i]!;
      const b = trail[i + 1]!;
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen < 16) continue;
      const steps = Math.min(10, Math.floor(segLen / 42));
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        const jitter =
          item.vfxType === 'LIGHTNING'
            ? Math.sin(this.timeSeconds * 24 + s * 2.5 + i) * 7
            : Math.sin(this.timeSeconds * 14 + s * 1.9 + i) * 4;
        const horiz = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
        const gx = Math.round(horiz ? px : px + jitter);
        const gy = Math.round(horiz ? py + jitter : py);
        ctx.fillStyle = s % 2 === 0 ? glow : prim;
        ctx.fillRect(gx - 3, gy - 3, 6, 6);
      }
    }
    ctx.restore();
  }
}
