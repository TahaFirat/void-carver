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
  OpticNerveBoss
} from './VolfiedBosses';

export function createBossesForLevel(
  sectorId: number,
  bossType: BossArchetype,
  bossHpOverride?: number
): BaseBoss[] {
  const tier = Math.floor((sectorId - 1) / 4) + 1;

  switch (bossType) {
    case 'CENTIPEDE': {
      if (sectorId >= 15) {
        return [new CentipedeBoss({ x: 460, y: 460 }, 15, 'CRIMSON', bossHpOverride ?? 14)];
      }
      if (sectorId >= 8) {
        return [new CentipedeBoss({ x: 460, y: 460 }, 12, 'GOLD', bossHpOverride ?? 10)];
      }
      return [new CentipedeBoss({ x: 470, y: 440 }, 10, 'YELLOW_GREEN', bossHpOverride ?? 6)];
    }

    case 'LOBSTER_MECHA':
      return [new LobsterMechaBoss({ x: 450, y: 500 }, bossHpOverride ?? 7, sectorId >= 9)];

    case 'BIO_WHEEL':
      return [new BioWheelBoss({ x: 450, y: 510 }, bossHpOverride ?? 8)];

    case 'MANTIS':
      return [new MantisBoss({ x: 450, y: 500 }, bossHpOverride ?? 8, sectorId >= 11)];

    case 'CRUISER_CORE':
    case 'TITAN_CORE':
      return [
        new TitanCore({ x: 450, y: 520 }, tier, sectorId >= 10, bossHpOverride ?? 9)
      ];

    case 'TWIN_SPLIT':
    case 'TWIN_NEXUS': {
      const halfHp = Math.max(4, Math.round((bossHpOverride ?? 12) * 0.5));
      const alpha = new TwinNexus({ x: 410, y: 540 }, 'ALPHA', halfHp);
      const omega = new TwinNexus({ x: 490, y: 540 }, 'OMEGA', halfHp);
      alpha.linkPartner(omega);
      omega.linkPartner(alpha);
      return [alpha, omega];
    }

    case 'MORPHING_CELL':
      return [new MorphingCellBoss({ x: 450, y: 510 }, bossHpOverride ?? 10)];

    case 'CYBER_SKULL':
      return [new CyberSkullBoss({ x: 450, y: 490 }, bossHpOverride ?? 12)];

    case 'OPTIC_NERVE':
      return [new OpticNerveBoss({ x: 450, y: 510 }, bossHpOverride ?? 13)];

    case 'ALIEN_BRAIN':
      return [new AlienBrainBoss({ x: 450, y: 490 }, bossHpOverride ?? 18)];
  }
}
