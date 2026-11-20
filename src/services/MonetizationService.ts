import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  RewardAdPluginEvents,
  type AdMobRewardItem
} from '@capacitor-community/admob';
import { ADMOB_CONFIG, getRewardedAdUnitId } from './AdMobConfig';
import { StorageService } from './StorageService';

export type RewardedReviveOutcome = 'REWARDED' | 'DISMISSED_EARLY' | 'UNAVAILABLE' | 'ERROR';

export interface RewardedReviveResult {
  outcome: RewardedReviveOutcome;
  errorMessage?: string;
}

export interface PurchaseAdapter {
  purchaseElitePack(): Promise<boolean>;
  restorePurchases(): Promise<boolean>;
}

export interface RewardedAdAdapter {
  requestTrackingAuthorizationIfNeeded(): Promise<void>;
  preloadRewardedReviveAd(): Promise<boolean>;
  showRewardedReviveAd(): Promise<RewardedReviveResult>;
  isRewardedAdReady(): boolean;
}

/**
 * Production Google AdMob Rewarded Video adapter (`@capacitor-community/admob` v8 + SPM).
 *
 * - Strictly handles iOS App Tracking Transparency (ATT) before SDK init & sets `npa: true`
 *   whenever the player declines tracking.
 * - Handles optional EU UMP consent gracefully without ever crashing offline players.
 * - Waits for BOTH `Rewarded` AND `Dismissed` before returning `'REWARDED'` so gameplay
 *   never resumes behind a still-open fullscreen video ad.
 */
class NativeAdMobRewardedAdapter implements RewardedAdAdapter {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private adLoaded = false;
  private preloadPromise: Promise<boolean> | null = null;
  private useNpa = true;

  public isRewardedAdReady(): boolean {
    return this.adLoaded;
  }

  public async requestTrackingAuthorizationIfNeeded(): Promise<void> {
    if (!ADMOB_CONFIG.enabled || !Capacitor.isNativePlatform()) {
      return;
    }
    if (this.initialized) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.runInitSequence();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async runInitSequence(): Promise<void> {
    try {
      const platform = Capacitor.getPlatform();
      if (platform === 'ios') {
        try {
          const initialStatus = await AdMob.trackingAuthorizationStatus();
          if (initialStatus.status === 'notDetermined') {
            await AdMob.requestTrackingAuthorization();
          }
          const finalStatus = await AdMob.trackingAuthorizationStatus();
          this.useNpa = finalStatus.status !== 'authorized';
        } catch {
          this.useNpa = true;
        }
      } else {
        this.useNpa = false;
      }

      // Best-effort Google UMP consent check for EEA/UK users (never blocks if offline/unconfigured)
      try {
        const consentInfo = await AdMob.requestConsentInfo();
        if (
          consentInfo.isConsentFormAvailable &&
          consentInfo.status === AdmobConsentStatus.REQUIRED
        ) {
          await AdMob.showConsentForm();
        }
      } catch {
        // Proceed gracefully without UMP form if offline or not configured in AdMob console
      }

      await AdMob.initialize({
        initializeForTesting: ADMOB_CONFIG.isTesting
      });

      this.initialized = true;
      void this.preloadRewardedReviveAd();
    } catch {
      this.initialized = false;
    }
  }

  public async preloadRewardedReviveAd(): Promise<boolean> {
    if (!ADMOB_CONFIG.enabled || !Capacitor.isNativePlatform()) {
      return false;
    }
    if (this.adLoaded) {
      return true;
    }
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      try {
        await this.requestTrackingAuthorizationIfNeeded();
        if (!this.initialized) {
          return false;
        }
        const adId = getRewardedAdUnitId(Capacitor.getPlatform(), ADMOB_CONFIG);
        await AdMob.prepareRewardVideoAd({
          adId,
          isTesting: ADMOB_CONFIG.isTesting,
          npa: this.useNpa
        });
        this.adLoaded = true;
        return true;
      } catch {
        this.adLoaded = false;
        return false;
      } finally {
        this.preloadPromise = null;
      }
    })();

    return this.preloadPromise;
  }

  public async showRewardedReviveAd(): Promise<RewardedReviveResult> {
    if (!ADMOB_CONFIG.enabled || !Capacitor.isNativePlatform()) {
      return { outcome: 'UNAVAILABLE', errorMessage: 'NATIVE_PLATFORM_REQUIRED' };
    }

    await this.requestTrackingAuthorizationIfNeeded();
    if (!this.initialized) {
      return { outcome: 'UNAVAILABLE', errorMessage: 'SDK_NOT_INITIALIZED' };
    }

    if (!this.adLoaded) {
      const loaded = await this.preloadRewardedReviveAd();
      if (!loaded) {
        return { outcome: 'UNAVAILABLE', errorMessage: 'AD_LOAD_FAILED' };
      }
    }

    const adId = getRewardedAdUnitId(Capacitor.getPlatform(), ADMOB_CONFIG);
    const handles: PluginListenerHandle[] = [];
    let earnedReward = false;
    let dismissed = false;
    let resolveDismissWait: (() => void) | null = null;

    const dismissPromise = new Promise<void>((resolve) => {
      resolveDismissWait = resolve;
    });

    const markDismissed = (): void => {
      if (dismissed) return;
      dismissed = true;
      resolveDismissWait?.();
    };

    try {
      handles.push(
        await AdMob.addListener(RewardAdPluginEvents.Rewarded, (reward: AdMobRewardItem) => {
          if (reward && Number(reward.amount ?? 1) > 0) {
            earnedReward = true;
          }
        })
      );
      handles.push(
        await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          markDismissed();
        })
      );
      handles.push(
        await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
          markDismissed();
        })
      );

      this.adLoaded = false;

      let showSucceeded = false;
      let rejectedMessage = '';
      try {
        const rewardItem = await AdMob.showRewardVideoAd({ adId });
        if (rewardItem && Number(rewardItem.amount ?? 1) > 0) {
          earnedReward = true;
        }
        showSucceeded = true;
      } catch (err) {
        rejectedMessage = err instanceof Error ? err.message : String(err ?? '');
      }

      // If reward was granted while ad end-card is still visible on iOS, wait cleanly until
      // the fullscreen ad finishes dismissing before resuming gameplay!
      if (showSucceeded && !dismissed) {
        await Promise.race([
          dismissPromise,
          new Promise<void>((resolve) => {
            setTimeout(resolve, 60_000);
          })
        ]);
      }

      if (earnedReward) {
        return { outcome: 'REWARDED' };
      }
      if (/not ready|no ad|failed/i.test(rejectedMessage)) {
        return { outcome: 'UNAVAILABLE', errorMessage: rejectedMessage };
      }
      return { outcome: 'DISMISSED_EARLY', errorMessage: rejectedMessage || undefined };
    } catch (err) {
      return {
        outcome: 'ERROR',
        errorMessage: err instanceof Error ? err.message : String(err ?? '')
      };
    } finally {
      for (const h of handles) {
        try {
          await h.remove();
        } catch {
          // ignore cleanup failures
        }
      }
      // Quietly pre-buffer the next rewarded video in the background
      void this.preloadRewardedReviveAd();
    }
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
  private adAdapter: RewardedAdAdapter = new NativeAdMobRewardedAdapter();
  private purchaseAdapter: PurchaseAdapter = new DefaultPurchaseAdapter();

  public setAdapters(adAdapter: RewardedAdAdapter, purchaseAdapter: PurchaseAdapter): void {
    this.adAdapter = adAdapter;
    this.purchaseAdapter = purchaseAdapter;
  }

  public resetDefaultAdapters(): void {
    this.adAdapter = new NativeAdMobRewardedAdapter();
    this.purchaseAdapter = new DefaultPurchaseAdapter();
  }

  public isPremiumUnlocked(): boolean {
    return StorageService.getCurrent().premiumUnlocked;
  }

  public canOfferSecondChance(reviveUsedThisLevel: boolean): boolean {
    return !reviveUsedThisLevel;
  }

  public isRewardedAdReady(): boolean {
    return this.adAdapter.isRewardedAdReady();
  }

  public async prepareAdsIfEnabled(): Promise<void> {
    await this.adAdapter.requestTrackingAuthorizationIfNeeded();
  }

  public async preloadRewardedRevive(): Promise<boolean> {
    return this.adAdapter.preloadRewardedReviveAd();
  }

  public async triggerRewardedReviveWithResult(): Promise<RewardedReviveResult> {
    if (this.isPremiumUnlocked()) {
      return { outcome: 'REWARDED' };
    }
    return this.adAdapter.showRewardedReviveAd();
  }

  public async triggerRewardedRevive(): Promise<boolean> {
    const result = await this.triggerRewardedReviveWithResult();
    return result.outcome === 'REWARDED';
  }

  public async buyElitePack(): Promise<boolean> {
    return this.purchaseAdapter.purchaseElitePack();
  }

  public async restorePurchases(): Promise<boolean> {
    return this.purchaseAdapter.restorePurchases();
  }
}

export const MonetizationService = new MonetizationServiceImpl();
