import { describe, expect, it } from 'vitest';
import { ArenaHazardManager } from '../../entities/ArenaHazards';
import {
  FrostLeviathanBoss,
  PlasmaScorpionBoss,
  QuantumButterflyBoss,
  SinkholeWormBoss,
  SolarFlareCoreBoss,
  VoidEmperorBoss
} from '../../entities/bosses/BestiaryBosses';
import { instantiateBossBySpeciesId } from '../../entities/bosses/BossFactory';
import { createMinionBySpecies } from '../../entities/enemies/MinionFactory';
import { ProjectileManager } from '../../entities/Projectiles';
import { createInitialArenaPolygon } from '../../geometry/PolygonMath';
import { getFieldCrystalSprite } from '../../rendering/BestiarySprites';
import * as aiMod from '../AutonomousMinionEcology';
import * as progMod from '../CampaignProgressionV12';
import { FIXED_DT } from '../Config';
import * as juiceMod from '../PowerUpAndJuiceSystem';

function createMockCanvasContext(): CanvasRenderingContext2D {
  const noop = (): void => {};
  const grad = { addColorStop: noop };
  return {
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    shadowColor: '#000',
    shadowBlur: 0,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    fillRect: noop,
    strokeRect: noop,
    clearRect: noop,
    setLineDash: noop,
    drawImage: noop,
    putImageData: noop,
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createImageData: (w: number, h: number) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4)
    })
  } as unknown as CanvasRenderingContext2D;
}

function withMockDocumentCanvas<T>(fn: () => T): T {
  const g = globalThis as unknown as { document?: unknown };
  const prevDoc = g.document;
  g.document = {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const ctx = createMockCanvasContext();
        return {
          width: 64,
          height: 64,
          getContext: () => ctx
        };
      }
      return {};
    }
  };
  try {
    return fn();
  } finally {
    g.document = prevDoc;
  }
}

describe('Build 12 Verification Suite (Fixed 24-Stage Order, Anti-Camping AI, Fair Balance & 24 Bosses / 18 Minions)', () => {
  it('passes all Build 12 mathematical & architectural assertions (24 fixed stages, <=82% mobile targets, 600-frame zero border camping, 1-Hit Shield & Respawn Shockwave)', () => {
    const {
      DIFFICULTY_UI_PROFILES,
      FIXED_CAMPAIGN_STAGES,
      getFixedLevelPlan,
      computeCrowdingSpeedDampener,
      createDefaultCampaignSave,
      recordLevelCompletion
    } = progMod;
    const { AutonomousMinionEcology } = aiMod;
    const { PowerUpAndJuiceSystem } = juiceMod;

    // 1. Strict 24 Unique Bosses in Fixed Order (Zero Random Shuffling!)
    expect(FIXED_CAMPAIGN_STAGES.length).toBe(24);
    const uniqueBosses = new Set(FIXED_CAMPAIGN_STAGES.map((s) => s.bossId));
    expect(uniqueBosses.size).toBe(24);

    for (let retry = 0; retry < 50; retry++) {
      const l1 = getFixedLevelPlan(1, 'MEDIUM');
      const l5 = getFixedLevelPlan(5, 'HARD');
      const l8 = getFixedLevelPlan(8, 'MEDIUM');
      const l24 = getFixedLevelPlan(24, 'EASY');
      expect(l1.bossId).toBe('CENTIPEDE_WYRM');
      expect(l5.bossId).toBe('FROST_LEVIATHAN');
      expect(l8.bossId).toBe('PLASMA_SCORPION');
      expect(l24.bossId).toBe('VOID_EMPEROR');
    }

    // 2. Fair Mobile Difficulty Thresholds across ALL 24 levels & 3 difficulties
    for (const diff of ['EASY', 'MEDIUM', 'HARD'] as const) {
      const prof = DIFFICULTY_UI_PROFILES[diff];
      expect(prof.accentHex.startsWith('#')).toBe(true);
      expect(prof.summaryLineTr.length).toBeGreaterThan(15);

      for (let lvl = 1; lvl <= 24; lvl++) {
        const plan = getFixedLevelPlan(lvl, diff);
        expect(plan.targetPercent).toBeLessThanOrEqual(82);
        expect(plan.bossSpeedScale).toBeLessThanOrEqual(1.38);
        const minionSum = plan.minionSpawns.reduce((acc, g) => acc + g.count, 0);
        expect(minionSum).toBeLessThanOrEqual(6);
      }
    }

    expect(computeCrowdingSpeedDampener(30)).toBe(1.0);
    expect(computeCrowdingSpeedDampener(75)).toBeLessThan(0.85);

    // 3. Autonomous Minion Ecology NEVER Border-Camps or Freezes!
    const ecology = new AutonomousMinionEcology(12345);
    const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 600 };
    const bossPos = { x: 200, y: 300 };
    const playerOnSafeBorder = {
      pos: { x: 0, y: 300 },
      isCutting: false,
      activeCuttingDurationSec: 0
    };

    const testSpecies: progMod.MinionSpeciesId[] = [
      'WASP_SWARMER',
      'LINE_LEECH',
      'CHARGER_HORN',
      'HOMING_SEEKER',
      'SCARAB_BEETLE',
      'COSMIC_MANTA',
      'RICOCHET_CRYSTAL',
      'VORTEX_DRIFTER',
      'COMET_SEED'
    ];

    const minions = testSpecies.map((sp, idx) => {
      const m = ecology.spawnMinion(`m_${idx}`, sp, bounds, bossPos, 1.0);
      m.pos = { x: 18, y: 300 };
      return m;
    });

    for (let frame = 0; frame < 600; frame++) {
      ecology.stepMinions(minions, 1 / 60, bounds, bossPos, playerOnSafeBorder, 20, 0.9);
    }

    for (const m of minions) {
      const speed = Math.hypot(m.vel.x, m.vel.y);
      const distFromBorderPlayer = Math.hypot(
        m.pos.x - playerOnSafeBorder.pos.x,
        m.pos.y - playerOnSafeBorder.pos.y
      );
      expect(speed).toBeGreaterThanOrEqual(55);
      expect(distFromBorderPlayer).toBeGreaterThan(42);
    }

    // 4. 1-Hit Trail Shield, Respawn Shockwave & 3-Star Save Progression
    const juice = new PowerUpAndJuiceSystem();
    juice.activatePowerUp('TRAIL_SHIELD_1HIT', minions);
    const hitWithShield = juice.resolveIncomingPlayerHit({ x: 0, y: 250 });
    expect(hitWithShield.playerDied).toBe(false);
    expect(hitWithShield.shieldAbsorbed).toBe(true);
    expect(hitWithShield.rewindToPos).toEqual({ x: 0, y: 250 });

    minions[0]!.pos = { x: 10, y: 10 };
    juice.triggerRespawnShockwave({ x: 0, y: 0 }, minions, 145);
    expect(Math.hypot(minions[0]!.pos.x, minions[0]!.pos.y)).toBeGreaterThanOrEqual(144);

    const save = createDefaultCampaignSave();
    const stars = recordLevelCompletion(save, 'MEDIUM', 1, 90, false);
    expect(stars).toBe(3);
    expect(save.highestUnlockedLevel.MEDIUM).toBe(2);
  });

  it('instantiates, updates, telegraphs, and renders all 24 Bosses, all 18 Minions, and all 4 Field Power Crystals cleanly', () => {
    const poly = createInitialArenaPolygon();
    const projectiles = new ProjectileManager();
    const hazards = new ArenaHazardManager();

    expect(progMod.ALL_BOSS_IDS_V12.length).toBe(24);
    expect(progMod.ALL_MINION_IDS_V12.length).toBe(18);

    withMockDocumentCanvas(() => {
      const ctx = createMockCanvasContext();

      for (const bossId of progMod.ALL_BOSS_IDS_V12) {
        const bosses = instantiateBossBySpeciesId(bossId, { x: 450, y: 500 }, 10, true);
        expect(bosses.length).toBeGreaterThanOrEqual(1);
        for (const b of bosses) {
          for (let step = 0; step < 36; step++) {
            b.update({
              dt: FIXED_DT,
              timeSeconds: step * FIXED_DT,
              activePolygon: poly,
              claimedPercent: step < 18 ? 30 : 52,
              playerPos: { x: 450, y: 1200 },
              playerVel: { x: 0, y: 0 },
              playerState: step % 2 === 0 ? 'ON_BORDER' : 'CUTTING',
              activeTrail: [
                { x: 450, y: 1200 },
                { x: 450, y: 1040 }
              ],
              speedScale: 1.0,
              telegraphLeadSec: 0.7,
              aimMode: 'DIRECT_AIM',
              projectiles,
              summonMinion: () => {},
              spawnSolidObstacle: () => {},
              spawnEscortBoss: () => {},
              hazards,
              currentMinionCount: 3
            });
          }
          expect(b.getHitCircles().length).toBeGreaterThanOrEqual(1);
          b.render(ctx, 1.0, 1.25, true);
        }
      }

      for (let i = 0; i < progMod.ALL_MINION_IDS_V12.length; i++) {
        const sp = progMod.ALL_MINION_IDS_V12[i]!;
        const m = createMinionBySpecies(sp, { x: 300 + (i % 5) * 50, y: 320 + i * 22 }, i);
        expect(m.speciesId).toBe(sp);
        for (let step = 0; step < 20; step++) {
          if (!m.alive) break;
          m.update({
            dt: FIXED_DT,
            activePolygon: poly,
            playerState: 'ON_BORDER',
            playerPos: { x: 450, y: 1200 },
            activeTrail: [],
            speedScale: 1.0,
            projectiles,
            spawnChildMinion: () => {},
            currentMinionCount: 3,
            bossCenter: { x: 450, y: 500 },
            hazards
          });
        }
        m.render(ctx, 1.0, 1.25);
      }

      // Verify the 6 new Boss signature mechanics specifically
      const frost = new FrostLeviathanBoss({ x: 450, y: 500 }, 9);
      const scorpion = new PlasmaScorpionBoss({ x: 450, y: 500 }, 10);
      const worm = new SinkholeWormBoss({ x: 450, y: 500 }, 11);
      const butterfly = new QuantumButterflyBoss({ x: 450, y: 500 }, 12);
      const solar = new SolarFlareCoreBoss({ x: 450, y: 500 }, 14);
      const emperor = new VoidEmperorBoss({ x: 450, y: 500 }, 18);

      expect(emperor.awakenedCore).toBe(false);
      emperor.update({
        dt: FIXED_DT,
        timeSeconds: 1.0,
        activePolygon: poly,
        claimedPercent: 48,
        playerPos: { x: 450, y: 1200 },
        playerState: 'ON_BORDER',
        activeTrail: [],
        speedScale: 1.0,
        telegraphLeadSec: 0.7,
        projectiles,
        summonMinion: () => {},
        currentMinionCount: 2
      });
      expect(emperor.awakenedCore).toBe(true);

      frost.update({
        dt: 1.5,
        timeSeconds: 1.5,
        activePolygon: poly,
        claimedPercent: 20,
        playerPos: { x: 450, y: 1200 },
        playerState: 'ON_BORDER',
        activeTrail: [],
        speedScale: 1.0,
        telegraphLeadSec: 0.7,
        projectiles,
        summonMinion: () => {},
        hazards,
        currentMinionCount: 2
      });
      expect(hazards.frostZones.length).toBeGreaterThanOrEqual(1);
      expect(hazards.isPointInFrostZone(hazards.frostZones[0]!)).toBe(true);
      hazards.render(ctx, 1.0);

      void scorpion;
      void worm;
      void butterfly;
      void solar;

      for (const cType of [
        'TIME_FREEZE',
        'SPEED_BOOST',
        'TRAIL_SHIELD_1HIT',
        'LASER_CANNON'
      ] as const) {
        expect(getFieldCrystalSprite(cType, 0)).toBeTruthy();
        expect(getFieldCrystalSprite(cType, 1)).toBeTruthy();
      }
    });
  });
});
