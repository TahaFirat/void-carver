import { computeLayout, getLayout, readSafeAreaInsets, setLayout } from './core/ResponsiveLayout';
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

  /**
   * V5 universal responsive sizing: the canvas always covers the full visual viewport,
   * the virtual coordinate space adapts to the device aspect ratio (`ResponsiveLayout.ts`).
   */
  const resizeCanvas = (): void => {
    const vv = window.visualViewport;
    const cssW = Math.max(120, Math.round(vv?.width ?? window.innerWidth));
    const cssH = Math.max(160, Math.round(vv?.height ?? window.innerHeight));
    const layout = computeLayout(cssW, cssH, readSafeAreaInsets());
    setLayout(layout);

    // Clamp DPR to 3 for crisp pixels on Retina while protecting GPU fill-rate
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

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
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 120));
  window.visualViewport?.addEventListener('resize', queueResize);
  resizeCanvas();

  const engine = new GameEngine();

  const toVirtualCoords = (clientX: number, clientY: number): { vx: number; vy: number } => {
    const rect = canvas.getBoundingClientRect();
    const s = getLayout().cssScale || 1;
    return {
      vx: (clientX - rect.left) / s,
      vy: (clientY - rect.top) / s
    };
  };

  window.addEventListener(
    'pointerdown',
    (e) => {
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

  window.addEventListener('pointerup', (e) => engine.handlePointerUp(e.pointerId), { passive: true });
  window.addEventListener('pointercancel', (e) => engine.handlePointerUp(e.pointerId), {
    passive: true
  });

  // Prevent browser context menu on long press
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  void engine.boot(ctx);
}

bootstrap();
