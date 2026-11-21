import { MinionSpeciesId } from '../../core/CampaignProgressionV12';
import {
  MinionArchetypeId,
  MinionSynergyTraitId
} from '../../core/ProceduralChimeraBossEngine';
import { Point } from '../../geometry/Types';
import { InteriorMinion } from './BaseMinion';
import {
  AnchorBarnacleMinion,
  BorderSparkCrabMinion,
  ChargerHornMinion,
  CometSeedMinion,
  CosmicMantaMinion,
  HomingSeekerMinion,
  KamikazeSporeMinion,
  LineLeechMinion,
  MineLayerDroneMinion,
  OrbitSatelliteMinion,
  PhaseGhostMinion,
  PodTurretMinion,
  RicochetCrystalMinion,
  ScarabBeetleMinion,
  ShieldSapperMinion,
  SplitterAmoebaMinion,
  VortexDrifterMinion,
  WaspSwarmerMinion
} from './BestiaryMinions';

export function createMinionBySpecies(
  species: MinionSpeciesId,
  pos: Point,
  seedIndex = 0
): InteriorMinion {
  switch (species) {
    case 'SCARAB_BEETLE':
      return new ScarabBeetleMinion(
        pos,
        176,
        Math.PI * 0.25 + (seedIndex % 4) * (Math.PI * 0.5)
      );
    case 'WASP_SWARMER':
      return new WaspSwarmerMinion(pos, 196, seedIndex);
    case 'LINE_LEECH':
      return new LineLeechMinion(pos, 172, seedIndex);
    case 'POD_TURRET':
      return new PodTurretMinion(pos, seedIndex);
    case 'SPLITTER_AMOEBA':
      return new SplitterAmoebaMinion(pos, false, 136, seedIndex);
    case 'BORDER_SPARK_CRAB':
      return new BorderSparkCrabMinion(pos, 152, seedIndex);
    case 'SHIELD_SAPPER':
      return new ShieldSapperMinion(pos, 168);
    case 'MINE_LAYER_DRONE':
      return new MineLayerDroneMinion(pos, 148, seedIndex);
    case 'CHARGER_HORN':
      return new ChargerHornMinion(pos, seedIndex);
    case 'PHASE_GHOST':
      return new PhaseGhostMinion(pos, 154, seedIndex);
    case 'ORBIT_SATELLITE':
      return new OrbitSatelliteMinion(pos, seedIndex);
    case 'HOMING_SEEKER':
      return new HomingSeekerMinion(pos, 198, (seedIndex * 1.8) % (Math.PI * 2));
    case 'ANCHOR_BARNACLE':
      return new AnchorBarnacleMinion(pos, seedIndex);
    case 'KAMIKAZE_SPORE':
      return new KamikazeSporeMinion(pos, 216, seedIndex);
    case 'COSMIC_MANTA':
      return new CosmicMantaMinion(pos, 134, seedIndex);
    case 'RICOCHET_CRYSTAL':
      return new RicochetCrystalMinion(pos, 148, seedIndex);
    case 'VORTEX_DRIFTER':
      return new VortexDrifterMinion(pos, 115, seedIndex);
    case 'COMET_SEED':
      return new CometSeedMinion(pos, 156, seedIndex);
  }
}

export function mapChimeraMinionToSpecies(arch: MinionArchetypeId): MinionSpeciesId {
  switch (arch) {
    case 'SCARAB_BOUNCER':
    case 'TREASURE_SCARAB':
    case 'MAGMA_BEETLE':
      return 'SCARAB_BEETLE';
    case 'COSMIC_MANTA':
    case 'NEBULA_SERPENT':
      return 'COSMIC_MANTA';
    case 'RICOCHET_PRISM':
    case 'MIRROR_SHARD':
      return 'RICOCHET_CRYSTAL';
    case 'ORBIT_GUARD':
    case 'TESLA_LINK_NODE':
      return 'ORBIT_SATELLITE';
    case 'VORTEX_DRIFTER':
    case 'GRAVITY_WISP':
      return 'VORTEX_DRIFTER';
    case 'COMET_SPRINTER':
    case 'CHRONO_TICK':
      return 'COMET_SEED';
    case 'SPLITTER_SLIME':
      return 'SPLITTER_AMOEBA';
    case 'PHASE_MOTH':
      return 'PHASE_GHOST';
    case 'WASP_INTERCEPTOR':
      return 'WASP_SWARMER';
    case 'TRAIL_LEECH':
      return 'LINE_LEECH';
    case 'HORN_CHARGER':
      return 'CHARGER_HORN';
    case 'POD_SENTRY':
      return 'POD_TURRET';
    case 'MINE_DRONE':
      return 'MINE_LAYER_DRONE';
    case 'SPARK_PATROLLER':
      return 'BORDER_SPARK_CRAB';
    case 'CRYO_PUFFER':
      return 'KAMIKAZE_SPORE';
  }
}

export function createMinionForChimeraSquad(
  archetype: MinionArchetypeId,
  synergyTrait: MinionSynergyTraitId,
  pos: Point,
  seedIndex = 0
): InteriorMinion {
  const species = mapChimeraMinionToSpecies(archetype);
  const m = createMinionBySpecies(species, pos, seedIndex);
  m.speciesId = species;
  m.synergyTrait = archetype === 'TREASURE_SCARAB' ? 'GOLD_PINATA' : synergyTrait;
  return m;
}
