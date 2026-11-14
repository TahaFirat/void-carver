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
  bossHpOverride?: number,
  tierIndexOverride?: number
): BaseBoss[] {
  const tierIndex =
    tierIndexOverride !== undefined
      ? Math.max(0, Math.min(3, tierIndexOverride))
      : Math.max(0, Math.min(3, Math.floor((Math.max(1, sectorId) - 1) / 25)));
  const tierNumber = tierIndex + 1; // 1..4 across the 100-stage campaign

  switch (bossType) {
    case 'CENTIPEDE': {
      if (tierIndex >= 3) {
        return [new CentipedeBoss({ x: 460, y: 460 }, 15, 'CRIMSON', bossHpOverride ?? 16)];
      }
      if (tierIndex === 2) {
        const variant = sectorId >= 63 ? 'CRIMSON' : 'GOLD';
        return [new CentipedeBoss({ x: 460, y: 460 }, 13, variant, bossHpOverride ?? 13)];
      }
      if (tierIndex === 1) {
        return [new CentipedeBoss({ x: 460, y: 460 }, 11, 'GOLD', bossHpOverride ?? 10)];
      }
      return [new CentipedeBoss({ x: 470, y: 440 }, 9, 'YELLOW_GREEN', bossHpOverride ?? 6)];
    }

    case 'LOBSTER_MECHA':
      return [new LobsterMechaBoss({ x: 450, y: 500 }, bossHpOverride ?? 7, tierIndex >= 2)];

    case 'BIO_WHEEL':
      return [new BioWheelBoss({ x: 450, y: 510 }, bossHpOverride ?? 8)];

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
      return [new CyberSkullBoss({ x: 450, y: 490 }, bossHpOverride ?? 12)];

    case 'OPTIC_NERVE':
      return [new OpticNerveBoss({ x: 450, y: 510 }, bossHpOverride ?? 13)];

    case 'ALIEN_BRAIN':
      return [new AlienBrainBoss({ x: 450, y: 490 }, bossHpOverride ?? 18)];
  }
}
