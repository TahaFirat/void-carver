import { BossSpeciesId, ResolvedLevelPlan } from '../../core/CampaignProgressionV12';
import { Point } from '../../geometry/Types';
import { ESCORT_SPAWN } from '../../levels/CampaignGenerator';
import { WaveEncounterPlan } from '../../levels/EncounterDeck';
import {
  BossPhaseBehavior,
  EndlessBossArchetype,
  WaveEncounterSpec
} from '../../levels/EndlessBossDirector';
import { BaseBoss, BossArchetype } from './BaseBoss';
import {
  ChronoSphinxBoss,
  ElectricMedusaBoss,
  FrostLeviathanBoss,
  GravityGolemBoss,
  HiveCarrierBoss,
  HydraBioHeadBoss,
  IronCrustaceanBoss,
  MagmaSerpentBoss,
  MechaTarantulaBoss,
  MirrorPrismBoss,
  PhantomMantisBoss,
  PlasmaScorpionBoss,
  QuantumButterflyBoss,
  SawbladeJuggernautBoss,
  SinkholeWormBoss,
  SniperScarabBoss,
  SolarFlareCoreBoss,
  SpiralNautilusBoss,
  VoidEmperorBoss
} from './BestiaryBosses';
import { CentipedeBoss } from './CentipedeBoss';
import { TitanCore } from './TitanCore';
import { TwinNexus } from './TwinNexus';
import {
  AlienBrainBoss,
  BioWheelBoss,
  CyberSkullBoss,
  LobsterMechaBoss,
  MantisBoss,
  MorphingCellBoss,
  OpticNerveBoss,
  PinballFrogBoss,
  PincerBeetleBoss,
  SniperLadybirdBoss
} from './VolfiedBosses';

export function instantiateBossBySpeciesId(
  bossId: BossSpeciesId,
  spawn: Point,
  hp: number,
  hasLateStageEvolution = false
): BaseBoss[] {
  switch (bossId) {
    case 'CENTIPEDE_WYRM': {
      const variant = hasLateStageEvolution ? 'GOLD' : 'YELLOW_GREEN';
      const b = new CentipedeBoss(spawn, 12, variant, hp, hasLateStageEvolution);
      b.speciesId = bossId;
      return [b];
    }
    case 'IRON_CRUSTACEAN':
      return [new IronCrustaceanBoss(spawn, hp, hasLateStageEvolution)];
    case 'ALL_DIR_BIO_WHEEL': {
      const b = new BioWheelBoss(spawn, hp);
      b.speciesId = bossId;
      return [b];
    }
    case 'SNIPER_SCARAB':
      return [new SniperScarabBoss(spawn, hp)];
    case 'PHANTOM_MANTIS':
      return [new PhantomMantisBoss(spawn, hp)];
    case 'SEPARATION_TWIN_CORE': {
      const halfHp = Math.max(4, Math.round(hp * 0.55));
      const alpha = new TwinNexus({ x: spawn.x - 42, y: spawn.y }, 'ALPHA', halfHp);
      const omega = new TwinNexus({ x: spawn.x + 42, y: spawn.y }, 'OMEGA', halfHp);
      alpha.speciesId = bossId;
      omega.speciesId = bossId;
      alpha.linkPartner(omega);
      omega.linkPartner(alpha);
      return [alpha, omega];
    }
    case 'SPIRAL_NAUTILUS':
      return [new SpiralNautilusBoss(spawn, hp)];
    case 'MAGMA_SERPENT':
      return [new MagmaSerpentBoss(spawn, hp)];
    case 'MECHA_TARANTULA':
      return [new MechaTarantulaBoss(spawn, hp)];
    case 'HIVE_CARRIER':
      return [new HiveCarrierBoss(spawn, hp + 2)];
    case 'MIRROR_PRISM':
      return [new MirrorPrismBoss(spawn, hp + 1)];
    case 'ELECTRIC_MEDUSA':
      return [new ElectricMedusaBoss(spawn, hp + 1)];
    case 'GRAVITY_GOLEM':
      return [new GravityGolemBoss(spawn, hp + 2)];
    case 'CYBER_TITAN_SKULL': {
      const b = new CyberSkullBoss(spawn, hp + 2, hasLateStageEvolution);
      b.speciesId = bossId;
      return [b];
    }
    case 'HYDRA_BIO_HEAD':
      return [new HydraBioHeadBoss(spawn, hp + 3)];
    case 'SAWBLADE_JUGGERNAUT':
      return [new SawbladeJuggernautBoss(spawn, hp + 3)];
    case 'CHRONO_SPHINX':
      return [new ChronoSphinxBoss(spawn, hp + 3)];
    case 'ABYSSAL_OVERMIND': {
      const b = new AlienBrainBoss(spawn, hp + 4, true);
      b.speciesId = bossId;
      return [b];
    }
    case 'FROST_LEVIATHAN':
      return [new FrostLeviathanBoss(spawn, hp + 1)];
    case 'PLASMA_SCORPION':
      return [new PlasmaScorpionBoss(spawn, hp + 1)];
    case 'SINKHOLE_WORM':
      return [new SinkholeWormBoss(spawn, hp + 2)];
    case 'QUANTUM_BUTTERFLY':
      return [new QuantumButterflyBoss(spawn, hp + 2)];
    case 'SOLAR_FLARE_CORE':
      return [new SolarFlareCoreBoss(spawn, hp + 3)];
    case 'VOID_EMPEROR':
      return [new VoidEmperorBoss(spawn, hp + 5)];
  }
}

export function createBossesForFixedLevelPlan(
  plan: ResolvedLevelPlan,
  phase1Behavior?: BossPhaseBehavior
): BaseBoss[] {
  const diffHpBonus = plan.difficulty === 'HARD' ? 2 : plan.difficulty === 'MEDIUM' ? 1 : 0;
  const hp = Math.max(6, Math.round(6 + plan.stageIndexZeroBased * 0.45 + diffHpBonus));
  const hasEvolution = plan.levelNumber >= 18 || plan.loopCycle > 0;
  const primary = instantiateBossBySpeciesId(
    plan.bossId,
    { x: 450, y: 500 },
    hp,
    hasEvolution
  );
  for (const b of primary) {
    if (phase1Behavior) {
      b.applyPhaseBehavior(phase1Behavior);
    }
  }
  return primary;
}

export function createBossesForEncounterPlan(
  plan: WaveEncounterPlan,
  phase1Behavior?: BossPhaseBehavior
): BaseBoss[] {
  const diffHpBonus = plan.difficulty === 'HARD' ? 3 : plan.difficulty === 'MEDIUM' ? 1 : 0;
  const hp = Math.max(6, Math.round(6 + plan.waveNumber * 0.65 + diffHpBonus));
  const primary = instantiateBossBySpeciesId(
    plan.bossId,
    { x: 450, y: 500 },
    hp,
    plan.hasLateStageEvolution
  );

  for (const b of primary) {
    b.eliteMutation = plan.eliteMutation;
    if (phase1Behavior) {
      b.applyPhaseBehavior(phase1Behavior);
    }
  }

  // Elite Mutation `TWIN_CLONE`: spawn a 0.78x clone escort of the same species!
  if (
    plan.eliteMutation === 'TWIN_CLONE' &&
    plan.bossId !== 'SEPARATION_TWIN_CORE' &&
    plan.bossId !== 'HYDRA_BIO_HEAD'
  ) {
    const clones = instantiateBossBySpeciesId(
      plan.bossId,
      { x: ESCORT_SPAWN.x, y: ESCORT_SPAWN.y },
      Math.max(4, Math.round(hp * 0.6)),
      false
    );
    for (const c of clones) {
      c.isEscort = true;
      c.cloneVisualScale = 0.78;
      c.boundingRadius = c.baseRadius * c.cloneVisualScale;
      c.eliteMutation = plan.eliteMutation;
      if (phase1Behavior) {
        c.applyPhaseBehavior(phase1Behavior);
      }
      primary.push(c);
    }
  }

  return primary;
}

export function mapEndlessArchetypeToLegacy(arch: EndlessBossArchetype): BossArchetype {
  switch (arch) {
    case 'CENTIPEDE_WYRM':
    case 'ELDER_CENTIPEDE':
      return 'CENTIPEDE';
    case 'ALL_DIR_BIO_WHEEL':
      return 'BIO_WHEEL';
    case 'PINCER_BEETLE':
      return 'PINCER_BEETLE';
    case 'SNIPER_LADYBIRD':
      return 'SNIPER_LADYBIRD';
    case 'PINBALL_FROG_CORE':
      return 'PINBALL_FROG';
    case 'SEPARATION_TWIN':
      return 'TWIN_SPLIT';
    case 'ARMORED_CRUSTACEAN':
      return 'LOBSTER_MECHA';
    case 'CYBER_TITAN_SKULL':
      return 'CYBER_SKULL';
    case 'ABYSSAL_OVERMIND':
      return 'ALIEN_BRAIN';
  }
}

export function createBossesForEndlessWave(spec: WaveEncounterSpec): BaseBoss[] {
  const hp = Math.max(6, Math.round(6 + spec.threatIndex * 1.4));
  let primary: BaseBoss[];

  switch (spec.bossArchetype) {
    case 'CENTIPEDE_WYRM':
      primary = [new CentipedeBoss({ x: 470, y: 440 }, 9, 'YELLOW_GREEN', hp, false)];
      break;
    case 'ELDER_CENTIPEDE':
      primary = [
        new CentipedeBoss({ x: 460, y: 450 }, 12, 'GOLD', Math.round(hp * 1.15), spec.canEvolvePhase2)
      ];
      break;
    case 'ALL_DIR_BIO_WHEEL':
      primary = [new BioWheelBoss({ x: 450, y: 510 }, hp)];
      break;
    case 'PINCER_BEETLE':
      primary = [new PincerBeetleBoss({ x: 450, y: 500 }, hp)];
      break;
    case 'SNIPER_LADYBIRD':
      primary = [new SniperLadybirdBoss({ x: 450, y: 680 }, hp)];
      break;
    case 'PINBALL_FROG_CORE':
      primary = [new PinballFrogBoss({ x: 450, y: 500 }, Math.max(5, hp - 1))];
      break;
    case 'SEPARATION_TWIN': {
      const halfHp = Math.max(3, Math.round(hp * 0.5));
      const alpha = new TwinNexus({ x: 410, y: 540 }, 'ALPHA', halfHp);
      const omega = new TwinNexus({ x: 490, y: 540 }, 'OMEGA', halfHp);
      alpha.linkPartner(omega);
      omega.linkPartner(alpha);
      primary = [alpha, omega];
      break;
    }
    case 'ARMORED_CRUSTACEAN':
      primary = [new LobsterMechaBoss({ x: 450, y: 500 }, hp + 1, spec.canEvolvePhase2)];
      break;
    case 'CYBER_TITAN_SKULL':
      primary = [new CyberSkullBoss({ x: 450, y: 490 }, hp + 2, spec.canEvolvePhase2)];
      break;
    case 'ABYSSAL_OVERMIND':
      primary = [new AlienBrainBoss({ x: 450, y: 490 }, hp + 4, spec.canEvolvePhase2)];
      break;
  }

  for (const b of primary) {
    b.applyPhaseBehavior(spec.phases[1]);
  }

  if (spec.isDualBossEncounter && spec.bossArchetype !== 'SEPARATION_TWIN') {
    const escort = new PinballFrogBoss(
      { x: ESCORT_SPAWN.x, y: ESCORT_SPAWN.y },
      Math.max(4, Math.round(hp * 0.55))
    );
    escort.isEscort = true;
    escort.applyPhaseBehavior(spec.phases[1]);
    primary.push(escort);
  }

  return primary;
}

export function createBossesForLevel(
  sectorId: number,
  bossType: BossArchetype,
  bossHpOverride?: number,
  tierIndexOverride?: number
): BaseBoss[] {
  const tierIndex =
    tierIndexOverride !== undefined
      ? Math.max(0, Math.min(3, tierIndexOverride))
      : Math.max(0, Math.min(3, Math.floor((Math.max(1, sectorId) - 1) / 25)));
  const tierNumber = tierIndex + 1;

  switch (bossType) {
    case 'CENTIPEDE': {
      if (tierIndex >= 3) {
        return [new CentipedeBoss({ x: 460, y: 460 }, 13, 'CRIMSON', bossHpOverride ?? 16, true)];
      }
      if (tierIndex === 2) {
        const variant = sectorId >= 63 ? 'CRIMSON' : 'GOLD';
        return [new CentipedeBoss({ x: 460, y: 460 }, 11, variant, bossHpOverride ?? 13, true)];
      }
      if (tierIndex === 1) {
        return [new CentipedeBoss({ x: 460, y: 460 }, 10, 'GOLD', bossHpOverride ?? 10, false)];
      }
      return [new CentipedeBoss({ x: 470, y: 440 }, 9, 'YELLOW_GREEN', bossHpOverride ?? 6, false)];
    }

    case 'LOBSTER_MECHA':
      return [new LobsterMechaBoss({ x: 450, y: 500 }, bossHpOverride ?? 8, tierIndex >= 1)];

    case 'IRON_CRUSTACEAN':
      return [new IronCrustaceanBoss({ x: 450, y: 500 }, bossHpOverride ?? 8, tierIndex >= 1)];

    case 'BIO_WHEEL':
      return [new BioWheelBoss({ x: 450, y: 510 }, bossHpOverride ?? 8)];

    case 'PINCER_BEETLE':
      return [new PincerBeetleBoss({ x: 450, y: 500 }, bossHpOverride ?? 8)];

    case 'SNIPER_LADYBIRD':
      return [new SniperLadybirdBoss({ x: 450, y: 680 }, bossHpOverride ?? 8)];

    case 'SNIPER_SCARAB':
      return [new SniperScarabBoss({ x: 450, y: 620 }, bossHpOverride ?? 8)];

    case 'PINBALL_FROG':
      return [new PinballFrogBoss({ x: 450, y: 500 }, bossHpOverride ?? 7)];

    case 'MANTIS':
      return [new MantisBoss({ x: 450, y: 500 }, bossHpOverride ?? 8, tierIndex >= 2)];

    case 'SPIRAL_NAUTILUS':
      return [new SpiralNautilusBoss({ x: 450, y: 500 }, bossHpOverride ?? 10)];

    case 'MAGMA_SERPENT':
      return [new MagmaSerpentBoss({ x: 450, y: 500 }, bossHpOverride ?? 10)];

    case 'MECHA_TARANTULA':
      return [new MechaTarantulaBoss({ x: 450, y: 500 }, bossHpOverride ?? 10)];

    case 'HIVE_CARRIER':
      return [new HiveCarrierBoss({ x: 450, y: 500 }, bossHpOverride ?? 12)];

    case 'MIRROR_PRISM':
      return [new MirrorPrismBoss({ x: 450, y: 500 }, bossHpOverride ?? 11)];

    case 'ELECTRIC_MEDUSA':
      return [new ElectricMedusaBoss({ x: 450, y: 500 }, bossHpOverride ?? 11)];

    case 'GRAVITY_GOLEM':
      return [new GravityGolemBoss({ x: 450, y: 500 }, bossHpOverride ?? 12)];

    case 'CRUISER_CORE':
    case 'TITAN_CORE':
      return [
        new TitanCore({ x: 450, y: 520 }, tierNumber, tierIndex >= 2, bossHpOverride ?? 9)
      ];

    case 'TWIN_SPLIT':
    case 'TWIN_NEXUS': {
      const halfHp = Math.max(3, Math.round((bossHpOverride ?? 12) * 0.5));
      const alpha = new TwinNexus({ x: 410, y: 540 }, 'ALPHA', halfHp);
      const omega = new TwinNexus({ x: 490, y: 540 }, 'OMEGA', halfHp);
      alpha.linkPartner(omega);
      omega.linkPartner(alpha);
      return [alpha, omega];
    }

    case 'MORPHING_CELL':
      return [new MorphingCellBoss({ x: 450, y: 510 }, bossHpOverride ?? 10)];

    case 'CYBER_SKULL':
      return [new CyberSkullBoss({ x: 450, y: 490 }, bossHpOverride ?? 12, tierIndex >= 2)];

    case 'HYDRA_BIO_HEAD':
      return [new HydraBioHeadBoss({ x: 450, y: 500 }, bossHpOverride ?? 14)];

    case 'SAWBLADE_JUGGERNAUT':
      return [new SawbladeJuggernautBoss({ x: 450, y: 500 }, bossHpOverride ?? 14)];

    case 'CHRONO_SPHINX':
      return [new ChronoSphinxBoss({ x: 450, y: 500 }, bossHpOverride ?? 14)];

    case 'OPTIC_NERVE':
      return [new OpticNerveBoss({ x: 450, y: 510 }, bossHpOverride ?? 13)];

    case 'ALIEN_BRAIN':
      return [new AlienBrainBoss({ x: 450, y: 490 }, bossHpOverride ?? 18, tierIndex >= 2)];

    case 'FROST_LEVIATHAN':
      return [new FrostLeviathanBoss({ x: 450, y: 500 }, bossHpOverride ?? 10)];

    case 'PLASMA_SCORPION':
      return [new PlasmaScorpionBoss({ x: 450, y: 500 }, bossHpOverride ?? 11)];

    case 'SINKHOLE_WORM':
      return [new SinkholeWormBoss({ x: 450, y: 500 }, bossHpOverride ?? 12)];

    case 'QUANTUM_BUTTERFLY':
      return [new QuantumButterflyBoss({ x: 450, y: 500 }, bossHpOverride ?? 13)];

    case 'SOLAR_FLARE_CORE':
      return [new SolarFlareCoreBoss({ x: 450, y: 500 }, bossHpOverride ?? 15)];

    case 'VOID_EMPEROR':
      return [new VoidEmperorBoss({ x: 450, y: 500 }, bossHpOverride ?? 18)];
  }
}
