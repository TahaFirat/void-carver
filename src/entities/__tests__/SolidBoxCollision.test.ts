import { describe, it, expect } from 'vitest';
import { FIXED_DT } from '../../core/Config';
import { PlayerShip } from '../PlayerShip';
import { PowerUpBox } from '../PowerUpBox';
import {
  isPointBlockedBySolidBoxes,
  bounceCircleOffSolidBoxes,
  SOLID_BOX_HALF,
} from '../../geometry/SolidBoxes';
import {
  createInitialArenaPolygon,
  pointInPolygonStrict,
} from '../../geometry/PolygonMath';
import { Point } from '../../geometry/Types';
import { InputState } from '../../input/InputManager';

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
    debugSectorSelect: null,
  };
}

describe('V5 SolidBoxCollision Tests', () => {
  it('Ship in CUTTING state stops flush against solid wall box, does not die, and can turn 90 degrees', () => {
    const poly = createInitialArenaPolygon();
    const ship = new PlayerShip();
    // Start at bottom border: (450, 1200)
    ship.initForLevel({ x: 450, y: 1200 }, 100);
    expect(ship.state).toBe('ON_BORDER');

    // Create a solid wall box directly above the ship at (450, 1000)
    const solidBox = new PowerUpBox({
      x: 450,
      y: 1000,
      type: 'S',
    });

    ship.solidBoxes = [solidBox];

    // Launch UP into cutting
    ship.update(FIXED_DT * 2, makeInput('UP', true), poly, []);
    expect(ship.state).toBe('CUTTING');
    expect(ship.y).toBeLessThan(1200);

    // Keep stepping UP towards the box until flush
    for (let i = 0; i < 80; i++) {
      ship.update(FIXED_DT, makeInput('UP', true), poly, []);
    }

    // Ship must stop flush below the box: y >= 1000 + SOLID_BOX_HALF (1034)
    expect(ship.y).toBeGreaterThanOrEqual(1000 + SOLID_BOX_HALF);
    expect(ship.state).toBe('CUTTING');
    expect(ship.getActiveTrail().length).toBeGreaterThan(1);
    expect(ship.boxContactThisStep).toBe(true);

    // Turning orthogonal (90 degrees right: RIGHT) should move ship sideways around the box
    const yBeforeTurn = ship.y;
    const xBeforeTurn = ship.x;
    for (let i = 0; i < 5; i++) {
      ship.update(FIXED_DT, makeInput('RIGHT', true), poly, []);
    }
    expect(ship.x).toBeGreaterThan(xBeforeTurn);
    expect(ship.y).toBe(yBeforeTurn);
    expect(ship.state).toBe('CUTTING');
  });

  it('bounceCircleOffSolidBoxes bounces minion/bullet velocity elastically off box walls', () => {
    const box = new PowerUpBox({
      x: 300,
      y: 300,
      type: 'BOSS_CANNON',
    });

    // Minion moving right towards box: pos (260, 300), vx = 100, vy = 0
    // Box left edge is 300 - 34 = 266. With radius 16: 260 + 16 = 276 penetrates box!
    const body = { x: 260, y: 300, vx: 100, vy: 0 };
    const radius = 16;

    const bounced = bounceCircleOffSolidBoxes(body, radius, [box]);
    expect(bounced).toBe(true);
    // x velocity should be inverted to negative
    expect(body.vx).toBeLessThan(0);
    expect(body.x).toBeLessThanOrEqual(300 - SOLID_BOX_HALF - radius);
  });

  it('Enclosing solid wall box in claimedPolygon collects it and removes it from solidBoxes', () => {
    const box1 = new PowerUpBox({
      x: 300,
      y: 300,
      type: 'S',
    });
    const box2 = new PowerUpBox({
      x: 700,
      y: 700,
      type: 'S',
    });

    let solidBoxes: PowerUpBox[] = [box1, box2];

    // Polygon that fully encloses box1 [200,200] -> [400,400]
    const claimedPoly: Point[] = [
      { x: 200, y: 200 },
      { x: 400, y: 200 },
      { x: 400, y: 400 },
      { x: 200, y: 400 },
    ];

    // Check which boxes are inside claimed polygon
    const collected: PowerUpBox[] = [];
    solidBoxes = solidBoxes.filter((b) => {
      const inside = pointInPolygonStrict(b.center, claimedPoly);
      if (inside) {
        b.collected = true;
        collected.push(b);
        return false;
      }
      return true;
    });

    expect(collected.length).toBe(1);
    expect(collected[0].x).toBe(300);
    expect(collected[0].y).toBe(300);
    expect(solidBoxes.length).toBe(1);
    expect(solidBoxes[0].x).toBe(700);
    expect(isPointBlockedBySolidBoxes({ x: 300, y: 300 }, solidBoxes)).toBe(false);
  });
});
