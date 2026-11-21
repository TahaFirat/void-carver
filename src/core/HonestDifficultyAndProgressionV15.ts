/**
 * VOID CARVER — BUILD 15 FINAL: LIVELY, ENGAGING & HONEST 3-TIER ARCADE DIFFICULTY
 * (`src/core/HonestDifficultyAndProgressionV15.ts`)
 *
 * Tuned so EVERY tier feels alive, exciting, and rewarding from Stage 1:
 * - EASY (`KOLAY`): Brisk, fun arcade action (never sleepy/boring!). 4 ships (max cap 5), 75%–78% target,
 *   active 142–176 px/s Boss, 3–4 lively bullets, and zero free hand-out shields (power-ups come from Blocks!).
 * - MEDIUM (`ORTA`): Classic 1989 arcade tension! 3 ships, 78%–81% target, 64s border shield,
 *   172–214 px/s Boss, up to 5 fast bullets, 1.75x Jeton.
 * - HARD (`ZOR`): Pure uncompromising mastery! 3 ships, 80%–84% target, 50s border shield,
 *   204–252 px/s Boss with Phase-2 Enrage at >= 50% area, up to 7 fast bullets, ZERO DDA softening, 3.0x Jeton!
 */

export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface DifficultySpecV15 {
  id: GameDifficulty;
  labelTr: string;
  accentHex: string;
  startingLives: number;
  baseTargetPercent: number;
  maxTargetPercent: number;
  borderShieldTimerSec: number;
  playerSpeedPxPerSec: number;
  wallSnapClosePx: number;
  bossBaseSpeedPx: number;
  bossMaxSpeedPx: number;
  minionBaseSpeedPx: number;
  minionMaxSpeedPx: number;
  minMinions: number;
  maxMinions: number;
  maxActiveBullets: number;
  bulletSpeedPx: number;
  minVolleyCooldownSec: number;
  minBulletCorridorGapPx: number;
  telegraphLeadSec: number;
  autoShieldRegenEverySec: number | null;
  allowSubtleAssistOnRepeatedDeaths: boolean;
  bossEnrageAtHalfArea: boolean;
  jetonRewardMultiplier: number;
}

export const HONEST_DIFFICULTIES_V15: Record<GameDifficulty, DifficultySpecV15> = {
  EASY: {
    id: 'EASY',
    labelTr: 'KOLAY',
    accentHex: '#10B981',
    startingLives: 4,
    baseTargetPercent: 75,
    maxTargetPercent: 78,
    borderShieldTimerSec: 76,
    playerSpeedPxPerSec: 332,
    wallSnapClosePx: 13,
    bossBaseSpeedPx: 142,
    bossMaxSpeedPx: 178,
    minionBaseSpeedPx: 118,
    minionMaxSpeedPx: 148,
    minMinions: 2,
    maxMinions: 4,
    maxActiveBullets: 4,
    bulletSpeedPx: 168,
    minVolleyCooldownSec: 2.1,
    minBulletCorridorGapPx: 56,
    telegraphLeadSec: 0.72,
    autoShieldRegenEverySec: null, // All power-ups strictly earned from enclosing Arena Blocks!
    allowSubtleAssistOnRepeatedDeaths: true,
    bossEnrageAtHalfArea: false,
    jetonRewardMultiplier: 1.0
  },
  MEDIUM: {
    id: 'MEDIUM',
    labelTr: 'ORTA',
    accentHex: '#F59E0B',
    startingLives: 3,
    baseTargetPercent: 78,
    maxTargetPercent: 81,
    borderShieldTimerSec: 64,
    playerSpeedPxPerSec: 342,
    wallSnapClosePx: 11,
    bossBaseSpeedPx: 174,
    bossMaxSpeedPx: 214,
    minionBaseSpeedPx: 140,
    minionMaxSpeedPx: 172,
    minMinions: 3,
    maxMinions: 5,
    maxActiveBullets: 5,
    bulletSpeedPx: 198,
    minVolleyCooldownSec: 1.65,
    minBulletCorridorGapPx: 50,
    telegraphLeadSec: 0.58,
    autoShieldRegenEverySec: null,
    allowSubtleAssistOnRepeatedDeaths: true,
    bossEnrageAtHalfArea: false,
    jetonRewardMultiplier: 1.75
  },
  HARD: {
    id: 'HARD',
    labelTr: 'ZOR',
    accentHex: '#EF4444',
    startingLives: 3,
    baseTargetPercent: 80,
    maxTargetPercent: 84,
    borderShieldTimerSec: 50,
    playerSpeedPxPerSec: 356,
    wallSnapClosePx: 9,
    bossBaseSpeedPx: 204,
    bossMaxSpeedPx: 252,
    minionBaseSpeedPx: 162,
    minionMaxSpeedPx: 198,
    minMinions: 3,
    maxMinions: 6,
    maxActiveBullets: 7,
    bulletSpeedPx: 232,
    minVolleyCooldownSec: 1.32,
    minBulletCorridorGapPx: 44,
    telegraphLeadSec: 0.44,
    autoShieldRegenEverySec: null,
    allowSubtleAssistOnRepeatedDeaths: false, // Zero hand-holding on Hard!
    bossEnrageAtHalfArea: true,
    jetonRewardMultiplier: 3.0
  }
};

export interface StageParametersV15 {
  mode: 'CAMPAIGN' | 'ENDLESS';
  index: number;
  difficulty: GameDifficulty;
  targetPercent: number;
  borderShieldTimerSec: number;
  playerSpeedPx: number;
  bossSpeedPx: number;
  minionSpeedPx: number;
  minionCount: number;
  maxActiveBullets: number;
  bulletSpeedPx: number;
  volleyCooldownSec: number;
  telegraphLeadSec: number;
  isBossEnraged: boolean;
}

export class HonestDifficultyGovernorV15 {
  private stageDeaths = 0;

  public onStageStart(): void {
    this.stageDeaths = 0;
  }

  public onPlayerDeath(): void {
    this.stageDeaths += 1;
  }

  public resolveStageParameters(params: {
    mode: 'CAMPAIGN' | 'ENDLESS';
    stageOrWave: number;
    difficulty: GameDifficulty;
    capturedPercent: number;
    playerSpeedPerkBonusRatio?: number;
  }): StageParametersV15 {
    const spec = HONEST_DIFFICULTIES_V15[params.difficulty];
    const n = Math.max(1, Math.floor(params.stageOrWave));

    const curve01 =
      params.mode === 'CAMPAIGN'
        ? Math.min(1, Math.pow((n - 1) / 29, 0.82))
        : 1 - Math.exp(-(n - 1) / 13);

    const targetPercent = Math.round(
      spec.baseTargetPercent + curve01 * (spec.maxTargetPercent - spec.baseTargetPercent)
    );

    // Gentle 8% breather ONLY on Easy/Medium after 2+ deaths on the same stage; NEVER on Hard!
    const assistFactor =
      spec.allowSubtleAssistOnRepeatedDeaths && this.stageDeaths >= 2 ? 0.92 : 1.0;

    const maxCrowdSlow = params.difficulty === 'HARD' ? 0.1 : 0.18;
    const crowdFactor =
      params.capturedPercent <= 62
        ? 1.0
        : 1.0 - Math.min(1, (params.capturedPercent - 62) / 22) * maxCrowdSlow;

    // Phase-2 Enrage on Hard (or Boss milestone stages/waves) when >= 50% area is carved!
    const isBossEnraged =
      (spec.bossEnrageAtHalfArea || n % 5 === 0) && params.capturedPercent >= 50;
    const enrageBoost = isBossEnraged ? 1.12 : 1.0;

    const rawBoss =
      (spec.bossBaseSpeedPx + curve01 * (spec.bossMaxSpeedPx - spec.bossBaseSpeedPx)) *
      assistFactor *
      crowdFactor *
      enrageBoost;

    const rawMinion =
      (spec.minionBaseSpeedPx + curve01 * (spec.minionMaxSpeedPx - spec.minionBaseSpeedPx)) *
      assistFactor *
      crowdFactor;

    const playerSpeedPx = Math.round(
      spec.playerSpeedPxPerSec * (1 + (params.playerSpeedPerkBonusRatio ?? 0))
    );

    const bossSpeedPx = Math.min(Math.round(playerSpeedPx * 0.76), Math.round(rawBoss));
    const minionSpeedPx = Math.min(Math.round(playerSpeedPx * 0.64), Math.round(rawMinion));

    const minionCount = Math.round(
      spec.minMinions + curve01 * (spec.maxMinions - spec.minMinions)
    );

    // Stage 1-2 starts lively (never reduced to 1 sleepy bullet!)
    const stageBulletCap =
      n <= 2
        ? Math.max(3, spec.maxActiveBullets - 1)
        : spec.maxActiveBullets;

    const volleyCooldownSec = +(
      (spec.minVolleyCooldownSec * (1.14 - curve01 * 0.14)) /
      (isBossEnraged ? 1.15 : 1.0)
    ).toFixed(2);

    return {
      mode: params.mode,
      index: n,
      difficulty: params.difficulty,
      targetPercent,
      borderShieldTimerSec: spec.borderShieldTimerSec,
      playerSpeedPx,
      bossSpeedPx,
      minionSpeedPx,
      minionCount,
      maxActiveBullets: stageBulletCap,
      bulletSpeedPx: Math.round(spec.bulletSpeedPx * (0.92 + curve01 * 0.08) * assistFactor),
      volleyCooldownSec,
      telegraphLeadSec: spec.telegraphLeadSec,
      isBossEnraged
    };
  }
}
