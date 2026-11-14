import { ESCORT_SPAWN } from '../../levels/CampaignGenerator';
import { EndlessBossArchetype, WaveEncounterSpec } from '../../levels/EndlessBossDirector';
import { BaseBoss, BossArchetype } from './BaseBoss';
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
    const escort = new PinballFrogBoss({ x: ESCORT_SPAWN.x, y: ESCORT_SPAWN.y }, Math.max(4, Math.round(hp * 0.55)));
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

    case 'BIO_WHEEL':
      return [new BioWheelBoss({ x: 450, y: 510 }, bossHpOverride ?? 8)];

    case 'PINCER_BEETLE':
      return [new PincerBeetleBoss({ x: 450, y: 500 }, bossHpOverride ?? 8)];

    case 'SNIPER_LADYBIRD':
      return [new SniperLadybirdBoss({ x: 450, y: 680 }, bossHpOverride ?? 8)];

    case 'PINBALL_FROG':
      return [new PinballFrogBoss({ x: 450, y: 500 }, bossHpOverride ?? 7)];

    case 'MANTIS':
      return [new MantisBoss({ x: 450, y: 500 }, bossHpOverride ?? 8, tierIndex >= 2)];

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

    case 'OPTIC_NERVE':
      return [new OpticNerveBoss({ x: 450, y: 510 }, bossHpOverride ?? 13)];

    case 'ALIEN_BRAIN':
      return [new AlienBrainBoss({ x: 450, y: 490 }, bossHpOverride ?? 18, tierIndex >= 2)];
  }
}
