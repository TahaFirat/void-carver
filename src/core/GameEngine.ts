import { SoundEngine } from '../audio/SoundEngine';
import { BaseBoss } from '../entities/bosses/BaseBoss';
import { createBossesForLevel } from '../entities/bosses/BossFactory';
import { TwinNexus } from '../entities/bosses/TwinNexus';
import { InteriorMinion } from '../entities/enemies/BaseMinion';
import { BorderCrawler } from '../entities/enemies/BorderCrawler';
import { DroneBouncer } from '../entities/enemies/DroneBouncer';
import { LineHunter } from '../entities/enemies/LineHunter';
import { PrismSplitter } from '../entities/enemies/PrismSplitter';
import { PlayerShip } from '../entities/PlayerShip';
import {
  ARMOR_PILLAR_BONUS,
  CollectiblePowerUpType,
  PowerUpBox,
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
  resolvePolygonPenetration
} from '../geometry/PolygonMath';
import { PolygonSplitter } from '../geometry/PolygonSplitter';
import { Barrier, Point } from '../geometry/Types';
import { InputManager, InputState } from '../input/InputManager';
import { LevelConfig, resolveLevelBoxes, resolveLevelShieldDuration } from '../levels/LevelDefinitions';
import {
  ESCORT_SPAWN,
  formatStageNumber,
  generateEndlessWaveConfig,
  getCampaignLevel,
  TOTAL_STAGES
} from '../levels/CampaignGenerator';
import { getLayout, pointInRect } from './ResponsiveLayout';
import { NativeBridge } from '../native/NativeBridge';
import { LayerRenderer } from '../rendering/LayerRenderer';
import { ParticlePool } from '../rendering/ParticlePool';
import {
  ARENA_PIXEL_SCALE,
  blitPixelSprite,
  drawPixelText
} from '../rendering/PixelArtEngine';
import { getMiniShipHudSprite } from '../rendering/VolfiedSprites';
import { MonetizationService } from '../services/MonetizationService';
import { StorageService } from '../services/StorageService';
import { isShipSkinId, MenuRenderer, ScreenState } from '../ui/MenuRenderer';
import {
  ARENA_HEIGHT,
  ARENA_VIEW_SCALE,
  ARENA_VIEW_X,
  ARENA_VIEW_Y,
  BASE_FUSE_SPEED,
  BASE_CUT_SPEED,
  CANVAS_WIDTH,
  DEFAULT_ARCADE_HIGH_SCORE,
  DIFFICULTIES,
  DifficultyId,
  EXTRA_LIFE_SCORE_STEP,
  HUD_BOTTOM_HEIGHT,
  HUD_BOTTOM_Y,
  HUD_TOP_HEIGHT,
  IDLE_FUSE_DELAY_SECONDS,
  INITIAL_ARENA_AREA,
  JUICE_HITSTOP_DURATION,
  JUICE_HITSTOP_THRESHOLD,
  PALETTE,
  PIXEL_SCALE,
  SHIP_SKINS,
  ShipSkinConfig
} from './Config';
import { GameLoop } from './GameLoop';
import {
  ACHIEVEMENTS,
  LevelClearBreakdown,
  LevelWinReason,
  ScoreSystem
} from './ScoreSystem';

export class GameEngine {
  public screen: ScreenState = 'MAIN_MENU';

  private readonly input = new InputManager();
  private readonly layerRenderer = new LayerRenderer();
  private readonly particles = new ParticlePool();
  private readonly projectiles = new ProjectileManager();
  private readonly ship = new PlayerShip();
  private readonly menuRenderer = new MenuRenderer();
  private readonly gameLoop: GameLoop;

  private currentLevel: LevelConfig = getCampaignLevel(1);
  private isEndlessMode = false;
  private activePolygon: Point[] = createInitialArenaPolygon();
  private activeBarriers: Barrier[] = [];
  private claimedPercent = 0;

  private bosses: BaseBoss[] = [];
  private minions: InteriorMinion[] = [];
  private crawlers: BorderCrawler[] = [];
  private powerBoxes: PowerUpBox[] = [];
  private capsules: PowerUpCapsule[] = [];
  private fuses: TrailFuse[] = [];

  private score = 0;
  private nextExtraLifeScore = EXTRA_LIFE_SCORE_STEP;
  private lives = 3;
  private timeFreezeTimer = 0;
  private crawlerSpawnTimer = 45;
  private dynamicPodTimer = 24;
  private roundIntroTimer = 0;
  private cutStallTimer = 0;
  private hesitationFuseLit = false;
  private shieldZeroBeepTimer = 0;
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
  private dirHoldDir: InputState['direction'] = null;
  private dirHoldTime = 0;
  private boxContactSfxCooldown = 0;

  constructor() {
    this.gameLoop = new GameLoop(
      (dt) => this.update(dt),
      (alpha, frameDt) => this.render(alpha, frameDt)
    );
  }

  public async boot(ctx: CanvasRenderingContext2D): Promise<void> {
    this.renderTargetCtx = ctx;

    const save = await StorageService.load();
    this.applySavedSettings();
    this.menuRenderer.setSelectedSector(save.unlockedSector);

    this.input.touch.onAutoCutToggle = () => {
      void this.handleUiAction('TOGGLE_AUTO_CUT');
    };

    SoundEngine.bindAutoUnlock();
    await MonetizationService.prepareAdsIfEnabled();

    await NativeBridge.initialize({
      onAppPause: () => {
        if (this.screen === 'PLAYING') {
          this.screen = 'PAUSED';
          this.input.resetActiveInputs();
        }
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

    const previewLvl = getCampaignLevel(save.unlockedSector);
    this.layerRenderer.initializeFloor({
      chapterTheme: previewLvl.chapterTheme,
      floorMotif: 'architectural-miter',
      stageNumber: previewLvl.id
    });

    this.applyShowcaseFromUrl();

    this.gameLoop.start();
  }

  /**
   * Store-screenshot showcase (`?shot=menu|kolay|orta|zor|usta`): boots straight into a
   * representative scene with an in-memory-only save, used by `npm run ios:screenshots`.
   */
  private applyShowcaseFromUrl(): void {
    if (typeof window === 'undefined') return;
    const shot = new URLSearchParams(window.location.search).get('shot');
    if (!shot) return;

    StorageService.persistenceDisabled = true;
    const save = StorageService.getCurrent();
    const frontier = shot === 'menu' ? 34 : shot === 'orta' ? 34 : shot === 'zor' ? 60 : shot === 'usta' ? 96 : 1;
    save.unlockedSector = Math.max(save.unlockedSector, frontier);
    for (let i = 1; i < frontier; i++) {
      save.sectors[i] = { cleared: true, stars: 1 + ((i * 7) % 3), bestPercent: 84, bestScore: 120_000 };
    }
    save.highScoreCampaign = Math.max(save.highScoreCampaign, 145_800);
    this.menuRenderer.setSelectedSector(frontier);

    if (shot === 'menu') return;
    this.startNewRun(frontier, false);
    this.roundIntroTimer = 0;
    this.score = shot === 'kolay' ? 24_600 : shot === 'orta' ? 145_800 : shot === 'zor' ? 388_200 : 912_400;

    // Pre-carve a few authentic 90-degree slices so the board looks mid-game
    const cuts: Point[][] =
      shot === 'kolay'
        ? [[{ x: 0, y: 900 }, { x: 260, y: 900 }, { x: 260, y: 1200 }]]
        : shot === 'orta'
          ? [
              [{ x: 0, y: 260 }, { x: 70, y: 260 }, { x: 70, y: 1200 }],
              [{ x: 70, y: 1040 }, { x: 330, y: 1040 }, { x: 330, y: 1200 }]
            ]
          : shot === 'zor'
            ? [
                [{ x: 900, y: 1000 }, { x: 640, y: 1000 }, { x: 640, y: 1200 }],
                [{ x: 0, y: 180 }, { x: 240, y: 180 }, { x: 240, y: 0 }]
              ]
            : [
                [{ x: 0, y: 1060 }, { x: 900, y: 1060 }],
                [{ x: 0, y: 120 }, { x: 900, y: 120 }]
              ];
    for (const trail of cuts) {
      this.processCompletedCut(trail, 1);
    }
    this.particles.clear();
    this.capsules = [];
    this.statusToast = null;
    this.statusToastTimer = 0;
    this.ship.snapOntoUpdatedPolygon(this.activePolygon);
    if (shot !== 'kolay') {
      this.ship.laserTimer = 6;
    }
  }

  public handlePointerDown(pointerId: number, vx: number, vy: number): void {
    // Pixel `❚❚` Pause button (position depends on the responsive layout)
    if (this.screen === 'PLAYING' && pointInRect(vx, vy, getLayout().pauseButton, 14)) {
      SoundEngine.playUiClick();
      this.screen = 'PAUSED';
      this.input.resetActiveInputs();
      return;
    }

    if (this.screen === 'PLAYING') {
      this.input.touch.handlePointerDown(pointerId, vx, vy, true);
      return;
    }

    const hitId = this.menuRenderer.hitTest(vx, vy);
    if (hitId) {
      SoundEngine.playUiClick();
      void this.handleUiAction(hitId);
    }
  }

  public handlePointerMove(pointerId: number, vx: number, vy: number): void {
    if (this.screen === 'PLAYING') {
      this.input.touch.handlePointerMove(pointerId, vx, vy);
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
    this.input.configure(s.controlMode, s.carveButtonMode, s.autoCut);
    SoundEngine.setVolumes(s.sfxVolume, s.ambientVolume, s.muted);
    NativeBridge.setHapticsEnabled(s.hapticsEnabled);
  }

  private showToast(msgTr: string): void {
    this.statusToast = msgTr;
    this.statusToastTimer = 2.2;
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
      this.screen = 'MAIN_MENU';
      return;
    }
    if (actionId === 'GOTO_SETTINGS') {
      this.screen = 'SETTINGS';
      return;
    }
    if (actionId === 'START_ENDLESS') {
      this.startNewRun(1, true);
      return;
    }

    if (actionId === 'CYCLE_DIFFICULTY') {
      const nextDiff: DifficultyId = save.difficulty === 'LEGEND' ? 'COMMANDER' : 'LEGEND';
      await StorageService.save((d) => {
        d.difficulty = nextDiff;
      });
      return;
    }

    if (actionId === 'CYCLE_CONTROL_MODE') {
      await StorageService.save((d) => {
        if (d.settings.controlMode === 'DPAD' && d.settings.carveButtonMode === 'HOLD') {
          d.settings.controlMode = 'DPAD';
          d.settings.carveButtonMode = 'TOGGLE';
        } else if (d.settings.controlMode === 'DPAD' && d.settings.carveButtonMode === 'TOGGLE') {
          d.settings.controlMode = 'SWIPE';
          d.settings.carveButtonMode = 'HOLD';
        } else {
          d.settings.controlMode = 'DPAD';
          d.settings.carveButtonMode = 'HOLD';
        }
      });
      this.applySavedSettings();
      return;
    }

    if (actionId === 'TOGGLE_AUTO_CUT') {
      await StorageService.save((d) => {
        d.settings.autoCut = !d.settings.autoCut;
      });
      this.applySavedSettings();
      SoundEngine.playUiClick();
      this.showToast(StorageService.getCurrent().settings.autoCut ? 'OTOMATİK KESİM AÇIK' : 'OTOMATİK KESİM KAPALI');
      return;
    }

    if (actionId.startsWith('SELECT_TIER_')) {
      const tierIdx = Number(actionId.replace('SELECT_TIER_', ''));
      if (!this.menuRenderer.setSelectedTier(tierIdx, save.unlockedSector)) {
        this.showToast('ÖNCEKİ KADEMEYİ BİTİR');
      }
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

    if (actionId.startsWith('SELECT_SECTOR_')) {
      const sectorId = Number(actionId.replace('SELECT_SECTOR_', ''));
      if (sectorId >= 1 && sectorId <= TOTAL_STAGES && sectorId <= save.unlockedSector) {
        this.menuRenderer.setSelectedSector(sectorId);
      }
      return;
    }

    if (actionId.startsWith('LAUNCH_SECTOR_')) {
      const sectorId = Number(actionId.replace('LAUNCH_SECTOR_', ''));
      // Strict sequential progression: only already-unlocked stages can be launched
      if (sectorId >= 1 && sectorId <= TOTAL_STAGES && sectorId <= save.unlockedSector) {
        this.menuRenderer.setSelectedSector(sectorId);
        this.startNewRun(sectorId, false);
      }
      return;
    }

    if (actionId.startsWith('SELECT_SHIP_')) {
      const skinId = actionId.replace('SELECT_SHIP_', '');
      if (isShipSkinId(skinId)) {
        const skin = SHIP_SKINS.find((s) => s.id === skinId);
        if (!skin) return;
        const totalStars = StorageService.getTotalStars();
        if (totalStars >= skin.starsRequired) {
          await StorageService.save((d) => {
            d.selectedShip = skinId;
          });
        } else {
          this.showToast(`${skin.starsRequired} ★ GEREKLİ`);
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

    if (actionId === 'RESTART_SECTOR') {
      if (this.lives <= 0) {
        this.startNewRun(this.currentLevel.id, this.isEndlessMode);
      } else {
        this.loadLevel(this.currentLevel.id, this.isEndlessMode);
        this.screen = 'PLAYING';
      }
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
      this.screen = 'GAME_OVER';
      return;
    }

    if (actionId === 'NEXT_SECTOR') {
      if (this.isEndlessMode) {
        this.loadLevel(this.currentLevel.id + 1, true);
        this.screen = 'PLAYING';
      } else if (this.currentLevel.id >= TOTAL_STAGES) {
        this.screen = 'CAMPAIGN_VICTORY';
      } else {
        const nextId = this.currentLevel.id + 1;
        this.menuRenderer.setSelectedSector(nextId);
        this.loadLevel(nextId, false);
        this.screen = 'PLAYING';
      }
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

  private startNewRun(startSector: number, endless: boolean): void {
    const save = StorageService.getCurrent();
    const diff = DIFFICULTIES[save.difficulty];
    this.isEndlessMode = endless;
    this.score = 0;
    this.nextExtraLifeScore = EXTRA_LIFE_SCORE_STEP;
    const firstLevel = endless ? generateEndlessWaveConfig(startSector) : getCampaignLevel(startSector);
    // V5 tier lives (KOLAY 4, others 3); the easy difficulty preset adds one bonus ship
    this.lives = firstLevel.startingLives + (diff.startingLives > 3 ? 1 : 0);

    void StorageService.save((d) => {
      d.stats.gamesPlayed += 1;
    });

    this.loadLevel(startSector, endless);
    this.screen = 'PLAYING';
  }

  private loadLevel(sectorOrWave: number, endless: boolean): void {
    const save = StorageService.getCurrent();

    this.currentLevel = endless
      ? generateEndlessWaveConfig(sectorOrWave)
      : getCampaignLevel(sectorOrWave);

    this.activePolygon = createInitialArenaPolygon();
    this.activeBarriers = getActivePerimeterBarriers(
      this.activePolygon,
      this.currentLevel.barrierSegments
    );
    this.claimedPercent = 0;

    this.layerRenderer.initializeFloor({
      chapterTheme: this.currentLevel.chapterTheme,
      floorMotif: 'architectural-miter',
      stageNumber: this.currentLevel.id,
      paletteHueShift: this.currentLevel.paletteHueShift
    });

    this.particles.clear();
    this.projectiles.clearAll();
    this.fuses = [];
    this.capsules = [];
    this.crawlers = [];
    this.clearBreakdown = null;
    this.timeFreezeTimer = 0;
    this.dynamicPodTimer = 24;
    this.roundIntroTimer = 1.0; // Clean 1-second `BÖLÜM XX` callout!
    this.cutStallTimer = 0;
    this.hesitationFuseLit = false;
    this.shieldZeroBeepTimer = 0;
    this.cutsThisLevel = 0;
    this.reviveUsedThisLevel = false;
    this.deathsThisLevel = 0;
    this.crawlerSpawnTimer = this.currentLevel.minionSetup.crawlerDelaySeconds;

    // Initialize Twin-Prong Fighter at bottom center (450, 1200)
    const shieldDuration = resolveLevelShieldDuration(this.currentLevel, save.difficulty);
    this.ship.initForLevel(
      { x: 450, y: ARENA_HEIGHT },
      shieldDuration,
      this.currentLevel.shieldUnits
    );

    // Spawn 16-bit Pixel Bosses (+ V5 escort boss on double-boss stages)
    this.bosses = createBossesForLevel(
      this.currentLevel.id,
      this.currentLevel.bossType,
      this.currentLevel.bossHp
    );
    if (this.currentLevel.escortBossType) {
      const escorts = createBossesForLevel(
        this.currentLevel.id,
        this.currentLevel.escortBossType,
        Math.max(4, Math.round(this.currentLevel.bossHp * 0.7))
      );
      escorts.forEach((e, idx) => {
        e.isEscort = true;
        e.x = ESCORT_SPAWN.x + (escorts.length > 1 ? (idx === 0 ? -50 : 50) : 0);
        e.y = ESCORT_SPAWN.y;
        e.prevX = e.x;
        e.prevY = e.y;
      });
      this.bosses.push(...escorts);
    }

    // Spawn 16-bit Pixel Minions
    this.minions = [];
    const ms = this.currentLevel.minionSetup;
    for (let i = 0; i < ms.drones; i++) {
      this.minions.push(
        new DroneBouncer(
          { x: 185 + ((i * 235) % 540), y: 265 + ((i * 195) % 510) },
          180,
          Math.PI * 0.25 + (i % 4) * (Math.PI * 0.5)
        )
      );
    }
    for (let i = 0; i < ms.hunters; i++) {
      this.minions.push(
        new LineHunter({ x: 240 + ((i * 285) % 440), y: 340 + ((i * 175) % 420) }, 168)
      );
    }
    for (let i = 0; i < ms.prisms; i++) {
      this.minions.push(
        new PrismSplitter({ x: 320 + ((i * 260) % 300), y: 380 + ((i * 210) % 320) }, false, 138)
      );
    }

    // Spawn V5 solid wall blocks (power-up walls + blind armor pillars)
    const boxDefs = resolveLevelBoxes(this.currentLevel, save.difficulty);
    this.powerBoxes = boxDefs.map((cfg) => new PowerUpBox(cfg));
    this.syncSolidBoxes();
    this.dirHoldDir = null;
    this.dirHoldTime = 0;

    this.input.resetActiveInputs();
  }

  /** Pushes the live (uncollected) wall blocks to the ship's collision list. */
  private syncSolidBoxes(): void {
    this.ship.solidBoxes = this.powerBoxes.filter((b) => !b.collected);
  }

  private getActiveSolidBoxes(): PowerUpBox[] {
    return this.powerBoxes.filter((b) => !b.collected);
  }

  /** Bosses that decide the stage (escorts are optional extra threats). */
  private getPrimaryBosses(): BaseBoss[] {
    return this.bosses.filter((b) => !b.isEscort);
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

    const save = StorageService.getCurrent();
    if (!this.isEndlessMode && this.score > save.highScoreCampaign) {
      save.highScoreCampaign = this.score;
    } else if (this.isEndlessMode && this.score > save.highScoreEndless) {
      save.highScoreEndless = this.score;
    }
  }

  private update(dt: number): void {
    this.timeSeconds += dt;
    this.particles.update(dt);

    if (this.roundIntroTimer > 0) {
      this.roundIntroTimer = Math.max(0, this.roundIntroTimer - dt);
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

    // Debug quick stage shortcut (dev server only — never skips progression in store builds)
    if (input.debugSectorSelect !== null && import.meta.env.DEV) {
      this.menuRenderer.setSelectedSector(input.debugSectorSelect);
      this.startNewRun(input.debugSectorSelect, false);
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
    const lvl = this.currentLevel;
    const bossSpeedScale = diff.enemySpeedMultiplier * lvl.bossSpeedMultiplier;
    const minionSpeedScale = diff.enemySpeedMultiplier * lvl.minionSpeedMultiplier;

    // V5 `[OTOMATİK]` one-hand mode: holding the inward arrow for 0.10s starts a cut without `KES`
    if (input.direction !== null && input.direction === this.dirHoldDir) {
      this.dirHoldTime += dt;
    } else {
      this.dirHoldDir = input.direction;
      this.dirHoldTime = 0;
    }
    if (
      save.settings.autoCut &&
      !input.carveHeld &&
      this.ship.state === 'ON_BORDER' &&
      input.direction !== null &&
      this.dirHoldTime >= 0.1 &&
      input.direction === this.ship.getInwardBorderDirection(this.activePolygon)
    ) {
      input.carveHeld = true;
    }

    // 1. Update Twin-Prong Fighter & Check Cut Completion
    this.syncSolidBoxes();
    const prevX = this.ship.x;
    const prevY = this.ship.y;
    const completedCut = this.ship.update(dt, input, this.activePolygon, this.activeBarriers);
    const movedDist = Math.hypot(this.ship.x - prevX, this.ship.y - prevY);

    if (this.ship.turnedCornerThisStep) {
      SoundEngine.playCornerClick();
    }

    // Metallic tick + 2 sparks when the cutting ship bumps a solid wall block
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

    // 3-Second `KALKAN 000` Warning Beep before perimeter shield drops!
    if (this.ship.state === 'ON_BORDER' && this.ship.isShieldInZeroWarning()) {
      this.shieldZeroBeepTimer -= dt;
      if (this.shieldZeroBeepTimer <= 0) {
        this.shieldZeroBeepTimer = 0.42;
        SoundEngine.playShieldZeroWarning();
      }
    } else {
      this.shieldZeroBeepTimer = 0;
    }

    if (this.ship.state === 'CUTTING') {
      if (movedDist > 0.25) {
        SoundEngine.playLaserCutLoop(this.ship.getActiveTrailLength(), this.ship.isBacktracking);
        this.cutStallTimer = 0;
      } else {
        SoundEngine.stopLaserCutLoop();
        this.cutStallTimer += dt;
      }

      // Authentic `3.5s` Hesitation Spark when stationary on own incomplete cut line!
      const activeTrailNow = this.ship.getActiveTrail();
      if (
        !this.hesitationFuseLit &&
        activeTrailNow.length >= 2 &&
        this.cutStallTimer >= IDLE_FUSE_DELAY_SECONDS
      ) {
        this.hesitationFuseLit = true;
        this.fuses.push(new TrailFuse(0, activeTrailNow));
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

    // Auto-Fire Twin Laser (`L`) or 3-Way Super Plasma (`★`) while on safe green border!
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
      this.processCompletedCut(completedCut.trail, diff.scoreMultiplier);
      if (this.screen !== 'PLAYING') {
        return;
      }
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

    // Periodic Mystery Wall Block Spawner (KOLAY/ORTA only; never while a cut line is open,
    // so a new wall can never appear on top of the active trail)
    if (lvl.tierIndex <= 1 && this.ship.state === 'ON_BORDER') {
      this.dynamicPodTimer -= dt;
      if (this.dynamicPodTimer <= 0) {
        this.dynamicPodTimer = 24;
        const remainingPods = this.powerBoxes.filter((p) => !p.collected).length;
        if (remainingPods < 2) {
          this.trySpawnDynamicMysteryPod();
        }
      }
    }

    // 2. Update Time Freeze timer
    const timeFrozen = this.timeFreezeTimer > 0;
    if (this.timeFreezeTimer > 0) {
      this.timeFreezeTimer = Math.max(0, this.timeFreezeTimer - dt);
    }

    const activeTrail = this.ship.getActiveTrail();

    // 3. Update Bosses, Minions, Spike Mines & Plasma Sparks
    if (!timeFrozen) {
      const spawnedMinions: InteriorMinion[] = [];
      let pocketCrushTriggered = false;

      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        boss.update({
          dt,
          timeSeconds: this.timeSeconds,
          activePolygon: this.activePolygon,
          claimedPercent: this.claimedPercent,
          playerPos: { x: this.ship.x, y: this.ship.y },
          playerState: this.ship.state,
          activeTrail,
          speedScale: bossSpeedScale,
          projectiles: this.projectiles,
          summonMinion: (m) => spawnedMinions.push(m),
          currentMinionCount: this.minions.length + spawnedMinions.length
        });

        // V5: bosses bounce elastically off solid wall blocks
        bounceCircleOffSolidBoxes(boss, boss.boundingRadius * 0.8, this.getActiveSolidBoxes());

        if (!boss.alive && boss.crushedInPocket) {
          pocketCrushTriggered = true;
          SoundEngine.playBossHit(false);
          this.particles.spawnShockwave(boss.x, boss.y, 480, '#FFE058', 0.5);
          this.particles.spawnBurst(boss.x, boss.y, 36, PALETTE.CUT_ORANGE, 80, 280, 8, 0.45);
        }
      }

      // Check `1.8s` Pocket Crush instant victory (escort bosses do not count)!
      if (pocketCrushTriggered && this.getPrimaryBosses().every((b) => !b.alive)) {
        save.stats.bossesDestroyed += 1;
        this.tryUnlockAchievement('BOSS_SLAYER');
        this.triggerLevelVictory('BOSS_DESTROYED');
        return;
      }

      for (const m of this.minions) {
        if (!m.alive) continue;
        m.update({
          dt,
          activePolygon: this.activePolygon,
          playerState: this.ship.state,
          playerPos: { x: this.ship.x, y: this.ship.y },
          activeTrail,
          speedScale: minionSpeedScale,
          projectiles: this.projectiles,
          spawnChildMinion: (child) => spawnedMinions.push(child),
          currentMinionCount: this.minions.length + spawnedMinions.length
        });
        bounceCircleOffSolidBoxes(m, m.radius, this.getActiveSolidBoxes());
      }

      if (spawnedMinions.length > 0) {
        this.minions.push(...spawnedMinions);
      }

      // Spawn Spike Mine (`BorderCrawler`) on border after delay
      this.crawlerSpawnTimer -= dt;
      if (this.crawlerSpawnTimer <= 0 && this.crawlers.length < 2) {
        this.crawlerSpawnTimer = 38;
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
          dt,
          this.activePolygon,
          { x: this.ship.x, y: this.ship.y },
          minionSpeedScale
        );
      }

      // Update active Plasma Spark Fuses (tier ratio x 300 px/s cut speed; `S` outruns KOLAY/ORTA sparks)
      if (this.ship.state === 'CUTTING' && activeTrail.length >= 2) {
        const diffFuseAdj = diff.fuseSpeedMultiplier / (BASE_FUSE_SPEED / BASE_CUT_SPEED);
        const fuseSpeed = BASE_CUT_SPEED * lvl.fuseSpeedRatio * diffFuseAdj;
        for (const fuse of this.fuses) {
          const res = fuse.update(dt, activeTrail, fuseSpeed);
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

    // 4. Update Projectiles & Check All Collisions
    this.projectiles.update(dt, this.activePolygon, timeFrozen);
    this.resolveProjectileWallImpacts();
    this.evaluateCombatAndHazards();
  }

  /**
   * Projectiles can never pass through solid wall blocks: they burst with a metallic spark.
   * On ZOR/USTA tiers enemy plasma orbs ricochet once instead (walls double as cover!).
   */
  private resolveProjectileWallImpacts(): void {
    const boxes = this.getActiveSolidBoxes();
    if (boxes.length === 0) return;

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
      if (this.currentLevel.bulletsRicochet && eb.ricochets < 1) {
        eb.ricochets += 1;
        bounceCircleOffSolidBoxes(eb, eb.radius, boxes);
      } else {
        eb.active = false;
        this.particles.spawnBurst(eb.x, eb.y, 4, '#C8D2E4', 30, 110, 4, 0.16);
      }
    }
  }

  private trySpawnDynamicMysteryPod(): void {
    const pool: PowerUpType[] = ['S', 'T', 'P', 'L', 'C', 'BOSS_CANNON'];
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    for (let attempt = 0; attempt < 24; attempt++) {
      const cand = {
        x: Math.round((140 + Math.random() * 620) / 10) * 10,
        y: Math.round((170 + Math.random() * 860) / 10) * 10
      };
      if (!pointInPolygonStrict(cand, this.activePolygon)) continue;
      // Keep the whole wall block (+ ship corridor) safely inside the uncut field
      const safe = resolvePolygonPenetration(cand, SOLID_BOX_HALF * 1.5 + 60, this.activePolygon);
      if (Math.hypot(safe.position.x - cand.x, safe.position.y - cand.y) > 4) continue;
      // Respect the safe-corridor spacing from other walls, the ship and every enemy
      const clashBox = this.getActiveSolidBoxes().some(
        (b) => Math.max(Math.abs(b.x - cand.x), Math.abs(b.y - cand.y)) < 160
      );
      if (clashBox) continue;
      if (Math.hypot(this.ship.x - cand.x, this.ship.y - cand.y) < 160) continue;
      const clashEnemy =
        this.bosses.some((b) => b.alive && Math.hypot(b.x - cand.x, b.y - cand.y) < b.boundingRadius + 70) ||
        this.minions.some((m) => m.alive && Math.hypot(m.x - cand.x, m.y - cand.y) < m.radius + 60);
      if (clashEnemy) continue;

      this.powerBoxes.push(new PowerUpBox({ x: cand.x, y: cand.y, type: chosen, blinking: true }));
      this.particles.spawnShockwave(cand.x, cand.y, 48, '#50E8FF', 0.28);
      return;
    }
  }

  private processCompletedCut(trail: readonly Point[], diffMultiplier: number): void {
    this.fuses = [];
    this.cutStallTimer = 0;
    this.hesitationFuseLit = false;

    const split = PolygonSplitter.split(this.activePolygon, trail);
    if (!split) return;

    this.cutsThisLevel += 1;

    const aliveBossPositions = this.getPrimaryBosses()
      .filter((b) => b.alive)
      .map((b) => b.position);
    const classified = PolygonSplitter.classifySplit(split, aliveBossPositions);

    const prevPercent = this.claimedPercent;
    this.activePolygon = classified.activePolygon;
    this.activeBarriers = getActivePerimeterBarriers(
      this.activePolygon,
      this.currentLevel.barrierSegments
    );

    const remainingArea = computeArea(this.activePolygon);
    this.claimedPercent = Math.min(
      99.9,
      Math.max(0, ((INITIAL_ARENA_AREA - remainingArea) / INITIAL_ARENA_AREA) * 100)
    );
    const percentDelta = Math.max(0.1, this.claimedPercent - prevPercent);

    // Snap entities cleanly onto updated perimeter
    this.ship.snapOntoUpdatedPolygon(this.activePolygon);
    for (const c of this.crawlers) {
      c.snapOntoUpdatedPolygon(this.activePolygon);
    }
    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      if (boss.isEscort && !pointInPolygonStrict(boss.position, this.activePolygon)) {
        // Escort boss sealed inside the conquered slice -> crushed for a big bonus
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

    // Pixel Shrapnel, Synth Sweep & Tactile Haptics
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

    // Award Cut Score
    const cutScore = ScoreSystem.computeCutScore(percentDelta, diffMultiplier);
    this.addScore(cutScore.points);
    this.particles.spawnFloatingText(
      this.ship.x,
      this.ship.y - 26,
      `+${cutScore.points}`,
      cutScore.isBigCut ? '#FFD040' : '#FFFFFF',
      cutScore.isBigCut ? 28 : 22
    );

    // Crush Alien Beetles/Pods trapped inside captured region!
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

    // Clear enemy bullets trapped outside activePolygon
    for (const eb of this.projectiles.enemyBullets) {
      if (eb.active && !pointInPolygonStrict({ x: eb.x, y: eb.y }, this.activePolygon)) {
        eb.active = false;
      }
    }

    // Burst open enclosed solid wall blocks: power walls launch a capsule, armor pillars pay +5.000
    for (const box of this.powerBoxes) {
      if (box.collected) continue;
      if (!pointInPolygonStrict(box.center, this.activePolygon)) {
        box.collected = true;
        const resolved = box.resolveType(this.timeSeconds);
        if (resolved === 'ARMOR_PILLAR') {
          this.addScore(ARMOR_PILLAR_BONUS);
          this.particles.spawnBurst(box.x, box.y, 18, '#C8D2E4', 55, 200, 7, 0.32);
          this.particles.spawnFloatingText(box.x, box.y, `+${ARMOR_PILLAR_BONUS}`, '#FFFFFF', 22);
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

    // Check Special Dual-Boss Separation Win (`TWIN_SPLIT`)!
    if (classified.outcome === 'TWIN_BOSS_SEPARATED') {
      save.stats.twinSplits += 1;
      this.tryUnlockAchievement('TWIN_SPLITTER');
      this.triggerLevelVictory('TWIN_SPLIT');
      return;
    }

    // Check tier target (`%80` / `%82` / `%85` / `%88` / `%90`) Territory Liberation Win!
    if (this.claimedPercent >= this.currentLevel.targetPercent) {
      this.triggerLevelVictory('AREA_THRESHOLD');
    }
  }

  /**
   * Applies collected `PowerUpCapsule` with ultra-clean 1-word Turkish pixel callouts:
   * `HIZ`, `DONDUR`, `KALKAN`, `LAZER`, `TEMİZLE`, `SÜPER ATIŞ`!
   */
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
        this.timeFreezeTimer = 10.0;
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
    // 1. Player Twin Lasers (`L`) & 3-Way Super Plasma (`★`) vs Enemy Bullets, Minions & Bosses
    for (const bolt of this.projectiles.playerBolts) {
      if (!bolt.active) continue;

      // Player bolts also shoot down incoming enemy plasma orbs!
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

    // 2. Enemy Trail Touch -> Ignite Plasma Spark Fuse!
    const activeTrail = this.ship.getActiveTrail();
    if (this.ship.state === 'CUTTING' && activeTrail.length >= 2 && this.timeFreezeTimer <= 0) {
      const checkTrailIgnite = (ex: number, ey: number, er: number): void => {
        const proj = projectPointToPolyline({ x: ex, y: ey }, activeTrail);
        if (proj.distance <= er + 4) {
          const alreadyLit = this.fuses.some((f) => f.arcDistance >= proj.arcLength - 36);
          if (!alreadyLit) {
            this.fuses.push(new TrailFuse(proj.arcLength, activeTrail));
            SoundEngine.playFuseAlarm();
            this.particles.spawnBurst(
              proj.point.x,
              proj.point.y,
              10,
              PALETTE.CUT_ORANGE,
              45,
              155,
              5,
              0.24
            );
          }
        }
      };

      for (const boss of this.bosses) {
        if (!boss.alive) continue;
        for (const c of boss.getHitCircles()) {
          checkTrailIgnite(c.x, c.y, c.radius);
        }
      }
      for (const m of this.minions) {
        if (m.alive) {
          checkTrailIgnite(m.x, m.y, m.radius);
        }
      }
    }

    // 3. Direct Hazards vs Player Ship
    if (this.ship.invulnerableTimer > 0) return;

    const shipRadius = 12;

    // 3a. Spike Mines (`BorderCrawler`): deflected while Circular Shield is active, lethal when shield hits 0!
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

    // 3b. Bosses & Minions vs Player Ship
    for (const boss of this.bosses) {
      if (!boss.alive) continue;
      for (const hc of boss.getHitCircles()) {
        if (Math.hypot(hc.x - this.ship.x, hc.y - this.ship.y) <= shipRadius + hc.radius) {
          if (this.ship.isPerimeterShieldActive()) {
            this.ship.shieldHitFlash = 0.24;
            SoundEngine.playShieldDeflect();
          } else {
            this.killPlayerShip();
            return;
          }
        }
      }
    }

    for (const m of this.minions) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - this.ship.x, m.y - this.ship.y) <= shipRadius + m.radius) {
        if (this.ship.isPerimeterShieldActive()) {
          this.ship.shieldHitFlash = 0.24;
          SoundEngine.playShieldDeflect();
          m.vx = -m.vx;
          m.vy = -m.vy;
        } else {
          this.killPlayerShip();
          return;
        }
      }
    }

    // 3c. Enemy Plasma Orbs vs Player Ship
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
    this.deathsThisLevel += 1;
    this.lives -= 1;

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

    SoundEngine.playLevelClear();
    NativeBridge.hapticPolygonShatter(30);

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
      this.claimedPercent >= this.currentLevel.targetPercent;

    const breakdown = ScoreSystem.computeLevelClearBreakdown(
      reason,
      this.claimedPercent,
      this.ship.getShieldUnits(),
      diff.scoreMultiplier * (1 + this.currentLevel.tierIndex * 0.25),
      clearedInSingleCut,
      this.currentLevel.targetPercent
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

    if (!this.isEndlessMode) {
      const sid = this.currentLevel.id;
      if (sid >= 50) this.tryUnlockAchievement('MIDWAY_HERO');
      if (sid >= TOTAL_STAGES) this.tryUnlockAchievement('SECTOR_80_SAVIOR');

      const recordedPct =
        reason === 'TWIN_SPLIT' || reason === 'BOSS_DESTROYED'
          ? 100
          : Math.round(this.claimedPercent * 10) / 10;

      void StorageService.save((d) => {
        const prev = d.sectors[sid] ?? {
          cleared: false,
          stars: 0,
          bestPercent: 0,
          bestScore: 0
        };
        d.sectors[sid] = {
          cleared: true,
          stars: Math.max(prev.stars, breakdown.stars),
          bestPercent: Math.max(prev.bestPercent, recordedPct),
          bestScore: Math.max(prev.bestScore, this.score)
        };
        // Strict sequential unlock: clearing stage N opens exactly N+1 (and the next tier at 25/50/75)
        if (sid < TOTAL_STAGES && d.unlockedSector <= sid) {
          d.unlockedSector = sid + 1;
        }
        d.stats.totalScore += breakdown.totalLevelBonus;
        if (this.score > d.highScoreCampaign) {
          d.highScoreCampaign = this.score;
        }
      });
    } else {
      void StorageService.save((d) => {
        if (this.currentLevel.id > d.bestEndlessWave) {
          d.bestEndlessWave = this.currentLevel.id;
        }
        if (this.score > d.highScoreEndless) {
          d.highScoreEndless = this.score;
        }
      });
    }

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
      ctx.restore();

      if (layout.topBarOffset && layout.statusOffset) {
        ctx.save();
        ctx.translate(layout.topBarOffset.x, layout.topBarOffset.y);
        this.renderTopArcadeScoreBar(ctx, save);
        ctx.restore();

        ctx.save();
        ctx.translate(layout.statusOffset.x, layout.statusOffset.y);
        this.renderBottomArcadeStatusBar(ctx);
        ctx.restore();
      } else {
        this.renderLandscapeHud(ctx, save);
      }

      this.input.touch.renderControls(ctx, this.ship.state === 'CUTTING');
      this.renderPauseButton(ctx);
    }

    if (this.screen !== 'PLAYING') {
      this.menuRenderer.renderScreen(ctx, this.screen, save, this.timeSeconds, {
        currentScore: this.score,
        currentSector: this.currentLevel.id,
        isEndless: this.isEndlessMode,
        clearBreakdown: this.clearBreakdown,
        adCountdown: this.adCountdown,
        statusToast: this.statusToast
      });
    } else if (this.statusToast) {
      const f = layout.arenaFrame;
      const w = Math.min(600, f.w - 40);
      const x = f.x + (f.w - w) * 0.5;
      const y = f.y + 24;
      ctx.save();
      ctx.fillStyle = PALETTE.PIXEL_BLACK;
      ctx.fillRect(x, y, w, 48);
      ctx.strokeStyle = PALETTE.GOLD_LIGHT;
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, w - 4, 44);
      drawPixelText(ctx, this.statusToast, x + w * 0.5, y + 24, {
        scale: 2.5,
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

  private getStageLabel(): string {
    if (this.isEndlessMode) {
      return `DALGA ${String(this.currentLevel.id).padStart(3, '0')}`;
    }
    return `BÖLÜM ${formatStageNumber(this.currentLevel.id)}`;
  }

  private getShieldTone(): 'white' | 'green' | 'red' | 'gold' {
    const shieldUnits = this.ship.getShieldUnits();
    const inZeroGrace = this.ship.isShieldInZeroWarning();
    const lowWarning = shieldUnits < 150 || inZeroGrace;
    const blinkAlt = Math.floor(this.timeSeconds * 12) % 2 === 0;
    if (shieldUnits === 0 && !inZeroGrace) return 'red';
    if (this.ship.shieldLockTimer > 0) return 'green';
    if (lowWarning) return blinkAlt ? 'red' : 'gold';
    return 'white';
  }

  private renderPauseButton(ctx: CanvasRenderingContext2D): void {
    const r = getLayout().pauseButton;
    const pw = Math.min(66, r.w - 8);
    const ph = Math.min(54, r.h - 8);
    const px = Math.round(r.x + (r.w - pw) * 0.5);
    const py = Math.round(r.y + (r.h - ph) * 0.5);
    ctx.save();
    ctx.fillStyle = PALETTE.PIXEL_BLACK;
    ctx.fillRect(px - 3, py - 3, pw + 6, ph + 6);
    ctx.fillStyle = '#94A6C4';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#182238';
    ctx.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    ctx.fillStyle = '#FFFFFF';
    const barH = Math.round(ph * 0.45);
    ctx.fillRect(Math.round(px + pw * 0.3), Math.round(py + (ph - barH) * 0.5), 8, barH);
    ctx.fillRect(Math.round(px + pw * 0.58), Math.round(py + (ph - barH) * 0.5), 8, barH);
    ctx.restore();
  }

  /** Landscape 3-column cabinet: riveted dark steel side wings. */
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

  /**
   * Landscape HUD (`03-hedef-ipad-ve-yatay-responsive.jpg`):
   * left wing: tier • stage + ships, right wing: score / record / target / shield.
   */
  private renderLandscapeHud(
    ctx: CanvasRenderingContext2D,
    save: ReturnType<typeof StorageService.getCurrent>
  ): void {
    const layout = getLayout();
    const lw = layout.leftWing;
    const rw = layout.rightWing;
    if (!lw || !rw) return;

    const panelScale = Math.max(2.2, Math.min(4, lw.w / 95));

    // Left wing info panel
    ctx.save();
    const lPanelH = panelScale * 62;
    ctx.fillStyle = '#05070C';
    ctx.fillRect(lw.x + 14, lw.y + 14, lw.w - 28, lPanelH);
    ctx.strokeStyle = '#364460';
    ctx.lineWidth = 3;
    ctx.strokeRect(lw.x + 14, lw.y + 14, lw.w - 28, lPanelH);
    const lcx = lw.x + lw.w * 0.5;
    drawPixelText(ctx, this.isEndlessMode ? 'SONSUZ' : `${this.currentLevel.tier} •`, lcx, lw.y + 14 + panelScale * 12, {
      scale: panelScale,
      tone: 'crimson',
      align: 'center'
    });
    drawPixelText(ctx, this.getStageLabel(), lcx, lw.y + 14 + panelScale * 28, {
      scale: panelScale,
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
        lw.y + 14 + panelScale * 46,
        Math.max(2, Math.round(panelScale * 0.9))
      );
    }

    // Right wing stats panel
    const rs = Math.max(2.2, Math.min(4, rw.w / 95));
    const rPanelTop = layout.pauseButton.y + layout.pauseButton.h + 12;
    const rPanelH = rs * 96;
    ctx.fillStyle = '#05070C';
    ctx.fillRect(rw.x + 14, rPanelTop, rw.w - 28, rPanelH);
    ctx.strokeRect(rw.x + 14, rPanelTop, rw.w - 28, rPanelH);
    const rx = rw.x + 30;
    const rawBest = this.isEndlessMode ? save.highScoreEndless : save.highScoreCampaign;
    const displayHi = Math.max(DEFAULT_ARCADE_HIGH_SCORE, rawBest, this.score);
    const lines: Array<[string, 'white' | 'gold' | 'green' | 'red' | 'cyan' | 'silver', number]> = [
      ['SKOR', 'gold', 10],
      [String(this.score).padStart(7, '0'), 'white', 22],
      ['REKOR', 'red', 38],
      [String(displayHi).padStart(7, '0'), 'gold', 50],
      [
        `${this.claimedPercent.toFixed(1)}% / ${this.currentLevel.targetPercent}%`,
        this.claimedPercent >= this.currentLevel.targetPercent ? 'green' : 'white',
        66
      ],
      ['KALKAN', 'cyan', 80],
      [String(this.ship.getShieldUnits()).padStart(3, '0'), this.getShieldTone(), 91]
    ];
    for (const [text, tone, off] of lines) {
      drawPixelText(ctx, text, rx, rPanelTop + rs * off, { scale: rs * 0.95, tone, align: 'left' });
    }
    ctx.restore();
  }

  private renderArenaWorld(ctx: CanvasRenderingContext2D, alpha: number): void {
    const shake = this.particles.getShakeOffset();
    const skin = this.getCurrentSkin();
    const bossCannonArmed = this.ship.bossCannonTimer > 0;

    // 1. Next Stage Terrain (`70%` brightness) + 3D Gold-Silver Pixel Frame (`01-hedef-oynanis.jpg`!)
    this.layerRenderer.renderUnderFloor(ctx, shake.x, shake.y, this.timeFreezeTimer);

    // Enter Cuttable Playfield Space (`ARENA_VIEW_X = 45, ARENA_VIEW_Y = 116, scale = 0.9`)
    ctx.save();
    ctx.translate(ARENA_VIEW_X + shake.x, ARENA_VIEW_Y + shake.y);
    ctx.scale(ARENA_VIEW_SCALE, ARENA_VIEW_SCALE);

    // 2. Current 16-Bit Planetary Stage Clipped to `activePolygon` + Bright Green `#28E038` Safe Border!
    this.layerRenderer.renderUncutSlab(ctx, this.activePolygon, this.timeFreezeTimer);

    // 3. Red-and-Silver Diagonal Striped Perimeter Barriers
    this.layerRenderer.renderSteelBarriers(ctx, this.activeBarriers);

    // 4. Red-Ruby Energy Blocks + Homing Letter Capsules
    for (const box of this.powerBoxes) {
      box.render(ctx, this.timeSeconds);
    }
    for (const cap of this.capsules) {
      cap.render(ctx);
    }

    // 5. Pixel Energy Tether between Twin Split Halves when nearby
    if (
      this.bosses.length === 2 &&
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
        ctx.strokeStyle = Math.floor(this.timeSeconds * 16) % 2 === 0 ? '#50E8FF' : '#FFF088';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(Math.round(p1.x), Math.round(p1.y));
        ctx.lineTo(Math.round(p2.x), Math.round(p2.y));
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. 16-Bit Pixel Minions, Bosses & Border Spike Mines
    for (const m of this.minions) {
      if (m.alive) m.render(ctx, alpha, this.timeSeconds);
    }
    for (const boss of this.bosses) {
      if (boss.alive) boss.render(ctx, alpha, this.timeSeconds, bossCannonArmed);
    }
    for (const crawler of this.crawlers) {
      crawler.render(ctx, alpha, this.timeSeconds);
    }

    // 7. Pixel Lasers, 3-Way Super Plasma & Enemy Orbs
    this.projectiles.render(ctx, alpha);

    // 8. Twin-Prong Pixel Ship, Circular Green/Red Forcefield, Entry Arrow & Orange Cut Line!
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

    // 9. Pixel Plasma Spark Fuses
    for (const fuse of this.fuses) {
      fuse.render(ctx, alpha, this.timeSeconds);
    }

    // 10. Pixel Explosions & Score Popups
    this.particles.renderArenaEffects(ctx);

    // 11. Ultra-Clean 1-Second `BÖLÜM 01` Start Callout (`01-SADE-ARCADE-MENU-VE-HUD-DUZENI.md`!)
    if (this.roundIntroTimer > 0 && this.screen === 'PLAYING') {
      const stageLabel = this.getStageLabel();
      ctx.save();
      ctx.fillStyle = 'rgba(6, 8, 16, 0.88)';
      ctx.fillRect(250, 535, 400, 96);
      ctx.strokeStyle = PALETTE.GOLD_LIGHT;
      ctx.lineWidth = 4;
      ctx.strokeRect(250, 535, 400, 96);
      drawPixelText(ctx, stageLabel, 450, 583, {
        scale: ARENA_PIXEL_SCALE * 1.35,
        tone: 'gold',
        align: 'center'
      });
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Portrait top score strip (legacy column `y: 0..86`): `SKOR` | `REKOR` (pause drawn separately).
   */
  private renderTopArcadeScoreBar(
    ctx: CanvasRenderingContext2D,
    save: ReturnType<typeof StorageService.getCurrent>
  ): void {
    ctx.save();
    ctx.fillStyle = '#03050A';
    ctx.fillRect(0, 0, CANVAS_WIDTH, HUD_TOP_HEIGHT);

    drawPixelText(ctx, 'SKOR', 38, 24, { scale: 2.5, tone: 'silver', align: 'left' });
    drawPixelText(ctx, String(this.score).padStart(7, '0'), 38, 60, {
      scale: 3.4,
      tone: 'white',
      align: 'left'
    });

    const rawBest = this.isEndlessMode ? save.highScoreEndless : save.highScoreCampaign;
    const displayHi = Math.max(DEFAULT_ARCADE_HIGH_SCORE, rawBest, this.score);
    drawPixelText(ctx, 'REKOR', CANVAS_WIDTH * 0.5, 24, { scale: 2.5, tone: 'gold', align: 'center' });
    drawPixelText(ctx, String(displayHi).padStart(7, '0'), CANVAS_WIDTH * 0.5, 60, {
      scale: 3.4,
      tone: 'gold',
      align: 'center'
    });
    ctx.restore();
  }

  /**
   * Portrait single-row status strip (legacy `y: 1230..1288`):
   * `ORTA • BÖLÜM 034` | ships | `68.5% / 82%` | `KALKAN 760`
   */
  private renderBottomArcadeStatusBar(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const stripX = 18;
    const stripW = CANVAS_WIDTH - 36;
    const cy = HUD_BOTTOM_Y + HUD_BOTTOM_HEIGHT * 0.5;

    ctx.fillStyle = '#04060D';
    ctx.fillRect(stripX, HUD_BOTTOM_Y, stripW, HUD_BOTTOM_HEIGHT);
    ctx.strokeStyle = '#364460';
    ctx.lineWidth = 3;
    ctx.strokeRect(stripX, HUD_BOTTOM_Y, stripW, HUD_BOTTOM_HEIGHT);

    const stage = this.isEndlessMode
      ? this.getStageLabel()
      : `${this.currentLevel.tier} • ${this.getStageLabel()}`;
    drawPixelText(ctx, stage, 32, cy, { scale: 2.1, tone: 'white', align: 'left' });

    const miniShip = getMiniShipHudSprite();
    const shownLives = Math.max(0, Math.min(this.lives, 4));
    for (let i = 0; i < shownLives; i++) {
      blitPixelSprite(ctx, miniShip, 312 + i * 26, cy, PIXEL_SCALE);
    }

    const target = this.currentLevel.targetPercent;
    drawPixelText(ctx, `${this.claimedPercent.toFixed(1)}%`, 508, cy, {
      scale: 2.7,
      tone: this.claimedPercent >= target ? 'green' : 'gold',
      align: 'center'
    });
    drawPixelText(ctx, `/ ${target}%`, 612, cy, { scale: 2.0, tone: 'silver', align: 'center' });

    const shieldStr = String(this.ship.getShieldUnits()).padStart(3, '0');
    drawPixelText(ctx, `KALKAN ${shieldStr}`, CANVAS_WIDTH - 30, cy, {
      scale: 2.1,
      tone: this.getShieldTone(),
      align: 'right'
    });
    ctx.restore();
  }
}
