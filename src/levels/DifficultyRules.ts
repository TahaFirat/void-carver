import { DifficultyId } from '../core/Config';

export type RunDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type BossAimMode = 'FIXED_SPREAD' | 'DIRECT_AIM' | 'PREDICTIVE_LEAD_AIM';

export type V7BossArchetype =
  | 'CENTIPEDE_WYRM'
  | 'ALL_DIR_BIO_WHEEL'
  | 'PINCER_BEETLE'
  | 'SNIPER_LADYBIRD'
  | 'PINBALL_FROG_CORE'
  | 'SEPARATION_TWIN'
  | 'ARMORED_CRUSTACEAN'
  | 'ELDER_CENTIPEDE'
  | 'CYBER_TITAN_SKULL'
  | 'ABYSSAL_OVERMIND';

export interface DifficultyRuleProfile {
  readonly runDifficulty: RunDifficulty;
  readonly difficultyId: DifficultyId;
  readonly labelTr: 'KOLAY' | 'ORTA' | 'ZOR';
  /** Starting ships: 4 (KOLAY) / 3 (ORTA) / 2 (ZOR) */
  readonly startingLives: number;
  /** Max interior minions that switch into Swarm Aggro when player steps off border */
  readonly aggroMaxMinions: number;
  /** Speed multiplier applied to Swarm Aggro minions (+15% / +45% / +80%) */
  readonly swarmAggroSpeedMult: number;
  /** When true (`ZOR`), Swarm Aggro minions aim at the intercept vector ahead of the ship */
  readonly swarmInterceptLead: boolean;
  /** Base Boss movement speed multiplier (0.85x / 1.0x / 1.22x) */
  readonly bossSpeedMult: number;
  /** Base Boss firing cadence in seconds (2.2s / 1.35s / 0.85s) */
  readonly bossFireIntervalSec: number;
  /** Base Boss projectile speed in logical px/s (210 / 320 / 430) */
  readonly bossBulletSpeed: number;
  /** Boss targeting intelligence */
  readonly bossAimMode: BossAimMode;
  /** Electric Line Shock speed along activeTrail (360 / 520 / 680 px/s) */
  readonly electricShockSpeed: number;
  /** On `ZOR`, Boss body OR Boss projectile touching activeTrail detonates instantly (0ms death)! */
  readonly bossHitTrailInstantDetonation: boolean;
  /** Cumulative mid-cut pause limit before Stall Spark fires from P_start (4.0s / 2.0s / 0.9s) */
  readonly stallSparkLimitSec: number;
  /** Border Crawler spawn delay in seconds (70s / 42s / 22s) */
  readonly crawlerDelaySec: number;
  /** On `ZOR`, a patrolling Homing Mine hunts inside the arena from Wave 1 */
  readonly alwaysSpawnHomingMine: boolean;
  /** Energy block economy ratios */
  readonly disappearingBoxRatio: number;
  readonly disappearOnSec: number;
  readonly disappearOffSec: number;
  readonly emptyOrTrapBoxRatio: number;
  readonly enrageTrapEnabled: boolean;
  readonly timeFreezeChance: number;
  readonly timeFreezeDurationSec: number;
  readonly scoreMultiplier: number;
}

export const DIFFICULTY_RULES: Record<RunDifficulty, DifficultyRuleProfile> = {
  EASY: {
    runDifficulty: 'EASY',
    difficultyId: 'EXPLORER',
    labelTr: 'KOLAY',
    startingLives: 4,
    aggroMaxMinions: 1,
    swarmAggroSpeedMult: 1.15,
    swarmInterceptLead: false,
    bossSpeedMult: 0.85,
    bossFireIntervalSec: 2.2,
    bossBulletSpeed: 210,
    bossAimMode: 'FIXED_SPREAD',
    electricShockSpeed: 360,
    bossHitTrailInstantDetonation: false,
    stallSparkLimitSec: 4.0,
    crawlerDelaySec: 70,
    alwaysSpawnHomingMine: false,
    disappearingBoxRatio: 0.15,
    disappearOnSec: 4.2,
    disappearOffSec: 2.0,
    emptyOrTrapBoxRatio: 0.1,
    enrageTrapEnabled: false,
    timeFreezeChance: 0.22,
    timeFreezeDurationSec: 8.0,
    scoreMultiplier: 1.0
  },
  MEDIUM: {
    runDifficulty: 'MEDIUM',
    difficultyId: 'COMMANDER',
    labelTr: 'ORTA',
    startingLives: 3,
    aggroMaxMinions: 99,
    swarmAggroSpeedMult: 1.45,
    swarmInterceptLead: false,
    bossSpeedMult: 1.0,
    bossFireIntervalSec: 1.35,
    bossBulletSpeed: 320,
    bossAimMode: 'DIRECT_AIM',
    electricShockSpeed: 520,
    bossHitTrailInstantDetonation: false,
    stallSparkLimitSec: 2.0,
    crawlerDelaySec: 42,
    alwaysSpawnHomingMine: false,
    disappearingBoxRatio: 0.5,
    disappearOnSec: 3.5,
    disappearOffSec: 2.5,
    emptyOrTrapBoxRatio: 0.25,
    enrageTrapEnabled: false,
    timeFreezeChance: 0.1,
    timeFreezeDurationSec: 6.0,
    scoreMultiplier: 1.25
  },
  HARD: {
    runDifficulty: 'HARD',
    difficultyId: 'LEGEND',
    labelTr: 'ZOR',
    startingLives: 2,
    aggroMaxMinions: 99,
    swarmAggroSpeedMult: 1.8,
    swarmInterceptLead: true,
    bossSpeedMult: 1.22,
    bossFireIntervalSec: 0.85,
    bossBulletSpeed: 430,
    bossAimMode: 'PREDICTIVE_LEAD_AIM',
    electricShockSpeed: 680,
    bossHitTrailInstantDetonation: true,
    stallSparkLimitSec: 0.9,
    crawlerDelaySec: 22,
    alwaysSpawnHomingMine: true,
    disappearingBoxRatio: 0.72,
    disappearOnSec: 2.4,
    disappearOffSec: 2.2,
    emptyOrTrapBoxRatio: 0.4,
    enrageTrapEnabled: true,
    timeFreezeChance: 0.04,
    timeFreezeDurationSec: 3.5,
    scoreMultiplier: 1.65
  }
};

export function getDifficultyRules(diff: RunDifficulty): DifficultyRuleProfile {
  return DIFFICULTY_RULES[diff];
}

export function getDifficultyRulesById(id: DifficultyId): DifficultyRuleProfile {
  if (id === 'EXPLORER') return DIFFICULTY_RULES.EASY;
  if (id === 'LEGEND') return DIFFICULTY_RULES.HARD;
  return DIFFICULTY_RULES.MEDIUM;
}

/**
 * Target Claim Percentage per Wave (`KOLAY` / `ORTA` / `ZOR` Night-and-Day Gap):
 * - KOLAY: 80% (Wave 10+: 82%)
 * - ORTA:  82% -> Wave 12+: 86%
 * - ZOR:   85% -> Wave 8+: 88% -> Wave 15+: 92%!
 */
export function resolveWaveTargetPercent(waveNumber: number, diff: RunDifficulty): number {
  if (diff === 'EASY') {
    return waveNumber >= 10 ? 82 : 80;
  }
  if (diff === 'MEDIUM') {
    if (waveNumber >= 16) return 88;
    if (waveNumber >= 12) return 86;
    if (waveNumber >= 6) return 84;
    return 82;
  }
  if (waveNumber >= 15) return 92;
  if (waveNumber >= 8) return 88;
  return 85;
}

/**
 * Perimeter Shield Seconds (`ON_BORDER` drain ONLY; pauses completely during `CUTTING`!):
 * - KOLAY: 95s -> 65s
 * - ORTA:  68s -> 45s
 * - ZOR:   42s -> 26s!
 */
export function resolveWaveShieldSeconds(waveNumber: number, diff: RunDifficulty): number {
  const w = Math.max(1, waveNumber);
  if (diff === 'EASY') {
    return Math.max(65, Math.round(95 - (w - 1) * 2.0));
  }
  if (diff === 'MEDIUM') {
    return Math.max(45, Math.round(68 - (w - 1) * 1.8));
  }
  return Math.max(26, Math.round(42 - (w - 1) * 1.4));
}

export function isGroupCApexBoss(archetype: V7BossArchetype): boolean {
  return (
    archetype === 'ELDER_CENTIPEDE' ||
    archetype === 'ARMORED_CRUSTACEAN' ||
    archetype === 'CYBER_TITAN_SKULL' ||
    archetype === 'ABYSSAL_OVERMIND'
  );
}

/**
 * Rare & Earned Boss Phase 2 Evolution Gate (`03` & `04`):
 * - Early waves and Group A/B classic bosses NEVER trigger fake Phase 2!
 * - `KOLAY`: ONLY milestone Waves 8, 12, 16, 20+ on Group C Apex Bosses!
 * - `ORTA`:  NEVER on Waves 1..4; opens from Wave 5+ on Group C Apex Bosses!
 * - `ZOR`:   NEVER on Wave 1; opens from Wave 2+ on Group C Apex Bosses!
 */
export function isWavePhase2Eligible(
  waveNumber: number,
  diff: RunDifficulty,
  archetype: V7BossArchetype
): boolean {
  if (!isGroupCApexBoss(archetype)) return false;
  if (diff === 'EASY') {
    return waveNumber >= 8 && waveNumber % 4 === 0;
  }
  if (diff === 'MEDIUM') {
    return waveNumber >= 5;
  }
  return waveNumber >= 2;
}

/**
 * Impossible Phase 3 Overdrive Gate (`ZOR` Wave 10+ Apex Bosses, or Deep Wave 18+ `ORTA`).
 */
export function isWavePhase3Eligible(
  waveNumber: number,
  diff: RunDifficulty,
  archetype: V7BossArchetype
): boolean {
  if (!isGroupCApexBoss(archetype)) return false;
  if (diff === 'HARD') return waveNumber >= 10;
  if (diff === 'MEDIUM') return waveNumber >= 18;
  return false;
}
