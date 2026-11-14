export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type BossSpeciesId =
  // Echelon I (Waves 1-4)
  | 'CENTIPEDE_WYRM'
  | 'IRON_CRUSTACEAN'
  | 'ALL_DIR_BIO_WHEEL'
  | 'SNIPER_SCARAB'
  // Echelon II (Waves 5-9)
  | 'PHANTOM_MANTIS'
  | 'SEPARATION_TWIN_CORE'
  | 'SPIRAL_NAUTILUS'
  | 'MAGMA_SERPENT'
  | 'MECHA_TARANTULA'
  // Echelon III (Waves 10-14)
  | 'HIVE_CARRIER'
  | 'MIRROR_PRISM'
  | 'ELECTRIC_MEDUSA'
  | 'GRAVITY_GOLEM'
  | 'CYBER_TITAN_SKULL'
  // Echelon IV (Waves 15-18+)
  | 'HYDRA_BIO_HEAD'
  | 'SAWBLADE_JUGGERNAUT'
  | 'CHRONO_SPHINX'
  | 'ABYSSAL_OVERMIND';

export type MinionSpeciesId =
  | 'SCARAB_BEETLE'
  | 'WASP_SWARMER'
  | 'LINE_LEECH'
  | 'POD_TURRET'
  | 'SPLITTER_AMOEBA'
  | 'BORDER_SPARK_CRAB'
  | 'SHIELD_SAPPER'
  | 'MINE_LAYER_DRONE'
  | 'CHARGER_HORN'
  | 'PHASE_GHOST'
  | 'ORBIT_SATELLITE'
  | 'HOMING_SEEKER'
  | 'ANCHOR_BARNACLE'
  | 'KAMIKAZE_SPORE';

export type EliteMutationAffix =
  | 'NONE'
  | 'TWIN_CLONE'
  | 'ORBIT_GUARDED'
  | 'MAGMA_WAKE'
  | 'SNIPER_OVERCLOCK'
  | 'FRENZY_PULSE';

export interface MinionSpawnGroup {
  species: MinionSpeciesId;
  count: number;
}

export interface WaveEncounterPlan {
  waveNumber: number;
  difficulty: GameDifficulty;
  bossId: BossSpeciesId;
  bossDisplayNameTr: string;
  eliteMutation: EliteMutationAffix;
  minionSquadSignature: string;
  minionSpawns: MinionSpawnGroup[];
  terrainThemeIndex: number;
  targetPercent: number;
  shieldSeconds: number;
  bossSpeedScale: number;
  minionAggroMultiplier: number;
  hasLateStageEvolution: boolean;
}

interface BossCatalogEntry {
  id: BossSpeciesId;
  nameTr: string;
  echelon: 1 | 2 | 3 | 4;
  signatureSquads: [MinionSpeciesId, MinionSpeciesId][];
}

const BOSS_CATALOG: BossCatalogEntry[] = [
  // Echelon 1 (Waves 1..4)
  {
    id: 'CENTIPEDE_WYRM',
    nameTr: 'ZIRHLI KIRKAYAK',
    echelon: 1,
    signatureSquads: [
      ['SCARAB_BEETLE', 'WASP_SWARMER'],
      ['LINE_LEECH', 'SCARAB_BEETLE']
    ]
  },
  {
    id: 'IRON_CRUSTACEAN',
    nameTr: 'HİDROLİK YENGEÇ',
    echelon: 1,
    signatureSquads: [
      ['CHARGER_HORN', 'ANCHOR_BARNACLE'],
      ['SCARAB_BEETLE', 'BORDER_SPARK_CRAB']
    ]
  },
  {
    id: 'ALL_DIR_BIO_WHEEL',
    nameTr: 'BİYO-ÇARK',
    echelon: 1,
    signatureSquads: [
      ['SPLITTER_AMOEBA', 'POD_TURRET'],
      ['ORBIT_SATELLITE', 'SCARAB_BEETLE']
    ]
  },
  {
    id: 'SNIPER_SCARAB',
    nameTr: 'ALTIN BOKBÖCEĞİ',
    echelon: 1,
    signatureSquads: [
      ['WASP_SWARMER', 'CHARGER_HORN'],
      ['POD_TURRET', 'LINE_LEECH']
    ]
  },

  // Echelon 2 (Waves 5..9)
  {
    id: 'PHANTOM_MANTIS',
    nameTr: 'ÇELİK PEYGAMBERDEVESİ',
    echelon: 2,
    signatureSquads: [
      ['WASP_SWARMER', 'PHASE_GHOST'],
      ['CHARGER_HORN', 'LINE_LEECH']
    ]
  },
  {
    id: 'SEPARATION_TWIN_CORE',
    nameTr: 'İKİZ REAKTÖR',
    echelon: 2,
    signatureSquads: [
      ['ORBIT_SATELLITE', 'SHIELD_SAPPER'],
      ['SPLITTER_AMOEBA', 'MINE_LAYER_DRONE']
    ]
  },
  {
    id: 'SPIRAL_NAUTILUS',
    nameTr: 'ZIRHLI NAUTILUS',
    echelon: 2,
    signatureSquads: [
      ['ANCHOR_BARNACLE', 'BORDER_SPARK_CRAB'],
      ['SPLITTER_AMOEBA', 'LINE_LEECH']
    ]
  },
  {
    id: 'MAGMA_SERPENT',
    nameTr: 'MAGMA EJDERİ',
    echelon: 2,
    signatureSquads: [
      ['LINE_LEECH', 'MINE_LAYER_DRONE'],
      ['CHARGER_HORN', 'KAMIKAZE_SPORE']
    ]
  },
  {
    id: 'MECHA_TARANTULA',
    nameTr: 'MEKANİK TARANTULA',
    echelon: 2,
    signatureSquads: [
      ['WASP_SWARMER', 'ANCHOR_BARNACLE'],
      ['SHIELD_SAPPER', 'LINE_LEECH']
    ]
  },

  // Echelon 3 (Waves 10..14)
  {
    id: 'HIVE_CARRIER',
    nameTr: 'ANA KOVAN GEMİSİ',
    echelon: 3,
    signatureSquads: [
      ['KAMIKAZE_SPORE', 'WASP_SWARMER'],
      ['KAMIKAZE_SPORE', 'SHIELD_SAPPER']
    ]
  },
  {
    id: 'MIRROR_PRISM',
    nameTr: 'KRİSTAL PRİZMA',
    echelon: 3,
    signatureSquads: [
      ['POD_TURRET', 'PHASE_GHOST'],
      ['ORBIT_SATELLITE', 'HOMING_SEEKER']
    ]
  },
  {
    id: 'ELECTRIC_MEDUSA',
    nameTr: 'ELEKTRİK DENİZANASI',
    echelon: 3,
    signatureSquads: [
      ['SHIELD_SAPPER', 'SPLITTER_AMOEBA'],
      ['PHASE_GHOST', 'BORDER_SPARK_CRAB']
    ]
  },
  {
    id: 'GRAVITY_GOLEM',
    nameTr: 'MANYETİK MONOLİT',
    echelon: 3,
    signatureSquads: [
      ['ORBIT_SATELLITE', 'ANCHOR_BARNACLE'],
      ['MINE_LAYER_DRONE', 'CHARGER_HORN']
    ]
  },
  {
    id: 'CYBER_TITAN_SKULL',
    nameTr: 'SİBER KAFATASI',
    echelon: 3,
    signatureSquads: [
      ['HOMING_SEEKER', 'PHASE_GHOST'],
      ['POD_TURRET', 'SHIELD_SAPPER']
    ]
  },

  // Echelon 4 (Waves 15..18+)
  {
    id: 'HYDRA_BIO_HEAD',
    nameTr: 'ÜÇ BAŞLI HİDRA',
    echelon: 4,
    signatureSquads: [
      ['LINE_LEECH', 'HOMING_SEEKER'],
      ['SPLITTER_AMOEBA', 'WASP_SWARMER']
    ]
  },
  {
    id: 'SAWBLADE_JUGGERNAUT',
    nameTr: 'TESTERE TANKI',
    echelon: 4,
    signatureSquads: [
      ['BORDER_SPARK_CRAB', 'MINE_LAYER_DRONE'],
      ['CHARGER_HORN', 'SHIELD_SAPPER']
    ]
  },
  {
    id: 'CHRONO_SPHINX',
    nameTr: 'ZAMAN SFENKSİ',
    echelon: 4,
    signatureSquads: [
      ['PHASE_GHOST', 'POD_TURRET'],
      ['ORBIT_SATELLITE', 'HOMING_SEEKER']
    ]
  },
  {
    id: 'ABYSSAL_OVERMIND',
    nameTr: 'HİÇLİK ANA BEYNİ',
    echelon: 4,
    signatureSquads: [
      ['HOMING_SEEKER', 'ORBIT_SATELLITE'],
      ['KAMIKAZE_SPORE', 'PHASE_GHOST']
    ]
  }
];

export const ALL_BOSS_IDS: BossSpeciesId[] = BOSS_CATALOG.map((b) => b.id);
export const ALL_MINION_IDS: MinionSpeciesId[] = [
  'SCARAB_BEETLE',
  'WASP_SWARMER',
  'LINE_LEECH',
  'POD_TURRET',
  'SPLITTER_AMOEBA',
  'BORDER_SPARK_CRAB',
  'SHIELD_SAPPER',
  'MINE_LAYER_DRONE',
  'CHARGER_HORN',
  'PHASE_GHOST',
  'ORBIT_SATELLITE',
  'HOMING_SEEKER',
  'ANCHOR_BARNACLE',
  'KAMIKAZE_SPORE'
];

export class EncounterDeck {
  private usedBossesInCycle = new Set<BossSpeciesId>();
  private lastSquadSignature = '';
  private lastTerrainIndex = -1;
  private rngState = 0x9e3779b9;

  constructor(seed = Date.now()) {
    this.reseed(seed);
  }

  public reseed(seed: number): void {
    this.rngState = seed >>> 0 || 0x9e3779b9;
    this.usedBossesInCycle.clear();
    this.lastSquadSignature = '';
    this.lastTerrainIndex = -1;
  }

  public resetRun(seed = Date.now()): void {
    this.reseed(seed);
  }

  public nextEncounter(waveNumber: number, difficulty: GameDifficulty): WaveEncounterPlan {
    // Reset 18-boss cycle ONLY after all 18 unique bosses have been fought!
    if (this.usedBossesInCycle.size >= BOSS_CATALOG.length) {
      this.usedBossesInCycle.clear();
    }

    const maxUnlockedEchelon: 1 | 2 | 3 | 4 =
      difficulty === 'HARD'
        ? waveNumber <= 2
          ? 2
          : waveNumber <= 6
            ? 3
            : 4
        : waveNumber <= 4
          ? 1
          : waveNumber <= 9
            ? 2
            : waveNumber <= 14
              ? 3
              : 4;

    // Prefer unused bosses in the newly unlocked or current echelon first so progression feels fresh every wave!
    let candidates = BOSS_CATALOG.filter(
      (b) => !this.usedBossesInCycle.has(b.id) && b.echelon === maxUnlockedEchelon
    );
    if (candidates.length === 0) {
      candidates = BOSS_CATALOG.filter(
        (b) => !this.usedBossesInCycle.has(b.id) && b.echelon <= maxUnlockedEchelon
      );
    }
    if (candidates.length === 0) {
      // Fallback if higher echelons haven't unlocked yet in cycle
      candidates = BOSS_CATALOG.filter((b) => !this.usedBossesInCycle.has(b.id));
    }

    const pickedBoss = candidates[Math.floor(this.rand() * candidates.length)];
    this.usedBossesInCycle.add(pickedBoss.id);

    const minionSpawns = this.buildDistinctMinionSquad(pickedBoss, waveNumber, difficulty);
    const minionSquadSignature = minionSpawns.map((m) => m.species).join('+');
    this.lastSquadSignature = minionSquadSignature;

    const eliteMutation = this.pickEliteMutation(waveNumber, difficulty, pickedBoss.id);
    const mutationLabelMap: Record<EliteMutationAffix, string> = {
      NONE: '',
      TWIN_CLONE: ' • İKİZ',
      ORBIT_GUARDED: ' • KALKANLI',
      MAGMA_WAKE: ' • LAV İZLİ',
      SNIPER_OVERCLOCK: ' • KESKİN NİŞAN',
      FRENZY_PULSE: ' • HİPER HIZ'
    };

    let terrainThemeIndex = Math.floor(this.rand() * 16);
    if (terrainThemeIndex === this.lastTerrainIndex) {
      terrainThemeIndex = (terrainThemeIndex + 5) % 16;
    }
    this.lastTerrainIndex = terrainThemeIndex;

    const baseTarget = difficulty === 'EASY' ? 80 : difficulty === 'MEDIUM' ? 82 : 85;
    const targetPercent = Math.min(92, baseTarget + Math.floor((waveNumber - 1) / 5) * 2);

    const baseShield = difficulty === 'EASY' ? 95 : difficulty === 'MEDIUM' ? 68 : 44;
    const shieldSeconds = Math.max(26, Math.round(baseShield - (waveNumber - 1) * 1.8));

    const diffSpeedBase = difficulty === 'EASY' ? 1.0 : difficulty === 'MEDIUM' ? 1.24 : 1.48;
    const bossSpeedScale = +(diffSpeedBase + Math.min(0.75, (waveNumber - 1) * 0.045)).toFixed(2);

    const minionAggroMultiplier =
      difficulty === 'EASY' ? 1.18 : difficulty === 'MEDIUM' ? 1.48 : 1.82;

    const hasLateStageEvolution =
      (difficulty === 'HARD' && waveNumber >= 3) ||
      (difficulty === 'MEDIUM' && waveNumber >= 6 && pickedBoss.echelon >= 2) ||
      (difficulty === 'EASY' && waveNumber >= 10 && pickedBoss.echelon >= 3);

    return {
      waveNumber,
      difficulty,
      bossId: pickedBoss.id,
      bossDisplayNameTr: pickedBoss.nameTr + mutationLabelMap[eliteMutation],
      eliteMutation,
      minionSquadSignature,
      minionSpawns,
      terrainThemeIndex,
      targetPercent,
      shieldSeconds,
      bossSpeedScale,
      minionAggroMultiplier,
      hasLateStageEvolution
    };
  }

  public getBossDisplayNameTr(bossId: BossSpeciesId, eliteMutation: EliteMutationAffix = 'NONE'): string {
    const found = BOSS_CATALOG.find((b) => b.id === bossId);
    const base = found ? found.nameTr : bossId;
    const mutationLabelMap: Record<EliteMutationAffix, string> = {
      NONE: '',
      TWIN_CLONE: ' • İKİZ',
      ORBIT_GUARDED: ' • KALKANLI',
      MAGMA_WAKE: ' • LAV İZLİ',
      SNIPER_OVERCLOCK: ' • KESKİN NİŞAN',
      FRENZY_PULSE: ' • HİPER HIZ'
    };
    return base + mutationLabelMap[eliteMutation];
  }

  private buildDistinctMinionSquad(
    boss: BossCatalogEntry,
    wave: number,
    diff: GameDifficulty
  ): MinionSpawnGroup[] {
    // Pick the signature pair that wasn't used in the immediately preceding wave
    let chosenPair = boss.signatureSquads[0];
    if (
      boss.signatureSquads.length > 1 &&
      boss.signatureSquads[0].join('+') === this.lastSquadSignature
    ) {
      chosenPair = boss.signatureSquads[1];
    } else if (boss.signatureSquads.length > 1 && this.rand() >= 0.5) {
      if (boss.signatureSquads[1].join('+') !== this.lastSquadSignature) {
        chosenPair = boss.signatureSquads[1];
      }
    }

    const totalBudget =
      diff === 'EASY'
        ? Math.min(5, 2 + Math.floor(wave / 4))
        : diff === 'MEDIUM'
          ? Math.min(7, 3 + Math.floor(wave / 3))
          : Math.min(9, 4 + Math.floor(wave / 2));

    const primaryCount = Math.max(1, Math.ceil(totalBudget * 0.55));
    const secondaryCount = Math.max(1, totalBudget - primaryCount);

    const groups: MinionSpawnGroup[] = [
      { species: chosenPair[0], count: primaryCount },
      { species: chosenPair[1], count: secondaryCount }
    ];

    // On deeper waves (Wave 7+ Medium / Wave 4+ Hard), inject a 3rd specialist threat!
    if ((diff === 'HARD' && wave >= 4) || (diff === 'MEDIUM' && wave >= 7) || wave >= 11) {
      const specialists: MinionSpeciesId[] = [
        'SHIELD_SAPPER',
        'BORDER_SPARK_CRAB',
        'HOMING_SEEKER',
        'MINE_LAYER_DRONE',
        'PHASE_GHOST'
      ];
      const extra =
        specialists[(wave + Math.floor(this.rand() * specialists.length)) % specialists.length];
      if (!chosenPair.includes(extra)) {
        groups.push({ species: extra, count: 1 });
      }
    }

    return groups;
  }

  private pickEliteMutation(
    wave: number,
    diff: GameDifficulty,
    bossId: BossSpeciesId
  ): EliteMutationAffix {
    // Cycle 1 early/mid waves stay pure so each Boss's natural identity shines;
    // Deep waves (Wave 13+ Medium, Wave 7+ Hard, or Cycle 2 Wave 19+) gain Elite Mutations!
    const mutationUnlocked =
      wave > 18 || (diff === 'HARD' && wave >= 7) || (diff === 'MEDIUM' && wave >= 13);
    if (!mutationUnlocked) return 'NONE';

    const pool: EliteMutationAffix[] = [
      'ORBIT_GUARDED',
      'MAGMA_WAKE',
      'SNIPER_OVERCLOCK',
      'FRENZY_PULSE'
    ];
    if (bossId !== 'SEPARATION_TWIN_CORE' && bossId !== 'HYDRA_BIO_HEAD') {
      pool.push('TWIN_CLONE');
    }
    return pool[Math.floor(this.rand() * pool.length)];
  }

  private rand(): number {
    let t = (this.rngState += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
