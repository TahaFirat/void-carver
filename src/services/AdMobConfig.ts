/**
 * Void Carver — Google AdMob Rewarded Video Configuration
 *
 * Only ONE optional ad placement exists in the entire game:
 * Game Over -> "VİDEO İZLE: +1 GEMİ HAKKI" (once per stage attempt).
 * Zero banners, zero interstitials, zero surprise popups.
 */

export const ADMOB_PRODUCTION_IDS = {
  IOS_APP_ID: 'ca-app-pub-5302761838731601~4951124402',
  IOS_REWARDED_ID: 'ca-app-pub-5302761838731601/3113756568'
} as const;

export const ADMOB_GOOGLE_TEST_IDS = {
  IOS_APP_ID: 'ca-app-pub-3940256099942544~1458002511',
  IOS_REWARDED_ID: 'ca-app-pub-3940256099942544/1712485313',
  ANDROID_APP_ID: 'ca-app-pub-3940256099942544~3347511713',
  ANDROID_REWARDED_ID: 'ca-app-pub-3940256099942544/5224354917'
} as const;

export interface AdMobRuntimeConfig {
  /** Master switch for native AdMob SDK calls. */
  enabled: boolean;
  /** True while using Google's official test ad units; MUST be false for App Store release. */
  isTesting: boolean;
  iosAppId: string;
  iosRewardedAdUnitId: string;
  androidAppId: string;
  androidRewardedAdUnitId: string;
}

const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as Record<
  string,
  string | undefined
>;

const iosAppId = (env.VITE_ADMOB_IOS_APP_ID || ADMOB_PRODUCTION_IDS.IOS_APP_ID).trim();
const iosRewardedAdUnitId = (
  env.VITE_ADMOB_IOS_REWARDED_ID || ADMOB_PRODUCTION_IDS.IOS_REWARDED_ID
).trim();
const androidAppId = (env.VITE_ADMOB_ANDROID_APP_ID || ADMOB_GOOGLE_TEST_IDS.ANDROID_APP_ID).trim();
const androidRewardedAdUnitId = (
  env.VITE_ADMOB_ANDROID_REWARDED_ID || ADMOB_GOOGLE_TEST_IDS.ANDROID_REWARDED_ID
).trim();

const usesTestUnit =
  iosAppId === ADMOB_GOOGLE_TEST_IDS.IOS_APP_ID ||
  iosRewardedAdUnitId === ADMOB_GOOGLE_TEST_IDS.IOS_REWARDED_ID;

export const ADMOB_CONFIG: AdMobRuntimeConfig = {
  enabled: env.VITE_ADMOB_ENABLED !== 'false',
  isTesting: env.VITE_ADMOB_TESTING === 'true' || usesTestUnit,
  iosAppId,
  iosRewardedAdUnitId,
  androidAppId,
  androidRewardedAdUnitId
};

export function isUsingTestAdIds(config: AdMobRuntimeConfig = ADMOB_CONFIG): boolean {
  return (
    config.iosAppId === ADMOB_GOOGLE_TEST_IDS.IOS_APP_ID ||
    config.iosRewardedAdUnitId === ADMOB_GOOGLE_TEST_IDS.IOS_REWARDED_ID
  );
}

export function getRewardedAdUnitId(
  platform: string,
  config: AdMobRuntimeConfig = ADMOB_CONFIG
): string {
  return platform === 'android' ? config.androidRewardedAdUnitId : config.iosRewardedAdUnitId;
}
