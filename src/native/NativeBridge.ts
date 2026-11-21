import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { OrientationType, ScreenOrientation } from '@capawesome/capacitor-screen-orientation';

export interface NativeLifecycleHandlers {
  onAppPause: (fullyHidden?: boolean) => void;
  onAppResume: () => void;
  onBackButton: () => void;
}

class NativeBridgeImpl {
  private initialized = false;
  private splashHidden = false;
  private hapticsEnabled = true;

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public setHapticsEnabled(enabled: boolean): void {
    this.hapticsEnabled = enabled;
  }

  public async initialize(handlers: NativeLifecycleHandlers): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Web & WKWebView lifecycle listeners: distinguish full backgrounding (`hidden`) vs soft window blur
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handlers.onAppPause(true);
      } else {
        handlers.onAppResume();
      }
    });

    window.addEventListener('pagehide', () => {
      handlers.onAppPause(true);
    });

    window.addEventListener('beforeunload', () => {
      handlers.onAppPause(true);
    });

    window.addEventListener('pageshow', () => {
      if (!document.hidden) {
        handlers.onAppResume();
      }
    });

    window.addEventListener('blur', () => {
      handlers.onAppPause(Boolean(document.hidden));
    });

    window.addEventListener('focus', () => {
      if (!document.hidden) {
        handlers.onAppResume();
      }
    });

    if (!this.isNative()) {
      return;
    }

    try {
      await ScreenOrientation.lock({ type: OrientationType.PORTRAIT });
    } catch {
      // Orientation lock not supported on current device/window mode
    }

    try {
      await StatusBar.hide();
    } catch {
      // System bars managed automatically on edge-to-edge Android 16+
    }

    try {
      await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          handlers.onAppResume();
        } else {
          handlers.onAppPause(true);
        }
      });

      await App.addListener('backButton', () => {
        handlers.onBackButton();
      });
    } catch {
      // Ignore listener errors on unsupported environments
    }
  }

  public async hideSplashOnceReady(): Promise<void> {
    if (this.splashHidden) return;
    this.splashHidden = true;
    if (!this.isNative()) return;

    try {
      await SplashScreen.hide({ fadeOutDuration: 250 });
    } catch {
      // Ignore if already hidden
    }
  }

  public hapticCornerTurn(): void {
    if (!this.hapticsEnabled) return;
    if (this.isNative()) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    }
  }

  private canWebVibrate(): boolean {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } })
      .userActivation;
    return Boolean(ua?.hasBeenActive);
  }

  public hapticPowerUp(): void {
    if (!this.hapticsEnabled) return;
    if (this.isNative()) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    } else if (this.canWebVibrate()) {
      try {
        navigator.vibrate(18);
      } catch {
        // Ignore
      }
    }
  }

  public hapticPolygonShatter(percentClaimed: number): void {
    if (!this.hapticsEnabled) return;
    if (this.isNative()) {
      const style = percentClaimed >= 10 ? ImpactStyle.Heavy : ImpactStyle.Light;
      Haptics.impact({ style }).catch(() => {});
    } else if (percentClaimed >= 10 && this.canWebVibrate()) {
      try {
        navigator.vibrate(28);
      } catch {
        // Ignore
      }
    }
  }

  public hapticDanger(): void {
    if (!this.hapticsEnabled) return;
    if (this.isNative()) {
      Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    } else if (this.canWebVibrate()) {
      try {
        navigator.vibrate([45, 30, 65]);
      } catch {
        // Ignore
      }
    }
  }
}

export const NativeBridge = new NativeBridgeImpl();
