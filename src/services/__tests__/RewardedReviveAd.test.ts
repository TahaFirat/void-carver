import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  ADMOB_CONFIG,
  ADMOB_GOOGLE_TEST_IDS,
  getRewardedAdUnitId,
  isUsingTestAdIds,
  type AdMobRuntimeConfig
} from '../AdMobConfig';
import { MonetizationService, type RewardedAdAdapter } from '../MonetizationService';
import { createDefaultSaveData } from '../StorageService';
import { MenuRenderer } from '../../ui/MenuRenderer';

function makeMockCtx(): CanvasRenderingContext2D {
  const noop = vi.fn();
  return new Proxy(
    {
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1,
      globalAlpha: 1,
      imageSmoothingEnabled: false,
      save: noop,
      restore: noop,
      translate: noop,
      scale: noop,
      rotate: noop,
      fillRect: noop,
      strokeRect: noop,
      clearRect: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      arc: noop,
      fill: noop,
      stroke: noop,
      drawImage: noop,
      createImageData: (w: number, h: number) => ({
        width: w,
        height: h,
        data: new Uint8ClampedArray(w * h * 4)
      }),
      putImageData: noop,
      measureText: () => ({ width: 100 })
    },
    {
      get(target, prop) {
        if (prop in target) return (target as Record<PropertyKey, unknown>)[prop];
        return noop;
      }
    }
  ) as unknown as CanvasRenderingContext2D;
}

describe('Game Over +1 Gemi Hakkı Rewarded Video System', () => {
  const origDocument = globalThis.document;

  beforeAll(() => {
    if (typeof globalThis.document === 'undefined') {
      (globalThis as unknown as { document: unknown }).document = {
        createElement: () => ({
          width: 0,
          height: 0,
          getContext: () => makeMockCtx()
        })
      };
    }
  });

  afterAll(() => {
    if (origDocument === undefined) {
      delete (globalThis as unknown as { document?: unknown }).document;
    } else {
      (globalThis as unknown as { document: unknown }).document = origDocument;
    }
  });

  afterEach(() => {
    MonetizationService.resetDefaultAdapters();
  });

  it('allows revive strictly once per stage attempt (zero ad spam)', () => {
    expect(MonetizationService.canOfferSecondChance(false)).toBe(true);
    expect(MonetizationService.canOfferSecondChance(true)).toBe(false);
  });

  it('grants revive ONLY when the rewarded ad completes (never on dismiss/unavailable)', async () => {
    const mockPurchase = {
      purchaseElitePack: async () => false,
      restorePurchases: async () => false
    };

    const rewardedAdapter: RewardedAdAdapter = {
      requestTrackingAuthorizationIfNeeded: async () => {},
      preloadRewardedReviveAd: async () => true,
      showRewardedReviveAd: async () => ({ outcome: 'REWARDED' }),
      isRewardedAdReady: () => true
    };
    MonetizationService.setAdapters(rewardedAdapter, mockPurchase);
    expect((await MonetizationService.triggerRewardedReviveWithResult()).outcome).toBe('REWARDED');
    expect(await MonetizationService.triggerRewardedRevive()).toBe(true);

    const dismissedAdapter: RewardedAdAdapter = {
      requestTrackingAuthorizationIfNeeded: async () => {},
      preloadRewardedReviveAd: async () => true,
      showRewardedReviveAd: async () => ({ outcome: 'DISMISSED_EARLY' }),
      isRewardedAdReady: () => true
    };
    MonetizationService.setAdapters(dismissedAdapter, mockPurchase);
    expect((await MonetizationService.triggerRewardedReviveWithResult()).outcome).toBe(
      'DISMISSED_EARLY'
    );
    expect(await MonetizationService.triggerRewardedRevive()).toBe(false);

    const offlineAdapter: RewardedAdAdapter = {
      requestTrackingAuthorizationIfNeeded: async () => {},
      preloadRewardedReviveAd: async () => false,
      showRewardedReviveAd: async () => ({ outcome: 'UNAVAILABLE', errorMessage: 'OFFLINE' }),
      isRewardedAdReady: () => false
    };
    MonetizationService.setAdapters(offlineAdapter, mockPurchase);
    expect((await MonetizationService.triggerRewardedReviveWithResult()).outcome).toBe(
      'UNAVAILABLE'
    );
    expect(await MonetizationService.triggerRewardedRevive()).toBe(false);
  });

  it('accurately flags Google Test IDs vs real Production AdMob IDs', () => {
    const testCfg: AdMobRuntimeConfig = {
      enabled: true,
      isTesting: true,
      iosAppId: ADMOB_GOOGLE_TEST_IDS.IOS_APP_ID,
      iosRewardedAdUnitId: ADMOB_GOOGLE_TEST_IDS.IOS_REWARDED_ID,
      androidAppId: ADMOB_GOOGLE_TEST_IDS.ANDROID_APP_ID,
      androidRewardedAdUnitId: ADMOB_GOOGLE_TEST_IDS.ANDROID_REWARDED_ID
    };
    expect(isUsingTestAdIds(testCfg)).toBe(true);

    const prodCfg: AdMobRuntimeConfig = {
      enabled: true,
      isTesting: false,
      iosAppId: 'ca-app-pub-1234567890123456~1111111111',
      iosRewardedAdUnitId: 'ca-app-pub-1234567890123456/2222222222',
      androidAppId: 'ca-app-pub-1234567890123456~3333333333',
      androidRewardedAdUnitId: 'ca-app-pub-1234567890123456/4444444444'
    };
    expect(isUsingTestAdIds(prodCfg)).toBe(false);
    expect(getRewardedAdUnitId('ios', prodCfg)).toBe('ca-app-pub-1234567890123456/2222222222');
    expect(getRewardedAdUnitId('android', prodCfg)).toBe('ca-app-pub-1234567890123456/4444444444');

    // Runtime iOS config must use live publisher AdMob IDs (never Google test IDs) for App Store release
    expect(isUsingTestAdIds(ADMOB_CONFIG)).toBe(false);
    expect(ADMOB_CONFIG.isTesting).toBe(false);
    expect(ADMOB_CONFIG.iosAppId).toBe('ca-app-pub-5302761838731601~4951124402');
    expect(ADMOB_CONFIG.iosRewardedAdUnitId).toBe('ca-app-pub-5302761838731601/3113756568');
  });

  it('renders ACCEPT_REVIVE button on GAME_OVER only when eligible and not loading', () => {
    const renderer = new MenuRenderer();
    const ctx = makeMockCtx();
    const save = createDefaultSaveData();

    // 1. Eligible & idle -> ACCEPT_REVIVE button active
    renderer.renderScreen(ctx, 'GAME_OVER', save, 1.0, {
      currentScore: 42_500,
      currentWave: 5,
      isNewRecord: false,
      clearBreakdown: null,
      adCountdown: 0,
      statusToast: null,
      canOfferRevive: true,
      reviveAdLoading: false
    });
    expect(renderer.activeButtons.some((b) => b.id === 'ACCEPT_REVIVE')).toBe(true);
    expect(renderer.activeButtons.some((b) => b.id === 'RETRY_CURRENT_STAGE')).toBe(true);
    const reviveBtn = renderer.activeButtons.find((b) => b.id === 'ACCEPT_REVIVE')!;
    expect(renderer.hitTest(reviveBtn.x + reviveBtn.w * 0.5, reviveBtn.y + reviveBtn.h * 0.5)).toBe(
      'ACCEPT_REVIVE'
    );

    // 2. Loading -> ACCEPT_REVIVE disabled to prevent double-taps
    renderer.renderScreen(ctx, 'GAME_OVER', save, 1.0, {
      currentScore: 42_500,
      currentWave: 5,
      isNewRecord: false,
      clearBreakdown: null,
      adCountdown: 0,
      statusToast: null,
      canOfferRevive: true,
      reviveAdLoading: true
    });
    expect(renderer.activeButtons.some((b) => b.id === 'ACCEPT_REVIVE')).toBe(false);

    // 3. Already revived once -> button hidden completely
    renderer.renderScreen(ctx, 'GAME_OVER', save, 1.0, {
      currentScore: 42_500,
      currentWave: 5,
      isNewRecord: false,
      clearBreakdown: null,
      adCountdown: 0,
      statusToast: null,
      canOfferRevive: false,
      reviveAdLoading: false
    });
    expect(renderer.activeButtons.some((b) => b.id === 'ACCEPT_REVIVE')).toBe(false);
    expect(renderer.activeButtons.some((b) => b.id === 'RETRY_CURRENT_STAGE')).toBe(true);
  });
});
