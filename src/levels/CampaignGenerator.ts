import { ChapterThemeId } from '../core/Config';
import { BossArchetype } from '../entities/bosses/BaseBoss';
import { PowerUpBoxConfig, PowerUpType } from '../entities/PowerUpBox';
import { BOX_BORDER_MARGIN, BOX_MIN_CENTER_GAP } from '../geometry/SolidBoxes';
import { Barrier } from '../geometry/Types';
import { CAMPAIGN_LEVELS, LevelConfig, LevelTemplate, MinionSpawnSpec, TierId } from './LevelDefinitions';

/**
 * V5 — 100 sequential stages split into 4 tiers of 25:
 * `KOLAY 1-25` -> `ORTA 26-50` -> `ZOR 51-75` -> `USTA 76-100`.
 * Every stage is generated deterministically (`mulberry32(stageNumber)`) on top of the
 * 16 hand-made 16-bit planet/boss templates, so stage N always looks and plays the same.
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
  bossSpeed: number;
  minionSpeed: number;
  fuseRatio: number;
  barrierFraction: number;
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
    shieldStart: 135,
    shieldEnd: 105,
    lives: 5,
    bossSpeed: 0.82,
    minionSpeed: 0.8,
    fuseRatio: 0.96,
    barrierFraction: 0,
    crawlerDelay: 95,
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
    shieldStart: 105,
    shieldEnd: 84,
    lives: 4,
    bossSpeed: 0.98,
    minionSpeed: 0.92,
    fuseRatio: 1.08,
    barrierFraction: 0.14,
    crawlerDelay: 72,
    minions: [2, 3],
    powerWalls: [3, 4],
    pillars: [1, 2],
    blinkingChance: 0.3,
    ricochet: false
  },
  {
    id: 'ZOR',
    index: 2,
    nameTr: 'ZOR',
    start: 51,
    end: 75,
    targetPercent: 85,
    shieldStart: 84,
    shieldEnd: 68,
    lives: 4,
    bossSpeed: 1.14,
    minionSpeed: 1.05,
    fuseRatio: 1.2,
    barrierFraction: 0.22,
    crawlerDelay: 56,
    minions: [3, 4],
    powerWalls: [2, 3],
    pillars: [3, 4],
    blinkingChance: 0.25,
    ricochet: true
  },
  {
    id: 'USTA',
    index: 3,
    nameTr: 'USTA',
    start: 76,
    end: 100,
    targetPercent: 88,
    shieldStart: 68,
    shieldEnd: 54,
    lives: 4,
    bossSpeed: 1.28,
    minionSpeed: 1.15,
    fuseRatio: 1.32,
    barrierFraction: 0.28,
    crawlerDelay: 44,
    minions: [3, 4],
    powerWalls: [1, 2],
    pillars: [4, 6],
    blinkingChance: 0,
    ricochet: true
  }
];

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
      return stage === 30 || stage === 36 || stage === 42 || stage === 48;
    case 'ZOR':
      return stage % 3 === 0;
    case 'USTA':
      return stage === 80 || stage === 85 || stage === 90 || stage === 95 || stage === 100;
  }
}

/**
 * Generates outer-frame steel barrier segments covering `fraction` of the 4200-unit perimeter.
 * Keeps 70 units clear of every corner and the bottom-center ship spawn (`x 300..600`) free.
 */
function generateBarriers(rng: () => number, base: readonly Barrier[], fraction: number): Barrier[] {
  const out: Barrier[] = base.map((b) => ({ ...b }));
  if (fraction <= 0) return out;

  const targetLen = 4200 * fraction;
  let covered = out.reduce((sum, b) => sum + Math.abs(b.x2 - b.x1) + Math.abs(b.y2 - b.y1), 0);

  type Edge = 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT';
  const edges: Edge[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT'];

  const overlaps = (cand: Barrier): boolean =>
    out.some((b) => {
      const sameLine =
        (b.x1 === b.x2 && cand.x1 === cand.x2 && b.x1 === cand.x1) ||
        (b.y1 === b.y2 && cand.y1 === cand.y2 && b.y1 === cand.y1);
      if (!sameLine) return false;
      if (b.x1 === b.x2) {
        return !(cand.y2 + 60 <= b.y1 || cand.y1 >= b.y2 + 60);
      }
      return !(cand.x2 + 60 <= b.x1 || cand.x1 >= b.x2 + 60);
    });

  for (let attempt = 0; attempt < 200 && covered < targetLen; attempt++) {
    const edge = edges[Math.floor(rng() * edges.length)];
    const len = Math.round(randInt(rng, 140, 240) / 10) * 10;
    let cand: Barrier;
    if (edge === 'TOP' || edge === 'BOTTOM') {
      const start = Math.round(randInt(rng, 70, 900 - 70 - len) / 10) * 10;
      cand = { x1: start, y1: edge === 'TOP' ? 0 : 1200, x2: start + len, y2: edge === 'TOP' ? 0 : 1200 };
      if (edge === 'BOTTOM' && !(cand.x2 <= 300 || cand.x1 >= 600)) continue;
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
 * `>= 130` from the frame and `>= 160` Chebyshev distance between centers (edge gap >= 92),
 * so the ship can always wrap around every block.
 */
function placeBoxes(rng: () => number, types: readonly PowerUpType[], blinkingChance: number): PowerUpBoxConfig[] {
  const placed: PowerUpBoxConfig[] = [];
  const minX = BOX_BORDER_MARGIN;
  const maxX = 900 - BOX_BORDER_MARGIN;
  const minY = BOX_BORDER_MARGIN;
  const maxY = 1200 - BOX_BORDER_MARGIN;

  const inBossZone = (x: number, y: number): boolean =>
    (x > 300 && x < 600 && y > 370 && y < 650) ||
    Math.hypot(x - ESCORT_SPAWN.x, y - ESCORT_SPAWN.y) < 120;

  for (const type of types) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const x = Math.round(lerp(minX, maxX, rng()) / 10) * 10;
      const y = Math.round(lerp(minY, maxY, rng()) / 10) * 10;
      if (inBossZone(x, y)) continue;
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

function buildMinions(rng: () => number, tier: TierSpec, template: LevelTemplate): MinionSpawnSpec {
  const total = randInt(rng, tier.minions[0], tier.minions[1]);
  let drones = 0;
  let hunters = 0;
  let prisms = 0;
  for (let i = 0; i < total; i++) {
    const r = rng();
    if (tier.index === 0) {
      if (r < 0.7) drones++;
      else if (r < 0.9) hunters++;
      else prisms++;
    } else if (tier.index === 1) {
      if (r < 0.45) drones++;
      else if (r < 0.8) hunters++;
      else prisms++;
    } else {
      if (r < 0.25) drones++;
      else if (r < 0.8) hunters++;
      else prisms++;
    }
  }
  prisms = Math.min(prisms, 2);
  void template;
  return { drones, hunters, prisms, crawlerDelaySeconds: tier.crawlerDelay };
}

const STAGE_CACHE = new Map<number, LevelConfig>();

export function generateStage(stageNumber: number): LevelConfig {
  const n = clampStage(stageNumber);
  const cached = STAGE_CACHE.get(n);
  if (cached) return cached;

  const rng = mulberry32(n * 7919 + 13);
  const tier = getTierForStage(n);
  const template = CAMPAIGN_LEVELS[(n - 1) % CAMPAIGN_LEVELS.length];
  const isMilestone = n % 5 === 0;
  const t = (n - tier.start) / (STAGES_PER_TIER - 1);

  let bossType: BossArchetype = template.bossType;
  let chapterTheme: ChapterThemeId = template.chapterTheme;
  let escortBossType: BossArchetype | null = null;

  if (n === TOTAL_STAGES) {
    // Final stage: Alien Mother Brain + Twin Guardian escort
    bossType = 'ALIEN_BRAIN';
    chapterTheme = 'STAGE_16_BRAIN_CORTEX';
    escortBossType = 'TWIN_SPLIT';
  } else if (escortStagesFor(tier, n) && bossType !== 'TWIN_SPLIT') {
    const pool = ESCORT_POOL.filter((b) => b !== bossType);
    escortBossType = pool[Math.floor(rng() * pool.length)];
  }

  const bossHp = Math.round(template.bossHp * (1 + tier.index * 0.25) * (isMilestone ? 1.3 : 1));

  // Solid wall block composition
  const wallCount = randInt(rng, tier.powerWalls[0], tier.powerWalls[1]);
  const pillarCount = randInt(rng, tier.pillars[0], tier.pillars[1]);
  const wallTypes: PowerUpType[] = [];
  const pool: PowerUpType[] = tier.index === 3 ? ['P', 'S'] : ['S', 'T', 'P', 'L', 'C'];
  const wantsSuperShot =
    tier.index < 3 && (template.hasRedLightBossBox || isMilestone) && wallCount > 0;
  for (let i = 0; i < wallCount; i++) {
    if (i === 0 && wantsSuperShot) {
      wallTypes.push('BOSS_CANNON');
    } else {
      wallTypes.push(pool[Math.floor(rng() * pool.length)]);
    }
  }
  const allTypes: PowerUpType[] = [...wallTypes];
  for (let i = 0; i < pillarCount; i++) {
    allTypes.push('ARMOR_PILLAR');
  }

  const greyBoxes = placeBoxes(rng, allTypes, tier.blinkingChance);
  const barrierSegments = generateBarriers(rng, template.barrierSegments, tier.barrierFraction);

  const shieldDuration = Math.round(lerp(tier.shieldStart, tier.shieldEnd, t));
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
    minionSetup: buildMinions(rng, tier, template),
    shieldUnits: 999,
    shieldDuration,
    shieldDurationHard: Math.round(shieldDuration * 0.85),
    barrierSegments,
    greyBoxes,
    hasRedLightBossBox: wantsSuperShot,
    tier: tier.id,
    tierIndex: tier.index,
    targetPercent,
    startingLives: tier.lives,
    bossSpeedMultiplier: tier.bossSpeed * (isMilestone ? 1.06 : 1),
    minionSpeedMultiplier: tier.minionSpeed,
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
