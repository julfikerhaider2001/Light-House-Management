// Native (Capacitor) integration. Plugins load only inside the Android app, so the web
// bundle pays nothing for them.

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
}

export function isNative(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** Status bar, splash and the hardware back button. Call once at startup. */
export async function initNative(): Promise<void> {
  if (!isNative()) return;
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
  ]);

  await StatusBar.setOverlaysWebView({ overlay: false }).catch(() => undefined);
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined);
  await StatusBar.setBackgroundColor({ color: '#050807' }).catch(() => undefined);
  await SplashScreen.hide().catch(() => undefined);

  await App.addListener('backButton', ({ canGoBack }) => {
    // An open sheet closes first (same as Escape), then history, then the app exits.
    if (document.querySelector('[role="dialog"]')) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    } else if (canGoBack) {
      history.back();
    } else {
      void App.exitApp();
    }
  });
}

export type HapticKind = 'tap' | 'success' | 'warning';

/** Haptics for meaningful moments only: a saved meal, a saved entry, a closed month, a delete. */
export function haptic(kind: HapticKind): void {
  if (!isNative()) return;
  void import('@capacitor/haptics').then(({ Haptics, ImpactStyle, NotificationType }) => {
    if (kind === 'tap') return Haptics.impact({ style: ImpactStyle.Light });
    return Haptics.notification({
      type: kind === 'success' ? NotificationType.Success : NotificationType.Warning,
    });
  });
}
