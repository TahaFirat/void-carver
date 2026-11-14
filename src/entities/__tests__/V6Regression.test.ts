import { describe, expect, it } from 'vitest';
import { TouchGestureEngine } from '../../input/TouchGestureEngine';
import { EndlessBossDirector } from '../../levels/EndlessBossDirector';
import { BorderAndCutNavigator, GridPoint } from '../BorderAndCutNavigator';

describe('Mathematical & Gameplay Regression Suite', () => {
  it('TEST 1: SINGLE_HAND_DRAG registers 90-degree thumb turns cleanly and never overlaps status strip', () => {
    const touch = new TouchGestureEngine();
    touch.configure('SINGLE_HAND_DRAG', 'CENTER');
    touch.updateViewportBounds(390, 844, 610);
    touch.handleTouchStart(1, 200, 700, 0);
    touch.handleTouchMove(1, 235, 700, 16);
    touch.handleTouchMove(1, 270, 700, 32);
    expect(touch.getDirection()).toBe('RIGHT');

    // Slide thumb UP along a natural +3px arc -> immediately registers UP!
    touch.handleTouchMove(1, 271, 692, 64);
    touch.handleTouchMove(1, 273, 682, 80);
    expect(touch.getDirection()).toBe('UP');

    // Visual ring must NEVER overlap status strip (y <= 610)
    const vis = touch.getVisualState();
    expect(vis.padCenterY).toBeGreaterThanOrEqual(610 + 52);
  });

  it('TEST 2: Narrow 14px vertical peninsula tip launches straight UP into CUTTING without corner ping-pong, and outer corner stops cleanly', () => {
    const concavePeninsulaPoly: GridPoint[] = [
      { x: 0, y: 0 },
      { x: 540, y: 0 },
      { x: 540, y: 700 },
      { x: 214, y: 700 },
      { x: 214, y: 300 },
      { x: 200, y: 300 },
      { x: 200, y: 700 },
      { x: 0, y: 700 }
    ];

    const nav = new BorderAndCutNavigator({ x: 200, y: 306 });
    const step1 = nav.step(1 / 60, 1200, 'UP', true, concavePeninsulaPoly, [], [], null);
    expect(step1.mode).toBe('CUTTING');
    expect(step1.pos.x).toBe(200);
    expect(step1.pos.y).toBeLessThan(300);

    const navMidTip = new BorderAndCutNavigator({ x: 206, y: 300 });
    const stepTip = navMidTip.step(1 / 60, 360, 'UP', true, concavePeninsulaPoly, [], [], null);
    expect(stepTip.mode).toBe('CUTTING');
    expect(stepTip.pos.x).toBe(206);
    expect(stepTip.pos.y).toBeLessThan(300);

    // Outer top-left corner (0,0) pressing UP must STOP cleanly at (0,0) and NEVER spin/wrap!
    const navOuter = new BorderAndCutNavigator({ x: 0, y: 10 });
    navOuter.step(1 / 60, 1200, 'UP', true, concavePeninsulaPoly, [], [], null);
    const afterCorner = navOuter.step(1 / 60, 1200, 'UP', true, concavePeninsulaPoly, [], [], null);
    expect(afterCorner.mode).toBe('ON_BORDER');
    expect(afterCorner.pos.x).toBe(0);
    expect(afterCorner.pos.y).toBe(0);
  });

  it('TEST 3: Endless Boss Director escalates continuously to İMKÂNSIZ & gates Phase 2 strictly to Group C Apex waves', () => {
    const director = new EndlessBossDirector();
    const w1Easy = director.buildWave(1, 'EASY');
    const w15Easy = director.buildWave(15, 'EASY');
    const w1Hard = director.buildWave(1, 'HARD');
    const w14Hard = director.buildWave(14, 'HARD');
    const w10Hard = director.buildWave(10, 'HARD'); // ABYSSAL_OVERMIND (Group C Apex!)

    expect(w15Easy.threatIndex).toBeGreaterThan(w1Easy.threatIndex * 3);
    expect(w1Easy.phases[1].projectilePattern).not.toBe(w1Hard.phases[1].projectilePattern);
    expect(w14Hard.threatLabelTr).toBe('İMKÂNSIZ');
    expect(w1Easy.canEvolvePhase2).toBe(false);
    expect(w10Hard.canEvolvePhase2).toBe(true);
    expect(director.resolveActivePhase(65, 1.0, w10Hard)).toBe(2);
    expect(director.resolveActivePhase(82, 1.0, w10Hard)).toBe(3);
  });
});
