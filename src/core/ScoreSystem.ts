import {
  BIG_CUT_MULTIPLIER,
  BIG_CUT_THRESHOLD,
  BOSS_DESTROY_BONUS,
  FIRST_CUT_80_BONUS,
  LEVEL_CLEAR_BASE_BONUS,
  MAX_OVER_80_BONUS,
  SCORE_PER_PERCENT,
  SHIELD_UNIT_BONUS,
  SPECIAL_BLOCK_OPEN_BONUS,
  TWIN_SPLIT_BONUS
} from './Config';

export type LevelWinReason = 'AREA_THRESHOLD' | 'TWIN_SPLIT' | 'BOSS_DESTROYED';

export interface LevelClearBreakdown {
  winReason: LevelWinReason;
  claimedPercent: number;
  baseBonus: number;
  over80Bonus: number;
  shieldBonus: number;
  specialBonus: number;
  firstCutMillionBonus: number;
  totalLevelBonus: number;
  stars: 1 | 2 | 3;
}

export interface AchievementDef {
  id: string;
  titleTr: string;
  titleEn: string;
  descTr: string;
  descEn: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'FIRST_CARVE',
    titleTr: 'İLK KURTARIŞ',
    titleEn: 'FIRST LIBERATION',
    descTr: 'İlk bölümü %80+ alan keserek tamamla.',
    descEn: 'Clear your first stage by claiming 80%+ territory.'
  },
  {
    id: 'MEGA_SLICE',
    titleTr: 'CERRAHİ KESİM',
    titleEn: 'SURGICAL CARVER',
    descTr: 'Tek bir kesimde alanın en az %25\'ini ele geçir.',
    descEn: 'Capture at least 25% of the arena in a single cut.'
  },
  {
    id: 'MASTER_99',
    titleTr: 'YÜZDE 99 EFSANESİ',
    titleEn: '99% GRANDMASTER',
    descTr: 'Bir bölümü %99.0 veya üzeri alanla tamamla.',
    descEn: 'Finish any stage with 99.0% or higher claimed area.'
  },
  {
    id: 'TWIN_SPLITTER',
    titleTr: 'İKİZ AYIRICI',
    titleEn: 'BINARY DIVIDER',
    descTr: 'İkiz Boss\'u iki ayrı alana ayırarak anında kazan.',
    descEn: 'Win instantly by splitting the Twin Bosses apart.'
  },
  {
    id: 'BOSS_SLAYER',
    titleTr: 'ANA YARATIK AVCISI',
    titleEn: 'BOSS DESTROYER',
    descTr: 'Süper Atış veya cep sıkıştırması ile Boss\'u imha et.',
    descEn: 'Destroy a Stage Boss directly or crush it in a pocket.'
  },
  {
    id: 'COMBO_HUNTER',
    titleTr: 'ZİNCİRLEME İMHA',
    titleEn: 'CHAIN TRAPPER',
    descTr: 'Tek bir kesimde aynı anda en az 3 böceği patlat.',
    descEn: 'Trap and destroy 3 or more beetles in a single cut.'
  },
  {
    id: 'UNTOUCHABLE',
    titleTr: 'DOKUNULMAZ PİLOT',
    titleEn: 'UNTOUCHABLE PILOT',
    descTr: 'Hiç can kaybetmeden bir bölümü tamamla.',
    descEn: 'Complete a stage without losing a single ship.'
  },
  {
    id: 'MIDWAY_HERO',
    titleTr: 'YARI YOL ŞAMPİYONU',
    titleEn: 'HALFWAY CHAMPION',
    descTr: 'Bölüm 50\'yi temizle (ORTA kademe finali).',
    descEn: 'Conquer Stage 50 (MEDIUM tier finale).'
  },
  {
    id: 'SECTOR_80_SAVIOR',
    titleTr: 'KURTULUŞ KAPISI',
    titleEn: 'ESCAPE VICTOR',
    descTr: '100 bölümlük maceranın tamamını zaferle bitir.',
    descEn: 'Complete all 100 stages of the campaign.'
  },
  {
    id: 'HIGH_ROLLER',
    titleTr: 'REKOR KOMUTANI',
    titleEn: 'HIGH SCORE ACE',
    descTr: 'Tek bir oyunda 1.000.000 puana ulaş.',
    descEn: 'Reach 1,000,000 points in a single game session.'
  }
];

export class ScoreSystem {
  public static computeCutScore(percentDelta: number, diffMultiplier: number): {
    points: number;
    isBigCut: boolean;
  } {
    const isBigCut = percentDelta >= BIG_CUT_THRESHOLD;
    const raw = percentDelta * SCORE_PER_PERCENT * (isBigCut ? BIG_CUT_MULTIPLIER : 1.0);
    return {
      points: Math.max(10, Math.round((raw * diffMultiplier) / 10) * 10),
      isBigCut
    };
  }

  public static computeMinionTrapScore(chainIndex: number): number {
    const clampedExp = Math.min(8, Math.max(0, chainIndex));
    return 500 * Math.pow(2, clampedExp);
  }

  public static computeSpecialBlockBonus(): number {
    return SPECIAL_BLOCK_OPEN_BONUS;
  }

  /**
   * Exponential over-target mastery bonus scaling smoothly up to `+500,000` near `99.8%`!
   */
  public static computeOver80Bonus(claimedPercent: number, targetPercent = 80): number {
    if (claimedPercent <= targetPercent) return 0;
    if (claimedPercent >= 99.8) return MAX_OVER_80_BONUS;

    const span = Math.max(1.0, 99.8 - targetPercent);
    const normalized = Math.max(0, Math.min(1, (claimedPercent - targetPercent) / span));
    const linearPart = normalized * 60_000;
    const expPart = Math.pow(normalized, 2.75) * (MAX_OVER_80_BONUS - 60_000);
    return Math.min(MAX_OVER_80_BONUS, Math.round((linearPart + expPart) / 100) * 100);
  }

  public static computeLevelClearBreakdown(
    winReason: LevelWinReason,
    claimedPercent: number,
    remainingShieldUnits: number,
    diffMultiplier: number,
    clearedInSingleCut = false,
    targetPercent = 80
  ): LevelClearBreakdown {
    const baseBonus = Math.round(LEVEL_CLEAR_BASE_BONUS * diffMultiplier);
    const over80Bonus = Math.round(
      this.computeOver80Bonus(claimedPercent, targetPercent) * diffMultiplier
    );
    const shieldBonus = Math.round(remainingShieldUnits * SHIELD_UNIT_BONUS * diffMultiplier);

    let specialBonus = 0;
    if (winReason === 'TWIN_SPLIT') {
      specialBonus = TWIN_SPLIT_BONUS;
    } else if (winReason === 'BOSS_DESTROYED') {
      specialBonus = BOSS_DESTROY_BONUS;
    }

    // Legendary `+1,000,000` bonus when reaching the stage target on the VERY FIRST cut!
    const firstCutMillionBonus =
      clearedInSingleCut && claimedPercent >= targetPercent ? FIRST_CUT_80_BONUS : 0;

    // Stars scale with the tier target (`%80` -> 2★ at 88%, 3★ at 95%; `%88` -> 2★ 93%, 3★ 97%)
    const twoStarAt = Math.min(96, targetPercent + 8);
    const threeStarAt = Math.min(98.5, Math.max(twoStarAt + 2, targetPercent + 15));
    let stars: 1 | 2 | 3 = 1;
    if (
      claimedPercent >= threeStarAt ||
      winReason === 'TWIN_SPLIT' ||
      winReason === 'BOSS_DESTROYED' ||
      firstCutMillionBonus > 0
    ) {
      stars = 3;
    } else if (claimedPercent >= twoStarAt) {
      stars = 2;
    }

    const totalLevelBonus =
      baseBonus + over80Bonus + shieldBonus + specialBonus + firstCutMillionBonus;

    return {
      winReason,
      claimedPercent,
      baseBonus,
      over80Bonus,
      shieldBonus,
      specialBonus,
      firstCutMillionBonus,
      totalLevelBonus,
      stars
    };
  }
}
