/**
 * VOID CARVER — BUILD 15 FINAL: UNIFIED SINGLE-CURRENCY (`JETON`) ECONOMY & MINIMALIST STORE
 * (`src/core/CleanJetonEconomyAndStore.ts`)
 *
 * Eliminates all multi-currency bloat and clutter labels!
 * - ONE clean currency across the entire game: `JETON`.
 * - Balanced Jeton Earning Pacing:
 *   - Easy stage clear: ~20–26 Jeton
 *   - Medium stage clear: ~35–48 Jeton
 *   - Hard stage clear: ~60–82 Jeton
 * - Clean Minimalist Store (`MAĞAZA`) with 3 tabs ONLY:
 *   1. `GEMİLER` (8 iconic ships: 0 -> 250 -> 450 -> 700 -> 1000 -> 1400 -> 1900 -> 2500 Jeton)
 *   2. `İZLER` (6 crisp cutting trails: 0 -> 200 -> 400 -> 750 -> 1100 -> 1600 Jeton)
 *   3. `JETON AL` (4 standard App Store / Play Store tiers: 79,99 TL / 149,99 TL / 179,99 TL / 349,99 TL)
 * - Bulletproof Idempotent Transaction Ledger (`creditedTransactionIds`) + Automatic Pending-Purchase
 *   Reconciliation (`reconcilePendingEntitlements`) so a paying player NEVER loses an entitlement!
 */

import { GameDifficulty, HONEST_DIFFICULTIES_V15 } from './HonestDifficultyAndProgressionV15';

export interface ShipSkinItem {
  id: string;
  nameTr: string;
  jetonCost: number;
  hullHex: string;
  trimHex: string;
}

export interface TrailSkinItem {
  id: string;
  nameTr: string;
  jetonCost: number;
  primaryHex: string;
  glowHex: string;
  vfxType: 'CLEAN' | 'AMBER_SPARK' | 'EMERALD_PULSE' | 'LIGHTNING' | 'CRIMSON_FLARE' | 'PRISM';
}

export type StoreIapProductId =
  | 'com.tahafirat.voidcarver.jeton_500'
  | 'com.tahafirat.voidcarver.jeton_1500'
  | 'com.tahafirat.voidcarver.jeton_4000'
  | 'com.tahafirat.voidcarver.starter_x2';

export interface JetonIapPackSpec {
  productId: StoreIapProductId;
  kind: 'CONSUMABLE' | 'NON_CONSUMABLE';
  titleTr: string;
  detailTr: string;
  jetonAmount: number;
  grantsPermanentDoubleJeton?: boolean;
  grantsShipId?: string;
  defaultDisplayPriceTr: string;
  referenceUsd: number;
}

export const SHIPS_STORE_CATALOG: ShipSkinItem[] = [
  { id: 'SHIP_VANGUARD', nameTr: 'Vanguard', jetonCost: 0, hullHex: '#38BDF8', trimHex: '#E0F2FE' },
  { id: 'SHIP_PHANTOM', nameTr: 'Phantom', jetonCost: 250, hullHex: '#F43F5E', trimHex: '#FFE4E6' },
  { id: 'SHIP_GLACIER', nameTr: 'Buzul', jetonCost: 450, hullHex: '#22D3EE', trimHex: '#CFFAFE' },
  { id: 'SHIP_MANTA', nameTr: 'Vatoz', jetonCost: 700, hullHex: '#F59E0B', trimHex: '#FEF3C7' },
  { id: 'SHIP_SAMURAI', nameTr: 'Samuray', jetonCost: 1000, hullHex: '#A855F7', trimHex: '#F3E8FF' },
  { id: 'SHIP_VIPER', nameTr: 'Engerek', jetonCost: 1400, hullHex: '#10B981', trimHex: '#D1FAE5' },
  { id: 'SHIP_MAGMA', nameTr: 'Magma', jetonCost: 1900, hullHex: '#EA580C', trimHex: '#FFEDD5' },
  { id: 'SHIP_PHOENIX', nameTr: 'Anka', jetonCost: 2500, hullHex: '#EAB308', trimHex: '#FEF9C3' }
];

export const TRAILS_STORE_CATALOG: TrailSkinItem[] = [
  { id: 'TRAIL_CYAN', nameTr: 'İyon Mavi', jetonCost: 0, primaryHex: '#38BDF8', glowHex: '#BAE6FD', vfxType: 'CLEAN' },
  { id: 'TRAIL_AMBER', nameTr: 'Kehribar', jetonCost: 200, primaryHex: '#F59E0B', glowHex: '#FDE68A', vfxType: 'AMBER_SPARK' },
  { id: 'TRAIL_EMERALD', nameTr: 'Zümrüt', jetonCost: 400, primaryHex: '#10B981', glowHex: '#A7F3D0', vfxType: 'EMERALD_PULSE' },
  { id: 'TRAIL_LIGHTNING', nameTr: 'Şimşek', jetonCost: 750, primaryHex: '#60A5FA', glowHex: '#FFFFFF', vfxType: 'LIGHTNING' },
  { id: 'TRAIL_CRIMSON', nameTr: 'Kızıl Kor', jetonCost: 1100, primaryHex: '#F43F5E', glowHex: '#FECDD3', vfxType: 'CRIMSON_FLARE' },
  { id: 'TRAIL_PRISM', nameTr: 'Prizma', jetonCost: 1600, primaryHex: '#EC4899', glowHex: '#38BDF8', vfxType: 'PRISM' }
];

export const JETON_IAP_PACKS: JetonIapPackSpec[] = [
  {
    productId: 'com.tahafirat.voidcarver.jeton_500',
    kind: 'CONSUMABLE',
    titleTr: '500 Jeton',
    detailTr: 'Standart Jeton Paketi',
    jetonAmount: 500,
    defaultDisplayPriceTr: '79,99 TL',
    referenceUsd: 1.99
  },
  {
    productId: 'com.tahafirat.voidcarver.jeton_1500',
    kind: 'CONSUMABLE',
    titleTr: '1.500 Jeton',
    detailTr: '+%20 Avantajlı Paket',
    jetonAmount: 1500,
    defaultDisplayPriceTr: '179,99 TL',
    referenceUsd: 4.99
  },
  {
    productId: 'com.tahafirat.voidcarver.jeton_4000',
    kind: 'CONSUMABLE',
    titleTr: '4.000 Jeton',
    detailTr: 'Büyük Koleksiyon Paketi',
    jetonAmount: 4000,
    defaultDisplayPriceTr: '349,99 TL',
    referenceUsd: 9.99
  },
  {
    productId: 'com.tahafirat.voidcarver.starter_x2',
    kind: 'NON_CONSUMABLE',
    titleTr: 'Başlangıç Paketi',
    detailTr: 'Kalıcı x2 Jeton + Phantom + 750 Jeton',
    jetonAmount: 750,
    grantsPermanentDoubleJeton: true,
    grantsShipId: 'SHIP_PHANTOM',
    defaultDisplayPriceTr: '149,99 TL',
    referenceUsd: 3.99
  }
];

export interface VerifiedStoreTransaction {
  productId: StoreIapProductId;
  transactionId: string;
}

export interface NativePurchaseOutcome {
  ok: boolean;
  transactionId?: string;
  alreadyOwnedOnStore?: boolean;
  cancelled?: boolean;
}

export interface NativeStoreDriver {
  isNative(): boolean;
  getLocalizedPrices(ids: StoreIapProductId[]): Promise<Record<string, string>>;
  purchaseProduct(id: StoreIapProductId): Promise<NativePurchaseOutcome>;
  restoreOwnedNonConsumables(): Promise<StoreIapProductId[]>;
  getOwnedOrPendingPurchases?(): Promise<VerifiedStoreTransaction[]>;
}

const MAX_LEDGER_TX_HISTORY = 250;
const MAX_SAFE_JETON = 99_999_999;

function clampSafeJeton(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(MAX_SAFE_JETON, Math.floor(val)));
}

export class CleanJetonEconomyAndStore {
  public static readonly CONTINUE_COST_JETON = 100;

  public jetonBalance = 0;
  public hasPermanentDoubleJeton = false;
  public ownedShips = new Set<string>(['SHIP_VANGUARD']);
  public ownedTrails = new Set<string>(['TRAIL_CYAN']);
  public equippedShipId = 'SHIP_VANGUARD';
  public equippedTrailId = 'TRAIL_CYAN';
  public highestUnlockedStage: Record<GameDifficulty, number> = { EASY: 1, MEDIUM: 1, HARD: 1 };
  public bestEndlessWave: Record<GameDifficulty, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  public creditedTransactionIds = new Set<string>();
  public localizedPrices: Record<StoreIapProductId, string> = {
    'com.tahafirat.voidcarver.jeton_500': '79,99 TL',
    'com.tahafirat.voidcarver.jeton_1500': '179,99 TL',
    'com.tahafirat.voidcarver.jeton_4000': '349,99 TL',
    'com.tahafirat.voidcarver.starter_x2': '149,99 TL'
  };

  public usedContinueInCurrentRun = false;
  public isPurchasing = false;
  private onPersistCallback: (() => void) | null = null;
  private driver: NativeStoreDriver;

  constructor(initialJeton = 50, driver?: NativeStoreDriver) {
    this.jetonBalance = clampSafeJeton(initialJeton);
    this.driver =
      driver ?? {
        isNative: () => false,
        getLocalizedPrices: async () => ({}),
        purchaseProduct: async () => ({ ok: true }),
        restoreOwnedNonConsumables: async () =>
          this.hasPermanentDoubleJeton ? ['com.tahafirat.voidcarver.starter_x2'] : []
      };
  }

  public setPersistenceHook(cb: (() => void) | null): void {
    this.onPersistCallback = cb;
  }

  private notifyPersist(): void {
    try {
      this.onPersistCallback?.();
    } catch {
      // Never allow persistence hook exception to interrupt entitlement grant
    }
  }

  private recordCreditedTx(txId: string | undefined): void {
    if (!txId) return;
    this.creditedTransactionIds.add(txId);
    if (this.creditedTransactionIds.size > MAX_LEDGER_TX_HISTORY) {
      const oldest = this.creditedTransactionIds.values().next().value;
      if (oldest) this.creditedTransactionIds.delete(oldest);
    }
  }

  public onNewRunStart(): void {
    this.usedContinueInCurrentRun = false;
  }

  /**
   * Balanced Jeton reward calculation at the end of every cleared Stage or Endless Wave!
   */
  public awardStageClearJeton(params: {
    difficulty: GameDifficulty;
    finalCapturedPercent: number;
    megaCutsCount: number; // Single cuts >= 25% area
    crushedMinionsCount: number;
    noDeathClear: boolean;
    extraBonusRatio?: number;
  }): number {
    const diffMult = HONEST_DIFFICULTIES_V15[params.difficulty].jetonRewardMultiplier;
    const base = 16;
    const bonusOverTarget = Math.max(0, params.finalCapturedPercent - 75) * 0.6;
    const skillBonus =
      Math.max(0, params.megaCutsCount) * 6 +
      Math.max(0, params.crushedMinionsCount) * 2 +
      (params.noDeathClear ? 5 : 0);

    const x2Mult = this.hasPermanentDoubleJeton ? 2.0 : 1.0;
    const perkMult = 1 + Math.max(0, params.extraBonusRatio ?? 0);
    const earned = Math.max(
      10,
      Math.round((base + bonusOverTarget + skillBonus) * diffMult * x2Mult * perkMult)
    );
    this.jetonBalance = clampSafeJeton(this.jetonBalance + earned);
    this.notifyPersist();
    return earned;
  }

  public canOfferContinueModal(capturedPercent: number, waveOrStage: number): boolean {
    if (this.usedContinueInCurrentRun) return false;
    return capturedPercent >= 50 || waveOrStage >= 3;
  }

  public canContinueRun(capturedPercent: number, waveOrStage: number): boolean {
    if (this.usedContinueInCurrentRun) return false; // Strictly max 1 continue per run!
    if (capturedPercent < 50 && waveOrStage < 3) return false;
    return this.jetonBalance >= CleanJetonEconomyAndStore.CONTINUE_COST_JETON;
  }

  public spendJetonForContinue(): boolean {
    if (
      this.usedContinueInCurrentRun ||
      this.jetonBalance < CleanJetonEconomyAndStore.CONTINUE_COST_JETON
    ) {
      return false;
    }
    this.jetonBalance = clampSafeJeton(
      this.jetonBalance - CleanJetonEconomyAndStore.CONTINUE_COST_JETON
    );
    this.usedContinueInCurrentRun = true;
    this.notifyPersist();
    return true;
  }

  public buyOrEquipShip(shipId: string): 'EQUIPPED' | 'BOUGHT_AND_EQUIPPED' | 'NOT_ENOUGH_JETON' {
    const item = SHIPS_STORE_CATALOG.find((s) => s.id === shipId);
    if (!item) return 'NOT_ENOUGH_JETON';
    if (!this.ownedShips.has(shipId)) {
      if (this.jetonBalance < item.jetonCost) return 'NOT_ENOUGH_JETON';
      this.jetonBalance = clampSafeJeton(this.jetonBalance - item.jetonCost);
      this.ownedShips.add(shipId);
      this.equippedShipId = shipId;
      this.notifyPersist();
      return 'BOUGHT_AND_EQUIPPED';
    }
    this.equippedShipId = shipId;
    this.notifyPersist();
    return 'EQUIPPED';
  }

  public buyOrEquipTrail(trailId: string): 'EQUIPPED' | 'BOUGHT_AND_EQUIPPED' | 'NOT_ENOUGH_JETON' {
    const item = TRAILS_STORE_CATALOG.find((t) => t.id === trailId);
    if (!item) return 'NOT_ENOUGH_JETON';
    if (!this.ownedTrails.has(trailId)) {
      if (this.jetonBalance < item.jetonCost) return 'NOT_ENOUGH_JETON';
      this.jetonBalance = clampSafeJeton(this.jetonBalance - item.jetonCost);
      this.ownedTrails.add(trailId);
      this.equippedTrailId = trailId;
      this.notifyPersist();
      return 'BOUGHT_AND_EQUIPPED';
    }
    this.equippedTrailId = trailId;
    this.notifyPersist();
    return 'EQUIPPED';
  }

  public async syncStorePrices(): Promise<void> {
    if (!this.driver.isNative()) return;
    try {
      const ids = JETON_IAP_PACKS.map((p) => p.productId);
      const map = await this.driver.getLocalizedPrices(ids);
      for (const id of ids) {
        if (map[id]) this.localizedPrices[id] = map[id]!;
      }
    } catch {
      // Retain clean default labels offline
    }
  }

  /**
   * Automatically reconciles any interrupted/pending StoreKit 2 or Play Billing transactions
   * (e.g., app crashed or battery died right after payment, Ask-to-Buy approval, or reinstall).
   */
  public async reconcilePendingEntitlements(): Promise<{ recoveredCount: number }> {
    if (!this.driver.isNative() || !this.driver.getOwnedOrPendingPurchases) {
      return { recoveredCount: 0 };
    }
    let recoveredCount = 0;
    try {
      const txs = await this.driver.getOwnedOrPendingPurchases();
      for (const tx of txs) {
        const pack = JETON_IAP_PACKS.find((p) => p.productId === tx.productId);
        if (!pack) continue;

        if (pack.kind === 'NON_CONSUMABLE') {
          const hadBefore =
            this.hasPermanentDoubleJeton &&
            (!pack.grantsShipId || this.ownedShips.has(pack.grantsShipId));
          if (pack.grantsPermanentDoubleJeton) this.hasPermanentDoubleJeton = true;
          if (pack.grantsShipId) this.ownedShips.add(pack.grantsShipId);

          if (tx.transactionId && !this.creditedTransactionIds.has(tx.transactionId)) {
            if (!hadBefore) {
              this.jetonBalance = clampSafeJeton(this.jetonBalance + pack.jetonAmount);
            }
            this.recordCreditedTx(tx.transactionId);
            recoveredCount += 1;
          } else if (!hadBefore) {
            recoveredCount += 1;
          }
        } else if (tx.transactionId && !this.creditedTransactionIds.has(tx.transactionId)) {
          this.jetonBalance = clampSafeJeton(this.jetonBalance + pack.jetonAmount);
          this.recordCreditedTx(tx.transactionId);
          recoveredCount += 1;
        }
      }
      if (recoveredCount > 0) {
        this.notifyPersist();
      }
    } catch {
      // Silent retry on next foreground resume
    }
    return { recoveredCount };
  }

  public async purchaseJetonPack(
    productId: StoreIapProductId
  ): Promise<{
    ok: boolean;
    alreadyOwned?: boolean;
    restoredExisting?: boolean;
    busy?: boolean;
    cancelled?: boolean;
  }> {
    const pack = JETON_IAP_PACKS.find((p) => p.productId === productId);
    if (!pack) return { ok: false };
    if (pack.kind === 'NON_CONSUMABLE' && this.hasPermanentDoubleJeton) {
      if (pack.grantsShipId) this.ownedShips.add(pack.grantsShipId);
      this.notifyPersist();
      return { ok: false, alreadyOwned: true };
    }
    if (this.isPurchasing) {
      return { ok: false, busy: true };
    }

    this.isPurchasing = true;
    try {
      const res = await this.driver.purchaseProduct(productId);

      // If StoreKit / Play Billing reports the user ALREADY bought `starter_x2` (e.g., after reinstall),
      // grant the Non-Consumable perks immediately without charging or failing!
      if (pack.kind === 'NON_CONSUMABLE' && res.alreadyOwnedOnStore) {
        if (pack.grantsPermanentDoubleJeton) this.hasPermanentDoubleJeton = true;
        if (pack.grantsShipId) this.ownedShips.add(pack.grantsShipId);
        if (res.transactionId) this.recordCreditedTx(res.transactionId);
        this.notifyPersist();
        return { ok: true, restoredExisting: true };
      }

      if (!res.ok) {
        // Fallback check: if native purchase failed on Non-Consumable, verify if store already owns it!
        if (pack.kind === 'NON_CONSUMABLE' && this.driver.isNative()) {
          const restored = await this.restorePurchasesInternal();
          if (restored) {
            return { ok: true, restoredExisting: true };
          }
        }
        return { ok: false, cancelled: res.cancelled };
      }

      // Idempotency guard: never double-credit the exact same StoreKit/Play transactionId,
      // while guaranteeing immediate persistent disk write!
      if (res.transactionId && this.creditedTransactionIds.has(res.transactionId)) {
        if (pack.grantsPermanentDoubleJeton) this.hasPermanentDoubleJeton = true;
        if (pack.grantsShipId) this.ownedShips.add(pack.grantsShipId);
        this.notifyPersist();
        return { ok: true, restoredExisting: true };
      }

      this.jetonBalance = clampSafeJeton(this.jetonBalance + pack.jetonAmount);
      if (pack.grantsPermanentDoubleJeton) this.hasPermanentDoubleJeton = true;
      if (pack.grantsShipId) this.ownedShips.add(pack.grantsShipId);
      if (res.transactionId) {
        this.recordCreditedTx(res.transactionId);
      }
      this.notifyPersist();
      return { ok: true };
    } finally {
      this.isPurchasing = false;
    }
  }

  private async restorePurchasesInternal(): Promise<boolean> {
    try {
      const owned = await this.driver.restoreOwnedNonConsumables();
      if (owned.includes('com.tahafirat.voidcarver.starter_x2')) {
        this.hasPermanentDoubleJeton = true;
        this.ownedShips.add('SHIP_PHANTOM');
        this.notifyPersist();
        return true;
      }
    } catch {
      // Ignore offline/cancelled restore errors
    }
    return false;
  }

  public async restorePurchases(): Promise<boolean> {
    if (this.isPurchasing) return false;
    this.isPurchasing = true;
    try {
      const nonConsRestored = await this.restorePurchasesInternal();
      const pending = await this.reconcilePendingEntitlements();
      return nonConsRestored || pending.recoveredCount > 0;
    } finally {
      this.isPurchasing = false;
    }
  }
}
