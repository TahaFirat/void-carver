import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../../core/Config';
import { createInitialArenaPolygon } from '../../geometry/PolygonMath';
import { PolygonSplitter } from '../../geometry/PolygonSplitter';
import { InputState } from '../../input/InputManager';
import { TouchGestureEngine } from '../../input/TouchGestureEngine';
import { DIFFICULTY_RULES } from '../../levels/DifficultyRules';
import { EndlessBossDirector } from '../../levels/EndlessBossDirector';
import { CentipedeBoss } from '../bosses/CentipedeBoss';
import {
  AlienBrainBoss,
  BioWheelBoss,
  CyberSkullBoss,
  LobsterMechaBoss,
  PinballFrogBoss,
  PincerBeetleBoss
} from '../bosses/VolfiedBosses';
import { DroneBouncer } from '../enemies/DroneBouncer';
import { SawBladeMinion, YellowSwarmer } from '../enemies/VolfiedMinions';
import { PlayerShip } from '../PlayerShip';
import { PowerUpBox } from '../PowerUpBox';
import { ProjectileManager } from '../Projectiles';

function inputOf(
  direction: InputState['direction'],
  carveHeld = false,
  secondaryDirection?: InputState['secondaryDirection']
): InputState {
  return {
    direction,
    secondaryDirection,
    carveHeld,
    autoCarveSwipe: false,
    pauseJustPressed: false,
    debugSectorSelect: null
  };
}

describe('V7 1989 Arcade Reverse-Engineering Acceptance Suite', () => {
  it('RULE 1 (Zero-Inertia Stop): Releasing direction in ON_BORDER or CUTTING stops ship by exact 0px on the very next frame', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 95);

    // 1A. Move on border, then release direction -> exact 0px delta on very next frame!
    ship.update(FIXED_DT, inputOf('LEFT', false), poly, []);
    const borderStoppedX = ship.x;
    const borderStoppedY = ship.y;
    expect(borderStoppedX).toBeLessThan(450);

    ship.update(FIXED_DT, inputOf(null, false), poly, []);
    expect(ship.x - borderStoppedX).toBe(0);
    expect(ship.y - borderStoppedY).toBe(0);

    // 1B. Cut into open space, then release direction -> exact 0px delta on very next frame!
    for (let i = 0; i < 12; i++) {
      ship.update(FIXED_DT, inputOf('UP', true), poly, []);
    }
    expect(ship.state).toBe('CUTTING');
    const cutStoppedX = ship.x;
    const cutStoppedY = ship.y;

    for (let f = 0; f < 10; f++) {
      ship.update(FIXED_DT, inputOf(null, false), poly, []);
      expect(ship.x - cutStoppedX).toBe(0);
      expect(ship.y - cutStoppedY).toBe(0);
      expect(ship.state).toBe('CUTTING');
    }

    // 1C. TouchGestureEngine instant 0ms release stop & SINGLE_HAND_DRAG idle finger pause stop
    const gesture = new TouchGestureEngine();
    gesture.configure('CLASSIC_ARCADE', 'LEFT');
    gesture.updateViewportBounds(390, 844, 610);
    const vis = gesture.getVisualState();
    gesture.handleTouchStart(1, vis.padCenterX + 32, vis.padCenterY, 0);
    expect(gesture.getDirection()).toBe('RIGHT');
    gesture.handleTouchEnd(1);
    expect(gesture.getDirection()).toBeNull();

    gesture.configure('SINGLE_HAND_DRAG', 'CENTER');
    gesture.handleTouchStart(2, 195, 730, 100);
    gesture.handleTouchMove(2, 220, 730, 116);
    expect(gesture.getDirection()).toBe('RIGHT');
    // Finger stops moving on glass for >= 95ms -> 0ms instant stop!
    gesture.tick(220);
    expect(gesture.getDirection()).toBeNull();
  });

  it('RULE 2 (PC Keyboard Safe Border): Without SPACE, arrows & diagonal corners NEVER leave border; SPACE + inward enters CUTTING in 1 frame and persists after SPACE release', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 870, y: 1200 }, 95);

    // Hold inward UP without SPACE (`carveHeld = false`) on bottom border -> NEVER cuts!
    for (let i = 0; i < 20; i++) {
      ship.update(FIXED_DT, inputOf('UP', false), poly, []);
      expect(ship.state).toBe('ON_BORDER');
      expect(ship.y).toBe(1200);
    }

    // Hold diagonal RIGHT + UP (`carveHeld = false`) approaching bottom-right corner (900, 1200):
    // Glides smoothly around corner onto right vertical wall (x = 900) without EVER entering CUTTING!
    for (let i = 0; i < 20; i++) {
      ship.update(FIXED_DT, inputOf('RIGHT', false, 'UP'), poly, []);
      expect(ship.state).toBe('ON_BORDER');
    }
    expect(ship.x).toBe(900);
    expect(ship.y).toBeLessThan(1200);

    // Press SPACE + Inward LEFT (`carveHeld = true`) -> enters CUTTING in a single frame!
    ship.update(FIXED_DT, inputOf('LEFT', true), poly, []);
    expect(ship.state).toBe('CUTTING');
    expect(ship.x).toBeLessThan(900);

    // Release SPACE (`carveHeld = false`) while holding LEFT -> stays in CUTTING and keeps advancing!
    const xAfterLaunch = ship.x;
    ship.update(FIXED_DT, inputOf('LEFT', false), poly, []);
    expect(ship.state).toBe('CUTTING');
    expect(ship.x).toBeLessThan(xAfterLaunch);
  });

  it('RULE 3 (Shield Pause Law): Shield drains strictly in ON_BORDER and pauses at exact 0.000 drain during CUTTING', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 68, 680);

    const initialShield = ship.shieldTimer;
    for (let i = 0; i < 30; i++) {
      ship.update(FIXED_DT, inputOf(null, false), poly, []);
    }
    const shieldAfterBorder = ship.shieldTimer;
    expect(shieldAfterBorder).toBeLessThan(initialShield);

    // Step into CUTTING
    ship.update(FIXED_DT, inputOf('UP', true), poly, []);
    expect(ship.state).toBe('CUTTING');
    const shieldAtCutStart = ship.shieldTimer;

    // Advance 90 frames in CUTTING (moving and stopped) -> shield drain must be EXACT 0!
    for (let i = 0; i < 45; i++) {
      ship.update(FIXED_DT, inputOf('UP', false), poly, []);
    }
    for (let i = 0; i < 45; i++) {
      ship.update(FIXED_DT, inputOf(null, false), poly, []);
    }
    expect(ship.state).toBe('CUTTING');
    expect(ship.shieldTimer).toBe(shieldAtCutStart);
  });

  it('RULE 4 (Unshielded Swarm Aggro): Minions turn toward player/trail and surge +15% / +45% / +80% the instant CUTTING starts', () => {
    const poly = createInitialArenaPolygon();
    const projectiles = new ProjectileManager();

    const runAggroCheck = (mult: number, interceptLead: boolean): { passiveSpd: number; aggroSpd: number; dotTowardShip: number } => {
      const m = new YellowSwarmer({ x: 250, y: 300 }, 200);
      // Force initial velocity pointing AWAY from player (up-left)
      m.vx = -140;
      m.vy = -140;

      m.update({
        dt: 0.1,
        activePolygon: poly,
        playerState: 'ON_BORDER',
        playerPos: { x: 450, y: 900 },
        activeTrail: [],
        speedScale: 1.0,
        aggroActive: false,
        aggroSpeedMult: mult,
        projectiles,
        spawnChildMinion: () => {},
        currentMinionCount: 1
      });
      expect(m.isSwarmAggro).toBe(false);
      const passiveSpd = Math.hypot(m.vx, m.vy);

      // Now player enters CUTTING -> Swarm Aggro engages immediately!
      for (let i = 0; i < 4; i++) {
        m.update({
          dt: 0.08,
          activePolygon: poly,
          playerState: 'CUTTING',
          playerPos: { x: 450, y: 900 },
          playerVel: { x: 0, y: -320 },
          activeTrail: [
            { x: 450, y: 1200 },
            { x: 450, y: 900 }
          ],
          speedScale: 1.0,
          aggroActive: true,
          aggroSpeedMult: mult,
          interceptLead,
          projectiles,
          spawnChildMinion: () => {},
          currentMinionCount: 1
        });
      }
      expect(m.isSwarmAggro).toBe(true);
      const aggroSpd = Math.hypot(m.vx, m.vy);
      const toShipX = 450 - m.x;
      const toShipY = 900 - m.y;
      const normA = Math.hypot(m.vx, m.vy) || 1;
      const normB = Math.hypot(toShipX, toShipY) || 1;
      const dotTowardShip = (m.vx * toShipX + m.vy * toShipY) / (normA * normB);
      return { passiveSpd, aggroSpd, dotTowardShip };
    };

    const easy = runAggroCheck(DIFFICULTY_RULES.EASY.swarmAggroSpeedMult, false);
    const med = runAggroCheck(DIFFICULTY_RULES.MEDIUM.swarmAggroSpeedMult, false);
    const hard = runAggroCheck(DIFFICULTY_RULES.HARD.swarmAggroSpeedMult, true);

    expect(easy.aggroSpd / easy.passiveSpd).toBeCloseTo(1.15, 2);
    expect(med.aggroSpd / med.passiveSpd).toBeCloseTo(1.45, 2);
    expect(hard.aggroSpd / hard.passiveSpd).toBeCloseTo(1.8, 2);
    expect(easy.dotTowardShip).toBeGreaterThan(0.85);
    expect(med.dotTowardShip).toBeGreaterThan(0.85);
    expect(hard.dotTowardShip).toBeGreaterThan(0.8);

    // Also verify DroneBouncer calms right back down when player returns to ON_BORDER
    const drone = new DroneBouncer({ x: 300, y: 400 }, 180, 0);
    drone.update({
      dt: 0.05,
      activePolygon: poly,
      playerState: 'CUTTING',
      playerPos: { x: 450, y: 900 },
      activeTrail: [
        { x: 450, y: 1200 },
        { x: 450, y: 900 }
      ],
      speedScale: 1.0,
      aggroActive: true,
      aggroSpeedMult: 1.45,
      projectiles,
      spawnChildMinion: () => {},
      currentMinionCount: 1
    });
    expect(drone.isSwarmAggro).toBe(true);

    drone.update({
      dt: 0.05,
      activePolygon: poly,
      playerState: 'ON_BORDER',
      playerPos: { x: 450, y: 1200 },
      activeTrail: [],
      speedScale: 1.0,
      aggroActive: false,
      projectiles,
      spawnChildMinion: () => {},
      currentMinionCount: 1
    });
    expect(drone.isSwarmAggro).toBe(false);
  });

  it('RULE 5 (KOLAY / ORTA / ZOR Gap, Authentic Boss Patterns, Pinball Shrink-Speedup & Rare Group C Evolutions)', () => {
    const director = new EndlessBossDirector();
    const poly = createInitialArenaPolygon();
    const projectiles = new ProjectileManager();

    // 5A. Waves 1..4 on KOLAY & ORTA NEVER trigger fake Phase 2!
    for (let w = 1; w <= 4; w++) {
      const easySpec = director.buildWave(w, 'EASY');
      const medSpec = director.buildWave(w, 'MEDIUM');
      expect(easySpec.canEvolvePhase2).toBe(false);
      expect(medSpec.canEvolvePhase2).toBe(false);
      expect(director.resolveActivePhase(78, 0.2, easySpec)).toBe(1);
      expect(director.resolveActivePhase(78, 0.2, medSpec)).toBe(1);
    }

    // 5B. Night-and-Day KOLAY vs ZOR gap (`bossHitTrailInstantDetonation`, shield seconds, stall spark)
    const w1Easy = director.buildWave(1, 'EASY');
    const w1Hard = director.buildWave(1, 'HARD');
    expect(w1Easy.rules.bossHitTrailInstantDetonation).toBe(false);
    expect(w1Hard.rules.bossHitTrailInstantDetonation).toBe(true);
    expect(w1Hard.shieldSeconds).toBeLessThan(w1Easy.shieldSeconds * 0.5);
    expect(w1Hard.rules.stallSparkLimitSec).toBeLessThan(1.0);

    // Boss bullets carry `fromBoss = true` so ZOR instant trail detonation identifies them cleanly
    const wheel = new BioWheelBoss({ x: 450, y: 500 }, 8);
    wheel.update({
      dt: 2.5,
      timeSeconds: 2.5,
      activePolygon: poly,
      claimedPercent: 0,
      playerPos: { x: 450, y: 1200 },
      playerState: 'ON_BORDER',
      activeTrail: [],
      speedScale: 1.0,
      projectiles,
      summonMinion: () => {},
      currentMinionCount: 0
    });
    const bossShots = projectiles.enemyBullets.filter((b) => b.active);
    expect(bossShots.length).toBe(8); // Simultaneous 8-way 360-degree ring!
    expect(bossShots.every((b) => b.fromBoss)).toBe(true);

    // PincerBeetle alternates 5-way fan + vertical twin columns
    projectiles.clearAll();
    const pincer = new PincerBeetleBoss({ x: 450, y: 500 }, 8);
    pincer.update({
      dt: 2.2,
      timeSeconds: 2.2,
      activePolygon: poly,
      claimedPercent: 0,
      playerPos: { x: 450, y: 1200 },
      playerState: 'ON_BORDER',
      activeTrail: [],
      speedScale: 1.0,
      projectiles,
      summonMinion: () => {},
      currentMinionCount: 0
    });
    expect(projectiles.enemyBullets.filter((b) => b.active).length).toBe(5);

    // 5C. Law 5 Pinball Shrink-Speedup in narrow pocket (`0.45x` scale -> `> 1.5x` speed boost!)
    const frog = new PinballFrogBoss({ x: 16, y: 600 }, 7);
    const narrowSplit = PolygonSplitter.split(poly, [
      { x: 30, y: 0 },
      { x: 30, y: 1200 }
    ])!;
    const narrowPoly = PolygonSplitter.classifySplit(narrowSplit, [{ x: 16, y: 600 }]).activePolygon;
    frog.onPolygonShrunk(narrowPoly);
    expect(frog.renderScale).toBeLessThan(0.6);
    expect(frog.pinballSpeedBoost).toBeGreaterThan(1.45);

    // 5D. Group C #1: ElderCentipede shatters carapace at >= 70% -> 5-segment 2.0x Crimson Parasite!
    const elder = new CentipedeBoss({ x: 450, y: 500 }, 12, 'GOLD', 10, true);
    const debris = elder.triggerElderArmorShed(poly);
    expect(debris.length).toBe(12);
    expect(elder.armorShed).toBe(true);
    expect(elder.segmentCount).toBe(5);
    expect(elder.parasiteSpeedMultiplier).toBe(2.0);

    // 5E. Group C #2: ArmoredCrustacean drops permanent solid obstacle shell!
    let droppedObstaclePos = null;
    const crustacean = new LobsterMechaBoss({ x: 450, y: 520 }, 9, true);
    crustacean.triggerShellDrop({
      spawnSolidObstacle: (p) => {
        droppedObstaclePos = p;
      }
    });
    expect(crustacean.shellDropped).toBe(true);
    expect(droppedObstaclePos).not.toBeNull();

    // 5F. Group C #3: CyberTitanSkull False Victory / 10s OR 90% Last Stand!
    const skullSpec = director.buildWave(5, 'HARD');
    expect(skullSpec.bossArchetype).toBe('CYBER_TITAN_SKULL');
    expect(skullSpec.canEvolvePhase2).toBe(true);

    const skull = new CyberSkullBoss({ x: 450, y: 500 }, 12, true);
    expect(skull.triggerLastStand(10.0)).toBe(true);
    expect(skull.inLastStand).toBe(true);
    expect(skull.lastStandCompleted).toBe(false);

    skull.update({
      dt: 5.0,
      timeSeconds: 5.0,
      activePolygon: poly,
      claimedPercent: 86,
      playerPos: { x: 450, y: 1200 },
      playerState: 'ON_BORDER',
      activeTrail: [],
      speedScale: 1.0,
      projectiles,
      summonMinion: () => {},
      currentMinionCount: 0
    });
    expect(skull.lastStandCompleted).toBe(false);

    // Survive remaining 5.1s -> Last Stand completes!
    skull.update({
      dt: 5.1,
      timeSeconds: 10.1,
      activePolygon: poly,
      claimedPercent: 86,
      playerPos: { x: 450, y: 1200 },
      playerState: 'ON_BORDER',
      activeTrail: [],
      speedScale: 1.0,
      projectiles,
      summonMinion: () => {},
      currentMinionCount: 0
    });
    expect(skull.lastStandCompleted).toBe(true);

    // 5G. Group C #4: AbyssalOvermind detaches 4 independent SawBladeMinions!
    const detachedMinions: SawBladeMinion[] = [];
    const overmind = new AlienBrainBoss({ x: 450, y: 500 }, 16, true);
    const detachedCount = overmind.detachArmorSawBlades({
      summonMinion: (m) => {
        if (m instanceof SawBladeMinion) detachedMinions.push(m);
      }
    });
    expect(detachedCount).toBe(4);
    expect(detachedMinions.length).toBe(4);

    // 5H. Law 6 Disappearing Block: materialized -> 0.6s warning flicker -> vanished (`!isMaterialized`)
    const blinkingBox = new PowerUpBox({
      x: 300,
      y: 400,
      type: 'T',
      blockKind: 'DISAPPEARING',
      onDurationSec: 4.0,
      offDurationSec: 2.0,
      phaseOffsetSec: 0
    });
    expect(blinkingBox.isMaterialized(1.0)).toBe(true);
    expect(blinkingBox.isFlickeringWarning(1.0)).toBe(false);
    expect(blinkingBox.isFlickeringWarning(3.6)).toBe(true);
    expect(blinkingBox.isMaterialized(4.5)).toBe(false);
  });
});
