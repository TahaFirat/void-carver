import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  CampaignSaveData,
  createDefaultCampaignSave,
  GameDifficulty
} from '../core/CampaignProgressionV12';
import {
  CleanJetonEconomyAndStore,
  SHIPS_STORE_CATALOG,
  TRAILS_STORE_CATALOG
} from '../core/CleanJetonEconomyAndStore';
import { DifficultyId, SHIP_SKINS, ShipSkinConfig, ShipSkinId } from '../core/Config';
import type { ControlScheme } from '../input/TouchGestureEngine';
import type { RunDifficulty } from '../levels/EndlessBossDirector';

export type ControlMode = ControlScheme;
export type CarveButtonMode = 'HOLD' | 'TOGGLE';
export type JoystickSide = 'LEFT' | 'CENTER' | 'RIGHT';
export type LanguageCode = 'TR' | 'EN';

export interface SectorProgress {
  cleared: boolean;
  stars: number; // 0..3
  bestPercent: number;
  bestScore: number;
}

export interface DifficultyPersonalRecord {
  highScore: number;
  bestWave: number;
}

export interface PlayerSettings {
  controlMode: ControlMode;
  carveButtonMode: CarveButtonMode;
  joystickSide: JoystickSide;
  sfxVolume: number; // 0..1
  ambientVolume: number; // 0..1
  muted: boolean;
  hapticsEnabled: boolean;
  language: LanguageCode;
  autoCut: boolean;
}

export interface LifetimeStats {
  totalScore: number;
  totalCuts: number;
  biggestSingleCut: number;
  bossesDestroyed: number;
  twinSplits: number;
  gamesPlayed: number;
  powerUpsCollected: number;
}

export interface ActiveRunCheckpointV15 {
  mode: 'CAMPAIGN' | 'ENDLESS';
  wave: number;
  score: number;
  lives: number;
  difficulty: DifficultyId;
  runSeed: number;
  perkStacks: Array<[string, number]>;
  usedContinue: boolean;
  savedAtMs: number;
}

export interface V15PersistedStoreState {
  jetonBalance: number;
  hasPermanentDoubleJeton: boolean;
  ownedShips: string[];
  ownedTrails: string[];
  equippedShipId: string;
  equippedTrailId: string;
  highestUnlockedStage: Record<GameDifficulty, number>;
  bestEndlessWave: Record<GameDifficulty, number>;
  hasSeenSwipeHint: boolean;
  creditedTransactionIds: string[];
  activeRunCheckpoint: ActiveRunCheckpointV15 | null;
}

export interface GameSaveData {
  version: number;
  saveSeq?: number;
  difficulty: DifficultyId;
  selectedShip: ShipSkinId;
  unlockedSector: number;
  sectors: Record<number, SectorProgress>;
  highScoreCampaign: number;
  highScoreEndless: number;
  bestEndlessWave: number;
  difficultyRecords: Record<RunDifficulty, DifficultyPersonalRecord>;
  campaignV12: CampaignSaveData;
  selectedStageByDifficulty: Record<GameDifficulty, number>;
  v15Store: V15PersistedStoreState;
  achievements: string[];
  premiumUnlocked: boolean;
  stats: LifetimeStats;
  settings: PlayerSettings;
}

interface SaveEnvelopeV15 {
  __vcEnvelope: 15;
  seq: number;
  checksum: string;
  data: GameSaveData;
}

const STORAGE_KEY = 'void_carver_sector80_save_v1';
const STORAGE_BACKUP_KEY = 'void_carver_sector80_save_v1_backup';

const VALID_STORE_SHIP_IDS = new Set(SHIPS_STORE_CATALOG.map((s) => s.id));
const VALID_STORE_TRAIL_IDS = new Set(TRAILS_STORE_CATALOG.map((t) => t.id));

function clampSafeInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function clampSafeFloat(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Fast, deterministic FNV-1a 32-bit integrity checksum for tamper/corruption detection.
 */
export function computeSaveChecksum(payload: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Safe JSON parser that strips prototype-pollution keys (`__proto__`, `constructor`, `prototype`).
 */
function parseSafeJson(raw: string): unknown {
  return JSON.parse(raw, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
}

function unwrapSaveCandidate(raw: string | null): { seq: number; data: Partial<GameSaveData> } | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = parseSafeJson(raw) as Partial<SaveEnvelopeV15> & Partial<GameSaveData>;
    if (!parsed || typeof parsed !== 'object') return null;

    if (parsed.__vcEnvelope === 15 && parsed.data && typeof parsed.checksum === 'string') {
      const canonical = JSON.stringify(parsed.data);
      if (computeSaveChecksum(canonical) !== parsed.checksum) {
        return null; // Corrupted/truncated write rejected!
      }
      return {
        seq: clampSafeInt(parsed.seq, 0, 2_000_000_000, Number(parsed.data.saveSeq) || 1),
        data: parsed.data
      };
    }

    // Legacy V1–V14 plain JSON migration path
    if (typeof parsed.version === 'number' || parsed.settings || parsed.v15Store) {
      return {
        seq: clampSafeInt(parsed.saveSeq, 0, 2_000_000_000, 0),
        data: parsed
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function difficultyIdToRunDifficulty(diff: DifficultyId): RunDifficulty {
  if (diff === 'EXPLORER') return 'EASY';
  if (diff === 'LEGEND') return 'HARD';
  return 'MEDIUM';
}

function isValidShipId(val: unknown): val is ShipSkinId {
  return typeof val === 'string' && SHIP_SKINS.some((s) => s.id === val);
}

function detectDefaultControlMode(): ControlMode {
  return 'JOYSTICK_KES';
}

export function createDefaultV15StoreState(): V15PersistedStoreState {
  return {
    jetonBalance: 50,
    hasPermanentDoubleJeton: false,
    ownedShips: ['SHIP_VANGUARD'],
    ownedTrails: ['TRAIL_CYAN'],
    equippedShipId: 'SHIP_VANGUARD',
    equippedTrailId: 'TRAIL_CYAN',
    highestUnlockedStage: { EASY: 1, MEDIUM: 1, HARD: 1 },
    bestEndlessWave: { EASY: 0, MEDIUM: 0, HARD: 0 },
    hasSeenSwipeHint: false,
    creditedTransactionIds: [],
    activeRunCheckpoint: null
  };
}

export function createDefaultSaveData(): GameSaveData {
  const sectors: Record<number, SectorProgress> = {};
  for (let i = 1; i <= 100; i++) {
    sectors[i] = {
      cleared: false,
      stars: 0,
      bestPercent: 0,
      bestScore: 0
    };
  }

  return {
    version: 15,
    saveSeq: 0,
    difficulty: 'COMMANDER',
    selectedShip: 'TITAN',
    unlockedSector: 1,
    sectors,
    highScoreCampaign: 0,
    highScoreEndless: 0,
    bestEndlessWave: 0,
    difficultyRecords: {
      EASY: { highScore: 0, bestWave: 0 },
      MEDIUM: { highScore: 0, bestWave: 0 },
      HARD: { highScore: 0, bestWave: 0 }
    },
    campaignV12: createDefaultCampaignSave(),
    selectedStageByDifficulty: {
      EASY: 1,
      MEDIUM: 1,
      HARD: 1
    },
    v15Store: createDefaultV15StoreState(),
    achievements: [],
    premiumUnlocked: false,
    stats: {
      totalScore: 0,
      totalCuts: 0,
      biggestSingleCut: 0,
      bossesDestroyed: 0,
      twinSplits: 0,
      gamesPlayed: 0,
      powerUpsCollected: 0
    },
    settings: {
      controlMode: detectDefaultControlMode(),
      carveButtonMode: 'HOLD',
      joystickSide: 'LEFT',
      sfxVolume: 0.8,
      ambientVolume: 0.45,
      muted: false,
      hapticsEnabled: true,
      language: 'TR',
      autoCut: false
    }
  };
}

function sanitizeCheckpoint(raw: unknown): ActiveRunCheckpointV15 | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<ActiveRunCheckpointV15>;
  const mode = r.mode === 'ENDLESS' ? 'ENDLESS' : r.mode === 'CAMPAIGN' ? 'CAMPAIGN' : null;
  if (!mode) return null;
  const diff: DifficultyId =
    r.difficulty === 'EXPLORER' || r.difficulty === 'COMMANDER' || r.difficulty === 'LEGEND'
      ? r.difficulty
      : 'COMMANDER';
  const perkStacks: Array<[string, number]> = [];
  if (Array.isArray(r.perkStacks)) {
    for (const entry of r.perkStacks.slice(0, 16)) {
      if (Array.isArray(entry) && typeof entry[0] === 'string') {
        perkStacks.push([entry[0], clampSafeInt(entry[1], 0, 5, 0)]);
      }
    }
  }
  return {
    mode,
    wave: clampSafeInt(r.wave, 1, 9999, 1),
    score: clampSafeInt(r.score, 0, 999_999_999, 0),
    lives: clampSafeInt(r.lives, 1, 5, 3),
    difficulty: diff,
    runSeed: clampSafeInt(r.runSeed, 0, 0xffffffff, 0x51f2a9c3),
    perkStacks,
    usedContinue: Boolean(r.usedContinue),
    savedAtMs: clampSafeInt(r.savedAtMs, 0, 9_999_999_999_999, 0)
  };
}

function normalizeSaveObject(parsed: Partial<GameSaveData>, seq: number): GameSaveData {
  const defaults = createDefaultSaveData();
  const migratedShip: ShipSkinId = isValidShipId(parsed.selectedShip)
    ? parsed.selectedShip
    : 'TITAN';

  const rawVersion = clampSafeInt(parsed.version, 1, 99, 1);
  const rawSettings = (parsed.settings ?? {}) as Partial<PlayerSettings>;
  const mergedSettings: PlayerSettings = {
    controlMode:
      rawSettings.controlMode === 'CLASSIC_ARCADE' ||
      rawSettings.controlMode === 'JOYSTICK_KES' ||
      rawSettings.controlMode === 'SINGLE_HAND_DRAG'
        ? rawSettings.controlMode
        : defaults.settings.controlMode,
    carveButtonMode: rawSettings.carveButtonMode === 'TOGGLE' ? 'TOGGLE' : 'HOLD',
    joystickSide:
      rawSettings.joystickSide === 'LEFT' ||
      rawSettings.joystickSide === 'CENTER' ||
      rawSettings.joystickSide === 'RIGHT'
        ? rawSettings.joystickSide
        : 'LEFT',
    sfxVolume: clampSafeFloat(rawSettings.sfxVolume, 0, 1, 0.8),
    ambientVolume: clampSafeFloat(rawSettings.ambientVolume, 0, 1, 0.45),
    muted: Boolean(rawSettings.muted),
    hapticsEnabled:
      typeof rawSettings.hapticsEnabled === 'boolean' ? rawSettings.hapticsEnabled : true,
    language: rawSettings.language === 'EN' ? 'EN' : 'TR',
    autoCut: Boolean(rawSettings.autoCut)
  };

  if (rawVersion < 8) {
    mergedSettings.controlMode = 'JOYSTICK_KES';
    mergedSettings.joystickSide = mergedSettings.joystickSide === 'RIGHT' ? 'RIGHT' : 'LEFT';
    mergedSettings.autoCut = false;
  } else if (
    mergedSettings.controlMode !== 'SINGLE_HAND_DRAG' &&
    mergedSettings.joystickSide === 'CENTER'
  ) {
    mergedSettings.joystickSide = 'LEFT';
  }

  const validDiff: DifficultyId =
    parsed.difficulty === 'EXPLORER' ||
    parsed.difficulty === 'COMMANDER' ||
    parsed.difficulty === 'LEGEND'
      ? parsed.difficulty
      : 'COMMANDER';

  const parsedRecords = parsed.difficultyRecords;
  const difficultyRecords: Record<RunDifficulty, DifficultyPersonalRecord> = {
    EASY: {
      highScore: clampSafeInt(parsedRecords?.EASY?.highScore, 0, 999_999_999, 0),
      bestWave: clampSafeInt(parsedRecords?.EASY?.bestWave, 0, 9999, 0)
    },
    MEDIUM: {
      highScore: clampSafeInt(parsedRecords?.MEDIUM?.highScore, 0, 999_999_999, 0),
      bestWave: clampSafeInt(parsedRecords?.MEDIUM?.bestWave, 0, 9999, 0)
    },
    HARD: {
      highScore: clampSafeInt(parsedRecords?.HARD?.highScore, 0, 999_999_999, 0),
      bestWave: clampSafeInt(parsedRecords?.HARD?.bestWave, 0, 9999, 0)
    }
  };

  const parsedCamp = parsed.campaignV12;
  const defaultCamp = createDefaultCampaignSave();
  const highestUnlockedLevel: Record<GameDifficulty, number> = {
    EASY: clampSafeInt(
      Math.max(
        Number(parsed.v15Store?.highestUnlockedStage?.EASY) || 1,
        Number(parsedCamp?.highestUnlockedLevel?.EASY) || 1
      ),
      1,
      30,
      1
    ),
    MEDIUM: clampSafeInt(
      Math.max(
        Number(parsed.v15Store?.highestUnlockedStage?.MEDIUM) || 1,
        Number(parsedCamp?.highestUnlockedLevel?.MEDIUM) || 1
      ),
      1,
      30,
      1
    ),
    HARD: clampSafeInt(
      Math.max(
        Number(parsed.v15Store?.highestUnlockedStage?.HARD) || 1,
        Number(parsedCamp?.highestUnlockedLevel?.HARD) || 1
      ),
      1,
      30,
      1
    )
  };

  const safeStarsByLevel: Record<string, 1 | 2 | 3> = { ...defaultCamp.starsByLevel };
  if (parsedCamp?.starsByLevel && typeof parsedCamp.starsByLevel === 'object') {
    for (const [k, v] of Object.entries(parsedCamp.starsByLevel)) {
      if (/^(EASY|MEDIUM|HARD)_\d{1,2}$/.test(k)) {
        const st = clampSafeInt(v, 0, 3, 0);
        if (st === 1 || st === 2 || st === 3) {
          safeStarsByLevel[k] = st;
        }
      }
    }
  }

  const campaignV12: CampaignSaveData = {
    selectedDifficulty: difficultyIdToRunDifficulty(validDiff),
    highestUnlockedLevel,
    starsByLevel: safeStarsByLevel
  };

  const parsedSelStage = parsed.selectedStageByDifficulty;
  const selectedStageByDifficulty: Record<GameDifficulty, number> = {
    EASY: clampSafeInt(
      parsedSelStage?.EASY,
      1,
      highestUnlockedLevel.EASY,
      highestUnlockedLevel.EASY
    ),
    MEDIUM: clampSafeInt(
      parsedSelStage?.MEDIUM,
      1,
      highestUnlockedLevel.MEDIUM,
      highestUnlockedLevel.MEDIUM
    ),
    HARD: clampSafeInt(
      parsedSelStage?.HARD,
      1,
      highestUnlockedLevel.HARD,
      highestUnlockedLevel.HARD
    )
  };

  const defaultV15 = createDefaultV15StoreState();
  const rawV15 = parsed.v15Store;
  const cleanShips = Array.isArray(rawV15?.ownedShips)
    ? rawV15.ownedShips.filter((id): id is string => typeof id === 'string' && VALID_STORE_SHIP_IDS.has(id))
    : [];
  const cleanTrails = Array.isArray(rawV15?.ownedTrails)
    ? rawV15.ownedTrails.filter((id): id is string => typeof id === 'string' && VALID_STORE_TRAIL_IDS.has(id))
    : [];
  const ownedShips = Array.from(new Set(['SHIP_VANGUARD', ...cleanShips]));
  const ownedTrails = Array.from(new Set(['TRAIL_CYAN', ...cleanTrails]));

  const equippedShipId =
    typeof rawV15?.equippedShipId === 'string' && ownedShips.includes(rawV15.equippedShipId)
      ? rawV15.equippedShipId
      : 'SHIP_VANGUARD';
  const equippedTrailId =
    typeof rawV15?.equippedTrailId === 'string' && ownedTrails.includes(rawV15.equippedTrailId)
      ? rawV15.equippedTrailId
      : 'TRAIL_CYAN';

  const creditedTx = Array.isArray(rawV15?.creditedTransactionIds)
    ? Array.from(
        new Set(
          rawV15.creditedTransactionIds
            .filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 160)
            .slice(-250)
        )
      )
    : [];

  const v15Store: V15PersistedStoreState = {
    jetonBalance: clampSafeInt(
      rawV15?.jetonBalance,
      0,
      99_999_999,
      defaultV15.jetonBalance
    ),
    hasPermanentDoubleJeton: Boolean(rawV15?.hasPermanentDoubleJeton),
    ownedShips,
    ownedTrails,
    equippedShipId,
    equippedTrailId,
    highestUnlockedStage: { ...highestUnlockedLevel },
    bestEndlessWave: {
      EASY: clampSafeInt(rawV15?.bestEndlessWave?.EASY, 0, 9999, 0),
      MEDIUM: clampSafeInt(rawV15?.bestEndlessWave?.MEDIUM, 0, 9999, 0),
      HARD: clampSafeInt(rawV15?.bestEndlessWave?.HARD, 0, 9999, 0)
    },
    hasSeenSwipeHint: Boolean(rawV15?.hasSeenSwipeHint),
    creditedTransactionIds: creditedTx,
    activeRunCheckpoint: sanitizeCheckpoint(rawV15?.activeRunCheckpoint)
  };

  return {
    version: 15,
    saveSeq: seq,
    difficulty: validDiff,
    unlockedSector: clampSafeInt(parsed.unlockedSector, 1, 100, 1),
    selectedShip: migratedShip,
    sectors: { ...defaults.sectors, ...(parsed.sectors ?? {}) },
    highScoreCampaign: clampSafeInt(parsed.highScoreCampaign, 0, 999_999_999, 0),
    highScoreEndless: clampSafeInt(parsed.highScoreEndless, 0, 999_999_999, 0),
    bestEndlessWave: clampSafeInt(parsed.bestEndlessWave, 0, 9999, 0),
    difficultyRecords,
    campaignV12,
    selectedStageByDifficulty,
    v15Store,
    premiumUnlocked: Boolean(parsed.premiumUnlocked),
    stats: {
      totalScore: clampSafeInt(parsed.stats?.totalScore, 0, 999_999_999, 0),
      totalCuts: clampSafeInt(parsed.stats?.totalCuts, 0, 999_999_999, 0),
      biggestSingleCut: clampSafeFloat(parsed.stats?.biggestSingleCut, 0, 100, 0),
      bossesDestroyed: clampSafeInt(parsed.stats?.bossesDestroyed, 0, 999_999_999, 0),
      twinSplits: clampSafeInt(parsed.stats?.twinSplits, 0, 999_999_999, 0),
      gamesPlayed: clampSafeInt(parsed.stats?.gamesPlayed, 0, 999_999_999, 0),
      powerUpsCollected: clampSafeInt(parsed.stats?.powerUpsCollected, 0, 999_999_999, 0)
    },
    settings: mergedSettings,
    achievements: Array.isArray(parsed.achievements)
      ? parsed.achievements.filter((a): a is string => typeof a === 'string' && a.length <= 64)
      : []
  };
}

/**
 * Merges monotonic entitlements across primary & backup slots so an interrupted write
 * can NEVER erase a purchased ship, trail, permanent x2 Jeton pack, or stage unlock!
 */
function mergeHighWaterEntitlements(winner: GameSaveData, other: GameSaveData): GameSaveData {
  winner.premiumUnlocked = winner.premiumUnlocked || other.premiumUnlocked;
  winner.v15Store.hasPermanentDoubleJeton =
    winner.v15Store.hasPermanentDoubleJeton || other.v15Store.hasPermanentDoubleJeton;
  winner.v15Store.ownedShips = Array.from(
    new Set([...winner.v15Store.ownedShips, ...other.v15Store.ownedShips])
  );
  winner.v15Store.ownedTrails = Array.from(
    new Set([...winner.v15Store.ownedTrails, ...other.v15Store.ownedTrails])
  );
  winner.v15Store.creditedTransactionIds = Array.from(
    new Set([
      ...other.v15Store.creditedTransactionIds,
      ...winner.v15Store.creditedTransactionIds
    ])
  ).slice(-250);

  for (const d of ['EASY', 'MEDIUM', 'HARD'] as const) {
    const maxStage = Math.max(
      winner.v15Store.highestUnlockedStage[d],
      other.v15Store.highestUnlockedStage[d],
      winner.campaignV12.highestUnlockedLevel[d],
      other.campaignV12.highestUnlockedLevel[d]
    );
    winner.v15Store.highestUnlockedStage[d] = maxStage;
    winner.campaignV12.highestUnlockedLevel[d] = maxStage;
    winner.v15Store.bestEndlessWave[d] = Math.max(
      winner.v15Store.bestEndlessWave[d],
      other.v15Store.bestEndlessWave[d]
    );
    winner.difficultyRecords[d].highScore = Math.max(
      winner.difficultyRecords[d].highScore,
      other.difficultyRecords[d].highScore
    );
    winner.difficultyRecords[d].bestWave = Math.max(
      winner.difficultyRecords[d].bestWave,
      other.difficultyRecords[d].bestWave
    );
  }
  winner.highScoreEndless = Math.max(winner.highScoreEndless, other.highScoreEndless);
  winner.bestEndlessWave = Math.max(winner.bestEndlessWave, other.bestEndlessWave);
  return winner;
}

class StorageServiceImpl {
  private cached: GameSaveData = createDefaultSaveData();
  public persistenceDisabled = false;
  private hasLoadedOnce = false;
  private pendingUpdatersBeforeLoad: Array<(data: GameSaveData) => void> = [];
  private writeChain: Promise<void> = Promise.resolve();

  public setCurrentForSession(data: GameSaveData): void {
    this.cached = data;
    this.hasLoadedOnce = true;
  }

  public getCurrent(): GameSaveData {
    return this.cached;
  }

  public getTotalStars(): number {
    let sum = 0;
    for (let i = 1; i <= 100; i++) {
      sum += this.cached.sectors[i]?.stars ?? 0;
    }
    const v12Stars = this.getTotalCampaignStarsV12(this.cached);
    return Math.max(sum, v12Stars);
  }

  public getCampaignStageStars(
    diff: GameDifficulty,
    stageNum: number,
    save: GameSaveData = this.cached
  ): number {
    const key = `${diff}_${stageNum}`;
    return save.campaignV12?.starsByLevel?.[key] ?? 0;
  }

  public getTotalCampaignStarsV12(save: GameSaveData = this.cached): number {
    const map = save.campaignV12?.starsByLevel ?? {};
    let total = 0;
    for (const v of Object.values(map)) {
      total += Number(v) || 0;
    }
    return total;
  }

  public getHighestUnlockedStage(
    diff: GameDifficulty = difficultyIdToRunDifficulty(this.cached.difficulty),
    save: GameSaveData = this.cached
  ): number {
    const raw = Math.max(
      save.v15Store?.highestUnlockedStage?.[diff] ?? 1,
      save.campaignV12?.highestUnlockedLevel?.[diff] ?? 1
    );
    return Math.max(1, Math.min(30, Math.floor(raw)));
  }

  public getSelectedStartStage(
    diff: GameDifficulty = difficultyIdToRunDifficulty(this.cached.difficulty),
    save: GameSaveData = this.cached
  ): number {
    const maxUnlocked = this.getHighestUnlockedStage(diff, save);
    const chosen = save.selectedStageByDifficulty?.[diff] ?? maxUnlocked;
    return Math.max(1, Math.min(maxUnlocked, Math.floor(chosen)));
  }

  public getBestWaveOverall(save: GameSaveData = this.cached): number {
    return Math.max(
      save.bestEndlessWave || 0,
      save.difficultyRecords?.EASY?.bestWave || 0,
      save.difficultyRecords?.MEDIUM?.bestWave || 0,
      save.difficultyRecords?.HARD?.bestWave || 0,
      save.v15Store?.bestEndlessWave?.EASY || 0,
      save.v15Store?.bestEndlessWave?.MEDIUM || 0,
      save.v15Store?.bestEndlessWave?.HARD || 0
    );
  }

  public getBestScoreOverall(save: GameSaveData = this.cached): number {
    return Math.max(
      save.highScoreEndless || 0,
      save.highScoreCampaign || 0,
      save.difficultyRecords?.EASY?.highScore || 0,
      save.difficultyRecords?.MEDIUM?.highScore || 0,
      save.difficultyRecords?.HARD?.highScore || 0
    );
  }

  public getDifficultyRecord(
    diff: DifficultyId = this.cached.difficulty,
    save: GameSaveData = this.cached
  ): DifficultyPersonalRecord {
    const key = difficultyIdToRunDifficulty(diff);
    return save.difficultyRecords?.[key] ?? { highScore: 0, bestWave: 0 };
  }

  public isShipUnlocked(skin: ShipSkinConfig, save: GameSaveData = this.cached): boolean {
    if (skin.waveRequired <= 1 && skin.scoreRequired <= 0) return true;
    const bestWave = this.getBestWaveOverall(save);
    const bestScore = this.getBestScoreOverall(save);
    const stars = this.getTotalStars();
    return (
      bestWave >= skin.waveRequired ||
      bestScore >= skin.scoreRequired ||
      stars >= skin.starsRequired
    );
  }

  public hydrateV15Store(
    store: CleanJetonEconomyAndStore,
    save: GameSaveData = this.cached
  ): void {
    const s = save.v15Store ?? createDefaultV15StoreState();
    save.v15Store = s;
    store.jetonBalance = clampSafeInt(s.jetonBalance, 0, 99_999_999, 50);
    store.hasPermanentDoubleJeton = Boolean(s.hasPermanentDoubleJeton);
    store.ownedShips = new Set([
      'SHIP_VANGUARD',
      ...s.ownedShips.filter((id) => VALID_STORE_SHIP_IDS.has(id))
    ]);
    store.ownedTrails = new Set([
      'TRAIL_CYAN',
      ...s.ownedTrails.filter((id) => VALID_STORE_TRAIL_IDS.has(id))
    ]);
    store.equippedShipId = store.ownedShips.has(s.equippedShipId)
      ? s.equippedShipId
      : 'SHIP_VANGUARD';
    store.equippedTrailId = store.ownedTrails.has(s.equippedTrailId)
      ? s.equippedTrailId
      : 'TRAIL_CYAN';
    store.highestUnlockedStage = { ...s.highestUnlockedStage };
    store.bestEndlessWave = { ...s.bestEndlessWave };
    store.creditedTransactionIds = new Set(s.creditedTransactionIds ?? []);
  }

  public captureV15Store(
    store: CleanJetonEconomyAndStore,
    hasSeenSwipeHint: boolean,
    save: GameSaveData = this.cached,
    checkpoint?: ActiveRunCheckpointV15 | null
  ): void {
    const prevCheckpoint =
      checkpoint === undefined ? (save.v15Store?.activeRunCheckpoint ?? null) : checkpoint;
    save.v15Store = {
      jetonBalance: clampSafeInt(store.jetonBalance, 0, 99_999_999, 0),
      hasPermanentDoubleJeton: Boolean(store.hasPermanentDoubleJeton),
      ownedShips: Array.from(store.ownedShips),
      ownedTrails: Array.from(store.ownedTrails),
      equippedShipId: store.equippedShipId,
      equippedTrailId: store.equippedTrailId,
      highestUnlockedStage: { ...store.highestUnlockedStage },
      bestEndlessWave: { ...store.bestEndlessWave },
      hasSeenSwipeHint: Boolean(hasSeenSwipeHint || save.v15Store?.hasSeenSwipeHint),
      creditedTransactionIds: Array.from(store.creditedTransactionIds).slice(-250),
      activeRunCheckpoint: prevCheckpoint
    };
  }

  private buildSerializedEnvelope(data: GameSaveData): string {
    const nextSeq = clampSafeInt((data.saveSeq ?? 0) + 1, 1, 2_000_000_000, 1);
    data.saveSeq = nextSeq;
    const canonical = JSON.stringify(data);
    const envelope: SaveEnvelopeV15 = {
      __vcEnvelope: 15,
      seq: nextSeq,
      checksum: computeSaveChecksum(canonical),
      data
    };
    return JSON.stringify(envelope);
  }

  /**
   * Immediate synchronous flush to `localStorage` primary + backup slots.
   * Ensures 0ms crash/background-kill durability even before async native `Preferences` resolves!
   */
  public flushSyncMirror(): string | null {
    if (this.persistenceDisabled || !this.hasLoadedOnce) return null;
    const serialized = this.buildSerializedEnvelope(this.cached);
    if (typeof localStorage !== 'undefined') {
      try {
        const prevPrimary = localStorage.getItem(STORAGE_KEY);
        localStorage.setItem(STORAGE_KEY, serialized);
        // Promote previous verified primary to backup, or initialize backup if empty
        if (prevPrimary && unwrapSaveCandidate(prevPrimary)) {
          localStorage.setItem(STORAGE_BACKUP_KEY, prevPrimary);
        } else {
          localStorage.setItem(STORAGE_BACKUP_KEY, serialized);
        }
      } catch {
        // Ignore private browsing / storage quota restrictions
      }
    }
    return serialized;
  }

  public async load(): Promise<GameSaveData> {
    try {
      const rawCandidates: Array<string | null> = [];
      if (Capacitor.isNativePlatform()) {
        try {
          const [p1, p2] = await Promise.all([
            Preferences.get({ key: STORAGE_KEY }),
            Preferences.get({ key: STORAGE_BACKUP_KEY })
          ]);
          rawCandidates.push(p1.value, p2.value);
        } catch {
          // Fall back to localStorage mirror if Preferences fails
        }
      }
      if (typeof localStorage !== 'undefined') {
        try {
          rawCandidates.push(
            localStorage.getItem(STORAGE_KEY),
            localStorage.getItem(STORAGE_BACKUP_KEY)
          );
        } catch {
          // Ignore restricted storage
        }
      }

      const validNormalized: Array<{ seq: number; save: GameSaveData }> = [];
      for (const raw of rawCandidates) {
        const unwrapped = unwrapSaveCandidate(raw);
        if (unwrapped) {
          validNormalized.push({
            seq: unwrapped.seq,
            save: normalizeSaveObject(unwrapped.data, unwrapped.seq)
          });
        }
      }

      if (validNormalized.length > 0) {
        validNormalized.sort((a, b) => b.seq - a.seq);
        let merged = validNormalized[0]!.save;
        for (let i = 1; i < validNormalized.length; i++) {
          merged = mergeHighWaterEntitlements(merged, validNormalized[i]!.save);
        }
        this.cached = merged;
      } else {
        this.cached = createDefaultSaveData();
      }
    } catch {
      this.cached = createDefaultSaveData();
    }

    this.hasLoadedOnce = true;
    if (this.pendingUpdatersBeforeLoad.length > 0) {
      const queued = this.pendingUpdatersBeforeLoad.splice(0);
      for (const fn of queued) {
        fn(this.cached);
      }
      void this.save();
    }

    return this.cached;
  }

  public async save(updater?: (data: GameSaveData) => void): Promise<void> {
    if (!this.hasLoadedOnce && !this.persistenceDisabled) {
      if (updater) {
        this.pendingUpdatersBeforeLoad.push(updater);
        updater(this.cached);
      }
      return;
    }

    if (updater) {
      updater(this.cached);
    }
    if (this.persistenceDisabled) {
      return;
    }

    const serialized = this.flushSyncMirror();
    if (!serialized) return;

    if (Capacitor.isNativePlatform()) {
      this.writeChain = this.writeChain
        .then(async () => {
          try {
            const prev = await Preferences.get({ key: STORAGE_KEY });
            await Preferences.set({ key: STORAGE_KEY, value: serialized });
            if (prev.value && unwrapSaveCandidate(prev.value)) {
              await Preferences.set({ key: STORAGE_BACKUP_KEY, value: prev.value });
            } else {
              await Preferences.set({ key: STORAGE_BACKUP_KEY, value: serialized });
            }
          } catch {
            // Sync localStorage mirror already holds the verified payload
          }
        })
        .catch(() => {});
      await this.writeChain;
    }
  }

  public unlockAchievement(id: string): boolean {
    if (this.cached.achievements.includes(id)) {
      return false;
    }
    this.cached.achievements.push(id);
    void this.save();
    return true;
  }
}

export const StorageService = new StorageServiceImpl();
