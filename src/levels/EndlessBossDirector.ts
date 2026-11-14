import {
  DIFFICULTY_RULES,
  DifficultyRuleProfile,
  isWavePhase2Eligible,
  isWavePhase3Eligible,
  resolveWaveShieldSeconds,
  resolveWaveTargetPercent,
  RunDifficulty as RunDifficultyId
} from './DifficultyRules';

export type RunDifficulty = RunDifficultyId;

/**
 * V7 Authentic 1989 Boss Roster:
 * - Group A (Single-Phase Classics — ZERO fake Phase 2!):
 *   `CENTIPEDE_WYRM`, `ALL_DIR_BIO_WHEEL`, `PINCER_BEETLE`, `SNIPER_LADYBIRD`, `PINBALL_FROG_CORE`
 * - Group B (Tactical Split Mechanic):
 *   `SEPARATION_TWIN`
 * - Group C (Rare Deep-Wave / High-Difficulty Evolutions ONLY when `canEvolvePhase2 === true`!):
 *   `ELDER_CENTIPEDE`, `ARMORED_CRUSTACEAN`, `CYBER_TITAN_SKULL`, `ABYSSAL_OVERMIND`
 */
export type EndlessBossArchetype =
  | 'CENTIPEDE_WYRM'
  | 'ALL_DIR_BIO_WHEEL'
  | 'PINCER_BEETLE'
  | 'SNIPER_LADYBIRD'
  | 'PINBALL_FROG_CORE'
  | 'SEPARATION_TWIN'
  | 'ELDER_CENTIPEDE'
  | 'ARMORED_CRUSTACEAN'
  | 'CYBER_TITAN_SKULL'
  | 'ABYSSAL_OVERMIND';

export type BossCombatPhase = 1 | 2 | 3;

export type MinionSpawnArchetype = 'DRONE' | 'SWARMER' | 'PRISM' | 'HUNTER' | 'MISSILE';

export interface BossPhaseBehavior {
  phase: BossCombatPhase;
  speedMultiplier: number;
  projectilePattern:
    | 'SINGLE_AIMED'
    | 'SPREAD_3'
    | 'SPREAD_5'
    | 'SPIRAL_RING'
    | 'SWEEPING_BEAM'
    | 'TETHER_VOLLEY'
    | 'HOMING_SWARM';
  specialMechanic:
    | 'NONE'
    | 'ELDER_PARASITE_SHED'
    | 'SHELL_DROP_SCISSOR_DASH'
    | 'SKULL_FALSE_VICTORY_LAST_STAND'
    | 'OVERMIND_DETACH_SAWBLADES'
    | 'ORBITING_SHIELD_BLADES'
    | 'MOLTEN_TRAIL_HAZARD';
  fireIntervalSec: number;
  visualTint: 'BASE' | 'MOLTEN_PHASE2' | 'CRIMSON_OVERDRIVE';
}

export interface WaveEncounterSpec {
  waveNumber: number;
  selectedDifficulty: RunDifficulty;
  rules: DifficultyRuleProfile;
  threatIndex: number;
  threatLabelTr: 'SAKİN' | 'GERİLİMLİ' | 'AĞIR' | 'KÂBUS' | 'İMKÂNSIZ';
  bossArchetype: EndlessBossArchetype;
  isDualBossEncounter: boolean;
  targetPercent: number;
  shieldSeconds: number;
  fuseSpeedRatio: number;
  terrainThemeIndex: number;
  powerUpBoxCount: number;
  disappearingBoxCount: number;
  hasSpecialStage1RedBlock: boolean;
  solidArmorPillarCount: number;
  borderBarrierRatio: number;
  minionCount: number;
  minionComposition: MinionSpawnArchetype[];
  /** V7: Strictly `false` on Waves 1..4 (`KOLAY`/`ORTA`) and on all Group A/B bosses! */
  canEvolvePhase2: boolean;
  canEvolvePhase3: boolean;
  phase2TriggerPercent: number;
  hasPhase3Overdrive: boolean;
  phases: Record<BossCombatPhase, BossPhaseBehavior>;
}

export class EndlessBossDirector {
  private recentBosses: EndlessBossArchetype[] = [];

  public resetRun(): void {
    this.recentBosses = [];
  }

  public buildWave(waveNumber: number, difficulty: RunDifficulty): WaveEncounterSpec {
    const rules = DIFFICULTY_RULES[difficulty];
    const baseThreat = difficulty === 'EASY' ? 1.0 : difficulty === 'MEDIUM' ? 2.2 : 3.8;
    const slopePerWave = difficulty === 'EASY' ? 0.2 : difficulty === 'MEDIUM' ? 0.34 : 0.5;
    const threatIndex = +(baseThreat + (waveNumber - 1) * slopePerWave).toFixed(2);

    const threatLabelTr: WaveEncounterSpec['threatLabelTr'] =
      threatIndex < 2.2
        ? 'SAKİN'
        : threatIndex < 4.4
          ? 'GERİLİMLİ'
          : threatIndex < 6.8
            ? 'AĞIR'
            : threatIndex < 9.4
              ? 'KÂBUS'
              : 'İMKÂNSIZ';

    const bossArchetype = this.pickWaveBoss(waveNumber, difficulty);
    const isDualBossEncounter =
      bossArchetype === 'SEPARATION_TWIN' ||
      (difficulty === 'HARD' && waveNumber >= 12 && waveNumber % 5 === 0);

    const targetPercent = resolveWaveTargetPercent(waveNumber, difficulty);
    const shieldSeconds = resolveWaveShieldSeconds(waveNumber, difficulty);
    const fuseSpeedRatio = +(
      (rules.electricShockSpeed / 380) *
      (1 + Math.min(0.32, (waveNumber - 1) * 0.02))
    ).toFixed(2);
    const terrainThemeIndex = ((waveNumber - 1) + (difficulty === 'HARD' ? 4 : 0)) % 16;

    const powerUpBoxCount = difficulty === 'EASY' ? 3 : difficulty === 'MEDIUM' ? 3 : 2;
    const disappearingBoxCount =
      waveNumber >= 2 ? (difficulty === 'HARD' ? 2 : 1) : difficulty === 'HARD' ? 1 : 0;
    const hasSpecialStage1RedBlock =
      waveNumber >= 2 && (waveNumber % 2 === 0 || bossArchetype === 'ABYSSAL_OVERMIND');

    const solidArmorPillarCount =
      difficulty === 'EASY'
        ? waveNumber >= 5
          ? 1
          : 0
        : difficulty === 'MEDIUM'
          ? waveNumber <= 2
            ? 0
            : Math.min(4, Math.floor((waveNumber - 1) * 0.45))
          : Math.min(5, 1 + Math.floor(waveNumber * 0.45));

    const borderBarrierRatio =
      difficulty === 'EASY' && waveNumber <= 4
        ? 0
        : waveNumber <= 1 && difficulty === 'MEDIUM'
          ? 0
          : Math.min(
              0.34,
              +((difficulty === 'HARD' ? 0.1 : 0.04) + (waveNumber - 1) * 0.022).toFixed(2)
            );

    const minionComposition = this.buildMinionComposition(waveNumber, difficulty, bossArchetype);
    const minionCount = minionComposition.length;

    const canEvolvePhase2 = isWavePhase2Eligible(waveNumber, difficulty, bossArchetype);
    const canEvolvePhase3 = isWavePhase3Eligible(waveNumber, difficulty, bossArchetype);

    const phase2TriggerPercent =
      bossArchetype === 'CYBER_TITAN_SKULL'
        ? targetPercent
        : bossArchetype === 'ELDER_CENTIPEDE'
          ? 70
          : bossArchetype === 'ARMORED_CRUSTACEAN'
            ? 65
            : 60;

    const phases = this.buildBossPhases(
      bossArchetype,
      difficulty,
      rules,
      waveNumber,
      canEvolvePhase2,
      canEvolvePhase3
    );

    return {
      waveNumber,
      selectedDifficulty: difficulty,
      rules,
      threatIndex,
      threatLabelTr,
      bossArchetype,
      isDualBossEncounter,
      targetPercent,
      shieldSeconds,
      fuseSpeedRatio,
      terrainThemeIndex,
      powerUpBoxCount,
      disappearingBoxCount,
      hasSpecialStage1RedBlock,
      solidArmorPillarCount,
      borderBarrierRatio,
      minionCount,
      minionComposition,
      canEvolvePhase2,
      canEvolvePhase3,
      phase2TriggerPercent,
      hasPhase3Overdrive: canEvolvePhase3,
      phases
    };
  }

  public resolveActivePhase(
    claimedPercent: number,
    bossHpRatio: number,
    spec: WaveEncounterSpec
  ): BossCombatPhase {
    if (!spec.canEvolvePhase2) return 1;

    if (spec.bossArchetype === 'CYBER_TITAN_SKULL') {
      return claimedPercent >= spec.targetPercent ? 2 : 1;
    }

    if (spec.canEvolvePhase3 && claimedPercent >= 78) {
      return 3;
    }

    if (spec.bossArchetype === 'ARMORED_CRUSTACEAN') {
      return claimedPercent >= 65 || bossHpRatio <= 0.5 ? 2 : 1;
    }

    return claimedPercent >= spec.phase2TriggerPercent ? 2 : 1;
  }

  private pickWaveBoss(wave: number, difficulty: RunDifficulty): EndlessBossArchetype {
    // Signature deterministic early-wave 1989 progression:
    if (wave === 1) return this.recordBoss('CENTIPEDE_WYRM');
    if (wave === 2) return this.recordBoss('ALL_DIR_BIO_WHEEL');
    if (wave === 3) return this.recordBoss('PINCER_BEETLE');

    if (difficulty === 'HARD') {
      if (wave === 4) return this.recordBoss('ELDER_CENTIPEDE');
      if (wave === 5) return this.recordBoss('CYBER_TITAN_SKULL');
      if (wave === 6) return this.recordBoss('ARMORED_CRUSTACEAN');
      if (wave === 10) return this.recordBoss('ABYSSAL_OVERMIND');
    } else if (difficulty === 'MEDIUM') {
      if (wave === 4) return this.recordBoss('SNIPER_LADYBIRD');
      if (wave === 5) return this.recordBoss('PINBALL_FROG_CORE');
      if (wave === 6) return this.recordBoss('ARMORED_CRUSTACEAN');
      if (wave === 7) return this.recordBoss('SEPARATION_TWIN');
      if (wave === 8) return this.recordBoss('ELDER_CENTIPEDE');
      if (wave === 10) return this.recordBoss('CYBER_TITAN_SKULL');
      if (wave === 14) return this.recordBoss('ABYSSAL_OVERMIND');
    } else {
      // `KOLAY` enjoys classic single-phase bosses + milestone Apex Bosses on Waves 8, 12, 16
      if (wave === 4) return this.recordBoss('SNIPER_LADYBIRD');
      if (wave === 5) return this.recordBoss('PINBALL_FROG_CORE');
      if (wave === 6) return this.recordBoss('SEPARATION_TWIN');
      if (wave === 7) return this.recordBoss('ARMORED_CRUSTACEAN');
      if (wave === 8) return this.recordBoss('ELDER_CENTIPEDE');
      if (wave === 12) return this.recordBoss('CYBER_TITAN_SKULL');
      if (wave === 16) return this.recordBoss('ABYSSAL_OVERMIND');
    }

    const pool: EndlessBossArchetype[] = [
      'CENTIPEDE_WYRM',
      'ALL_DIR_BIO_WHEEL',
      'PINCER_BEETLE',
      'SNIPER_LADYBIRD',
      'PINBALL_FROG_CORE',
      'SEPARATION_TWIN',
      'ARMORED_CRUSTACEAN'
    ];

    if (
      (difficulty === 'EASY' && wave >= 20 && wave % 4 === 0) ||
      (difficulty === 'MEDIUM' && wave >= 8) ||
      (difficulty === 'HARD' && wave >= 4)
    ) {
      pool.push('ELDER_CENTIPEDE');
    }
    if ((difficulty === 'MEDIUM' && wave >= 10) || (difficulty === 'HARD' && wave >= 5)) {
      pool.push('CYBER_TITAN_SKULL');
    }
    if ((difficulty === 'MEDIUM' && wave >= 14) || (difficulty === 'HARD' && wave >= 10)) {
      pool.push('ABYSSAL_OVERMIND');
    }

    const candidates = pool.filter((b) => !this.recentBosses.includes(b));
    const usable = candidates.length > 0 ? candidates : pool;
    const chosen = usable[(wave * 5 + (difficulty === 'HARD' ? 3 : 1)) % usable.length];
    return this.recordBoss(chosen);
  }

  private recordBoss(chosen: EndlessBossArchetype): EndlessBossArchetype {
    this.recentBosses.push(chosen);
    if (this.recentBosses.length > 3) this.recentBosses.shift();
    return chosen;
  }

  private buildMinionComposition(
    wave: number,
    difficulty: RunDifficulty,
    boss: EndlessBossArchetype
  ): MinionSpawnArchetype[] {
    if (boss === 'SNIPER_LADYBIRD') {
      // Original Stage 5 signature: Sniper Ladybird + 4 fast Yellow Swarmers!
      return difficulty === 'HARD'
        ? ['SWARMER', 'SWARMER', 'SWARMER', 'SWARMER', 'MISSILE']
        : ['SWARMER', 'SWARMER', 'SWARMER', 'SWARMER'];
    }
    if (boss === 'PINBALL_FROG_CORE') {
      // Original Pinball Frog Core guarded by Homing Missile creatures!
      return difficulty === 'EASY'
        ? ['MISSILE', 'MISSILE']
        : difficulty === 'MEDIUM'
          ? ['MISSILE', 'MISSILE', 'SWARMER']
          : ['MISSILE', 'MISSILE', 'MISSILE', 'SWARMER'];
    }

    const count =
      difficulty === 'EASY'
        ? Math.min(3, 1 + Math.floor(wave / 3))
        : difficulty === 'MEDIUM'
          ? Math.min(5, 2 + Math.floor((wave - 1) / 2))
          : Math.min(6, 3 + Math.floor(wave / 2));

    const out: MinionSpawnArchetype[] = [];
    for (let i = 0; i < count; i++) {
      if (difficulty === 'HARD' && i === 0) {
        out.push('MISSILE');
      } else if (wave === 1) {
        out.push('DRONE');
      } else if (wave === 2) {
        out.push(i % 2 === 0 ? 'SWARMER' : 'DRONE');
      } else if (wave === 3) {
        out.push(i === 0 ? 'PRISM' : i % 2 === 1 ? 'HUNTER' : 'SWARMER');
      } else {
        const cycle: MinionSpawnArchetype[] = ['MISSILE', 'SWARMER', 'HUNTER', 'PRISM'];
        out.push(cycle[(wave + i) % cycle.length]);
      }
    }
    return out;
  }

  private buildBossPhases(
    boss: EndlessBossArchetype,
    diff: RunDifficulty,
    rules: DifficultyRuleProfile,
    wave: number,
    canEvolvePhase2: boolean,
    canEvolvePhase3: boolean
  ): Record<BossCombatPhase, BossPhaseBehavior> {
    const waveSpeedGain = 1 + Math.min(0.42, (wave - 1) * 0.032);
    const p1Speed = +(rules.bossSpeedMult * waveSpeedGain).toFixed(2);
    const baseFireInterval = +(
      rules.bossFireIntervalSec * Math.max(0.68, 1 - (wave - 1) * 0.025)
    ).toFixed(2);

    const p1Pattern: BossPhaseBehavior['projectilePattern'] =
      diff === 'EASY' ? 'SINGLE_AIMED' : diff === 'MEDIUM' ? 'SPREAD_3' : 'SPREAD_5';

    const p2Special: BossPhaseBehavior['specialMechanic'] = !canEvolvePhase2
      ? 'NONE'
      : boss === 'ELDER_CENTIPEDE'
        ? 'ELDER_PARASITE_SHED'
        : boss === 'ARMORED_CRUSTACEAN'
          ? 'SHELL_DROP_SCISSOR_DASH'
          : boss === 'CYBER_TITAN_SKULL'
            ? 'SKULL_FALSE_VICTORY_LAST_STAND'
            : boss === 'ABYSSAL_OVERMIND'
              ? 'OVERMIND_DETACH_SAWBLADES'
              : 'NONE';

    return {
      1: {
        phase: 1,
        speedMultiplier: p1Speed,
        projectilePattern: p1Pattern,
        specialMechanic: 'NONE',
        fireIntervalSec: baseFireInterval,
        visualTint: 'BASE'
      },
      2: {
        phase: 2,
        speedMultiplier: canEvolvePhase2
          ? +(p1Speed * (boss === 'ELDER_CENTIPEDE' ? 2.0 : 1.38)).toFixed(2)
          : p1Speed,
        projectilePattern:
          boss === 'CYBER_TITAN_SKULL'
            ? 'SWEEPING_BEAM'
            : boss === 'ABYSSAL_OVERMIND'
              ? 'SPIRAL_RING'
              : 'SPREAD_5',
        specialMechanic: p2Special,
        fireIntervalSec: canEvolvePhase2 ? +(baseFireInterval * 0.72).toFixed(2) : baseFireInterval,
        visualTint: canEvolvePhase2 ? 'MOLTEN_PHASE2' : 'BASE'
      },
      3: {
        phase: 3,
        speedMultiplier: canEvolvePhase3 ? +(p1Speed * 1.65).toFixed(2) : p1Speed,
        projectilePattern: boss === 'CYBER_TITAN_SKULL' ? 'SWEEPING_BEAM' : 'SPIRAL_RING',
        specialMechanic: p2Special,
        fireIntervalSec: canEvolvePhase3 ? +(baseFireInterval * 0.56).toFixed(2) : baseFireInterval,
        visualTint: canEvolvePhase3 ? 'CRIMSON_OVERDRIVE' : 'BASE'
      }
    };
  }
}
