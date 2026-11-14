import { ChapterThemeId } from '../core/Config';
import { BossArchetype } from '../entities/bosses/BaseBoss';
import { PowerUpBoxConfig, PowerUpType } from '../entities/PowerUpBox';
import { BOX_BORDER_MARGIN, BOX_MIN_CENTER_GAP } from '../geometry/SolidBoxes';
import { Barrier } from '../geometry/Types';
import { CAMPAIGN_LEVELS, LevelConfig, MinionSpawnSpec, TierId } from './LevelDefinitions';

/**
 * 100 sequential stages split into 4 tiers of 25:
 * `KOLAY 1-25` -> `ORTA 26-50` -> `ZOR 51-75` -> `USTA 76-100`.
 * Every stage is generated deterministically (`mulberry32(stageNumber)`) with a smooth,
 * monotonically rising difficulty curve inside each 25-stage tier and `ALIEN_BRAIN` reserved
 * exclusively for Tier Finales (`25, 50, 75, 100`).
 */
export const TOTAL_STAGES = 100;
export const STAGES_PER_TIER = 25;

export interface TierSpec {
  id: TierId;
  index: 0 | 1 | 2 | 3;
  nameTr: string;
  start: number;
  end: number;
  targetPercent: number;
  shieldStart: number;
  shieldEnd: number;
  lives: number;
  bossSpeedStart: number;
  bossSpeedEnd: number;
  minionSpeedStart: number;
  minionSpeedEnd: number;
  hpStart: number;
  hpEnd: number;
  fuseRatio: number;
  barrierFractionStart: number;
  barrierFractionEnd: number;
  crawlerDelay: number;
  minions: readonly [number, number];
  powerWalls: readonly [number, number];
  pillars: readonly [number, number];
  blinkingChance: number;
  ricochet: boolean;
}

export const TIERS: readonly TierSpec[] = [
  {
    id: 'KOLAY',
    index: 0,
    nameTr: 'KOLAY',
    start: 1,
    end: 25,
    targetPercent: 80,
    shieldStart: 145,
    shieldEnd: 112,
    lives: 5,
    bossSpeedStart: 0.68,
    bossSpeedEnd: 0.84,
    minionSpeedStart: 0.68,
    minionSpeedEnd: 0.82,
    hpStart: 5,
    hpEnd: 12,
    fuseRatio: 0.88,
    barrierFractionStart: 0,
    barrierFractionEnd: 0,
    crawlerDelay: 105,
    minions: [1, 2],
    powerWalls: [3, 4],
    pillars: [0, 0],
    blinkingChance: 0,
    ricochet: false
  },
  {
    id: 'ORTA',
    index: 1,
    nameTr: 'ORTA',
    start: 26,
    end: 50,
    targetPercent: 82,
    shieldStart: 112,
    shieldEnd: 88,
    lives: 4,
    bossSpeedStart: 0.86,
    bossSpeedEnd: 1.0,
    minionSpeedStart: 0.84,
    minionSpeedEnd: 0.95,
    hpStart: 8,
    hpEnd: 16,
    fuseRatio: 1.02,
    barrierFractionStart: 0.08,
    barrierFractionEnd: 0.16,
    crawlerDelay: 76,
    minions: [2, 3],
    powerWalls: [3, 4],
    pillars: [1, 2],
    blinkingChance: 0.25,
    ricochet: false
  },
  {
    id: 'ZOR',
    index: 2,
    nameTr: 'ZOR',
    start: 51,
    end: 75,
    targetPercent: 85,
    shieldStart: 88,
    shieldEnd: 70,
    lives: 4,
    bossSpeedStart: 1.02,
    bossSpeedEnd: 1.16,
    minionSpeedStart: 0.96,
    minionSpeedEnd: 1.08,
    hpStart: 11,
    hpEnd: 20,
    fuseRatio: 1.16,
    barrierFractionStart: 0.16,
    barrierFractionEnd: 0.24,
    crawlerDelay: 58,
    minions: [2, 4],
    powerWalls: [2, 3],
    pillars: [3, 4],
    blinkingChance: 0.22,
    ricochet: true
  },
  {
    id: 'USTA',
    index: 3,
    nameTr: 'USTA',
    start: 76,
    end: 100,
    targetPercent: 88,
    shieldStart: 72,
    shieldEnd: 56,
    lives: 4,
    bossSpeedStart: 1.16,
    bossSpeedEnd: 1.28,
    minionSpeedStart: 1.08,
    minionSpeedEnd: 1.18,
    hpStart: 14,
    hpEnd: 24,
    fuseRatio: 1.28,
    barrierFractionStart: 0.22,
    barrierFractionEnd: 0.3,
    crawlerDelay: 46,
    minions: [3, 4],
    powerWalls: [2, 2],
    pillars: [4, 6],
    blinkingChance: 0,
    ricochet: true
  }
];

/**
 * Curated 25-stage Boss Curriculum within each Tier (`posInTier = 0..24`):
 * - Calm movement bosses first (`CENTIPEDE`, `BIO_WHEEL`, `LOBSTER_MECHA`)
 * - 5-stage milestones (`pos 4, 9, 14, 19`) feature signature heavy bosses
 * - `TWIN_SPLIT` appears 3 times per tier so players master Twin Separation
 * - `ALIEN_BRAIN` is exclusively the Tier Finale (`pos 24` -> Stages `25, 50, 75, 100`)!
 */
const TIER_BOSS_PROGRESSION: readonly BossArchetype[] = [
  'CENTIPEDE',      // +1 (e.g. 01)
  'BIO_WHEEL',      // +2 (02)
  'LOBSTER_MECHA',  // +3 (03)
  'MANTIS',         // +4 (04)
  'CRUISER_CORE',   // +5 (05 Milestone)
  'TWIN_SPLIT',     // +6 (06)
  'MORPHING_CELL',  // +7 (07)
  'LOBSTER_MECHA',  // +8 (08)
  'BIO_WHEEL',      // +9 (09)
  'CYBER_SKULL',    // +10 (10 Milestone)
  'CENTIPEDE',      // +11 (11)
  'MANTIS',         // +12 (12)
  'OPTIC_NERVE',    // +13 (13)
  'TWIN_SPLIT',     // +14 (14)
  'CRUISER_CORE',   // +15 (15 Milestone)
  'MORPHING_CELL',  // +16 (16)
  'LOBSTER_MECHA',  // +17 (17)
  'CYBER_SKULL',    // +18 (18)
  'MANTIS',         // +19 (19)
  'OPTIC_NERVE',    // +20 (20 Milestone)
  'BIO_WHEEL',      // +21 (21)
  'TWIN_SPLIT',     // +22 (22)
  'CYBER_SKULL',    // +23 (23)
  'CENTIPEDE',      // +24 (24)
  'ALIEN_BRAIN'     // +25 (25 Tier Finale!)
];

const NON_FINALE_THEMES: readonly ChapterThemeId[] = CAMPAIGN_LEVELS.slice(0, 15).map(
  (l) => l.chapterTheme
);

const ESCORT_POOL: readonly BossArchetype[] = [
  'BIO_WHEEL',
  'MORPHING_CELL',
  'MANTIS',
  'LOBSTER_MECHA',
  'OPTIC_NERVE',
  'CYBER_SKULL'
];

const HUE_SHIFT_BY_CYCLE: readonly number[] = [0, 38, -34, 72, -68, 118, 160];

/** Escort spawn point (top-center); boxes keep clear of it. */
export const ESCORT_SPAWN = { x: 450, y: 250 } as const;

export function clampStage(n: number): number {
  return Math.max(1, Math.min(TOTAL_STAGES, Math.round(n)));
}

export function getTierForStage(stage: number): TierSpec {
  const s = clampStage(stage);
  return TIERS[Math.min(3, Math.floor((s - 1) / STAGES_PER_TIER))];
}

/** A tier opens only once the previous tier's final stage has been cleared. */
export function isTierUnlocked(tierIndex: number, unlockedSector: number): boolean {
  const tier = TIERS[Math.max(0, Math.min(3, tierIndex))];
  return unlockedSector >= tier.start;
}

export function formatStageNumber(stage: number): string {
  return String(clampStage(stage)).padStart(3, '0');
}

/** Deterministic seeded PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function escortStagesFor(tier: TierSpec, stage: number): boolean {
  switch (tier.id) {
    case 'KOLAY':
      return false;
    case 'ORTA':
      return stage === 35 || stage === 45 || stage === 50;
    case 'ZOR':
      return stage === 55 || stage === 60 || stage === 65 || stage === 70 || stage === 75;
    case 'USTA':
      return stage === 80 || stage === 85 || stage === 90 || stage === 95 || stage === 100;
  }
}

/**
 * Generates outer-frame steel barrier segments covering `fraction` of the 4200-unit perimeter.
 * Returns `[]` whenever `fraction <= 0` so `KOLAY (1-25)` never leaks template barriers!
 * Keeps 70 units clear of every corner and the bottom-center ship spawn (`x 300..600`) free.
 */
function generateBarriers(rng: () => number, fraction: number): Barrier[] {
  if (fraction <= 0) return [];

  const out: Barrier[] = [];
  const targetLen = 4200 * fraction;
  let covered = 0;

  type Edge = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  const edges: Edge[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];

  const overlaps = (cand: Barrier): boolean =>
    out.some((b) => {
      const sameLine =
        (b.x1 === b.x2 && cand.x1 === cand.x2 && b.x1 === cand.x1) ||
        (b.y1 === b.y2 && cand.y1 === cand.y2 && b.y1 === cand.y1);
      if (!sameLine) return false;
      if (b.x1 === b.x2) {
        return !(cand.y2 + 70 <= b.y1 || cand.y1 >= b.y2 + 70);
      }
      return !(cand.x2 + 70 <= b.x1 || cand.x1 >= b.x2 + 70);
    });

  for (let attempt = 0; attempt < 220 && covered < targetLen; attempt++) {
    const edge = edges[Math.floor(rng() * edges.length)];
    const len = Math.round(randInt(rng, 140, 220) / 10) * 10;
    let cand: Barrier;
    if (edge === 'TOP' || edge === 'BOTTOM') {
      const start = Math.round(randInt(rng, 70, 900 - 70 - len) / 10) * 10;
      cand = {
        x1: start,
        y1: edge === 'TOP' ? 0 : 1200,
        x2: start + len,
        y2: edge === 'TOP' ? 0 : 1200
      };
      if (edge === 'BOTTOM' && !(cand.x2 <= 290 || cand.x1 >= 610)) continue;
    } else {
      const start = Math.round(randInt(rng, 70, 1200 - 70 - len) / 10) * 10;
      const x = edge === 'LEFT' ? 0 : 900;
      cand = { x1: x, y1: start, x2: x, y2: start + len };
    }
    if (overlaps(cand)) continue;
    out.push(cand);
    covered += len;
  }
  return out;
}

/**
 * Places solid wall blocks on the even 10-unit grid with strict safe-corridor spacing:
 * `>= 130` from the frame, clear of boss & player launch zones, and `>= 160` Chebyshev distance
 * between centers (edge gap >= 92), so the ship can always wrap around every block.
 */
function placeBoxes(
  rng: () => number,
  types: readonly PowerUpType[],
  blinkingChance: number
): PowerUpBoxConfig[] {
  const placed: PowerUpBoxConfig[] = [];
  const minX = BOX_BORDER_MARGIN;
  const maxX = 900 - BOX_BORDER_MARGIN;
  const minY = BOX_BORDER_MARGIN;
  const maxY = 1200 - BOX_BORDER_MARGIN;

  const inReservedZone = (x: number, y: number): boolean =>
    (x > 300 && x < 600 && y > 370 && y < 650) ||
    Math.hypot(x - ESCORT_SPAWN.x, y - ESCORT_SPAWN.y) < 120 ||
    (Math.abs(x - 450) < 100 && y > 960);

  for (const type of types) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const x = Math.round(lerp(minX, maxX, rng()) / 10) * 10;
      const y = Math.round(lerp(minY, maxY, rng()) / 10) * 10;
      if (inReservedZone(x, y)) continue;
      const clash = placed.some(
        (p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < BOX_MIN_CENTER_GAP
      );
      if (clash) continue;
      placed.push({
        x,
        y,
        type,
        blinking: type !== 'ARMOR_PILLAR' && type !== 'BOSS_CANNON' && rng() < blinkingChance
      });
      break;
    }
  }
  return placed;
}

function buildMinions(rng: () => number, tier: TierSpec, posInTier: number): MinionSpawnSpec {
  // Smooth onboarding: Stages 1..4 start with a single calm Scarab Beetle (no Hunters/Prisms)!
  if (tier.index === 0 && posInTier < 4) {
    return {
      drones: 1,
      hunters: 0,
      prisms: 0,
      crawlerDelaySeconds: tier.crawlerDelay + 20
    };
  }
  if (tier.index === 0 && posInTier < 10) {
    return {
      drones: posInTier < 7 ? 1 : 2,
      hunters: 0,
      prisms: 0,
      crawlerDelaySeconds: tier.crawlerDelay
    };
  }

  const progress = posInTier / (STAGES_PER_TIER - 1);
  const total =
    progress < 0.45 ? tier.minions[0] : randInt(rng, tier.minions[0], tier.minions[1]);

  let drones = 0;
  let hunters = 0;
  let prisms = 0;
  for (let i = 0; i < total; i++) {
    const r = rng();
    if (tier.index === 0) {
      if (r < 0.72) drones++;
      else if (r < 0.92) hunters++;
      else prisms++;
    } else if (tier.index === 1) {
      if (r < 0.5) drones++;
      else if (r < 0.84) hunters++;
      else prisms++;
    } else {
      if (r < 0.3) drones++;
      else if (r < 0.8) hunters++;
      else prisms++;
    }
  }
  prisms = Math.min(prisms, tier.index <= 1 ? 1 : 2);
  return { drones, hunters, prisms, crawlerDelaySeconds: tier.crawlerDelay };
}

const STAGE_CACHE = new Map<number, LevelConfig>();

export function generateStage(stageNumber: number): LevelConfig {
  const n = clampStage(stageNumber);
  const cached = STAGE_CACHE.get(n);
  if (cached) return cached;

  const rng = mulberry32(n * 7919 + 13);
  const tier = getTierForStage(n);
  const posInTier = n - tier.start; // 0..24
  const isTierFinale = posInTier === STAGES_PER_TIER - 1;
  const isMilestone = n % 5 === 0;
  const t = posInTier / (STAGES_PER_TIER - 1);

  const bossType: BossArchetype = TIER_BOSS_PROGRESSION[posInTier];
  const chapterTheme: ChapterThemeId = isTierFinale
    ? 'STAGE_16_BRAIN_CORTEX'
    : NON_FINALE_THEMES[(posInTier + tier.index * 4) % NON_FINALE_THEMES.length];

  let escortBossType: BossArchetype | null = null;
  if (n === TOTAL_STAGES) {
    escortBossType = 'TWIN_SPLIT';
  } else if (escortStagesFor(tier, n) && bossType !== 'TWIN_SPLIT') {
    const pool = ESCORT_POOL.filter((b) => b !== bossType);
    escortBossType = pool[Math.floor(rng() * pool.length)];
  }

  // Smoothly rising Boss HP within the tier (+2 HP on 5-stage milestones, +3 HP on Tier Finale)
  const baseHp = Math.round(lerp(tier.hpStart, tier.hpEnd, t));
  const bossHp = baseHp + (isTierFinale ? 3 : isMilestone ? 2 : 0);

  // Solid wall block composition
  const wallCount = randInt(rng, tier.powerWalls[0], tier.powerWalls[1]);
  const pillarCount = randInt(rng, tier.pillars[0], tier.pillars[1]);
  const wallTypes: PowerUpType[] = [];

  if (n <= 3) {
    // Curated onboarding power-up loadouts on Stages 1..3 so new players feel empowered!
    if (n === 1) wallTypes.push('S', 'L', 'P');
    else if (n === 2) wallTypes.push('S', 'T', 'L');
    else wallTypes.push('BOSS_CANNON', 'S', 'P');
  } else {
    const pool: PowerUpType[] = tier.index === 3 ? ['P', 'S', 'L'] : ['S', 'T', 'P', 'L', 'C'];
    const wantsSuperShot =
      (isMilestone || isTierFinale || posInTier % 4 === 2) && wallCount > 0;
    for (let i = 0; i < wallCount; i++) {
      if (i === 0 && wantsSuperShot) {
        wallTypes.push('BOSS_CANNON');
      } else {
        wallTypes.push(pool[Math.floor(rng() * pool.length)]);
      }
    }
  }

  const allTypes: PowerUpType[] = [...wallTypes];
  for (let i = 0; i < pillarCount; i++) {
    allTypes.push('ARMOR_PILLAR');
  }

  const greyBoxes = placeBoxes(rng, allTypes, tier.blinkingChance);
  const barrierFraction =
    tier.id === 'ORTA' && posInTier < 3
      ? 0
      : lerp(tier.barrierFractionStart, tier.barrierFractionEnd, t);
  const barrierSegments = generateBarriers(rng, barrierFraction);

  const shieldDuration = Math.round(lerp(tier.shieldStart, tier.shieldEnd, t));
  const bossSpeedMultiplier =
    Math.round(lerp(tier.bossSpeedStart, tier.bossSpeedEnd, t) * (isMilestone ? 1.04 : 1) * 100) /
    100;
  const minionSpeedMultiplier =
    Math.round(lerp(tier.minionSpeedStart, tier.minionSpeedEnd, t) * 100) / 100;
  const targetPercent = tier.id === 'USTA' && n >= 96 ? 90 : tier.targetPercent;
  const cycle = Math.floor((n - 1) / CAMPAIGN_LEVELS.length);
  const label = formatStageNumber(n);

  const cfg: LevelConfig = {
    id: n,
    sectorTitleTr: `BÖLÜM ${label}`,
    sectorTitleEn: `STAGE ${label}`,
    chapterTheme,
    bossType,
    bossHp,
    minionSetup: buildMinions(rng, tier, posInTier),
    shieldUnits: 999,
    shieldDuration,
    shieldDurationHard: Math.round(shieldDuration * 0.85),
    barrierSegments,
    greyBoxes,
    hasRedLightBossBox: wallTypes.includes('BOSS_CANNON'),
    tier: tier.id,
    tierIndex: tier.index,
    targetPercent,
    startingLives: tier.lives,
    bossSpeedMultiplier,
    minionSpeedMultiplier,
    fuseSpeedRatio: tier.fuseRatio,
    escortBossType,
    isMilestone,
    paletteHueShift: HUE_SHIFT_BY_CYCLE[Math.min(HUE_SHIFT_BY_CYCLE.length - 1, cycle)],
    bulletsRicochet: tier.ricochet
  };

  STAGE_CACHE.set(n, cfg);
  return cfg;
}

export function getCampaignLevel(stageNumber: number): LevelConfig {
  return generateStage(stageNumber);
}

/** Endless waves loop through the 100-stage campaign with a growing pressure curve. */
export function generateEndlessWaveConfig(waveNumber: number): LevelConfig {
  const base = generateStage(((waveNumber - 1) % TOTAL_STAGES) + 1);
  const cycle = Math.floor((waveNumber - 1) / TOTAL_STAGES);
  const labelNum = String(waveNumber).padStart(3, '0');
  return {
    ...base,
    id: waveNumber,
    sectorTitleTr: `DALGA ${labelNum}`,
    sectorTitleEn: `WAVE ${labelNum}`,
    shieldDuration: Math.max(36, base.shieldDuration - cycle * 6),
    shieldDurationHard: Math.max(32, base.shieldDurationHard - cycle * 5),
    bossSpeedMultiplier: base.bossSpeedMultiplier * (1 + cycle * 0.08)
  };
}
