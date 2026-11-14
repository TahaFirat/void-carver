import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../../core/Config';
import {
  createInitialArenaPolygon,
  pointInPolygonStrict
} from '../../geometry/PolygonMath';
import { PolygonSplitter } from '../../geometry/PolygonSplitter';
import { Barrier } from '../../geometry/Types';
import { InputState } from '../../input/InputManager';
import { TouchControls } from '../../input/TouchControls';
import { computeLayout, getLayout, setLayout } from '../../core/ResponsiveLayout';
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

  it('uses Border Exit Magnet near safe boundary so early perpendicular thumb tilt exits cleanly onto border', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 100);

    // Cut straight UP until within 12px of top border y=0
    let completed = null;
    for (let i = 0; i < 300; i++) {
      completed = ship.update(FIXED_DT, makeInput('UP', true), poly, []);
      if (ship.y <= 12) break;
    }
    expect(ship.state).toBe('CUTTING');
    expect(ship.y).toBeGreaterThan(0);
    expect(ship.y).toBeLessThanOrEqual(12);

    // Player tilts thumb RIGHT early anticipating top-border travel:
    // Ship must finish exiting onto y=0 (NOT get stuck cutting parallel at y=10) and then glide RIGHT!
    for (let i = 0; i < 8; i++) {
      const ev = ship.update(FIXED_DT, makeInput('RIGHT', false), poly, []);
      if (ev) completed = ev;
    }
    expect(completed).not.toBeNull();
    expect(ship.state).toBe('ON_BORDER');
    expect(ship.y).toBe(0);
    expect(ship.x).toBeGreaterThan(450);
    expect(ship.isAutoCutSuppressedAfterExit('RIGHT')).toBe(true);
  });

  it('detects both inward directions at a concave polygon corner and supports Left/Right dynamic joystick', () => {
    const arena = createInitialArenaPolygon();
    const split = PolygonSplitter.split(arena, [
      { x: 0, y: 900 },
      { x: 300, y: 900 },
      { x: 300, y: 1200 }
    ])!;
    const classified = PolygonSplitter.classifySplit(split, [{ x: 500, y: 500 }]);

    const ship = new PlayerShip();
    ship.initForLevel({ x: 300, y: 900 }, 100);
    const inward = ship.getInwardBorderDirections(classified.activePolygon, []);
    expect(inward).toContain('UP');
    expect(inward).toContain('RIGHT');

    // Verify JOYSTICK mode (comfortable 68px throw — slight thumb relax never flips 180°!),
    // DPAD mode (immediate direction on tap!), SWIPE mode, and RIGHT / LEFT / CENTER positions!
    setLayout(computeLayout(390, 844, { top: 0, right: 0, bottom: 0, left: 0 }, 'RIGHT'));
    const touch = new TouchControls();
    touch.configure('JOYSTICK', 'RIGHT');
    const rightCx = getLayout().joystick.cx;
    const rightCy = getLayout().joystick.cy;
    expect(rightCx).toBeGreaterThan(450);

    // Touch 35px right of visual center, drag 18px LEFT -> must steer LEFT (never inverted!)
    touch.handlePointerDown(1, rightCx + 35, rightCy, true);
    touch.handlePointerMove(1, rightCx + 17, rightCy);
    expect(touch.getSnapshot().direction).toBe('LEFT');

    // Drag far RIGHT (+120px): relaxing thumb slightly by 20px (~3mm) MUST STAY 'RIGHT',
    // while deliberately pulling 85px LEFT cleanly reverses to 'LEFT'!
    touch.handlePointerMove(1, rightCx + 155, rightCy);
    expect(touch.getSnapshot().direction).toBe('RIGHT');
    touch.handlePointerMove(1, rightCx + 135, rightCy);
    expect(touch.getSnapshot().direction).toBe('RIGHT');
    touch.handlePointerMove(1, rightCx + 70, rightCy);
    expect(touch.getSnapshot().direction).toBe('LEFT');
    touch.handlePointerUp(1);

    // Switch to DPAD mode on LEFT side -> tapping right wedge fires 'RIGHT' immediately with 0px drag!
    touch.configure('DPAD', 'LEFT');
    const leftStick = getLayout().joystick;
    expect(leftStick.cx).toBeLessThan(450);
    touch.handlePointerDown(2, leftStick.cx + 48, leftStick.cy, true);
    expect(touch.getSnapshot().direction).toBe('RIGHT');
    touch.handlePointerUp(2);

    // Switch to CENTER position & SWIPE mode
    touch.configure('SWIPE', 'CENTER');
    expect(Math.round(getLayout().joystick.cx)).toBe(450);
    touch.handlePointerDown(3, 300, 600, true);
    touch.handlePointerMove(3, 300, 560);
    expect(touch.getSnapshot().direction).toBe('UP');
    touch.handlePointerUp(3);
  });

  it('cruises continuously to complete a cut even if player lifts thumb mid-cut, and glides along outer wall on diagonal input', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 100);

    // Start cutting UP for 10 frames
    for (let i = 0; i < 10; i++) {
      ship.update(FIXED_DT, makeInput('UP', true), poly, []);
    }
    expect(ship.state).toBe('CUTTING');

    // Lift thumb completely (direction = null): ship MUST cruise all the way to y=0 and finish the cut!
    let completed = null;
    for (let i = 0; i < 320; i++) {
      const ev = ship.update(FIXED_DT, makeInput(null, false), poly, []);
      if (ev) {
        completed = ev;
        break;
      }
    }
    expect(completed).not.toBeNull();
    expect(ship.state).toBe('ON_BORDER');
    expect(ship.y).toBe(0);

    // At top border (450, 0), holding diagonal UP + secondary RIGHT must glide RIGHT instead of stalling!
    const prevX = ship.x;
    ship.update(
      FIXED_DT * 3,
      {
        direction: 'UP',
        secondaryDirection: 'RIGHT',
        carveHeld: false,
        autoCarveSwipe: false,
        pauseJustPressed: false,
        debugSectorSelect: null
      },
      poly,
      []
    );
    expect(ship.x).toBeGreaterThan(prevX);
  });
});
