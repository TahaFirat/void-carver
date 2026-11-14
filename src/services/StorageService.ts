import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
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
  /** Configurable thumb pad side (`LEFT`, `CENTER`, or `RIGHT`). */
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

export interface GameSaveData {
  version: number;
  difficulty: DifficultyId;
  selectedShip: ShipSkinId;
  unlockedSector: number;
  sectors: Record<number, SectorProgress>;
  highScoreCampaign: number;
  highScoreEndless: number;
  bestEndlessWave: number;
  difficultyRecords: Record<RunDifficulty, DifficultyPersonalRecord>;
  achievements: string[];
  premiumUnlocked: boolean;
  stats: LifetimeStats;
  settings: PlayerSettings;
}

const STORAGE_KEY = 'void_carver_sector80_save_v1';

export function difficultyIdToRunDifficulty(diff: DifficultyId): RunDifficulty {
  if (diff === 'EXPLORER') return 'EASY';
  if (diff === 'LEGEND') return 'HARD';
  return 'MEDIUM';
}

function isValidShipId(val: unknown): val is ShipSkinId {
  return typeof val === 'string' && SHIP_SKINS.some((s) => s.id === val);
}

function detectDefaultControlMode(): ControlMode {
  return 'CLASSIC_ARCADE';
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
    version: 7,
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

class StorageServiceImpl {
  private cached: GameSaveData = createDefaultSaveData();
  /** Store-screenshot showcase mode keeps everything in memory only. */
  public persistenceDisabled = false;

  /** Replaces the in-memory save (used by tests and the screenshot showcase). */
  public setCurrentForSession(data: GameSaveData): void {
    this.cached = data;
  }

  public getCurrent(): GameSaveData {
    return this.cached;
  }

  public getTotalStars(): number {
    let sum = 0;
    for (let i = 1; i <= 100; i++) {
      sum += this.cached.sectors[i]?.stars ?? 0;
    }
    return sum;
  }

  public getBestWaveOverall(save: GameSaveData = this.cached): number {
    return Math.max(
      save.bestEndlessWave || 0,
      save.difficultyRecords?.EASY?.bestWave || 0,
      save.difficultyRecords?.MEDIUM?.bestWave || 0,
      save.difficultyRecords?.HARD?.bestWave || 0
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

  public async load(): Promise<GameSaveData> {
    try {
      let raw: string | null = null;
      if (Capacitor.isNativePlatform()) {
        const res = await Preferences.get({ key: STORAGE_KEY });
        raw = res.value;
      } else if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(STORAGE_KEY);
      }

      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GameSaveData>;
        const defaults = createDefaultSaveData();
        const migratedShip: ShipSkinId = isValidShipId(parsed.selectedShip)
          ? parsed.selectedShip
          : 'TITAN';

        const rawVersion = Number(parsed.version) || 1;
        const mergedSettings: PlayerSettings = {
          ...defaults.settings,
          ...(parsed.settings ?? {})
        };

        const rawMode = (parsed.settings as { controlMode?: string } | undefined)?.controlMode;
        if (rawVersion < 7) {
          mergedSettings.controlMode =
            rawMode === 'JOYSTICK_KES' ? 'JOYSTICK_KES' : 'CLASSIC_ARCADE';
          mergedSettings.joystickSide =
            mergedSettings.joystickSide === 'RIGHT' ? 'RIGHT' : 'LEFT';
          mergedSettings.autoCut = false;
        } else {
          if (
            mergedSettings.controlMode !== 'CLASSIC_ARCADE' &&
            mergedSettings.controlMode !== 'JOYSTICK_KES' &&
            mergedSettings.controlMode !== 'SINGLE_HAND_DRAG'
          ) {
            mergedSettings.controlMode = 'CLASSIC_ARCADE';
          }
          if (
            mergedSettings.joystickSide !== 'LEFT' &&
            mergedSettings.joystickSide !== 'CENTER' &&
            mergedSettings.joystickSide !== 'RIGHT'
          ) {
            mergedSettings.joystickSide = 'LEFT';
          }
          if (
            mergedSettings.controlMode !== 'SINGLE_HAND_DRAG' &&
            mergedSettings.joystickSide === 'CENTER'
          ) {
            mergedSettings.joystickSide = 'LEFT';
          }
        }

        const validDiff: DifficultyId =
          parsed.difficulty === 'EXPLORER' ||
          parsed.difficulty === 'COMMANDER' ||
          parsed.difficulty === 'LEGEND'
            ? parsed.difficulty
            : 'COMMANDER';

        const legacyHigh = Math.max(
          Number(parsed.highScoreEndless) || 0,
          Number(parsed.highScoreCampaign) || 0
        );
        const legacyWave = Math.max(0, Number(parsed.bestEndlessWave) || 0);
        const parsedRecords = parsed.difficultyRecords;
        const difficultyRecords: Record<RunDifficulty, DifficultyPersonalRecord> = {
          EASY: {
            highScore: Math.max(0, Number(parsedRecords?.EASY?.highScore) || 0),
            bestWave: Math.max(0, Number(parsedRecords?.EASY?.bestWave) || 0)
          },
          MEDIUM: {
            highScore: Math.max(
              rawVersion < 6 ? legacyHigh : 0,
              Number(parsedRecords?.MEDIUM?.highScore) || 0
            ),
            bestWave: Math.max(
              rawVersion < 6 ? legacyWave : 0,
              Number(parsedRecords?.MEDIUM?.bestWave) || 0
            )
          },
          HARD: {
            highScore: Math.max(0, Number(parsedRecords?.HARD?.highScore) || 0),
            bestWave: Math.max(0, Number(parsedRecords?.HARD?.bestWave) || 0)
          }
        };

        this.cached = {
          ...defaults,
          ...parsed,
          version: 7,
          difficulty: validDiff,
          unlockedSector: Math.max(
            1,
            Math.min(100, Math.round(Number(parsed.unlockedSector) || 1))
          ),
          selectedShip: migratedShip,
          sectors: { ...defaults.sectors, ...(parsed.sectors ?? {}) },
          difficultyRecords,
          stats: { ...defaults.stats, ...(parsed.stats ?? {}) },
          settings: mergedSettings,
          achievements: Array.isArray(parsed.achievements) ? parsed.achievements : []
        };
      }
    } catch {
      this.cached = createDefaultSaveData();
    }
    return this.cached;
  }

  public async save(updater?: (data: GameSaveData) => void): Promise<void> {
    if (updater) {
      updater(this.cached);
    }
    if (this.persistenceDisabled) {
      return;
    }
    const serialized = JSON.stringify(this.cached);
    try {
      if (Capacitor.isNativePlatform()) {
        await Preferences.set({ key: STORAGE_KEY, value: serialized });
      } else if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch {
      // Ignore quota or private browsing storage restrictions
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
