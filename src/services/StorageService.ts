import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { DifficultyId, SHIP_SKINS, ShipSkinId } from '../core/Config';

export type ControlMode = 'DPAD' | 'SWIPE' | 'KEYBOARD';
export type CarveButtonMode = 'HOLD' | 'TOGGLE';
export type JoystickSide = 'RIGHT' | 'LEFT';
export type LanguageCode = 'TR' | 'EN';

export interface SectorProgress {
  cleared: boolean;
  stars: number; // 0..3
  bestPercent: number;
  bestScore: number;
}

export interface PlayerSettings {
  controlMode: ControlMode;
  carveButtonMode: CarveButtonMode;
  /** Configurable thumb joystick / drag side (`RIGHT` or `LEFT`). */
  joystickSide: JoystickSide;
  sfxVolume: number; // 0..1
  ambientVolume: number; // 0..1
  muted: boolean;
  hapticsEnabled: boolean;
  language: LanguageCode;
  /** V5 `[OTOMATİK]` one-hand mode: pressing the inward arrow for 0.10s starts a cut without `KES`. */
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
  achievements: string[];
  premiumUnlocked: boolean;
  stats: LifetimeStats;
  settings: PlayerSettings;
}

const STORAGE_KEY = 'void_carver_sector80_save_v1';

function isValidShipId(val: unknown): val is ShipSkinId {
  return typeof val === 'string' && SHIP_SKINS.some((s) => s.id === val);
}

function detectDefaultControlMode(): ControlMode {
  if (typeof window !== 'undefined') {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (coarse || touch) {
      return 'DPAD';
    }
  }
  return 'DPAD';
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
    version: 3,
    difficulty: 'COMMANDER',
    selectedShip: 'TITAN',
    unlockedSector: 1,
    sectors,
    highScoreCampaign: 0,
    highScoreEndless: 0,
    bestEndlessWave: 0,
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
      joystickSide: 'RIGHT',
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

        const mergedSettings: PlayerSettings = {
          ...defaults.settings,
          ...(parsed.settings ?? {})
        };
        if (mergedSettings.joystickSide !== 'LEFT' && mergedSettings.joystickSide !== 'RIGHT') {
          mergedSettings.joystickSide = 'RIGHT';
        }

        this.cached = {
          ...defaults,
          ...parsed,
          version: 3,
          unlockedSector: Math.max(
            1,
            Math.min(100, Math.round(Number(parsed.unlockedSector) || 1))
          ),
          selectedShip: migratedShip,
          sectors: { ...defaults.sectors, ...(parsed.sectors ?? {}) },
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
