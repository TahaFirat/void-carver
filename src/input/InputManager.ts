import { Direction } from '../geometry/Types';
import { CarveButtonMode, ControlMode, JoystickSide } from '../services/StorageService';
import { TouchControls } from './TouchControls';

export interface InputState {
  direction: Direction | null;
  /** Second-most-recent held keyboard direction (`Last-Key-Wins` stack) for diagonal safe-border corner rounding. */
  secondaryDirection?: Direction | null;
  carveHeld: boolean;
  autoCarveSwipe?: boolean;
  pauseJustPressed: boolean;
  debugSectorSelect: number | null;
}

export class InputManager {
  public readonly touch = new TouchControls();

  private readonly dirStack: Direction[] = [];
  private carveKeys = new Set<string>();
  private mouseCutHeld = false;
  private pauseQueued = false;
  private debugSectorQueued: number | null = null;
  private gamepadPauseWasPressed = false;

  constructor() {
    this.bindKeyboard();
  }

  public configure(
    mode: ControlMode,
    _carveMode: CarveButtonMode,
    _autoCut = false,
    joystickSide: JoystickSide = 'LEFT'
  ): void {
    this.touch.configure(mode, joystickSide);
  }

  public resetActiveInputs(): void {
    this.dirStack.length = 0;
    this.carveKeys.clear();
    this.mouseCutHeld = false;
    this.touch.reset();
  }

  public poll(_dt: number): InputState {
    const touchSnap = this.touch.getSnapshot();
    const gpSnap = this.pollGamepad();

    const kbDir = this.dirStack.length > 0 ? this.dirStack[this.dirStack.length - 1] : null;
    const kbSecondaryDir =
      this.dirStack.length >= 2 ? this.dirStack[this.dirStack.length - 2] : null;
    const usingTouch = touchSnap.direction !== null;

    // Priority: active touch -> most recent keyboard direction (`Last-Key-Wins`) -> gamepad
    const direction: Direction | null = touchSnap.direction ?? kbDir ?? gpSnap.direction;
    const secondaryDirection: Direction | null = usingTouch ? null : kbSecondaryDir;

    // V7 Law 1 & PC Keyboard Purity:
    // Bare keyboard directional keys NEVER set `carveHeld`!
    // Launching off the safe border requires explicit `cutIntent` (`Space / Shift / Z / J / Enter` or `KES`).
    const kbCutHeld = this.carveKeys.size > 0 || (this.mouseCutHeld && kbDir !== null);
    const carveHeld = usingTouch
      ? touchSnap.cutAllowed || kbCutHeld || gpSnap.carveHeld
      : touchSnap.cutAllowed || kbCutHeld || gpSnap.carveHeld;

    const pauseJustPressed = this.pauseQueued || gpSnap.pauseJustPressed;
    this.pauseQueued = false;

    const debugSectorSelect = this.debugSectorQueued;
    this.debugSectorQueued = null;

    return {
      direction,
      secondaryDirection,
      carveHeld,
      autoCarveSwipe: false,
      pauseJustPressed,
      debugSectorSelect
    };
  }

  private bindKeyboard(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e) => {
      const dir = this.mapKeyToDir(e.code, e.key);
      if (dir) {
        e.preventDefault();
        const idx = this.dirStack.indexOf(dir);
        if (idx !== -1) {
          this.dirStack.splice(idx, 1);
        }
        this.dirStack.push(dir);
        return;
      }

      const carveToken = this.normalizeCarveKey(e.code, e.key);
      if (carveToken) {
        if (carveToken === 'Space' || carveToken === 'Enter') e.preventDefault();
        this.carveKeys.add(carveToken);
        return;
      }

      if (
        e.code === 'Escape' ||
        e.code === 'KeyP' ||
        e.key === 'Escape' ||
        e.key === 'p' ||
        e.key === 'P'
      ) {
        this.pauseQueued = true;
        return;
      }

      if (e.code.startsWith('Digit')) {
        const digit = Number(e.code.replace('Digit', ''));
        if (digit >= 1 && digit <= 9) {
          if (e.altKey && digit <= 7) {
            this.debugSectorQueued = 9 + digit;
          } else if (e.shiftKey) {
            this.debugSectorQueued = digit;
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      const dir = this.mapKeyToDir(e.code, e.key);
      if (dir) {
        const idx = this.dirStack.indexOf(dir);
        if (idx !== -1) {
          this.dirStack.splice(idx, 1);
        }
        return;
      }

      const carveToken = this.normalizeCarveKey(e.code, e.key);
      if (carveToken && this.carveKeys.has(carveToken)) {
        this.carveKeys.delete(carveToken);
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseCutHeld = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseCutHeld = false;
      }
    });

    window.addEventListener('blur', () => {
      this.dirStack.length = 0;
      this.carveKeys.clear();
      this.mouseCutHeld = false;
    });
  }

  private normalizeCarveKey(code: string, key: string): string | null {
    if (code === 'Space' || key === ' ' || key === 'Spacebar') return 'Space';
    if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'Shift') return code || 'Shift';
    if (code === 'KeyZ' || key === 'z' || key === 'Z') return 'KeyZ';
    if (code === 'KeyJ' || key === 'j' || key === 'J') return 'KeyJ';
    if (code === 'Enter' || key === 'Enter') return 'Enter';
    return null;
  }

  private mapKeyToDir(code: string, key = ''): Direction | null {
    switch (code || key) {
      case 'ArrowUp':
      case 'KeyW':
      case 'w':
      case 'W':
        return 'UP';
      case 'ArrowDown':
      case 'KeyS':
      case 's':
      case 'S':
        return 'DOWN';
      case 'ArrowLeft':
      case 'KeyA':
      case 'a':
      case 'A':
        return 'LEFT';
      case 'ArrowRight':
      case 'KeyD':
      case 'd':
      case 'D':
        return 'RIGHT';
      default:
        if (key === 'ArrowUp' || key === 'w' || key === 'W') return 'UP';
        if (key === 'ArrowDown' || key === 's' || key === 'S') return 'DOWN';
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'LEFT';
        if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'RIGHT';
        return null;
    }
  }

  private pollGamepad(): {
    direction: Direction | null;
    carveHeld: boolean;
    pauseJustPressed: boolean;
  } {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return { direction: null, carveHeld: false, pauseJustPressed: false };
    }

    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;

      let dir: Direction | null = null;
      if (pad.buttons[12]?.pressed) dir = 'UP';
      else if (pad.buttons[13]?.pressed) dir = 'DOWN';
      else if (pad.buttons[14]?.pressed) dir = 'LEFT';
      else if (pad.buttons[15]?.pressed) dir = 'RIGHT';
      else {
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        if (Math.hypot(ax, ay) > 0.35) {
          dir = Math.abs(ax) >= Math.abs(ay) ? (ax > 0 ? 'RIGHT' : 'LEFT') : ay > 0 ? 'DOWN' : 'UP';
        }
      }

      const carve = Boolean(
        pad.buttons[0]?.pressed ||
          pad.buttons[1]?.pressed ||
          pad.buttons[5]?.pressed ||
          pad.buttons[7]?.pressed
      );

      const pauseNow = Boolean(pad.buttons[9]?.pressed);
      const pauseJustPressed = pauseNow && !this.gamepadPauseWasPressed;
      this.gamepadPauseWasPressed = pauseNow;

      return { direction: dir, carveHeld: carve, pauseJustPressed };
    }

    this.gamepadPauseWasPressed = false;
    return { direction: null, carveHeld: false, pauseJustPressed: false };
  }
}
