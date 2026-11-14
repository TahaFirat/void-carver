import { describe, expect, it } from 'vitest';
import { FIXED_DT } from '../../core/Config';
import { computeLayout, getLayout, setLayout } from '../../core/ResponsiveLayout';
import {
  createInitialArenaPolygon,
  pointInPolygonStrict
} from '../../geometry/PolygonMath';
import { PolygonSplitter } from '../../geometry/PolygonSplitter';
import { Barrier } from '../../geometry/Types';
import { InputState } from '../../input/InputManager';
import { TouchControls } from '../../input/TouchControls';
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

describe('V6 PlayerShip, 180-Degree Line Backtrack, Barrier Physics & TouchControls', () => {
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
    const barriers: Barrier[] = [{ x1: 400, y1: 0, x2: 600, y2: 0 }];
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 100);

    let cutDone = null;
    for (let i = 0; i < 400; i++) {
      const ev = ship.update(FIXED_DT, makeInput('UP', true), poly, barriers);
      if (ev) cutDone = ev;
    }
    expect(cutDone).toBeNull();
    expect(ship.state).toBe('CUTTING');
    expect(ship.y).toBe(4);

    // Turn LEFT past x=400 and turn UP to valid top border!
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

  it('glides around corners on diagonal safe-border input while stopping cleanly at outer corners on single-axis input', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 8, y: 1200 }, 100);

    // Diagonal LEFT + UP without cut permission -> glides to (0, 1200) and rounds corner UP along x=0!
    for (let i = 0; i < 12; i++) {
      ship.update(
        FIXED_DT,
        {
          direction: 'LEFT',
          secondaryDirection: 'UP',
          carveHeld: false,
          autoCarveSwipe: false,
          pauseJustPressed: false,
          debugSectorSelect: null
        },
        poly,
        []
      );
    }
    expect(ship.state).toBe('ON_BORDER');
    expect(ship.x).toBe(0);
    expect(ship.y).toBeLessThan(1200);

    // Walk DOWN to outer corner (0, 1200) with single key: must stop cleanly at (0, 1200) and never wrap!
    for (let i = 0; i < 30; i++) {
      ship.update(FIXED_DT, makeInput('DOWN', false), poly, []);
    }
    expect(ship.x).toBe(0);
    expect(ship.y).toBe(1200);
  });

  it('smoothly resolves Boss boundingRadius penetration without leaving activePolygon', () => {
    const arena = createInitialArenaPolygon();
    const boss = new TitanCore({ x: 470, y: 600 });

    const split = PolygonSplitter.split(arena, [
      { x: 450, y: 0 },
      { x: 450, y: 1200 }
    ])!;
    const classified = PolygonSplitter.classifySplit(split, [boss.position]);

    boss.onPolygonShrunk(classified.activePolygon);
    expect(pointInPolygonStrict(boss.position, classified.activePolygon)).toBe(true);
  });

  it('rejects 10px parallel sliver turns near safe boundary so early perpendicular thumb tilt exits cleanly onto border', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 100);

    let completed = null;
    for (let i = 0; i < 300; i++) {
      completed = ship.update(FIXED_DT, makeInput('UP', true), poly, []);
      if (ship.y <= 9) break;
    }
    expect(ship.state).toBe('CUTTING');
    expect(ship.y).toBeGreaterThan(0);
    expect(ship.y).toBeLessThan(10);

    // Player tilts thumb RIGHT early anticipating top-border travel:
    // Navigator blocks the 9px parallel sliver turn, finishes exiting onto y=0, and glides RIGHT!
    for (let i = 0; i < 8; i++) {
      const ev = ship.update(FIXED_DT, makeInput('RIGHT', false), poly, []);
      if (ev) completed = ev;
    }
    expect(completed).not.toBeNull();
    expect(ship.state).toBe('ON_BORDER');
    expect(ship.y).toBe(0);
    expect(ship.x).toBeGreaterThan(450);
  });

  it('supports V7 CLASSIC_ARCADE, JOYSTICK_KES, and SINGLE_HAND_DRAG across LEFT / CENTER / RIGHT with zero HUD overlap', () => {
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

    // 1. SINGLE_HAND_DRAG on iPhone 390x844
    setLayout(computeLayout(390, 844, { top: 47, right: 0, bottom: 34, left: 0 }, 'RIGHT'));
    const touch = new TouchControls();
    touch.configure('SINGLE_HAND_DRAG', 'RIGHT');
    const visRight = touch.gesture.getVisualState();
    expect(visRight.padCenterX).toBeGreaterThan(195);
    expect(visRight.padCenterY - 52).toBeGreaterThanOrEqual(getLayout().statusStripBottomCssY + 4);

    touch.handleTouchDownCss(1, 220, 740, 450, 1450, true);
    touch.handleTouchMoveCss(1, 234, 740);
    expect(touch.getSnapshot().direction).toBe('RIGHT');
    expect(touch.getSnapshot().cutAllowed).toBe(true);

    touch.handleTouchMoveCss(1, 260, 740);
    touch.handleTouchMoveCss(1, 230, 740);
    expect(touch.getSnapshot().direction).toBe('LEFT');
    touch.handlePointerUp(1);
    expect(touch.getSnapshot().direction).toBeNull();

    // 2. CLASSIC_ARCADE on LEFT side -> tapping right arm fires 'RIGHT' immediately, cutAllowed false until KES!
    touch.configure('CLASSIC_ARCADE', 'LEFT');
    const visLeft = touch.gesture.getVisualState();
    expect(visLeft.padCenterX).toBeLessThan(195);
    const s = getLayout().cssScale;
    touch.handleTouchDownCss(
      2,
      visLeft.padCenterX + 32,
      visLeft.padCenterY,
      (visLeft.padCenterX + 32) / s,
      visLeft.padCenterY / s,
      true
    );
    expect(touch.getSnapshot().direction).toBe('RIGHT');
    expect(touch.getSnapshot().cutAllowed).toBe(false);

    // Second thumb presses dedicated KES button -> cutAllowed becomes true!
    touch.handleTouchDownCss(
      3,
      visLeft.cutBtnCenterX,
      visLeft.cutBtnCenterY,
      visLeft.cutBtnCenterX / s,
      visLeft.cutBtnCenterY / s,
      true
    );
    expect(touch.getSnapshot().cutAllowed).toBe(true);
    touch.handlePointerUp(2);
    touch.handlePointerUp(3);
    expect(touch.getSnapshot().direction).toBeNull();

    // 3. JOYSTICK_KES on RIGHT
    touch.configure('JOYSTICK_KES', 'RIGHT');
    const visJoy = touch.gesture.getVisualState();
    touch.handleTouchDownCss(
      4,
      visJoy.padCenterX,
      visJoy.padCenterY,
      visJoy.padCenterX / s,
      visJoy.padCenterY / s,
      true
    );
    touch.handleTouchMoveCss(4, visJoy.padCenterX, visJoy.padCenterY - 22);
    expect(touch.getSnapshot().direction).toBe('UP');
    touch.handlePointerUp(4);
    expect(touch.getSnapshot().direction).toBeNull();
  });

  it('enforces 0px Zero-Inertia Stop the instant thumb/key is released mid-cut, resuming cleanly on direction input', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    ship.initForLevel({ x: 450, y: 1200 }, 100);

    for (let i = 0; i < 10; i++) {
      ship.update(FIXED_DT, makeInput('UP', true), poly, []);
    }
    expect(ship.state).toBe('CUTTING');
    const stoppedX = ship.x;
    const stoppedY = ship.y;

    // Releasing direction (`null`) must freeze the ship at exact (stoppedX, stoppedY) — ZERO Continuous Cruise!
    for (let i = 0; i < 20; i++) {
      const ev = ship.update(FIXED_DT, makeInput(null, false), poly, []);
      expect(ev).toBeNull();
      expect(ship.x).toBe(stoppedX);
      expect(ship.y).toBe(stoppedY);
    }

    // Pressing UP again (even without holding KES/SPACE!) resumes and completes the cut cleanly!
    let completed = null;
    for (let i = 0; i < 320; i++) {
      const ev = ship.update(FIXED_DT, makeInput('UP', false), poly, []);
      if (ev) {
        completed = ev;
        break;
      }
    }
    expect(completed).not.toBeNull();
    expect(ship.state).toBe('ON_BORDER');
    expect(ship.y).toBe(0);
  });
});
