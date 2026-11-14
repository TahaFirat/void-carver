import {
  computeLayout,
  getLayout,
  getPreferredJoystickSide,
  readSafeAreaInsets,
  setLayout
} from './core/ResponsiveLayout';
import { GameEngine } from './core/GameEngine';

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Missing #game-canvas element in DOM');
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  let cachedRect: DOMRect = canvas.getBoundingClientRect();

  /**
   * V5 universal responsive sizing: the canvas always covers the full visual viewport,
   * the virtual coordinate space adapts to the device aspect ratio (`ResponsiveLayout.ts`).
   */
  const resizeCanvas = (): void => {
    const vv = window.visualViewport;
    const cssW = Math.max(120, Math.round(vv?.width ?? window.innerWidth));
    const cssH = Math.max(160, Math.round(vv?.height ?? window.innerHeight));
    const layout = computeLayout(cssW, cssH, readSafeAreaInsets(), getPreferredJoystickSide());
    setLayout(layout);

    // Clamp DPR to 2.5 for razor-sharp pixels on Retina while saving mobile GPU heat & battery
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    cachedRect = canvas.getBoundingClientRect();

    const k = layout.cssScale * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
  };

  let resizeQueued = false;
  const queueResize = (): void => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      resizeCanvas();
    });
  };

  window.addEventListener('resize', queueResize);
  window.addEventListener('scroll', () => {
    cachedRect = canvas.getBoundingClientRect();
  });
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));
  window.visualViewport?.addEventListener('resize', queueResize);
  resizeCanvas();

  const engine = new GameEngine();

  const toVirtualCoords = (clientX: number, clientY: number): { vx: number; vy: number } => {
    const s = getLayout().cssScale || 1;
    return {
      vx: (clientX - cachedRect.left) / s,
      vy: (clientY - cachedRect.top) / s
    };
  };

  window.addEventListener(
    'pointerdown',
    (e) => {
      if (cachedRect.width === 0) {
        cachedRect = canvas.getBoundingClientRect();
      }
      const { vx, vy } = toVirtualCoords(e.clientX, e.clientY);
      engine.handlePointerDown(e.pointerId, vx, vy);
    },
    { passive: false }
  );

  window.addEventListener(
    'pointermove',
    (e) => {
      const { vx, vy } = toVirtualCoords(e.clientX, e.clientY);
      engine.handlePointerMove(e.pointerId, vx, vy);
    },
    { passive: false }
  );

  window.addEventListener('pointerup', (e) => engine.handlePointerUp(e.pointerId), {
    passive: true
  });
  window.addEventListener('pointercancel', (e) => engine.handlePointerUp(e.pointerId), {
    passive: true
  });
  window.addEventListener('blur', () => engine.resetPointerInputs());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      engine.resetPointerInputs();
    }
  });

  // Prevent browser context menu on long press
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  void engine.boot(ctx);
}

bootstrap();
