import { Capacitor } from '@capacitor/core';
import { StorageService } from './StorageService';

export interface PurchaseAdapter {
  purchaseElitePack(): Promise<boolean>;
  restorePurchases(): Promise<boolean>;
}

export interface RewardedAdAdapter {
  requestTrackingAuthorizationIfNeeded(): Promise<void>;
  showRewardedReviveAd(): Promise<boolean>;
}

/**
 * Default adapter supporting clean offline/simulated preview on Web and ready for
 * `@capacitor-community/admob` + `@revenuecat/purchases-capacitor` bindings in production builds.
 *
 * NOTE ON iOS ATT & PrivacyInfo.xcprivacy:
 * If enabling `@capacitor-community/admob` in production (`VITE_ADMOB_ENABLED=true`),
 * call `AdMob.requestTrackingAuthorization()` inside `requestTrackingAuthorizationIfNeeded()`
 * BEFORE initializing/loading ads, add `NSUserTrackingUsageDescription` to `Info.plist`,
 * and set `NSPrivacyTracking = true` with advertising data disclosures in `PrivacyInfo.xcprivacy`.
 */
class DefaultRewardedAdAdapter implements RewardedAdAdapter {
  public async requestTrackingAuthorizationIfNeeded(): Promise<void> {
    const admobEnabled = import.meta.env.VITE_ADMOB_ENABLED === 'true';
    if (!admobEnabled || !Capacitor.isNativePlatform()) {
      return;
    }
    // Hook point for AdMob.requestTrackingAuthorization() when AdMob plugin is enabled
  }

  public async showRewardedReviveAd(): Promise<boolean> {
    // Simulated clean test countdown handled by in-game Rewarded Countdown Modal, or native AdMob hook
    return true;
  }
}

class DefaultPurchaseAdapter implements PurchaseAdapter {
  public async purchaseElitePack(): Promise<boolean> {
    await StorageService.save((d) => {
      d.premiumUnlocked = true;
    });
    return true;
  }

  public async restorePurchases(): Promise<boolean> {
    return StorageService.getCurrent().premiumUnlocked;
  }
}

class MonetizationServiceImpl {
  private adAdapter: RewardedAdAdapter = new DefaultRewardedAdAdapter();
  private purchaseAdapter: PurchaseAdapter = new DefaultPurchaseAdapter();

  public setAdapters(adAdapter: RewardedAdAdapter, purchaseAdapter: PurchaseAdapter): void {
    this.adAdapter = adAdapter;
    this.purchaseAdapter = purchaseAdapter;
  }

  public isPremiumUnlocked(): boolean {
    return StorageService.getCurrent().premiumUnlocked;
  }

  public canOfferSecondChance(reviveUsedThisLevel: boolean): boolean {
    return !reviveUsedThisLevel;
  }

  public async prepareAdsIfEnabled(): Promise<void> {
    await this.adAdapter.requestTrackingAuthorizationIfNeeded();
  }

  public async triggerRewardedRevive(): Promise<boolean> {
    if (this.isPremiumUnlocked()) {
      return true;
    }
    return this.adAdapter.showRewardedReviveAd();
  }

  public async buyElitePack(): Promise<boolean> {
    return this.purchaseAdapter.purchaseElitePack();
  }

  public async restorePurchases(): Promise<boolean> {
    return this.purchaseAdapter.restorePurchases();
  }
}

export const MonetizationService = new MonetizationServiceImpl();
