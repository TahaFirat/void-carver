import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../../core/Config';
import { ArenaHazardManager } from '../../entities/ArenaHazards';
import {
  HydraBioHeadBoss,
  MirrorPrismBoss,
  SniperScarabBoss,
  SpiralNautilusBoss
} from '../../entities/bosses/BestiaryBosses';
import {
  createBossesForEncounterPlan,
  instantiateBossBySpeciesId
} from '../../entities/bosses/BossFactory';
import {
  AnchorBarnacleMinion,
  PhaseGhostMinion,
  ShieldSapperMinion
} from '../../entities/enemies/BestiaryMinions';
import { createMinionBySpecies } from '../../entities/enemies/MinionFactory';
import { ProjectileManager } from '../../entities/Projectiles';
import { createInitialArenaPolygon } from '../../geometry/PolygonMath';
import { ALL_BOSS_IDS, ALL_MINION_IDS, EncounterDeck } from '../EncounterDeck';

function createMockCanvasContext(): CanvasRenderingContext2D {
  const noop = (): void => {};
  const grad = { addColorStop: noop };
  return {
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
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

describe('Build 11 Bestiary (18 Bosses + 14 Minions + Zero-Repeat EncounterDeck)', () => {
  it('guarantees ZERO Boss repetition across 18 consecutive waves and zero consecutive squad/terrain repeats on all difficulties', () => {
    for (const diff of ['EASY', 'MEDIUM', 'HARD'] as const) {
      const deck = new EncounterDeck(12345);
      const seenBosses = new Set<string>();
      let prevSquad = '';
      let prevTerrain = -1;

      for (let w = 1; w <= 18; w++) {
        const plan = deck.nextEncounter(w, diff);
        expect(
          seenBosses.has(plan.bossId),
          `Duplicate boss ${plan.bossId} on wave ${w} (${diff})`
        ).toBe(false);
        seenBosses.add(plan.bossId);

        expect(plan.minionSquadSignature).not.toBe(prevSquad);
        prevSquad = plan.minionSquadSignature;

        expect(plan.terrainThemeIndex).not.toBe(prevTerrain);
        prevTerrain = plan.terrainThemeIndex;
      }

      expect(seenBosses.size).toBe(ALL_BOSS_IDS.length);
      expect(ALL_BOSS_IDS.length).toBe(18);
    }
  });

  it('schedules all 14 distinct Minion species across a 36-wave run', () => {
    expect(ALL_MINION_IDS.length).toBe(14);
    const deck = new EncounterDeck(20261114);
    const seenMinions = new Set<string>();
    for (let w = 1; w <= 36; w++) {
      const plan = deck.nextEncounter(w, 'MEDIUM');
      for (const g of plan.minionSpawns) {
        seenMinions.add(g.species);
      }
    }
    for (const mId of ALL_MINION_IDS) {
      expect(seenMinions.has(mId), `Minion species ${mId} was never scheduled`).toBe(true);
    }
  });

  it('activates Elite Mutations on Cycle 2 (Waves 19..25) so post-18 waves never feel stale', () => {
    const deck = new EncounterDeck(777);
    let mutatedCount = 0;
    for (let w = 1; w <= 25; w++) {
      const plan = deck.nextEncounter(w, 'MEDIUM');
      if (w >= 19 && plan.eliteMutation !== 'NONE') {
        mutatedCount++;
      }
    }
    expect(mutatedCount).toBe(7);
  });

  it('instantiates, updates, and renders all 18 Boss species and all 14 Minion species without errors', () => {
    const poly = createInitialArenaPolygon();
    const projectiles = new ProjectileManager();
    const hazards = new ArenaHazardManager();

    withMockDocumentCanvas(() => {
      const ctx = createMockCanvasContext();

      for (const bossId of ALL_BOSS_IDS) {
        const bosses = instantiateBossBySpeciesId(bossId, { x: 450, y: 500 }, 10, true);
        expect(bosses.length).toBeGreaterThanOrEqual(1);
        for (const b of bosses) {
          for (let step = 0; step < 30; step++) {
            b.update({
              dt: FIXED_DT,
              timeSeconds: step * FIXED_DT,
              activePolygon: poly,
              claimedPercent: 35,
              playerPos: { x: 450, y: 1200 },
              playerVel: { x: 0, y: 0 },
              playerState: step % 2 === 0 ? 'ON_BORDER' : 'CUTTING',
              activeTrail: [
                { x: 450, y: 1200 },
                { x: 450, y: 1020 }
              ],
              speedScale: 1.0,
              aimMode: 'DIRECT_AIM',
              projectiles,
              summonMinion: () => {},
              spawnSolidObstacle: () => {},
              spawnEscortBoss: () => {},
              hazards,
              currentMinionCount: 2
            });
          }
          expect(b.getHitCircles().length).toBeGreaterThanOrEqual(1);
          b.render(ctx, 1.0, 1.25, true);
        }
      }

      for (let i = 0; i < ALL_MINION_IDS.length; i++) {
        const species = ALL_MINION_IDS[i];
        const m = createMinionBySpecies(species, { x: 320 + (i % 5) * 60, y: 360 + i * 24 }, i);
        expect(m.speciesId).toBe(species);
        for (let step = 0; step < 30; step++) {
          if (!m.alive) break;
          m.update({
            dt: FIXED_DT,
            activePolygon: poly,
            playerState: step < 15 ? 'ON_BORDER' : 'CUTTING',
            playerPos: { x: 450, y: 1120 },
            playerVel: { x: 0, y: -180 },
            activeTrail: [
              { x: 450, y: 1200 },
              { x: 450, y: 1120 }
            ],
            speedScale: 1.0,
            aggroActive: step >= 15,
            aggroSpeedMult: 1.45,
            interceptLead: false,
            projectiles,
            spawnChildMinion: () => {},
            currentMinionCount: 3,
            bossCenter: { x: 450, y: 500 },
            hazards,
            solidBoxes: [{ x: 250, y: 250, half: 34 }],
            waveElapsedSec: 40,
            crawlerDelaySec: 32
          });
        }
        m.render(ctx, 1.0, 1.25);
      }

      hazards.spawnMagmaPool({ x: 400, y: 400 });
      hazards.spawnWebZone({ x: 500, y: 500 });
      hazards.spawnSpaceMine({ x: 300, y: 300 });
      hazards.spawnStaticBorderArc({ x: 0, y: 200 }, { x: 0, y: 360 });
      hazards.render(ctx, 1.0);
    });
  });

  it('verifies signature Build 11 Boss & Minion mechanics (SniperScarab armor, MirrorPrism bounce, SpiralNautilus spin, Hydra detach, PhaseGhost & AnchorBarnacle)', () => {
    const poly = createInitialArenaPolygon();
    const projectiles = new ProjectileManager();
    const hazards = new ArenaHazardManager();

    // 1. SniperScarab: 70% armor reduction when closed, 0% when wings open
    const scarab = new SniperScarabBoss({ x: 450, y: 500 }, 10);
    expect(scarab.armorDamageReduction).toBeCloseTo(0.7, 2);
    scarab.takeCannonHit();
    expect(scarab.hp).toBeCloseTo(9.7, 2);

    // 2. MirrorPrism: fires mirror laser beams with bouncesLeft = 1 that ricochet off arena walls
    const prism = new MirrorPrismBoss({ x: 450, y: 500 }, 10);
    for (let i = 0; i < 160; i++) {
      prism.update({
        dt: FIXED_DT,
        timeSeconds: i * FIXED_DT,
        activePolygon: poly,
        claimedPercent: 20,
        playerPos: { x: 450, y: 1200 },
        playerState: 'ON_BORDER',
        activeTrail: [],
        speedScale: 1,
        projectiles,
        summonMinion: () => {},
        currentMinionCount: 0
      });
    }
    const mirrorBeams = projectiles.enemyBullets.filter((b) => b.bouncesLeft >= 1);
    expect(mirrorBeams.length).toBeGreaterThanOrEqual(2);

    // Force a mirror beam into the left wall x=0 and verify it reflects instead of dying
    const testBeam = mirrorBeams[0];
    testBeam.x = 2;
    testBeam.y = 500;
    testBeam.vx = -300;
    testBeam.vy = 120;
    projectiles.update(0.05, poly, false);
    expect(testBeam.active).toBe(true);
    expect(testBeam.vx).toBeGreaterThan(0);
    expect(testBeam.bouncesLeft).toBe(0);

    // 3. SpiralNautilus: enters 2.4x retracted pinball spin after 7.0s
    const nautilus = new SpiralNautilusBoss({ x: 450, y: 500 }, 10);
    expect(nautilus.isRetractedSpin).toBe(false);
    nautilus.update({
      dt: 7.2,
      timeSeconds: 7.2,
      activePolygon: poly,
      claimedPercent: 10,
      playerPos: { x: 450, y: 1200 },
      playerState: 'ON_BORDER',
      activeTrail: [],
      speedScale: 1,
      projectiles,
      summonMinion: () => {},
      currentMinionCount: 0
    });
    expect(nautilus.isRetractedSpin).toBe(true);
    expect(Math.hypot(nautilus.vx, nautilus.vy)).toBeGreaterThan(280);

    // 4. HydraBioHead: detaches an independent escort serpent head at >= 60% claimed area
    const hydra = new HydraBioHeadBoss({ x: 450, y: 500 }, 12);
    const detached: unknown[] = [];
    hydra.update({
      dt: FIXED_DT,
      timeSeconds: 1.0,
      activePolygon: poly,
      claimedPercent: 62,
      playerPos: { x: 450, y: 1200 },
      playerState: 'ON_BORDER',
      activeTrail: [],
      speedScale: 1,
      projectiles,
      summonMinion: () => {},
      spawnEscortBoss: (esc) => detached.push(esc),
      currentMinionCount: 0
    });
    expect(hydra.headDetached).toBe(true);
    expect(detached.length).toBe(1);

    // 5. TWIN_CLONE Elite Mutation spawns primary + 0.78x clone escort
    const deck = new EncounterDeck(42);
    const basePlan = deck.nextEncounter(1, 'HARD');
    const twinPlan = {
      ...basePlan,
      bossId: 'SNIPER_SCARAB' as const,
      eliteMutation: 'TWIN_CLONE' as const
    };
    const mutatedBosses = createBossesForEncounterPlan(twinPlan);
    expect(mutatedBosses.length).toBe(2);
    expect(mutatedBosses[1].isEscort).toBe(true);
    expect(mutatedBosses[1].cloneVisualScale).toBeCloseTo(0.78, 2);

    // 6. PhaseGhost ignores solid boxes; AnchorBarnacle toggles petrified solid obstacle; ShieldSapper latches to border
    const ghost = new PhaseGhostMinion({ x: 300, y: 300 }, 154, 0);
    expect(ghost.ignoresSolidBoxes).toBe(true);

    const barnacle = new AnchorBarnacleMinion({ x: 400, y: 400 }, 0);
    expect(barnacle.isPetrifiedObstacle).toBe(false);
    barnacle.update({
      dt: 4.1,
      activePolygon: poly,
      playerState: 'ON_BORDER',
      playerPos: { x: 450, y: 1200 },
      activeTrail: [],
      speedScale: 1,
      projectiles,
      spawnChildMinion: () => {},
      currentMinionCount: 1,
      hazards
    });
    expect(barnacle.isPetrifiedObstacle).toBe(true);

    const sapper = new ShieldSapperMinion({ x: 8, y: 600 }, 168);
    sapper.vx = -168;
    sapper.vy = 0;
    sapper.update({
      dt: 0.1,
      activePolygon: poly,
      playerState: 'ON_BORDER',
      playerPos: { x: 450, y: 1200 },
      activeTrail: [],
      speedScale: 1,
      projectiles,
      spawnChildMinion: () => {},
      currentMinionCount: 1
    });
    expect(sapper.isLatchedToBorder).toBe(true);
  });
});
