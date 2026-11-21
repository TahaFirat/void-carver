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
  let engineRef: GameEngine | null = null;

  /**
   * V6 universal responsive sizing: the canvas covers the full visual viewport,
   * and physical CSS pixel bounds are synced directly to `TouchGestureEngine`.
   */
  const resizeCanvas = (): void => {
    const vv = window.visualViewport;
    const cssW = Math.max(120, Math.round(vv?.width ?? window.innerWidth));
    const cssH = Math.max(160, Math.round(vv?.height ?? window.innerHeight));
    const layout = computeLayout(cssW, cssH, readSafeAreaInsets(), getPreferredJoystickSide());
    setLayout(layout);
    engineRef?.syncViewportLayout();

    // Clamp DPR to 2.0: razor-sharp Retina vector typography while cutting 3x Pro Max GPU fill-rate & heat by 55%!
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
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
  engineRef = engine;
  engine.syncViewportLayout();

  const toCoords = (
    clientX: number,
    clientY: number
  ): { cssX: number; cssY: number; vx: number; vy: number } => {
    const s = getLayout().cssScale || 1;
    const cssX = clientX - cachedRect.left;
    const cssY = clientY - cachedRect.top;
    return {
      cssX,
      cssY,
      vx: cssX / s,
      vy: cssY / s
    };
  };

  // Native Touch pipeline (`passive: false` + `preventDefault()`):
  // Mandatory on iOS WKWebView / Safari to suppress the iOS text-selection magnifier loupe,
  // edit callout menu, double-tap zoom, and premature `pointercancel` drops while holding a thumb!
  window.addEventListener(
    'touchstart',
    (e) => {
      if (e.cancelable) e.preventDefault();
      if (cachedRect.width === 0) {
        cachedRect = canvas.getBoundingClientRect();
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const { cssX, cssY, vx, vy } = toCoords(t.clientX, t.clientY);
        engine.handlePointerDown(1000 + t.identifier, vx, vy, cssX, cssY);
      }
    },
    { passive: false }
  );

  window.addEventListener(
    'touchmove',
    (e) => {
      if (e.cancelable) e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const { cssX, cssY, vx, vy } = toCoords(t.clientX, t.clientY);
        engine.handlePointerMove(1000 + t.identifier, vx, vy, cssX, cssY);
      }
    },
    { passive: false }
  );

  const endTouches = (e: TouchEvent): void => {
    if (e.cancelable) e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      engine.handlePointerUp(1000 + t.identifier);
    }
  };
  window.addEventListener('touchend', endTouches, { passive: false });
  window.addEventListener('touchcancel', endTouches, { passive: false });

  // Desktop mouse / pen fallback (skips `touch` pointerType already handled above)
  let mouseButtonHeld = false;
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') return;
      if (e.cancelable) e.preventDefault();
      if (cachedRect.width === 0) {
        cachedRect = canvas.getBoundingClientRect();
      }
      mouseButtonHeld = true;
      const { cssX, cssY, vx, vy } = toCoords(e.clientX, e.clientY);
      engine.handlePointerDown(e.pointerId, vx, vy, cssX, cssY);
    },
    { passive: false }
  );

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      if (!mouseButtonHeld) return;
      const { cssX, cssY, vx, vy } = toCoords(e.clientX, e.clientY);
      engine.handlePointerMove(e.pointerId, vx, vy, cssX, cssY);
    },
    { passive: false }
  );

  window.addEventListener(
    'pointerup',
    (e) => {
      if (e.pointerType === 'touch') return;
      mouseButtonHeld = false;
      engine.handlePointerUp(e.pointerId);
    },
    { passive: true }
  );
  window.addEventListener(
    'pointercancel',
    (e) => {
      if (e.pointerType === 'touch') return;
      mouseButtonHeld = false;
      engine.handlePointerUp(e.pointerId);
    },
    { passive: true }
  );
  window.addEventListener('blur', () => {
    mouseButtonHeld = false;
    engine.resetPointerInputs();
  });
  window.addEventListener('focus', () => {
    engine.notifyUserInteraction();
  });
  window.addEventListener('keydown', () => {
    engine.notifyUserInteraction();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      mouseButtonHeld = false;
      engine.resetPointerInputs();
    } else {
      engine.notifyUserInteraction();
    }
  });

  // Block all browser selection, callout, drag & pinch gestures
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('selectstart', (e) => e.preventDefault());
  document.addEventListener('dragstart', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false } as AddEventListenerOptions);

  void engine.boot(ctx);
}

bootstrap();
