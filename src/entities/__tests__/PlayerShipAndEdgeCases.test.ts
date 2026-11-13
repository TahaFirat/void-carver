import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../../core/Config';
import {
  createInitialArenaPolygon,
  pointInPolygonStrict
} from '../../geometry/PolygonMath';
import { PolygonSplitter } from '../../geometry/PolygonSplitter';
import { Barrier } from '../../geometry/Types';
import { InputState } from '../../input/InputManager';
import { TitanCore } from '../bosses/TitanCore';
import { PlayerShip } from '../PlayerShip';

function makeInput(
  direction: InputState['direction'],
  carveHeld = false,
  autoCarveSwipe = false
): InputState {
  return {
    direction,
    carveHeld,
    autoCarveSwipe,
    pauseJustPressed: false,
    debugSectorSelect: null
  };
}

describe('PlayerShip, 180-Degree Line Backtrack, Barrier Physics & Corner Buffering', () => {
  it('blocks launching a cut from a Border Barrier, but launches cleanly outside barrier', () => {
    const poly = createInitialArenaPolygon();
    const barriers: Barrier[] = [{ x1: 400, y1: 1200, x2: 500, y2: 1200 }];
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 100);

    // Attempt to cut UP while standing on barrier [400..500] -> must remain ON_BORDER
    ship.update(FIXED_DT * 3, makeInput('UP', true), poly, barriers);
    expect(ship.state).toBe('ON_BORDER');

    // Walk LEFT off the barrier to x < 400
    for (let i = 0; i < 25; i++) {
      ship.update(FIXED_DT, makeInput('LEFT', false), poly, barriers);
    }
    expect(ship.x).toBeLessThan(400);

    // Now launch UP into arena -> must enter CUTTING!
    ship.update(FIXED_DT * 2, makeInput('UP', true), poly, barriers);
    expect(ship.state).toBe('CUTTING');
  });

  it('supports authentic 180-degree Line Backtrack at 1.15x speed back to ON_BORDER and stops before self-intersecting', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 100);

    // Launch UP into arena
    for (let i = 0; i < 24; i++) {
      ship.update(FIXED_DT, makeInput('UP', true), poly, []);
    }
    expect(ship.state).toBe('CUTTING');
    const yMidCut = ship.y;
    expect(yMidCut).toBeLessThan(1200);

    // Turn RIGHT for 14 steps to create an L-shaped corner
    for (let i = 0; i < 14; i++) {
      ship.update(FIXED_DT, makeInput('RIGHT', true), poly, []);
    }
    expect(ship.x).toBeGreaterThan(450);

    // Now pull 180-degree opposite (`LEFT`) to rewind back to corner x = 450!
    for (let i = 0; i < 20; i++) {
      ship.update(FIXED_DT, makeInput('LEFT', false), poly, []);
    }
    expect(ship.x).toBe(450);
    expect(ship.state).toBe('CUTTING');

    // Pull `DOWN` to rewind the first segment all the way back to `cutStartPoint` (450, 1200) -> `ON_BORDER`!
    for (let i = 0; i < 30; i++) {
      ship.update(FIXED_DT, makeInput('DOWN', false), poly, []);
    }
    expect(ship.state).toBe('ON_BORDER');
    expect(ship.x).toBe(450);
    expect(ship.y).toBe(1200);
    expect(ship.getActiveTrail()).toHaveLength(0);

    // Launch UP again and spiral inward: RIGHT -> DOWN -> LEFT toward initial vertical segment at x=450
    for (let i = 0; i < 25; i++) ship.update(FIXED_DT, makeInput('UP', true), poly, []);
    for (let i = 0; i < 20; i++) ship.update(FIXED_DT, makeInput('RIGHT', true), poly, []);
    for (let i = 0; i < 12; i++) ship.update(FIXED_DT, makeInput('DOWN', true), poly, []);
    for (let i = 0; i < 40; i++) ship.update(FIXED_DT, makeInput('LEFT', true), poly, []);

    // Must stop safely BEFORE crossing x = 450!
    expect(ship.state).toBe('CUTTING');
    expect(ship.x).toBeGreaterThan(450);
  });

  it('stops before a barrier wall when cutting from inside, allowing 90-degree turn to valid wall', () => {
    const poly = createInitialArenaPolygon();
    // Barrier on top wall [400..600]
    const barriers: Barrier[] = [{ x1: 400, y1: 0, x2: 600, y2: 0 }];
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 100);

    // Cut straight UP toward top barrier at x=450
    let cutDone = null;
    for (let i = 0; i < 400; i++) {
      const ev = ship.update(FIXED_DT, makeInput('UP', true), poly, barriers);
      if (ev) cutDone = ev;
    }
    // Must NOT have closed on the barrier; stopped cleanly right below y=0 (at y=4)!
    expect(cutDone).toBeNull();
    expect(ship.state).toBe('CUTTING');
    expect(ship.y).toBe(4);

    // Now turn LEFT past x=400 and turn UP to valid top border!
    for (let i = 0; i < 30; i++) {
      ship.update(FIXED_DT, makeInput('LEFT', true), poly, barriers);
    }
    expect(ship.x).toBeLessThan(400);

    for (let i = 0; i < 10; i++) {
      const ev = ship.update(FIXED_DT, makeInput('UP', true), poly, barriers);
      if (ev) {
        cutDone = ev;
        break;
      }
    }
    expect(cutDone).not.toBeNull();
    expect(ship.state).toBe('ON_BORDER');
    expect(ship.y).toBe(0);
  });

  it('executes Corner Turn Buffering when pressing perpendicular direction within 18px of corner', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    // Place 14px away from bottom-left corner (0, 1200)
    ship.initForLevel({ x: 14, y: 1200 }, 100);

    // Player presses UP early (14px <= 18px corner buffer!) without holding LEFT
    for (let i = 0; i < 15; i++) {
      ship.update(FIXED_DT, makeInput('UP', false), poly, []);
    }

    // Ship should have glided into (0, 1200) and rounded the corner UP along x=0!
    expect(ship.x).toBe(0);
    expect(ship.y).toBeLessThan(1200);
  });

  it('smoothly resolves Boss boundingRadius penetration over 3 frames without leaving activePolygon', () => {
    const arena = createInitialArenaPolygon();
    const boss = new TitanCore({ x: 470, y: 600 }); // baseRadius = 42

    // Cut right next to Boss at x = 450 (distance 20 < radius 42!)
    const split = PolygonSplitter.split(arena, [
      { x: 450, y: 0 },
      { x: 450, y: 1200 }
    ])!;
    const classified = PolygonSplitter.classifySplit(split, [boss.position]);

    boss.onPolygonShrunk(classified.activePolygon);
    expect(pointInPolygonStrict(boss.position, classified.activePolygon)).toBe(true);
  });
});
