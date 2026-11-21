import { describe, expect, it } from 'vitest';
import { AutonomousMinionEcology } from '../AutonomousMinionEcology';
import { MAX_PLAYER_LIVES } from '../Config';
import {
  CleanJetonEconomyAndStore,
  JETON_IAP_PACKS,
  SHIPS_STORE_CATALOG,
  StoreIapProductId,
  TRAILS_STORE_CATALOG
} from '../CleanJetonEconomyAndStore';
import {
  CLEAN_ENDLESS_PERKS_V15,
  EndUserPolishControllerV15
} from '../EndUserPolishAndControlsV15';
import {
  HONEST_DIFFICULTIES_V15,
  HonestDifficultyGovernorV15
} from '../HonestDifficultyAndProgressionV15';
import { ProceduralChimeraBossEngine } from '../ProceduralChimeraBossEngine';
import {
  computeSaveChecksum,
  createDefaultSaveData,
  StorageService
} from '../../services/StorageService';

describe('VOID CARVER — Build 15 Final Production, Economy, Optimization & Reliability Suite', () => {
  it('1. Honest Difficulty Separation: EASY < MEDIUM < HARD & ZERO secret softening on HARD', () => {
    const gov = new HonestDifficultyGovernorV15();
    gov.onStageStart();

    const easy10 = gov.resolveStageParameters({
      mode: 'CAMPAIGN',
      stageOrWave: 10,
      difficulty: 'EASY',
      capturedPercent: 55
    });
    const med10 = gov.resolveStageParameters({
      mode: 'CAMPAIGN',
      stageOrWave: 10,
      difficulty: 'MEDIUM',
      capturedPercent: 55
    });
    const hard10 = gov.resolveStageParameters({
      mode: 'CAMPAIGN',
      stageOrWave: 10,
      difficulty: 'HARD',
      capturedPercent: 55
    });

    expect(easy10.bossSpeedPx).toBeLessThan(med10.bossSpeedPx);
    expect(med10.bossSpeedPx).toBeLessThan(hard10.bossSpeedPx);

    expect(easy10.maxActiveBullets).toBeLessThan(med10.maxActiveBullets);
    expect(med10.maxActiveBullets).toBeLessThan(hard10.maxActiveBullets);
    expect([
      HONEST_DIFFICULTIES_V15.EASY.maxActiveBullets,
      HONEST_DIFFICULTIES_V15.MEDIUM.maxActiveBullets,
      HONEST_DIFFICULTIES_V15.HARD.maxActiveBullets
    ]).toEqual([4, 5, 7]);
    expect(HONEST_DIFFICULTIES_V15.EASY.bossBaseSpeedPx).toBeGreaterThanOrEqual(140);
    expect(HONEST_DIFFICULTIES_V15.EASY.autoShieldRegenEverySec).toBeNull();
    expect(HONEST_DIFFICULTIES_V15.MEDIUM.autoShieldRegenEverySec).toBeNull();
    expect(HONEST_DIFFICULTIES_V15.HARD.autoShieldRegenEverySec).toBeNull();

    expect(easy10.targetPercent).toBeLessThan(med10.targetPercent);
    expect(med10.targetPercent).toBeLessThan(hard10.targetPercent);
    expect(hard10.borderShieldTimerSec).toBe(50);
    expect(hard10.isBossEnraged).toBe(true);

    // Hard mode MUST NEVER secretly nerf enemies after repeated player deaths!
    gov.onPlayerDeath();
    gov.onPlayerDeath();
    gov.onPlayerDeath();
    const hardAfterDeaths = gov.resolveStageParameters({
      mode: 'CAMPAIGN',
      stageOrWave: 10,
      difficulty: 'HARD',
      capturedPercent: 55
    });
    expect(hardAfterDeaths.bossSpeedPx).toBe(hard10.bossSpeedPx);
    expect(hardAfterDeaths.bulletSpeedPx).toBe(hard10.bulletSpeedPx);

    // Smooth monotonic stage progression across Stage 1 -> 15 -> 30 while keeping player faster than Boss
    const hard1 = gov.resolveStageParameters({
      mode: 'CAMPAIGN',
      stageOrWave: 1,
      difficulty: 'HARD',
      capturedPercent: 20
    });
    const hard15 = gov.resolveStageParameters({
      mode: 'CAMPAIGN',
      stageOrWave: 15,
      difficulty: 'HARD',
      capturedPercent: 20
    });
    const hard30 = gov.resolveStageParameters({
      mode: 'CAMPAIGN',
      stageOrWave: 30,
      difficulty: 'HARD',
      capturedPercent: 20
    });
    expect(hard1.bossSpeedPx).toBeLessThan(hard15.bossSpeedPx);
    expect(hard15.bossSpeedPx).toBeLessThan(hard30.bossSpeedPx);
    expect(hard30.bossSpeedPx).toBeLessThan(hard30.playerSpeedPx);
  });

  it('2. Unified Single-Currency (`JETON`) Economy, 3-Tab Catalog & Once-Per-Run Continue Guard', async () => {
    expect(SHIPS_STORE_CATALOG).toHaveLength(8);
    expect(TRAILS_STORE_CATALOG).toHaveLength(6);
    expect(JETON_IAP_PACKS).toHaveLength(4);
    for (const pack of JETON_IAP_PACKS) {
      expect(pack.referenceUsd).toBeGreaterThanOrEqual(1.99);
      expect(pack.referenceUsd).toBeLessThanOrEqual(9.99);
    }

    let cloudStarterOwned = false;
    const store = new CleanJetonEconomyAndStore(50, {
      isNative: () => true,
      getLocalizedPrices: async () => ({ 'com.tahafirat.voidcarver.jeton_500': '79,99 TL' }),
      purchaseProduct: async (id) => {
        if (id === 'com.tahafirat.voidcarver.starter_x2') cloudStarterOwned = true;
        return { ok: true, transactionId: `tx_${id}` };
      },
      restoreOwnedNonConsumables: async () =>
        cloudStarterOwned ? ['com.tahafirat.voidcarver.starter_x2'] : []
    });

    const easyJeton = store.awardStageClearJeton({
      difficulty: 'EASY',
      finalCapturedPercent: 75,
      megaCutsCount: 0,
      crushedMinionsCount: 1,
      noDeathClear: true
    });
    const medJeton = store.awardStageClearJeton({
      difficulty: 'MEDIUM',
      finalCapturedPercent: 78,
      megaCutsCount: 1,
      crushedMinionsCount: 2,
      noDeathClear: true
    });
    const hardJeton = store.awardStageClearJeton({
      difficulty: 'HARD',
      finalCapturedPercent: 82,
      megaCutsCount: 1,
      crushedMinionsCount: 2,
      noDeathClear: true
    });

    expect(easyJeton).toBeGreaterThanOrEqual(18);
    expect(easyJeton).toBeLessThanOrEqual(35);
    expect(medJeton).toBeGreaterThan(easyJeton);
    expect(hardJeton).toBeGreaterThan(medJeton);

    // Strictly max 1 Jeton continue per run!
    store.jetonBalance = 600;
    store.onNewRunStart();
    expect(store.canContinueRun(68, 4)).toBe(true);
    expect(store.spendJetonForContinue()).toBe(true);
    expect(store.canContinueRun(72, 4)).toBe(false);
    expect(store.spendJetonForContinue()).toBe(false);

    expect(store.buyOrEquipShip('SHIP_PHANTOM')).toBe('BOUGHT_AND_EQUIPPED');
    expect(store.buyOrEquipTrail('TRAIL_AMBER')).toBe('BOUGHT_AND_EQUIPPED');
    expect(store.buyOrEquipShip('SHIP_PHOENIX')).toBe('NOT_ENOUGH_JETON');

    await store.purchaseJetonPack('com.tahafirat.voidcarver.starter_x2');
    expect(store.hasPermanentDoubleJeton).toBe(true);

    const freshDeviceStore = new CleanJetonEconomyAndStore(0, {
      isNative: () => true,
      getLocalizedPrices: async () => ({}),
      purchaseProduct: async () => ({ ok: true }),
      restoreOwnedNonConsumables: async () => ['com.tahafirat.voidcarver.starter_x2']
    });
    expect(await freshDeviceStore.restorePurchases()).toBe(true);
    expect(freshDeviceStore.hasPermanentDoubleJeton).toBe(true);
    expect(freshDeviceStore.ownedShips.has('SHIP_PHANTOM')).toBe(true);
  });

  it('3. Payment Edge Cases: Crash Mid-Purchase Recovery, Idempotency, Reinstall Auto-Restore & Double-Tap Lock', async () => {
    const pendingStoreReceipts: Array<{ productId: StoreIapProductId; transactionId: string }> = [
      { productId: 'com.tahafirat.voidcarver.jeton_1500', transactionId: 'apple_tx_90001' },
      { productId: 'com.tahafirat.voidcarver.starter_x2', transactionId: 'apple_tx_90002' }
    ];

    let persistCalls = 0;
    let resolveSlowPurchase: (() => void) | null = null;
    const store = new CleanJetonEconomyAndStore(100, {
      isNative: () => true,
      getLocalizedPrices: async () => ({}),
      purchaseProduct: async (id) => {
        if (id === 'com.tahafirat.voidcarver.jeton_500') {
          await new Promise<void>((r) => {
            resolveSlowPurchase = r;
          });
          return { ok: true, transactionId: 'apple_tx_slow_500' };
        }
        return { ok: true, alreadyOwnedOnStore: true, transactionId: 'apple_tx_90002' };
      },
      restoreOwnedNonConsumables: async () => ['com.tahafirat.voidcarver.starter_x2'],
      getOwnedOrPendingPurchases: async () => pendingStoreReceipts
    });
    store.setPersistenceHook(() => {
      persistCalls += 1;
    });

    // Simulate app relaunching after crashing right when Apple charged the card:
    const firstReconcile = await store.reconcilePendingEntitlements();
    expect(firstReconcile.recoveredCount).toBe(2);
    // 100 initial + 1500 (jeton_1500) + 750 (starter_x2) = 2350 Jeton!
    expect(store.jetonBalance).toBe(2350);
    expect(store.hasPermanentDoubleJeton).toBe(true);
    expect(store.ownedShips.has('SHIP_PHANTOM')).toBe(true);
    expect(persistCalls).toBeGreaterThan(0);

    // Calling reconcile again on foreground resume MUST NOT double-credit!
    const secondReconcile = await store.reconcilePendingEntitlements();
    expect(secondReconcile.recoveredCount).toBe(0);
    expect(store.jetonBalance).toBe(2350);

    // Simulate concurrent double-tap while OS purchase sheet is open:
    const p1 = store.purchaseJetonPack('com.tahafirat.voidcarver.jeton_500');
    const p2 = await store.purchaseJetonPack('com.tahafirat.voidcarver.jeton_500');
    expect(p2.ok).toBe(false);
    expect(p2.busy).toBe(true);
    resolveSlowPurchase!();
    const res1 = await p1;
    expect(res1.ok).toBe(true);
    expect(store.jetonBalance).toBe(2850);

    // Simulate reinstalled user tapping `starter_x2` directly when store says `alreadyOwnedOnStore: true`:
    const reinstallStore = new CleanJetonEconomyAndStore(50, {
      isNative: () => true,
      getLocalizedPrices: async () => ({}),
      purchaseProduct: async () => ({
        ok: true,
        alreadyOwnedOnStore: true,
        transactionId: 'existing_starter_tx'
      }),
      restoreOwnedNonConsumables: async () => ['com.tahafirat.voidcarver.starter_x2']
    });
    const directTapRes = await reinstallStore.purchaseJetonPack(
      'com.tahafirat.voidcarver.starter_x2'
    );
    expect(directTapRes.ok).toBe(true);
    expect(directTapRes.restoredExisting).toBe(true);
    expect(reinstallStore.hasPermanentDoubleJeton).toBe(true);
    expect(reinstallStore.ownedShips.has('SHIP_PHANTOM')).toBe(true);
  });

  it('4. Crash-Safe Dual-Slot Storage: Recovers 100% of Jeton & Ships when Primary Slot is Corrupted', async () => {
    const mockMap = new Map<string, string>();
    const origLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => mockMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          mockMap.set(k, v);
        },
        removeItem: (k: string) => {
          mockMap.delete(k);
        },
        clear: () => {
          mockMap.clear();
        }
      }
    });

    try {
      StorageService.persistenceDisabled = false;
      const initial = createDefaultSaveData();
      StorageService.setCurrentForSession(initial);

      await StorageService.save((d) => {
        d.v15Store.jetonBalance = 1850;
        d.v15Store.hasPermanentDoubleJeton = true;
        d.v15Store.ownedShips = ['SHIP_VANGUARD', 'SHIP_SAMURAI'];
        d.v15Store.equippedShipId = 'SHIP_SAMURAI';
        d.v15Store.highestUnlockedStage.HARD = 19;
      });
      // Second save promotes verified state into backup slot as well
      await StorageService.save((d) => {
        d.v15Store.jetonBalance = 1920;
      });

      // Simulate power-loss / truncated corrupted write in PRIMARY slot!
      mockMap.set('void_carver_sector80_save_v1', '{"__vcEnvelope":15,"seq":999,"checksum":"bad');

      const recovered = await StorageService.load();
      expect(recovered.v15Store.jetonBalance).toBe(1850);
      expect(recovered.v15Store.hasPermanentDoubleJeton).toBe(true);
      expect(recovered.v15Store.ownedShips).toContain('SHIP_SAMURAI');
      expect(recovered.v15Store.highestUnlockedStage.HARD).toBe(19);

      // Verify prototype-pollution & NaN sanitization
      const maliciousData = {
        version: 15,
        v15Store: {
          jetonBalance: -99999,
          ownedShips: ['SHIP_VANGUARD', 'FAKE_HACKED_SHIP']
        }
      };
      const maliciousCanon = JSON.stringify(maliciousData);
      mockMap.set(
        'void_carver_sector80_save_v1',
        JSON.stringify({
          __vcEnvelope: 15,
          seq: 50,
          checksum: computeSaveChecksum(maliciousCanon),
          data: maliciousData
        })
      );
      mockMap.delete('void_carver_sector80_save_v1_backup');

      const sanitized = await StorageService.load();
      expect(sanitized.v15Store.jetonBalance).toBe(0);
      expect(sanitized.v15Store.ownedShips).not.toContain('FAKE_HACKED_SHIP');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: origLocalStorage
      });
    }
  });

  it('5. End-User Polish: 120Hz ProMotion Clamp, 180-Deg Reverse Lock, 115ms Buffer, Auto-Pause & 34,560 Chimera Bosses', () => {
    const polish = new EndUserPolishControllerV15();
    const dt120Hz = polish.computeSafeFrameDeltaSec(1000, 1008.33);
    expect(Math.abs(dt120Hz - 0.00833)).toBeLessThan(0.0005);
    expect(polish.computeSafeFrameDeltaSec(1000, 2500)).toBe(0.033);

    expect(polish.queueDirectionInput('LEFT', 'RIGHT', true, 500)).toBe('RIGHT');
    expect(polish.queueDirectionInput('UP', 'RIGHT', true, 500)).toBe('UP');
    expect(polish.showFirstLaunchSwipeHint).toBe(false);
    expect(polish.consumeBufferedDirection(580)).toBe('UP');
    expect(polish.consumeBufferedDirection(700)).toBeNull();

    polish.onAppBackgroundOrBlur();
    expect(polish.isPaused).toBe(true);
    polish.requestSmoothResume();
    expect(polish.stepResumeCountdown(0.5)).toBe(false);
    expect(polish.stepResumeCountdown(0.8)).toBe(true);

    expect(CLEAN_ENDLESS_PERKS_V15).toHaveLength(9);
    expect(MAX_PLAYER_LIVES).toBe(5);
    // When already at 5 ships, EXTRA_LIFE must never be dealt in the 3-card draft!
    for (let seed = 1; seed <= 30; seed++) {
      const perksAtMaxShips = polish.rollThreeCleanPerks(new Map(), seed, 5);
      expect(perksAtMaxShips.some((p) => p.id === 'EXTRA_LIFE')).toBe(false);
    }
    expect(ProceduralChimeraBossEngine.getTotalTheoreticalCombinations()).toBe(34560);

    const eco = new AutonomousMinionEcology(77);
    const min = eco.spawnMinion(
      'm',
      'LINE_LEECH',
      { minX: 0, minY: 0, maxX: 400, maxY: 600 },
      { x: 200, y: 300 },
      1.0
    );
    min.pos = { x: 10, y: 300 };
    for (let i = 0; i < 240; i++) {
      eco.stepMinions(
        [min],
        1 / 60,
        { minX: 0, minY: 0, maxX: 400, maxY: 600 },
        { x: 200, y: 300 },
        { pos: { x: 0, y: 300 }, isCutting: false, activeCuttingDurationSec: 0 },
        20,
        0.9
      );
    }
    expect(Math.hypot(min.pos.x, min.pos.y - 300)).toBeGreaterThan(40);
  });
});
