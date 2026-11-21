/**
 * VOID CARVER — BUILD 14: MODULAR MULTI-COMBINATION CHIMERA BOSS & SYNERGY MINION ENGINE
 * (`src/core/ProceduralChimeraBossEngine.ts`)
 *
 * Creates 34,560+ distinct visual & mechanical Boss combinations + 176 Mutant Minion variants:
 * - 24 Core Chassis × 12 Attachable Weapon Rigs × 10 Movement Doctrines × 12 Elemental Auras
 * - Campaign Mode: Deterministic seeds so every retry on Level N spawns the exact same Boss.
 * - Endless Rift & Daily Rift Modes: Synthesizes fresh hybrid Chimera Bosses & Minion Synergies.
 */

export type BossChassisId =
  | 'WYRM_SEGMENTED'
  | 'CRUSTACEAN_MECH'
  | 'BIO_GYRO_WHEEL'
  | 'ROYAL_SCARAB'
  | 'FROST_LEVIATHAN'
  | 'NAUTILUS_SHELL'
  | 'BLADE_MANTIS'
  | 'PLASMA_SCORPION'
  | 'TWIN_REACTOR'
  | 'MAGMA_DRAKE'
  | 'WEB_TARANTULA'
  | 'ABYSS_SANDWORM'
  | 'HIVE_DREADNOUGHT'
  | 'CRYSTAL_OBELISK'
  | 'QUANTUM_MONARCH'
  | 'VOLT_MEDUSA'
  | 'GRAVITY_MONOLITH'
  | 'CYBER_SKULL'
  | 'SOLAR_SERAPH'
  | 'TRI_HYDRA'
  | 'SAW_JUGGERNAUT'
  | 'CHRONO_SPHINX'
  | 'NEURAL_OVERMIND'
  | 'VOID_EMPEROR';

export type BossWeaponRigId =
  | 'FAN_TRIPLE_CANNON'
  | 'CROSS_PULSE_EMITTER'
  | 'MIRROR_BOUNCE_BEAM'
  | 'MORTAR_RING_BURST'
  | 'BOOMERANG_SCYTHE'
  | 'CRYO_SHARD_LANCE'
  | 'MAGMA_DROPLET_TAIL'
  | 'SPORE_POD_LAUNCHER'
  | 'TWIN_PINCER_SNAP'
  | 'SPIRAL_GALAXY_ORBS'
  | 'TESLA_ARC_COIL'
  | 'SNIPER_TELEGRAPH_RAIL';

export type BossLocomotionId =
  | 'SINUSOIDAL_GLIDE'
  | 'BILLIARD_RICOCHET'
  | 'FIGURE_EIGHT_SWEEP'
  | 'STEP_DASH_PAUSE'
  | 'PERIMETER_STALK_DISTANT'
  | 'SPIRAL_ORBIT_CENTER'
  | 'BURROW_TELEPORT_RING'
  | 'PENDULUM_ARC'
  | 'SPLIT_DUAL_SYNC'
  | 'TITAN_HEAVY_DRIFT';

export type BossElementalCoreId =
  | 'PURE_PLASMA'
  | 'CRYO_FROST'
  | 'MAGMA_EMBER'
  | 'VOLT_STORM'
  | 'PRISM_LIGHT'
  | 'VOID_SHADOW'
  | 'VENOM_BIO'
  | 'CHRONO_GOLD'
  | 'GRAVITY_VIOLET'
  | 'EMERALD_MATRIX'
  | 'SOLAR_CORONA'
  | 'CRIMSON_OVERDRIVE';

export type MinionArchetypeId =
  | 'SCARAB_BOUNCER'
  | 'COSMIC_MANTA'
  | 'RICOCHET_PRISM'
  | 'ORBIT_GUARD'
  | 'VORTEX_DRIFTER'
  | 'COMET_SPRINTER'
  | 'SPLITTER_SLIME'
  | 'PHASE_MOTH'
  | 'WASP_INTERCEPTOR'
  | 'TRAIL_LEECH'
  | 'HORN_CHARGER'
  | 'POD_SENTRY'
  | 'MINE_DRONE'
  | 'SPARK_PATROLLER'
  | 'CRYO_PUFFER'
  | 'MAGMA_BEETLE'
  | 'TESLA_LINK_NODE'
  | 'MIRROR_SHARD'
  | 'GRAVITY_WISP'
  | 'CHRONO_TICK'
  | 'TREASURE_SCARAB'
  | 'NEBULA_SERPENT';

export type MinionSynergyTraitId =
  | 'STANDARD'
  | 'TETHERED_PAIR'
  | 'SHIELD_BUBBLE'
  | 'FROST_TRAIL'
  | 'SPLIT_INTO_MINI'
  | 'PHASE_SHIMMER'
  | 'GOLD_PINATA'
  | 'ORBIT_LEADER';

export interface ChimeraBossBlueprint {
  signatureKey: string;
  displayNameTr: string;
  chassis: BossChassisId;
  weaponRig: BossWeaponRigId;
  locomotion: BossLocomotionId;
  elementalCore: BossElementalCoreId;
  palettePrimaryHex: string;
  paletteAccentHex: string;
  visualAttachments: {
    hasWingFin: boolean;
    hasTailStinger: boolean;
    orbitingCoreCount: number;
    auraRingStyle: 'HEX' | 'SPIKED' | 'ORBITAL' | 'CORONA';
  };
  minionSquads: Array<{
    archetype: MinionArchetypeId;
    synergyTrait: MinionSynergyTraitId;
    count: number;
  }>;
}

const CHASSIS_NAMES_TR: Record<BossChassisId, string> = {
  WYRM_SEGMENTED: 'Kırkayak',
  CRUSTACEAN_MECH: 'Zırhlı Yengeç',
  BIO_GYRO_WHEEL: 'Biyo-Çark',
  ROYAL_SCARAB: 'Kraliyet Skarabı',
  FROST_LEVIATHAN: 'Leviathan',
  NAUTILUS_SHELL: 'Nautilus',
  BLADE_MANTIS: 'Peygamberdevesi',
  PLASMA_SCORPION: 'Mekanik Akrep',
  TWIN_REACTOR: 'İkiz Reaktör',
  MAGMA_DRAKE: 'Ejder',
  WEB_TARANTULA: 'Tarantula',
  ABYSS_SANDWORM: 'Obruk Solucanı',
  HIVE_DREADNOUGHT: 'Ana Kovan',
  CRYSTAL_OBELISK: 'Dikilitaş',
  QUANTUM_MONARCH: 'Kelebek',
  VOLT_MEDUSA: 'Denizanası',
  GRAVITY_MONOLITH: 'Monolit',
  CYBER_SKULL: 'Siber Kafatası',
  SOLAR_SERAPH: 'Seraf',
  TRI_HYDRA: 'Üç Başlı Hidra',
  SAW_JUGGERNAUT: 'Testere Tankı',
  CHRONO_SPHINX: 'Sfenks',
  NEURAL_OVERMIND: 'Ana Beyin',
  VOID_EMPEROR: 'Hiçlik İmparatoru'
};

const ELEMENT_PREFIX_TR: Record<
  BossElementalCoreId,
  { prefix: string; primary: string; accent: string }
> = {
  PURE_PLASMA: { prefix: 'Plazma', primary: '#38BDF8', accent: '#BAE6FD' },
  CRYO_FROST: { prefix: 'Buzul', primary: '#22D3EE', accent: '#ECFEFF' },
  MAGMA_EMBER: { prefix: 'Magma', primary: '#F97316', accent: '#FED7AA' },
  VOLT_STORM: { prefix: 'Fırtına', primary: '#FACC15', accent: '#FEF08A' },
  PRISM_LIGHT: { prefix: 'Kristal', primary: '#E879F9', accent: '#FAE8FF' },
  VOID_SHADOW: { prefix: 'Hiçlik', primary: '#8B5CF6', accent: '#DDD6FE' },
  VENOM_BIO: { prefix: 'Biyo-Asit', primary: '#4ADE80', accent: '#DCFCE7' },
  CHRONO_GOLD: { prefix: 'Zaman', primary: '#FBBF24', accent: '#FEF3C7' },
  GRAVITY_VIOLET: { prefix: 'Çekim', primary: '#A855F7', accent: '#F3E8FF' },
  EMERALD_MATRIX: { prefix: 'Siber', primary: '#10B981', accent: '#A7F3D0' },
  SOLAR_CORONA: { prefix: 'Güneş', primary: '#FB923C', accent: '#FFEDD5' },
  CRIMSON_OVERDRIVE: { prefix: 'Kızıl', primary: '#F43F5E', accent: '#FECDD3' }
};

const WEAPON_TITLE_TR: Record<BossWeaponRigId, string> = {
  FAN_TRIPLE_CANNON: 'Üçlü Topçu',
  CROSS_PULSE_EMITTER: 'Haç Nabızlı',
  MIRROR_BOUNCE_BEAM: 'Ayna Lazerli',
  MORTAR_RING_BURST: 'Şok Halkalı',
  BOOMERANG_SCYTHE: 'Tırpan Kanatlı',
  CRYO_SHARD_LANCE: 'Buz Mızraklı',
  MAGMA_DROPLET_TAIL: 'Kor Kuyruklu',
  SPORE_POD_LAUNCHER: 'Spor Kovanlı',
  TWIN_PINCER_SNAP: 'Çift Kıskaçlı',
  SPIRAL_GALAXY_ORBS: 'Sarmal Küreli',
  TESLA_ARC_COIL: 'Tesla Bobinli',
  SNIPER_TELEGRAPH_RAIL: 'Keskin Nişancı'
};

const ALL_CHASSIS = Object.keys(CHASSIS_NAMES_TR) as BossChassisId[];
const ALL_WEAPONS = Object.keys(WEAPON_TITLE_TR) as BossWeaponRigId[];
const ALL_ELEMENTS = Object.keys(ELEMENT_PREFIX_TR) as BossElementalCoreId[];
const ALL_LOCOMOTIONS: BossLocomotionId[] = [
  'SINUSOIDAL_GLIDE',
  'BILLIARD_RICOCHET',
  'FIGURE_EIGHT_SWEEP',
  'STEP_DASH_PAUSE',
  'PERIMETER_STALK_DISTANT',
  'SPIRAL_ORBIT_CENTER',
  'BURROW_TELEPORT_RING',
  'PENDULUM_ARC',
  'SPLIT_DUAL_SYNC',
  'TITAN_HEAVY_DRIFT'
];
const ALL_MINIONS: MinionArchetypeId[] = [
  'SCARAB_BOUNCER',
  'COSMIC_MANTA',
  'RICOCHET_PRISM',
  'ORBIT_GUARD',
  'VORTEX_DRIFTER',
  'COMET_SPRINTER',
  'SPLITTER_SLIME',
  'PHASE_MOTH',
  'WASP_INTERCEPTOR',
  'TRAIL_LEECH',
  'HORN_CHARGER',
  'POD_SENTRY',
  'MINE_DRONE',
  'SPARK_PATROLLER',
  'CRYO_PUFFER',
  'MAGMA_BEETLE',
  'TESLA_LINK_NODE',
  'MIRROR_SHARD',
  'GRAVITY_WISP',
  'CHRONO_TICK',
  'TREASURE_SCARAB',
  'NEBULA_SERPENT'
];
const ALL_TRAITS: MinionSynergyTraitId[] = [
  'STANDARD',
  'TETHERED_PAIR',
  'SHIELD_BUBBLE',
  'FROST_TRAIL',
  'SPLIT_INTO_MINI',
  'PHASE_SHIMMER',
  'GOLD_PINATA',
  'ORBIT_LEADER'
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class ProceduralChimeraBossEngine {
  public static getTotalTheoreticalCombinations(): number {
    return ALL_CHASSIS.length * ALL_WEAPONS.length * ALL_LOCOMOTIONS.length * ALL_ELEMENTS.length;
  }

  public buildFixedCampaignEncounter(
    levelNumber: number,
    maxMinionsBudget: number
  ): ChimeraBossBlueprint {
    const idx = Math.max(0, Math.floor(levelNumber) - 1);
    const chassis = ALL_CHASSIS[idx % ALL_CHASSIS.length]!;
    const weaponRig = ALL_WEAPONS[(idx * 5 + Math.floor(idx / 6)) % ALL_WEAPONS.length]!;
    const locomotion = ALL_LOCOMOTIONS[(idx * 3) % ALL_LOCOMOTIONS.length]!;
    const elementalCore = ALL_ELEMENTS[(idx * 7) % ALL_ELEMENTS.length]!;

    return this.assembleBlueprint(
      idx + 1,
      chassis,
      weaponRig,
      locomotion,
      elementalCore,
      maxMinionsBudget,
      mulberry32((idx + 1) * 2654435761)
    );
  }

  public buildEndlessRiftEncounter(
    runSeed: number,
    waveNumber: number,
    maxMinionsBudget: number
  ): ChimeraBossBlueprint {
    const rng = mulberry32((runSeed ^ Math.imul(waveNumber, 0x9e3779b1)) >>> 0);
    const chassis = ALL_CHASSIS[(waveNumber * 7 + Math.floor(rng() * 5)) % ALL_CHASSIS.length]!;
    const weaponRig = ALL_WEAPONS[(waveNumber * 5 + Math.floor(rng() * 3)) % ALL_WEAPONS.length]!;
    const locomotion =
      ALL_LOCOMOTIONS[(waveNumber * 3 + Math.floor(rng() * 3)) % ALL_LOCOMOTIONS.length]!;
    const elementalCore =
      ALL_ELEMENTS[(waveNumber * 11 + Math.floor(rng() * 4)) % ALL_ELEMENTS.length]!;

    return this.assembleBlueprint(
      waveNumber,
      chassis,
      weaponRig,
      locomotion,
      elementalCore,
      maxMinionsBudget,
      rng
    );
  }

  private assembleBlueprint(
    stageOrWave: number,
    chassis: BossChassisId,
    weaponRig: BossWeaponRigId,
    locomotion: BossLocomotionId,
    elementalCore: BossElementalCoreId,
    maxMinionsBudget: number,
    rng: () => number
  ): ChimeraBossBlueprint {
    const el = ELEMENT_PREFIX_TR[elementalCore];
    const displayNameTr =
      `${el.prefix} ${WEAPON_TITLE_TR[weaponRig]} ${CHASSIS_NAMES_TR[chassis]}`.toUpperCase();

    const m1 = ALL_MINIONS[(stageOrWave * 3 + Math.floor(rng() * 4)) % ALL_MINIONS.length]!;
    let m2 = ALL_MINIONS[(stageOrWave * 7 + 5 + Math.floor(rng() * 4)) % ALL_MINIONS.length]!;
    if (m2 === m1) m2 = ALL_MINIONS[(ALL_MINIONS.indexOf(m1) + 3) % ALL_MINIONS.length]!;

    const t1 =
      stageOrWave <= 2
        ? 'STANDARD'
        : ALL_TRAITS[(stageOrWave + Math.floor(rng() * ALL_TRAITS.length)) % ALL_TRAITS.length]!;
    const t2 =
      stageOrWave % 3 === 0 ? 'GOLD_PINATA' : ALL_TRAITS[(stageOrWave * 2 + 1) % ALL_TRAITS.length]!;

    const c1 = Math.max(1, Math.ceil(maxMinionsBudget * 0.55));
    const c2 = Math.max(1, maxMinionsBudget - c1);

    const ringStyles: Array<'HEX' | 'SPIKED' | 'ORBITAL' | 'CORONA'> = [
      'HEX',
      'SPIKED',
      'ORBITAL',
      'CORONA'
    ];

    return {
      signatureKey: `${chassis}__${weaponRig}__${locomotion}__${elementalCore}`,
      displayNameTr,
      chassis,
      weaponRig,
      locomotion,
      elementalCore,
      palettePrimaryHex: el.primary,
      paletteAccentHex: el.accent,
      visualAttachments: {
        hasWingFin:
          weaponRig === 'BOOMERANG_SCYTHE' ||
          weaponRig === 'MIRROR_BOUNCE_BEAM' ||
          stageOrWave % 2 === 0,
        hasTailStinger:
          weaponRig === 'MAGMA_DROPLET_TAIL' ||
          chassis === 'PLASMA_SCORPION' ||
          stageOrWave % 3 === 0,
        orbitingCoreCount: stageOrWave >= 6 ? (stageOrWave % 3) + 1 : 0,
        auraRingStyle: ringStyles[stageOrWave % ringStyles.length]!
      },
      minionSquads: [
        { archetype: m1, synergyTrait: t1, count: c1 },
        { archetype: m2, synergyTrait: t2, count: c2 }
      ]
    };
  }
}
