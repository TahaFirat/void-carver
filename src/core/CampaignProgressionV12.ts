/**
 * VOID CARVER — BUILD 12: DETERMINISTIC 24-STAGE FIXED CAMPAIGN & FAIR MOBILE DIFFICULTY ENGINE
 * (`src/core/CampaignProgressionV12.ts` — Replaces random-shuffling `EncounterDeck.ts`)
 *
 * Fixes:
 * 1. DETERMINISTIC FIXED LEVEL ORDER: Level 1 is ALWAYS Boss #1 (`CENTIPEDE_WYRM`),
 *    Level 2 is ALWAYS Boss #2 (`IRON_CRUSTACEAN`) ... Level 24 is ALWAYS Boss #24 (`VOID_EMPEROR`).
 *    Losing a life or restarting NEVER randomizes which boss appears on a given level!
 * 2. MOBILE-CALIBRATED DIFFICULTY (`EASY`, `MEDIUM`, `HARD`):
 *    - Target capture % capped at playable mobile thresholds (75% Easy, 78% Medium, 80%–82% Hard; NEVER 90%!).
 *    - Boss & minion speeds strictly capped below player cutting speed so touch controls always have counter-play.
 *    - Crowding Dampener automatically slows enemies by up to 22% when >55% of the arena is already captured!
 * 3. EXPANDED VARIETY: 24 Unique Bosses (+6 brand-new) & 18 Unique Minion Species (+4 brand-new).
 * 4. CRYSTAL-CLEAR DIFFICULTY METADATA for the UI selector (color hex, badge text, lives, speed label).
 */

export type GameDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type BossSpeciesId =
  // Sector 1: Bio-Mechanical Frontier (Levels 1–6)
  | 'CENTIPEDE_WYRM'
  | 'IRON_CRUSTACEAN'
  | 'ALL_DIR_BIO_WHEEL'
  | 'SNIPER_SCARAB'
  | 'FROST_LEVIATHAN'      // NEW Build 12!
  | 'SPIRAL_NAUTILUS'
  // Sector 2: Molten & Industrial Core (Levels 7–12)
  | 'PHANTOM_MANTIS'
  | 'PLASMA_SCORPION'      // NEW Build 12!
  | 'SEPARATION_TWIN_CORE'
  | 'MAGMA_SERPENT'
  | 'MECHA_TARANTULA'
  | 'SINKHOLE_WORM'        // NEW Build 12!
  // Sector 3: Quantum & Astral Vault (Levels 13–18)
  | 'HIVE_CARRIER'
  | 'MIRROR_PRISM'
  | 'QUANTUM_BUTTERFLY'    // NEW Build 12!
  | 'ELECTRIC_MEDUSA'
  | 'GRAVITY_GOLEM'
  | 'CYBER_TITAN_SKULL'
  // Sector 4: Abyssal Citadel (Levels 19–24)
  | 'SOLAR_FLARE_CORE'     // NEW Build 12!
  | 'HYDRA_BIO_HEAD'
  | 'SAWBLADE_JUGGERNAUT'
  | 'CHRONO_SPHINX'
  | 'ABYSSAL_OVERMIND'
  | 'VOID_EMPEROR';        // NEW Build 12 Final Boss!

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
  | 'KAMIKAZE_SPORE'
  | 'COSMIC_MANTA'         // NEW Build 12: Smooth figure-8 glider
  | 'RICOCHET_CRYSTAL'     // NEW Build 12: Pure 45-degree prism bouncer
  | 'VORTEX_DRIFTER'       // NEW Build 12: Gentle curve puller (+5s shield on crush)
  | 'COMET_SEED';          // NEW Build 12: Fast comet with glowing tail

export interface DifficultyUiProfile {
  id: GameDifficulty;
  titleTr: string;
  badgeTr: string;
  accentHex: string;
  glowRgba: string;
  startingLives: number;
  baseTargetPercent: number;
  maxTargetPercent: number;
  shieldSecondsBase: number;
  playerCutSpeedPxPerSec: number;
  bossSpeedMultBase: number;
  bossSpeedMultMax: number;
  minionSpeedMult: number;
  reactionGraceSec: number; // Delay before hunter minions react to an active player cut!
  telegraphLeadSec: number; // Boss warning flash before firing/dashing!
  powerUpDropIntervalSec: number;
  summaryLineTr: string;
}

export const DIFFICULTY_UI_PROFILES: Record<GameDifficulty, DifficultyUiProfile> = {
  EASY: {
    id: 'EASY',
    titleTr: 'KOLAY',
    badgeTr: 'RAHAT KEYİF MODU',
    accentHex: '#10B981',
    glowRgba: 'rgba(16, 185, 129, 0.42)',
    startingLives: 5,
    baseTargetPercent: 75,
    maxTargetPercent: 77,
    shieldSecondsBase: 95,
    playerCutSpeedPxPerSec: 270,
    bossSpeedMultBase: 0.88,
    bossSpeedMultMax: 1.12,
    minionSpeedMult: 0.85,
    reactionGraceSec: 1.25,
    telegraphLeadSec: 0.9,
    powerUpDropIntervalSec: 11,
    summaryLineTr: '5 Can • %75 Alan Hedefi • Bol Güçlendirme • Rahat Mobil Hız'
  },
  MEDIUM: {
    id: 'MEDIUM',
    titleTr: 'ORTA',
    badgeTr: 'DENGELİ ARCADE (ÖNERİLEN)',
    accentHex: '#F59E0B',
    glowRgba: 'rgba(245, 158, 11, 0.45)',
    startingLives: 4,
    baseTargetPercent: 77,
    maxTargetPercent: 80,
    shieldSecondsBase: 80,
    playerCutSpeedPxPerSec: 280,
    bossSpeedMultBase: 0.98,
    bossSpeedMultMax: 1.24,
    minionSpeedMult: 1.0,
    reactionGraceSec: 0.9,
    telegraphLeadSec: 0.7,
    powerUpDropIntervalSec: 14,
    summaryLineTr: '4 Can • %78 Alan Hedefi • Adil Saldırı Uyarısı • Dengeli Tempo'
  },
  HARD: {
    id: 'HARD',
    titleTr: 'ZOR',
    badgeTr: 'USTA PİLOT SINAVI',
    accentHex: '#EF4444',
    glowRgba: 'rgba(239, 68, 68, 0.45)',
    startingLives: 3,
    baseTargetPercent: 80,
    maxTargetPercent: 82,
    shieldSecondsBase: 68,
    playerCutSpeedPxPerSec: 295,
    bossSpeedMultBase: 1.08,
    bossSpeedMultMax: 1.36,
    minionSpeedMult: 1.14,
    reactionGraceSec: 0.65,
    telegraphLeadSec: 0.52,
    powerUpDropIntervalSec: 16,
    summaryLineTr: '3 Can • %80 Alan Hedefi • Hızlı Boss Desenleri • Adil Usta Modu'
  }
};

export interface FixedStageSpec {
  levelNumber: number; // 1..24 FIXED!
  sectorNumber: 1 | 2 | 3 | 4;
  sectorNameTr: string;
  bossId: BossSpeciesId;
  bossNameTr: string;
  bossMechanicHintTr: string;
  terrainThemeIndex: number;
  primaryMinion: MinionSpeciesId;
  secondaryMinion: MinionSpeciesId;
  specialistMinion?: MinionSpeciesId;
}

/**
 * 100% DETERMINISTIC 24-LEVEL CAMPAIGN TABLE
 * Every single player, retry, and life-loss follows this exact curated arcade progression!
 */
export const FIXED_CAMPAIGN_STAGES: FixedStageSpec[] = [
  // SECTOR 1 (Levels 1-6)
  { levelNumber: 1, sectorNumber: 1, sectorNameTr: 'Sektör 1: Dış Yörünge', bossId: 'CENTIPEDE_WYRM', bossNameTr: 'ZIRHLI KIRKAYAK', bossMechanicHintTr: 'Kıvrımlı devriye gezer; üçlü yelpaze atışı öncesi başı parlar.', terrainThemeIndex: 0, primaryMinion: 'SCARAB_BEETLE', secondaryMinion: 'RICOCHET_CRYSTAL' },
  { levelNumber: 2, sectorNumber: 1, sectorNameTr: 'Sektör 1: Dış Yörünge', bossId: 'IRON_CRUSTACEAN', bossNameTr: 'HİDROLİK YENGEÇ', bossMechanicHintTr: 'Kıskaçlarını açıp uyardıktan sonra yatay makas darbesi atar.', terrainThemeIndex: 1, primaryMinion: 'COSMIC_MANTA', secondaryMinion: 'ANCHOR_BARNACLE' },
  { levelNumber: 3, sectorNumber: 1, sectorNameTr: 'Sektör 1: Dış Yörünge', bossId: 'ALL_DIR_BIO_WHEEL', bossNameTr: 'BİYO-ÇARK', bossMechanicHintTr: 'Dönerek sekiz yöne yavaş enerji halkası saçar.', terrainThemeIndex: 2, primaryMinion: 'SPLITTER_AMOEBA', secondaryMinion: 'ORBIT_SATELLITE' },
  { levelNumber: 4, sectorNumber: 1, sectorNameTr: 'Sektör 1: Dış Yörünge', bossId: 'SNIPER_SCARAB', bossNameTr: 'ALTIN SKARAB', bossMechanicHintTr: 'Nişan çizgisi gösterip 0.7 sn sonra tekli hızlı darbe yollar.', terrainThemeIndex: 3, primaryMinion: 'WASP_SWARMER', secondaryMinion: 'RICOCHET_CRYSTAL' },
  { levelNumber: 5, sectorNumber: 1, sectorNameTr: 'Sektör 1: Dış Yörünge', bossId: 'FROST_LEVIATHAN', bossNameTr: 'BUZUL LEVİATHAN', bossMechanicHintTr: 'Geçtiği yerde kısa süreli yavaşlatıcı buz kristalleri bırakır.', terrainThemeIndex: 4, primaryMinion: 'COSMIC_MANTA', secondaryMinion: 'POD_TURRET' },
  { levelNumber: 6, sectorNumber: 1, sectorNameTr: 'Sektör 1: Dış Yörünge', bossId: 'SPIRAL_NAUTILUS', bossNameTr: 'ZIRHLI NAUTİLUS', bossMechanicHintTr: 'Kabuğuna çekilip duvarlardan bilardo topu gibi seker.', terrainThemeIndex: 5, primaryMinion: 'SCARAB_BEETLE', secondaryMinion: 'VORTEX_DRIFTER', specialistMinion: 'BORDER_SPARK_CRAB' },

  // SECTOR 2 (Levels 7-12)
  { levelNumber: 7, sectorNumber: 2, sectorNameTr: 'Sektör 2: Magma Çekirdeği', bossId: 'PHANTOM_MANTIS', bossNameTr: 'ÇELİK PEYGAMBERDEVESİ', bossMechanicHintTr: 'Kısa mesafe sıçrama öncesi gölge izi bırakır.', terrainThemeIndex: 6, primaryMinion: 'WASP_SWARMER', secondaryMinion: 'PHASE_GHOST' },
  { levelNumber: 8, sectorNumber: 2, sectorNameTr: 'Sektör 2: Magma Çekirdeği', bossId: 'PLASMA_SCORPION', bossNameTr: 'PLAZMA AKREBİ', bossMechanicHintTr: 'Kuyruk iğnesini şarj edip yay şeklinde plazma dalgası atar.', terrainThemeIndex: 7, primaryMinion: 'CHARGER_HORN', secondaryMinion: 'RICOCHET_CRYSTAL' },
  { levelNumber: 9, sectorNumber: 2, sectorNameTr: 'Sektör 2: Magma Çekirdeği', bossId: 'SEPARATION_TWIN_CORE', bossNameTr: 'İKİZ REAKTÖR', bossMechanicHintTr: 'Alan %50 daraldığında iki küçük senkron çekirdeğe ayrılır.', terrainThemeIndex: 8, primaryMinion: 'ORBIT_SATELLITE', secondaryMinion: 'SPLITTER_AMOEBA' },
  { levelNumber: 10, sectorNumber: 2, sectorNameTr: 'Sektör 2: Magma Çekirdeği', bossId: 'MAGMA_SERPENT', bossNameTr: 'MAGMA EJDERİ', bossMechanicHintTr: 'S-kıvrımıyla yüzer ve 3 saniyede sönen kor damlaları bırakır.', terrainThemeIndex: 9, primaryMinion: 'COMET_SEED', secondaryMinion: 'MINE_LAYER_DRONE' },
  { levelNumber: 11, sectorNumber: 2, sectorNameTr: 'Sektör 2: Magma Çekirdeği', bossId: 'MECHA_TARANTULA', bossNameTr: 'MEKANİK TARANTULA', bossMechanicHintTr: 'Sahanın ortasına geçici enerji ağı örer.', terrainThemeIndex: 10, primaryMinion: 'LINE_LEECH', secondaryMinion: 'ANCHOR_BARNACLE' },
  { levelNumber: 12, sectorNumber: 2, sectorNameTr: 'Sektör 2: Magma Çekirdeği', bossId: 'SINKHOLE_WORM', bossNameTr: 'OBRUK SOLUCANI', bossMechanicHintTr: 'Boşlukta dalıp başka bir merkez noktasından uyarı halkasıyla çıkar.', terrainThemeIndex: 11, primaryMinion: 'VORTEX_DRIFTER', secondaryMinion: 'SCARAB_BEETLE', specialistMinion: 'SHIELD_SAPPER' },

  // SECTOR 3 (Levels 13-18)
  { levelNumber: 13, sectorNumber: 3, sectorNameTr: 'Sektör 3: Kuantum Mahzeni', bossId: 'HIVE_CARRIER', bossNameTr: 'ANA KOVAN GEMİSİ', bossMechanicHintTr: 'Ağır hareket eder; periyodik olarak mini spor dronu salar.', terrainThemeIndex: 12, primaryMinion: 'KAMIKAZE_SPORE', secondaryMinion: 'COSMIC_MANTA' },
  { levelNumber: 14, sectorNumber: 3, sectorNameTr: 'Sektör 3: Kuantum Mahzeni', bossId: 'MIRROR_PRISM', bossNameTr: 'KRİSTAL PRİZMA', bossMechanicHintTr: 'Duvarlardan 1 kez yansıyan ince ışık huzmesi gönderir.', terrainThemeIndex: 13, primaryMinion: 'RICOCHET_CRYSTAL', secondaryMinion: 'PHASE_GHOST' },
  { levelNumber: 15, sectorNumber: 3, sectorNameTr: 'Sektör 3: Kuantum Mahzeni', bossId: 'QUANTUM_BUTTERFLY', bossNameTr: 'KUANTUM KELEBEĞİ', bossMechanicHintTr: 'Kanat çırpışıyla simetrik ikili dalga halkaları yayar.', terrainThemeIndex: 14, primaryMinion: 'COSMIC_MANTA', secondaryMinion: 'ORBIT_SATELLITE' },
  { levelNumber: 16, sectorNumber: 3, sectorNameTr: 'Sektör 3: Kuantum Mahzeni', bossId: 'ELECTRIC_MEDUSA', bossNameTr: 'ELEKTRİK DENİZANASI', bossMechanicHintTr: 'Kısa menzilli nabız halkasıyla süzülür.', terrainThemeIndex: 15, primaryMinion: 'SPLITTER_AMOEBA', secondaryMinion: 'VORTEX_DRIFTER', specialistMinion: 'BORDER_SPARK_CRAB' },
  { levelNumber: 17, sectorNumber: 3, sectorNameTr: 'Sektör 3: Kuantum Mahzeni', bossId: 'GRAVITY_GOLEM', bossNameTr: 'MANYETİK MONOLİT', bossMechanicHintTr: 'Etrafındaki uyduları döndürerek ağır tempoda ilerler.', terrainThemeIndex: 0, primaryMinion: 'ORBIT_SATELLITE', secondaryMinion: 'ANCHOR_BARNACLE' },
  { levelNumber: 18, sectorNumber: 3, sectorNameTr: 'Sektör 3: Kuantum Mahzeni', bossId: 'CYBER_TITAN_SKULL', bossNameTr: 'SİBER KAFATASI', bossMechanicHintTr: 'Gözleri parladıktan sonra çapraz plazma yaylımı atar.', terrainThemeIndex: 3, primaryMinion: 'POD_TURRET', secondaryMinion: 'COMET_SEED', specialistMinion: 'HOMING_SEEKER' },

  // SECTOR 4 (Levels 19-24)
  { levelNumber: 19, sectorNumber: 4, sectorNameTr: 'Sektör 4: Hiçlik Kalesi', bossId: 'SOLAR_FLARE_CORE', bossNameTr: 'GÜNEŞ FIRTINASI ÇEKİRDEĞİ', bossMechanicHintTr: 'Döner güneş patlaması kolları arasında geniş güvenli boşluklar bırakır.', terrainThemeIndex: 7, primaryMinion: 'COMET_SEED', secondaryMinion: 'RICOCHET_CRYSTAL' },
  { levelNumber: 20, sectorNumber: 4, sectorNameTr: 'Sektör 4: Hiçlik Kalesi', bossId: 'HYDRA_BIO_HEAD', bossNameTr: 'ÜÇ BAŞLI HİDRA', bossMechanicHintTr: 'Üç baş sırayla ritmik mermi atar.', terrainThemeIndex: 9, primaryMinion: 'LINE_LEECH', secondaryMinion: 'WASP_SWARMER' },
  { levelNumber: 21, sectorNumber: 4, sectorNameTr: 'Sektör 4: Hiçlik Kalesi', bossId: 'SAWBLADE_JUGGERNAUT', bossNameTr: 'TESTERE TANKI', bossMechanicHintTr: 'Düz hatlarda hızlanıp köşelerde kısa mola verir.', terrainThemeIndex: 11, primaryMinion: 'CHARGER_HORN', secondaryMinion: 'MINE_LAYER_DRONE', specialistMinion: 'BORDER_SPARK_CRAB' },
  { levelNumber: 22, sectorNumber: 4, sectorNameTr: 'Sektör 4: Hiçlik Kalesi', bossId: 'CHRONO_SPHINX', bossNameTr: 'ZAMAN SFENKSİ', bossMechanicHintTr: 'Zaman halkaları açar; halkaların dışından kesim yapmak güvenlidir.', terrainThemeIndex: 13, primaryMinion: 'PHASE_GHOST', secondaryMinion: 'VORTEX_DRIFTER' },
  { levelNumber: 23, sectorNumber: 4, sectorNameTr: 'Sektör 4: Hiçlik Kalesi', bossId: 'ABYSSAL_OVERMIND', bossNameTr: 'HİÇLİK ANA BEYNİ', bossMechanicHintTr: 'Koruma uydularıyla süzülür; uyduları kesimle yok edilebilir.', terrainThemeIndex: 14, primaryMinion: 'ORBIT_SATELLITE', secondaryMinion: 'HOMING_SEEKER' },
  { levelNumber: 24, sectorNumber: 4, sectorNameTr: 'Sektör 4: Hiçlik Kalesi', bossId: 'VOID_EMPEROR', bossNameTr: 'HİÇLİK İMPARATORU', bossMechanicHintTr: 'İki aşamalı final karşılaşması; her saldırı öncesi net ışık uyarısı verir.', terrainThemeIndex: 15, primaryMinion: 'COSMIC_MANTA', secondaryMinion: 'COMET_SEED', specialistMinion: 'PHASE_GHOST' }
];

export const ALL_BOSS_IDS_V12: BossSpeciesId[] = FIXED_CAMPAIGN_STAGES.map((s) => s.bossId);

export const ALL_MINION_IDS_V12: MinionSpeciesId[] = [
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
  'KAMIKAZE_SPORE',
  'COSMIC_MANTA',
  'RICOCHET_CRYSTAL',
  'VORTEX_DRIFTER',
  'COMET_SEED'
];

export interface ResolvedLevelPlan {
  levelNumber: number;
  stageIndexZeroBased: number;
  loopCycle: number; // 0 for Levels 1..24, 1+ for Endless Prestige Loop 25+
  difficulty: GameDifficulty;
  sectorNameTr: string;
  bossId: BossSpeciesId;
  bossDisplayNameTr: string;
  bossMechanicHintTr: string;
  terrainThemeIndex: number;
  targetPercent: number;
  shieldSeconds: number;
  playerCutSpeedPxPerSec: number;
  bossSpeedScale: number;
  minionSpeedScale: number;
  reactionGraceSec: number;
  telegraphLeadSec: number;
  powerUpDropIntervalSec: number;
  minionSpawns: Array<{ species: MinionSpeciesId; count: number }>;
}

/**
 * Pure, deterministic level resolver:
 * Calling `getFixedLevelPlan(1, 'MEDIUM')` 1,000 times ALWAYS returns the exact same Boss & balanced stats!
 */
export function getFixedLevelPlan(levelNumber: number, difficulty: GameDifficulty): ResolvedLevelPlan {
  const safeLevel = Math.max(1, Math.floor(levelNumber));
  const stageIndexZeroBased = (safeLevel - 1) % FIXED_CAMPAIGN_STAGES.length;
  const loopCycle = Math.floor((safeLevel - 1) / FIXED_CAMPAIGN_STAGES.length);
  const stage = FIXED_CAMPAIGN_STAGES[stageIndexZeroBased]!;
  const prof = DIFFICULTY_UI_PROFILES[difficulty];

  const progress01 = stageIndexZeroBased / (FIXED_CAMPAIGN_STAGES.length - 1);

  const targetPercent = Math.min(
    prof.maxTargetPercent,
    Math.round(prof.baseTargetPercent + progress01 * (prof.maxTargetPercent - prof.baseTargetPercent))
  );

  const shieldSeconds = Math.max(
    45,
    Math.round(prof.shieldSecondsBase - progress01 * 18)
  );

  const rawBossScale =
    prof.bossSpeedMultBase +
    progress01 * (prof.bossSpeedMultMax - prof.bossSpeedMultBase) +
    Math.min(0.12, loopCycle * 0.06);
  const bossSpeedScale = +Math.min(prof.bossSpeedMultMax + 0.12, rawBossScale).toFixed(2);

  // Mobile-friendly minion count: starts at 2, maxes out at 4 (Easy), 5 (Medium), 6 (Hard) — NEVER 9-10!
  const maxMinions = difficulty === 'EASY' ? 4 : difficulty === 'MEDIUM' ? 5 : 6;
  const minMinions = difficulty === 'HARD' ? 3 : 2;
  const totalMinions = Math.min(maxMinions, Math.round(minMinions + progress01 * (maxMinions - minMinions)));

  const primaryCount = Math.ceil(totalMinions * 0.55);
  const secondaryCount = Math.max(1, totalMinions - primaryCount);
  const minionSpawns: Array<{ species: MinionSpeciesId; count: number }> = [
    { species: stage.primaryMinion, count: primaryCount },
    { species: stage.secondaryMinion, count: secondaryCount }
  ];

  if (stage.specialistMinion && ((difficulty === 'MEDIUM' && safeLevel >= 12) || (difficulty === 'HARD' && safeLevel >= 6))) {
    // Replace 1 secondary minion instead of inflating total screen clutter!
    if (minionSpawns[1]!.count > 1) minionSpawns[1]!.count -= 1;
    minionSpawns.push({ species: stage.specialistMinion, count: 1 });
  }

  return {
    levelNumber: safeLevel,
    stageIndexZeroBased,
    loopCycle,
    difficulty,
    sectorNameTr: stage.sectorNameTr,
    bossId: stage.bossId,
    bossDisplayNameTr: loopCycle > 0 ? `${stage.bossNameTr} MK-${loopCycle + 1}` : stage.bossNameTr,
    bossMechanicHintTr: stage.bossMechanicHintTr,
    terrainThemeIndex: stage.terrainThemeIndex,
    targetPercent,
    shieldSeconds,
    playerCutSpeedPxPerSec: prof.playerCutSpeedPxPerSec,
    bossSpeedScale,
    minionSpeedScale: prof.minionSpeedMult,
    reactionGraceSec: prof.reactionGraceSec,
    telegraphLeadSec: prof.telegraphLeadSec,
    powerUpDropIntervalSec: prof.powerUpDropIntervalSec,
    minionSpawns
  };
}

/**
 * Dynamic Crowding Speed Dampener:
 * When the player has already captured >55% of the arena, the remaining void becomes small.
 * Slowing enemy bounce speed by up to 22% keeps tight end-of-level cuts fair on mobile touchscreens!
 */
export function computeCrowdingSpeedDampener(capturedPercent: number): number {
  if (capturedPercent <= 55) return 1.0;
  const t = Math.min(1, (capturedPercent - 55) / 25); // 55% -> 80%
  return +(1.0 - t * 0.22).toFixed(3); // Down to 0.78x speed in tight endgame!
}

export interface CampaignSaveData {
  selectedDifficulty: GameDifficulty;
  highestUnlockedLevel: Record<GameDifficulty, number>;
  starsByLevel: Record<string, 1 | 2 | 3>; // key: `${difficulty}_${level}`
}

export function createDefaultCampaignSave(): CampaignSaveData {
  return {
    selectedDifficulty: 'MEDIUM',
    highestUnlockedLevel: { EASY: 1, MEDIUM: 1, HARD: 1 },
    starsByLevel: {}
  };
}

export function recordLevelCompletion(
  save: CampaignSaveData,
  difficulty: GameDifficulty,
  completedLevel: number,
  finalCapturedPercent: number,
  lostLifeOnThisAttempt: boolean
): 1 | 2 | 3 {
  const stars: 1 | 2 | 3 =
    finalCapturedPercent >= 88 && !lostLifeOnThisAttempt
      ? 3
      : finalCapturedPercent >= 83 || !lostLifeOnThisAttempt
        ? 2
        : 1;
  const key = `${difficulty}_${completedLevel}`;
  const prev = save.starsByLevel[key] ?? 0;
  if (stars > prev) save.starsByLevel[key] = stars;
  save.highestUnlockedLevel[difficulty] = Math.max(
    save.highestUnlockedLevel[difficulty],
    Math.min(24, completedLevel + 1)
  );
  return stars;
}
