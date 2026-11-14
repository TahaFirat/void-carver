export const GAME_TITLE = 'VOID CARVER';
export const GAME_SUBTITLE_TR = '16-BİT ARCADE';
export const GAME_SUBTITLE_EN = '16-BIT ARCADE';

// Virtual canvas (exact 9:16 portrait arcade cabinet ratio)
export const CANVAS_WIDTH = 900;
export const CANVAS_HEIGHT = 1600;

// Logical cuttable arena coordinates (900x1200 preserved for exact integer polygon geometry)
export const ARENA_WIDTH = 900;
export const ARENA_HEIGHT = 1200;
export const INITIAL_ARENA_AREA = ARENA_WIDTH * ARENA_HEIGHT; // 1,080,000 sq units

// 1989 16-Bit Native Pixel-Art Buffer Resolution (1 arcade pixel = 3x3 screen pixels):
// 270 * 3 = 810px screen width, 360 * 3 = 1080px screen height (exact 0.90x of 900x1200!)
export const PIXEL_SCALE = 3;
export const NATIVE_PIXEL_W = 270;
export const NATIVE_PIXEL_H = 360;

// Clean V4 Screen Zones inside 900x1600 virtual canvas (matches 01-hedef-oynanis.jpg):
// - Top Score Bar (`SKOR` / `REKOR` / `❚❚`): y = 0..86
// - Gold-Silver 3D Pixel Frame Outer Bezel: x = 21..879, y = 92..1220 (24px frame)
// - Inner Playfield (`810 x 1080` = `270 x 360` @ 3x): x = 45..855, y = 116..1196
// - Two-Line Status Strip (level/lives + area/shield): y = 1224..1302
// - Mobile Joystick Deck (drag joystick + automatic cut hint): y = 1308..1600
export const HUD_TOP_HEIGHT = 86;
export const FRAME_BEZEL_PX = 24;
export const ARENA_VIEW_SCALE = 0.9;
export const ARENA_VIEW_WIDTH = NATIVE_PIXEL_W * PIXEL_SCALE; // 810
export const ARENA_VIEW_HEIGHT = NATIVE_PIXEL_H * PIXEL_SCALE; // 1080
export const ARENA_VIEW_X = (CANVAS_WIDTH - ARENA_VIEW_WIDTH) / 2; // 45
export const ARENA_VIEW_Y = 116;
export const MIDDLE_ZONE_Y = ARENA_VIEW_Y - FRAME_BEZEL_PX; // 92
export const MIDDLE_ZONE_HEIGHT = ARENA_VIEW_HEIGHT + FRAME_BEZEL_PX * 2; // 1128
export const ARENA_PADDING = ARENA_VIEW_X;
export const HUD_BOTTOM_Y = 1224;
export const HUD_BOTTOM_HEIGHT = 92;
export const THUMB_ZONE_Y = 1320;
export const THUMB_ZONE_HEIGHT = CANVAS_HEIGHT - THUMB_ZONE_Y; // 280

// Geometry & fixed-timestep physics invariants
export const GRID_STEP = 2;
export const MIN_SEGMENT_LEN = 4;
export const FIXED_DT = 1 / 60;
export const MAX_ACCUMULATOR = 0.05;

// Authentic 1989 Arcade Gameplay & Mobile Ergonomic Tuning
export const TARGET_CLAIM_PERCENT = 80.0;
export const ENRAGE_CLAIM_PERCENT = 72.0;
export const CORNER_BUFFER_DIST = 32; // 32px generous mobile corner magnet
export const CORNER_BUFFER_TIME = 0.22; // 220ms early turn memory

// Tuned Mobile-Friendly Speed Rules:
// - Fast & responsive player border/cut speeds
// - 180-degree Line Backtrack speed: 1.38x current cut speed for quick safe retreats
export const BASE_BORDER_SPEED = 380;
export const BASE_CUT_SPEED = 345;
export const BASE_FUSE_SPEED = 360;
export const BASE_FUSE_MULTIPLIER = BASE_FUSE_SPEED / BASE_CUT_SPEED;
export const SPEED_BOOSTED_CUT_SPEED = 480;
export const SPEED_UP_STEP = (SPEED_BOOSTED_CUT_SPEED - BASE_CUT_SPEED) / BASE_CUT_SPEED;
export const MAX_SPEED_MULTIPLIER = 1.7;
export const BACKTRACK_SPEED_MULTIPLIER = 1.38;
export const SHIELD_ZERO_GRACE_SECONDS = 4.0;
export const IDLE_FUSE_DELAY_SECONDS = 5.5;

// Authentic 1989 Arcade Scoring (honest personal best starting from 0)
export const DEFAULT_ARCADE_HIGH_SCORE = 0;
export const SCORE_PER_PERCENT = 100;
export const BIG_CUT_THRESHOLD = 15.0;
export const BIG_CUT_MULTIPLIER = 2.5;
export const JUICE_HITSTOP_THRESHOLD = 20.0;
export const JUICE_HITSTOP_DURATION = 0.045;
export const LEVEL_CLEAR_BASE_BONUS = 10_000;
export const FIRST_CUT_80_BONUS = 1_000_000;
export const MAX_OVER_80_BONUS = 500_000;
export const SPECIAL_BLOCK_OPEN_BONUS = 100_000;
export const TWIN_SPLIT_BONUS = 100_000;
export const BOSS_DESTROY_BONUS = 100_000;
export const MASTER_CARVE_BONUS = 500_000;
export const SHIELD_UNIT_BONUS = 20;
export const EXTRA_LIFE_SCORE_STEP = 150_000;

export const UI_FONT_FAMILY = '"Courier New", Consolas, monospace';
export const ARCADE_FONT_FAMILY = '"Courier New", Consolas, monospace';

/**
 * 16-Bit 1989 Arcade Pixel Palette
 */
export const PALETTE = {
  APP_BG: '#04060E',
  HEADER_BG: '#020308',
  CARD_BG: '#141C30',
  CARD_BORDER: '#7A88A4',
  WELL_BG: '#080C18',

  INK_PRIMARY: '#F8FAFF',
  INK_SECONDARY: '#A8B8D8',
  INK_DARK: '#080810',
  PIXEL_BLACK: '#080810',

  // Signature Safe Green Line & Orange Laser Cut
  SAFE_GREEN: '#28E038',
  SAFE_GREEN_LIGHT: '#98FF70',
  CUT_ORANGE: '#FF7810',
  CUT_CORE: '#FFF0A0',

  SIGNAL_PRIMARY: '#E82820',
  SIGNAL_DEEP: '#88100C',
  SIGNAL_WARM: '#FFA828',
  DANGER_RED: '#FF2820',

  GOLD_LIGHT: '#FFF088',
  GOLD_MATTE: '#F8C830',
  GOLD_SHADOW: '#986808',
  STEEL_MID: '#647088',
  STEEL_LIGHT: '#D8E2F0',
  SHIELD_HEX: '#38F048',
  EMERALD_PLANET: '#20C848',
  DIVIDER: '#24304C'
} as const;

export type ChapterThemeId =
  | 'STAGE_01_DESERT_BASE'
  | 'STAGE_02_COBALT_OCEAN'
  | 'STAGE_03_ROCK_REACTOR'
  | 'STAGE_04_EMERALD_CAVE'
  | 'STAGE_05_ORBITAL_DECK'
  | 'STAGE_06_TWIN_TEMPLE'
  | 'STAGE_07_BIO_HIVE'
  | 'STAGE_08_VOLCANIC_MAGMA'
  | 'STAGE_09_COPPER_GEARS'
  | 'STAGE_10_GLACIAL_WRECK'
  | 'STAGE_11_TURBINE_ABYSS'
  | 'STAGE_12_CYBER_GATE'
  | 'STAGE_13_SPINE_TUNNEL'
  | 'STAGE_14_SYNAPSE_MATRIX'
  | 'STAGE_15_CRIMSON_ARTERIES'
  | 'STAGE_16_BRAIN_CORTEX';

export interface ChapterThemeSpec {
  id: ChapterThemeId;
  stageIndex: number; // 1..16
  primaryHex: string;
  accentHex: string;
}

export const CHAPTER_THEMES: Record<ChapterThemeId, ChapterThemeSpec> = {
  STAGE_01_DESERT_BASE: {
    id: 'STAGE_01_DESERT_BASE',
    stageIndex: 1,
    primaryHex: '#C89852',
    accentHex: '#7A8290'
  },
  STAGE_02_COBALT_OCEAN: {
    id: 'STAGE_02_COBALT_OCEAN',
    stageIndex: 2,
    primaryHex: '#0A1E6E',
    accentHex: '#1C3EA8'
  },
  STAGE_03_ROCK_REACTOR: {
    id: 'STAGE_03_ROCK_REACTOR',
    stageIndex: 3,
    primaryHex: '#6E4426',
    accentHex: '#7A8290'
  },
  STAGE_04_EMERALD_CAVE: {
    id: 'STAGE_04_EMERALD_CAVE',
    stageIndex: 4,
    primaryHex: '#18543E',
    accentHex: '#E8B838'
  },
  STAGE_05_ORBITAL_DECK: {
    id: 'STAGE_05_ORBITAL_DECK',
    stageIndex: 5,
    primaryHex: '#485468',
    accentHex: '#F0B820'
  },
  STAGE_06_TWIN_TEMPLE: {
    id: 'STAGE_06_TWIN_TEMPLE',
    stageIndex: 6,
    primaryHex: '#9C7428',
    accentHex: '#E8C458'
  },
  STAGE_07_BIO_HIVE: {
    id: 'STAGE_07_BIO_HIVE',
    stageIndex: 7,
    primaryHex: '#3E2264',
    accentHex: '#9848C8'
  },
  STAGE_08_VOLCANIC_MAGMA: {
    id: 'STAGE_08_VOLCANIC_MAGMA',
    stageIndex: 8,
    primaryHex: '#422428',
    accentHex: '#E84818'
  },
  STAGE_09_COPPER_GEARS: {
    id: 'STAGE_09_COPPER_GEARS',
    stageIndex: 9,
    primaryHex: '#884824',
    accentHex: '#D88840'
  },
  STAGE_10_GLACIAL_WRECK: {
    id: 'STAGE_10_GLACIAL_WRECK',
    stageIndex: 10,
    primaryHex: '#5A7C98',
    accentHex: '#9CC8E8'
  },
  STAGE_11_TURBINE_ABYSS: {
    id: 'STAGE_11_TURBINE_ABYSS',
    stageIndex: 11,
    primaryHex: '#104C58',
    accentHex: '#38A8B8'
  },
  STAGE_12_CYBER_GATE: {
    id: 'STAGE_12_CYBER_GATE',
    stageIndex: 12,
    primaryHex: '#342E4C',
    accentHex: '#7A78A8'
  },
  STAGE_13_SPINE_TUNNEL: {
    id: 'STAGE_13_SPINE_TUNNEL',
    stageIndex: 13,
    primaryHex: '#4C2838',
    accentHex: '#B89880'
  },
  STAGE_14_SYNAPSE_MATRIX: {
    id: 'STAGE_14_SYNAPSE_MATRIX',
    stageIndex: 14,
    primaryHex: '#14243C',
    accentHex: '#F0A828'
  },
  STAGE_15_CRIMSON_ARTERIES: {
    id: 'STAGE_15_CRIMSON_ARTERIES',
    stageIndex: 15,
    primaryHex: '#5C1628',
    accentHex: '#E83858'
  },
  STAGE_16_BRAIN_CORTEX: {
    id: 'STAGE_16_BRAIN_CORTEX',
    stageIndex: 16,
    primaryHex: '#481C48',
    accentHex: '#D858B8'
  }
};

export type DifficultyId = 'EXPLORER' | 'COMMANDER' | 'LEGEND';

export interface DifficultyPreset {
  id: DifficultyId;
  nameTr: string;
  nameEn: string;
  shortTr: string;
  shortEn: string;
  startingLives: number;
  shieldMultiplier: number;
  enemySpeedMultiplier: number;
  fuseSpeedMultiplier: number;
  scoreMultiplier: number;
  unlockAllSectors: boolean;
  isHardMode: boolean;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyPreset> = {
  EXPLORER: {
    id: 'EXPLORER',
    nameTr: 'KOLAY',
    nameEn: 'EASY',
    shortTr: 'KOLAY',
    shortEn: 'EASY',
    startingLives: 5,
    shieldMultiplier: 1.35,
    enemySpeedMultiplier: 0.78,
    fuseSpeedMultiplier: 0.94,
    scoreMultiplier: 1.0,
    unlockAllSectors: false,
    isHardMode: false
  },
  COMMANDER: {
    id: 'COMMANDER',
    nameTr: 'NORMAL',
    nameEn: 'NORMAL',
    shortTr: 'NORMAL',
    shortEn: 'NORMAL',
    startingLives: 4,
    shieldMultiplier: 1.15,
    enemySpeedMultiplier: 0.88,
    fuseSpeedMultiplier: 1.04,
    scoreMultiplier: 1.0,
    unlockAllSectors: false,
    isHardMode: false
  },
  LEGEND: {
    id: 'LEGEND',
    nameTr: 'ZOR',
    nameEn: 'HARD',
    shortTr: 'ZOR',
    shortEn: 'HARD',
    startingLives: 3,
    shieldMultiplier: 0.92,
    enemySpeedMultiplier: 1.08,
    fuseSpeedMultiplier: 1.24,
    scoreMultiplier: 1.35,
    unlockAllSectors: false,
    isHardMode: true
  }
};

export type ShipSkinId = 'TITAN' | 'RUST' | 'SAND' | 'BLACK';

export interface ShipSkinConfig {
  id: ShipSkinId;
  name: string;
  nameTr: string;
  nameEn: string;
  starsRequired: number;
  elitePackUnlock?: boolean;
  hullLightHex: string;
  hullMidHex: string;
  hullDarkHex: string;
  cockpitLightHex: string;
  cockpitDarkHex: string;
  wingAccentHex: string;
}

export const SHIP_SKINS: ShipSkinConfig[] = [
  {
    id: 'TITAN',
    name: 'GÜMÜŞ',
    nameTr: 'GÜMÜŞ',
    nameEn: 'SILVER',
    starsRequired: 0,
    hullLightHex: '#E8F0FA',
    hullMidHex: '#AAB6CA',
    hullDarkHex: '#5C687C',
    cockpitLightHex: '#FF7070',
    cockpitDarkHex: '#D81820',
    wingAccentHex: '#D82820'
  },
  {
    id: 'RUST',
    name: 'KIZIL',
    nameTr: 'KIZIL',
    nameEn: 'CRIMSON',
    starsRequired: 4,
    elitePackUnlock: true,
    hullLightHex: '#FF8A70',
    hullMidHex: '#D83824',
    hullDarkHex: '#7C140C',
    cockpitLightHex: '#FFF088',
    cockpitDarkHex: '#E89818',
    wingAccentHex: '#F8C830'
  },
  {
    id: 'SAND',
    name: 'ALTIN',
    nameTr: 'ALTIN',
    nameEn: 'GOLD',
    starsRequired: 12,
    elitePackUnlock: true,
    hullLightHex: '#FFF098',
    hullMidHex: '#E0A828',
    hullDarkHex: '#885808',
    cockpitLightHex: '#88E8FF',
    cockpitDarkHex: '#1888E8',
    wingAccentHex: '#28A8F8'
  },
  {
    id: 'BLACK',
    name: 'GÖLGE',
    nameTr: 'GÖLGE',
    nameEn: 'SHADOW',
    starsRequired: 24,
    elitePackUnlock: true,
    hullLightHex: '#8898B8',
    hullMidHex: '#445068',
    hullDarkHex: '#1E2434',
    cockpitLightHex: '#98FF70',
    cockpitDarkHex: '#20B838',
    wingAccentHex: '#28E038'
  }
];

export function arenaToCanvas(ax: number, ay: number): { x: number; y: number } {
  return {
    x: ARENA_VIEW_X + ax * ARENA_VIEW_SCALE,
    y: ARENA_VIEW_Y + ay * ARENA_VIEW_SCALE
  };
}

export function canvasToArena(cx: number, cy: number): { x: number; y: number } {
  return {
    x: (cx - ARENA_VIEW_X) / ARENA_VIEW_SCALE,
    y: (cy - ARENA_VIEW_Y) / ARENA_VIEW_SCALE
  };
}
