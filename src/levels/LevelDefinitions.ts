import { ChapterThemeId, DifficultyId } from '../core/Config';
import { BossArchetype } from '../entities/bosses/BaseBoss';
import { PowerUpBoxConfig } from '../entities/PowerUpBox';
import { Barrier } from '../geometry/Types';

export interface MinionSpawnSpec {
  drones: number;
  hunters: number;
  prisms: number;
  crawlerDelaySeconds: number;
}

export interface LevelTemplate {
  id: number;
  sectorTitleTr: string;
  sectorTitleEn: string;
  chapterTheme: ChapterThemeId;
  bossType: BossArchetype;
  bossHp: number;
  minionSetup: MinionSpawnSpec;
  shieldUnits: number;
  shieldDuration: number;
  shieldDurationHard: number;
  barrierSegments: Barrier[];
  greyBoxes: PowerUpBoxConfig[];
  hardBoxes?: PowerUpBoxConfig[];
  hasRedLightBossBox: boolean;
}

export type TierId = 'KOLAY' | 'ORTA' | 'ZOR' | 'USTA';

/**
 * V5 fully-resolved stage (`BÖLÜM 001..100`) produced by `CampaignGenerator`.
 */
export interface LevelConfig extends LevelTemplate {
  tier: TierId;
  tierIndex: 0 | 1 | 2 | 3;
  targetPercent: number;
  startingLives: number;
  bossSpeedMultiplier: number;
  minionSpeedMultiplier: number;
  /** Spark (fuse) speed as a multiple of the base 300 px/s cut speed. */
  fuseSpeedRatio: number;
  escortBossType: BossArchetype | null;
  isMilestone: boolean;
  /** Hue rotation (degrees) applied to recycled terrain art so 100 stages never look identical. */
  paletteHueShift: number;
  /** Hard/Master tiers: enemy plasma orbs ricochet once off solid wall blocks. */
  bulletsRicochet: boolean;
}

export const CAMPAIGN_LEVELS: LevelTemplate[] = [
  // 01: Cratered Desert + Right Steel Pipe Space Base (`01-hedef-oynanis.jpg`!)
  {
    id: 1,
    sectorTitleTr: 'BÖLÜM 01',
    sectorTitleEn: 'STAGE 01',
    chapterTheme: 'STAGE_01_DESERT_BASE',
    bossType: 'CENTIPEDE',
    bossHp: 6,
    minionSetup: { drones: 3, hunters: 0, prisms: 0, crawlerDelaySeconds: 52 },
    shieldUnits: 999,
    shieldDuration: 110,
    shieldDurationHard: 90,
    barrierSegments: [
      { x1: 0, y1: 490, x2: 0, y2: 710 },
      { x1: 900, y1: 490, x2: 900, y2: 710 }
    ],
    greyBoxes: [
      { x: 195, y: 260, type: 'S' },
      { x: 705, y: 260, type: 'L' },
      { x: 195, y: 920, type: 'T' },
      { x: 705, y: 920, type: 'P' },
      { x: 450, y: 800, type: 'BOSS_CANNON' }
    ],
    hasRedLightBossBox: true
  },
  // 02: Cobalt Bio-Ocean & Sunken Temple
  {
    id: 2,
    sectorTitleTr: 'BÖLÜM 02',
    sectorTitleEn: 'STAGE 02',
    chapterTheme: 'STAGE_02_COBALT_OCEAN',
    bossType: 'LOBSTER_MECHA',
    bossHp: 7,
    minionSetup: { drones: 2, hunters: 1, prisms: 0, crawlerDelaySeconds: 48 },
    shieldUnits: 999,
    shieldDuration: 105,
    shieldDurationHard: 85,
    barrierSegments: [
      { x1: 0, y1: 480, x2: 0, y2: 720 },
      { x1: 900, y1: 480, x2: 900, y2: 720 }
    ],
    greyBoxes: [
      { x: 190, y: 250, type: 'S' },
      { x: 710, y: 250, type: 'P' },
      { x: 190, y: 940, type: 'L' },
      { x: 710, y: 940, type: 'C' }
    ],
    hasRedLightBossBox: false
  },
  // 03: Rocky Canyon & Reactor Base
  {
    id: 3,
    sectorTitleTr: 'BÖLÜM 03',
    sectorTitleEn: 'STAGE 03',
    chapterTheme: 'STAGE_03_ROCK_REACTOR',
    bossType: 'BIO_WHEEL',
    bossHp: 8,
    minionSetup: { drones: 0, hunters: 2, prisms: 1, crawlerDelaySeconds: 45 },
    shieldUnits: 999,
    shieldDuration: 100,
    shieldDurationHard: 82,
    barrierSegments: [
      { x1: 350, y1: 0, x2: 550, y2: 0 },
      { x1: 0, y1: 490, x2: 0, y2: 710 },
      { x1: 900, y1: 490, x2: 900, y2: 710 }
    ],
    greyBoxes: [
      { x: 185, y: 240, type: 'S' },
      { x: 715, y: 240, type: 'T' },
      { x: 185, y: 950, type: 'P' },
      { x: 715, y: 950, type: 'BOSS_CANNON' }
    ],
    hasRedLightBossBox: true
  },
  // 04: Emerald Crystal Cavern
  {
    id: 4,
    sectorTitleTr: 'BÖLÜM 04',
    sectorTitleEn: 'STAGE 04',
    chapterTheme: 'STAGE_04_EMERALD_CAVE',
    bossType: 'MANTIS',
    bossHp: 8,
    minionSetup: { drones: 3, hunters: 1, prisms: 0, crawlerDelaySeconds: 42 },
    shieldUnits: 999,
    shieldDuration: 96,
    shieldDurationHard: 78,
    barrierSegments: [
      { x1: 0, y1: 230, x2: 0, y2: 470 },
      { x1: 900, y1: 730, x2: 900, y2: 970 }
    ],
    greyBoxes: [
      { x: 200, y: 250, type: 'S' },
      { x: 700, y: 250, type: 'T' },
      { x: 200, y: 950, type: 'C' },
      { x: 700, y: 950, type: 'L', blinking: true }
    ],
    hasRedLightBossBox: false
  },
  // 05: Orbital Station Deck
  {
    id: 5,
    sectorTitleTr: 'BÖLÜM 05',
    sectorTitleEn: 'STAGE 05',
    chapterTheme: 'STAGE_05_ORBITAL_DECK',
    bossType: 'CRUISER_CORE',
    bossHp: 9,
    minionSetup: { drones: 2, hunters: 2, prisms: 0, crawlerDelaySeconds: 40 },
    shieldUnits: 999,
    shieldDuration: 92,
    shieldDurationHard: 75,
    barrierSegments: [
      { x1: 120, y1: 0, x2: 310, y2: 0 },
      { x1: 590, y1: 0, x2: 780, y2: 0 }
    ],
    greyBoxes: [
      { x: 185, y: 240, type: 'S' },
      { x: 715, y: 240, type: 'P' },
      { x: 185, y: 950, type: 'L' },
      { x: 715, y: 950, type: 'BOSS_CANNON', blinking: true }
    ],
    hasRedLightBossBox: true
  },
  // 06: Ancient Gold-Bronze Twin Temple (`TWIN_SPLIT`)
  {
    id: 6,
    sectorTitleTr: 'BÖLÜM 06',
    sectorTitleEn: 'STAGE 06',
    chapterTheme: 'STAGE_06_TWIN_TEMPLE',
    bossType: 'TWIN_SPLIT',
    bossHp: 12,
    minionSetup: { drones: 2, hunters: 0, prisms: 0, crawlerDelaySeconds: 38 },
    shieldUnits: 999,
    shieldDuration: 95,
    shieldDurationHard: 78,
    barrierSegments: [
      { x1: 0, y1: 470, x2: 0, y2: 730 },
      { x1: 900, y1: 470, x2: 900, y2: 730 }
    ],
    greyBoxes: [
      { x: 190, y: 240, type: 'S' },
      { x: 710, y: 240, type: 'T' },
      { x: 450, y: 955, type: 'P' }
    ],
    hasRedLightBossBox: false
  },
  // 07: Purple Bio-Hive & Cocoons (`MORPHING_CELL`)
  {
    id: 7,
    sectorTitleTr: 'BÖLÜM 07',
    sectorTitleEn: 'STAGE 07',
    chapterTheme: 'STAGE_07_BIO_HIVE',
    bossType: 'MORPHING_CELL',
    bossHp: 10,
    minionSetup: { drones: 0, hunters: 1, prisms: 2, crawlerDelaySeconds: 36 },
    shieldUnits: 999,
    shieldDuration: 90,
    shieldDurationHard: 72,
    barrierSegments: [
      { x1: 350, y1: 0, x2: 550, y2: 0 },
      { x1: 0, y1: 220, x2: 0, y2: 460 },
      { x1: 900, y1: 740, x2: 900, y2: 980 }
    ],
    greyBoxes: [
      { x: 190, y: 245, type: 'S' },
      { x: 710, y: 245, type: 'L' },
      { x: 190, y: 955, type: 'C' },
      { x: 710, y: 955, type: 'T', blinking: true }
    ],
    hasRedLightBossBox: false
  },
  // 08: Volcanic Basalt & Magma (`CENTIPEDE` Gold 12-segment!)
  {
    id: 8,
    sectorTitleTr: 'BÖLÜM 08',
    sectorTitleEn: 'STAGE 08',
    chapterTheme: 'STAGE_08_VOLCANIC_MAGMA',
    bossType: 'CENTIPEDE',
    bossHp: 10,
    minionSetup: { drones: 3, hunters: 1, prisms: 0, crawlerDelaySeconds: 34 },
    shieldUnits: 999,
    shieldDuration: 88,
    shieldDurationHard: 70,
    barrierSegments: [
      { x1: 110, y1: 0, x2: 300, y2: 0 },
      { x1: 600, y1: 0, x2: 790, y2: 0 },
      { x1: 0, y1: 480, x2: 0, y2: 720 },
      { x1: 900, y1: 480, x2: 900, y2: 720 }
    ],
    greyBoxes: [
      { x: 185, y: 235, type: 'S' },
      { x: 715, y: 235, type: 'T' },
      { x: 185, y: 960, type: 'P' },
      { x: 715, y: 960, type: 'BOSS_CANNON', blinking: true }
    ],
    hasRedLightBossBox: true
  },
  // 09: Copper Foundry & Gears (`LOBSTER_MECHA` Elite)
  {
    id: 9,
    sectorTitleTr: 'BÖLÜM 09',
    sectorTitleEn: 'STAGE 09',
    chapterTheme: 'STAGE_09_COPPER_GEARS',
    bossType: 'LOBSTER_MECHA',
    bossHp: 11,
    minionSetup: { drones: 0, hunters: 2, prisms: 2, crawlerDelaySeconds: 32 },
    shieldUnits: 999,
    shieldDuration: 85,
    shieldDurationHard: 68,
    barrierSegments: [
      { x1: 340, y1: 0, x2: 560, y2: 0 },
      { x1: 0, y1: 460, x2: 0, y2: 740 },
      { x1: 900, y1: 460, x2: 900, y2: 740 }
    ],
    greyBoxes: [
      { x: 185, y: 235, type: 'S' },
      { x: 715, y: 235, type: 'P' },
      { x: 185, y: 960, type: 'C' },
      { x: 715, y: 960, type: 'L', blinking: true }
    ],
    hasRedLightBossBox: false
  },
  // 10: Glacial Crater & Mech Wreck (`MANTIS` Elite)
  {
    id: 10,
    sectorTitleTr: 'BÖLÜM 10',
    sectorTitleEn: 'STAGE 10',
    chapterTheme: 'STAGE_10_GLACIAL_WRECK',
    bossType: 'MANTIS',
    bossHp: 11,
    minionSetup: { drones: 1, hunters: 3, prisms: 0, crawlerDelaySeconds: 30 },
    shieldUnits: 999,
    shieldDuration: 82,
    shieldDurationHard: 65,
    barrierSegments: [
      { x1: 110, y1: 0, x2: 290, y2: 0 },
      { x1: 610, y1: 0, x2: 790, y2: 0 },
      { x1: 110, y1: 1200, x2: 280, y2: 1200 }
    ],
    greyBoxes: [
      { x: 190, y: 240, type: 'S' },
      { x: 710, y: 240, type: 'T' },
      { x: 190, y: 960, type: 'P' },
      { x: 710, y: 960, type: 'BOSS_CANNON', blinking: true }
    ],
    hasRedLightBossBox: true
  },
  // 11: Turquoise Subsea Turbine (`BIO_WHEEL` Electric)
  {
    id: 11,
    sectorTitleTr: 'BÖLÜM 11',
    sectorTitleEn: 'STAGE 11',
    chapterTheme: 'STAGE_11_TURBINE_ABYSS',
    bossType: 'BIO_WHEEL',
    bossHp: 12,
    minionSetup: { drones: 0, hunters: 2, prisms: 2, crawlerDelaySeconds: 29 },
    shieldUnits: 999,
    shieldDuration: 80,
    shieldDurationHard: 62,
    barrierSegments: [
      { x1: 0, y1: 210, x2: 0, y2: 470 },
      { x1: 900, y1: 210, x2: 900, y2: 470 },
      { x1: 0, y1: 730, x2: 0, y2: 990 },
      { x1: 900, y1: 730, x2: 900, y2: 990 }
    ],
    greyBoxes: [
      { x: 195, y: 235, type: 'S' },
      { x: 705, y: 235, type: 'P' },
      { x: 195, y: 965, type: 'L' },
      { x: 705, y: 965, type: 'C' }
    ],
    hasRedLightBossBox: false
  },
  // 12: Cybernetic Fortress Gate (`CYBER_SKULL` Iconic 16-Bit Skull!)
  {
    id: 12,
    sectorTitleTr: 'BÖLÜM 12',
    sectorTitleEn: 'STAGE 12',
    chapterTheme: 'STAGE_12_CYBER_GATE',
    bossType: 'CYBER_SKULL',
    bossHp: 12,
    minionSetup: { drones: 2, hunters: 3, prisms: 0, crawlerDelaySeconds: 28 },
    shieldUnits: 999,
    shieldDuration: 78,
    shieldDurationHard: 60,
    barrierSegments: [
      { x1: 340, y1: 0, x2: 560, y2: 0 },
      { x1: 0, y1: 450, x2: 0, y2: 750 },
      { x1: 900, y1: 450, x2: 900, y2: 750 }
    ],
    greyBoxes: [
      { x: 185, y: 230, type: 'S' },
      { x: 715, y: 230, type: 'T' },
      { x: 185, y: 965, type: 'P' },
      { x: 715, y: 965, type: 'BOSS_CANNON', blinking: true }
    ],
    hasRedLightBossBox: true
  },
  // 13: Biomechanical Spine (`OPTIC_NERVE` - scarce boxes!)
  {
    id: 13,
    sectorTitleTr: 'BÖLÜM 13',
    sectorTitleEn: 'STAGE 13',
    chapterTheme: 'STAGE_13_SPINE_TUNNEL',
    bossType: 'OPTIC_NERVE',
    bossHp: 13,
    minionSetup: { drones: 0, hunters: 3, prisms: 1, crawlerDelaySeconds: 27 },
    shieldUnits: 999,
    shieldDuration: 75,
    shieldDurationHard: 58,
    barrierSegments: [
      { x1: 100, y1: 0, x2: 300, y2: 0 },
      { x1: 600, y1: 0, x2: 800, y2: 0 },
      { x1: 0, y1: 460, x2: 0, y2: 740 },
      { x1: 900, y1: 460, x2: 900, y2: 740 }
    ],
    greyBoxes: [
      { x: 220, y: 280, type: 'P' },
      { x: 680, y: 920, type: 'S', blinking: true }
    ],
    hardBoxes: [],
    hasRedLightBossBox: false
  },
  // 14: Neural Synapse Circuit (`TWIN_SPLIT` Neural Twin!)
  {
    id: 14,
    sectorTitleTr: 'BÖLÜM 14',
    sectorTitleEn: 'STAGE 14',
    chapterTheme: 'STAGE_14_SYNAPSE_MATRIX',
    bossType: 'TWIN_SPLIT',
    bossHp: 16,
    minionSetup: { drones: 0, hunters: 2, prisms: 2, crawlerDelaySeconds: 26 },
    shieldUnits: 999,
    shieldDuration: 74,
    shieldDurationHard: 56,
    barrierSegments: [
      { x1: 340, y1: 0, x2: 560, y2: 0 },
      { x1: 0, y1: 450, x2: 0, y2: 750 },
      { x1: 900, y1: 450, x2: 900, y2: 750 }
    ],
    greyBoxes: [
      { x: 220, y: 260, type: 'S' },
      { x: 680, y: 940, type: 'P', blinking: true }
    ],
    hardBoxes: [{ x: 450, y: 940, type: 'P', blinking: true }],
    hasRedLightBossBox: false
  },
  // 15: Crimson Core (`CENTIPEDE` Crimson 15-segment!)
  {
    id: 15,
    sectorTitleTr: 'BÖLÜM 15',
    sectorTitleEn: 'STAGE 15',
    chapterTheme: 'STAGE_15_CRIMSON_ARTERIES',
    bossType: 'CENTIPEDE',
    bossHp: 14,
    minionSetup: { drones: 3, hunters: 2, prisms: 0, crawlerDelaySeconds: 25 },
    shieldUnits: 999,
    shieldDuration: 72,
    shieldDurationHard: 55,
    barrierSegments: [
      { x1: 90, y1: 0, x2: 210, y2: 0 },
      { x1: 690, y1: 0, x2: 810, y2: 0 },
      { x1: 0, y1: 450, x2: 0, y2: 750 },
      { x1: 900, y1: 450, x2: 900, y2: 750 }
    ],
    greyBoxes: [
      { x: 200, y: 240, type: 'S' },
      { x: 700, y: 240, type: 'P' },
      { x: 450, y: 950, type: 'T', blinking: true }
    ],
    hardBoxes: [{ x: 450, y: 950, type: 'P', blinking: true }],
    hasRedLightBossBox: false
  },
  // 16: Final Alien Brain Cortex -> Escape Hatch (`ALIEN_BRAIN`)
  {
    id: 16,
    sectorTitleTr: 'BÖLÜM 16',
    sectorTitleEn: 'STAGE 16',
    chapterTheme: 'STAGE_16_BRAIN_CORTEX',
    bossType: 'ALIEN_BRAIN',
    bossHp: 18,
    minionSetup: { drones: 0, hunters: 3, prisms: 2, crawlerDelaySeconds: 24 },
    shieldUnits: 999,
    shieldDuration: 75,
    shieldDurationHard: 55,
    barrierSegments: [
      { x1: 110, y1: 0, x2: 220, y2: 0 },
      { x1: 680, y1: 0, x2: 790, y2: 0 },
      { x1: 0, y1: 450, x2: 0, y2: 750 },
      { x1: 900, y1: 450, x2: 900, y2: 750 },
      { x1: 100, y1: 1200, x2: 210, y2: 1200 },
      { x1: 690, y1: 1200, x2: 800, y2: 1200 }
    ],
    greyBoxes: [
      { x: 200, y: 230, type: 'S' },
      { x: 700, y: 230, type: 'P' },
      { x: 450, y: 955, type: 'BOSS_CANNON', blinking: true }
    ],
    hardBoxes: [{ x: 450, y: 955, type: 'P' }],
    hasRedLightBossBox: true
  }
];


export function resolveLevelBoxes(cfg: LevelConfig, _difficulty: DifficultyId): PowerUpBoxConfig[] {
  return cfg.greyBoxes;
}

export function resolveLevelShieldDuration(cfg: LevelConfig, difficulty: DifficultyId): number {
  if (difficulty === 'LEGEND') {
    return cfg.shieldDurationHard;
  }
  if (difficulty === 'EXPLORER') {
    return Math.round(cfg.shieldDuration * 1.18);
  }
  return cfg.shieldDuration;
}
