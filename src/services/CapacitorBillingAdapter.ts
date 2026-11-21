import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import type {
  NativePurchaseOutcome,
  NativeStoreDriver,
  StoreIapProductId,
  VerifiedStoreTransaction
} from '../core/CleanJetonEconomyAndStore';

const VALID_PRODUCT_IDS = new Set<StoreIapProductId>([
  'com.tahafirat.voidcarver.jeton_500',
  'com.tahafirat.voidcarver.jeton_1500',
  'com.tahafirat.voidcarver.jeton_4000',
  'com.tahafirat.voidcarver.starter_x2'
]);

function withBillingTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, timeoutMs);

    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

/**
 * Apple StoreKit 2 & Google Play Billing 7 driver via `@capgo/native-purchases`.
 * - Includes automatic pending/interrupted transaction discovery (`getOwnedOrPendingPurchases`).
 * - Handles `ITEM_ALREADY_OWNED` gracefully so reinstalled users never lose Non-Consumable access.
 * - Includes timeout safety valves so a hung OS sheet can never freeze the UI.
 */
export function createCapacitorStoreDriver(): NativeStoreDriver {
  const isNative = Capacitor.isNativePlatform();
  let sandboxSeq = 0;

  const fetchVerifiedTransactions = async (): Promise<VerifiedStoreTransaction[]> => {
    if (!isNative) return [];
    try {
      const { purchases } = await withBillingTimeout(
        NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP }),
        15_000,
        { purchases: [] }
      );
      const out: VerifiedStoreTransaction[] = [];
      for (const p of purchases ?? []) {
        const pid = p.productIdentifier as StoreIapProductId;
        if (!pid || !VALID_PRODUCT_IDS.has(pid)) continue;
        const txId = String(p.transactionId || `${pid}_verified`);
        out.push({ productId: pid, transactionId: txId });
      }
      return out;
    } catch {
      return [];
    }
  };

  return {
    isNative: () => isNative,

    async getLocalizedPrices(ids: StoreIapProductId[]): Promise<Record<string, string>> {
      if (!isNative) return {};
      try {
        const { products } = await withBillingTimeout(
          NativePurchases.getProducts({
            productIdentifiers: ids,
            productType: PURCHASE_TYPE.INAPP
          }),
          12_000,
          { products: [] }
        );
        const out: Record<string, string> = {};
        for (const p of products ?? []) {
          if (p.identifier && p.priceString) {
            out[p.identifier] = p.priceString;
          }
        }
        return out;
      } catch {
        return {};
      }
    },

    async purchaseProduct(id: StoreIapProductId): Promise<NativePurchaseOutcome> {
      if (!isNative) {
        sandboxSeq += 1;
        return { ok: true, transactionId: `web_sandbox_${Date.now()}_${sandboxSeq}` };
      }

      try {
        const tx = await withBillingTimeout(
          NativePurchases.purchaseProduct({
            productIdentifier: id,
            productType: PURCHASE_TYPE.INAPP,
            quantity: 1
          }),
          60_000,
          null
        );
        if (tx && tx.transactionId) {
          return {
            ok: true,
            transactionId: String(tx.transactionId)
          };
        }

        // Edge case: purchase succeeded on StoreKit/Play right as sheet closed without returning tx directly;
        // verify against native receipt cache immediately so user never misses an item!
        const verified = await fetchVerifiedTransactions();
        const matching = verified.find((v) => v.productId === id);
        if (matching) {
          return {
            ok: true,
            transactionId: matching.transactionId,
            alreadyOwnedOnStore: id === 'com.tahafirat.voidcarver.starter_x2'
          };
        }

        return { ok: false };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err ?? '');
        if (/cancel|iptal|userCancelled/i.test(msg)) {
          return { ok: false, cancelled: true };
        }
        if (/already|owned|item_already_owned|7/i.test(msg)) {
          const verified = await fetchVerifiedTransactions();
          const matching = verified.find((v) => v.productId === id);
          return {
            ok: id === 'com.tahafirat.voidcarver.starter_x2',
            alreadyOwnedOnStore: true,
            transactionId: matching?.transactionId
          };
        }
        // Final safety net: check native receipt store in case payment actually cleared despite exception
        const verified = await fetchVerifiedTransactions();
        const matching = verified.find((v) => v.productId === id);
        if (matching) {
          return {
            ok: true,
            transactionId: matching.transactionId,
            alreadyOwnedOnStore: id === 'com.tahafirat.voidcarver.starter_x2'
          };
        }
        return { ok: false };
      }
    },

    async restoreOwnedNonConsumables(): Promise<StoreIapProductId[]> {
      if (!isNative) return [];
      try {
        await withBillingTimeout(NativePurchases.restorePurchases(), 20_000, undefined);
      } catch {
        // Continue to getPurchases even if restorePurchases throws on one platform
      }
      const verified = await fetchVerifiedTransactions();
      return Array.from(new Set(verified.map((v) => v.productId)));
    },

    async getOwnedOrPendingPurchases(): Promise<VerifiedStoreTransaction[]> {
      return fetchVerifiedTransactions();
    }
  };
}
