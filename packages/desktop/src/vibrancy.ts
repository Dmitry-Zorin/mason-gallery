import { useSettingsStore } from "@mason-gallery/core";
import { Effect, EffectState, getCurrentWindow } from "@tauri-apps/api/window";

// Window vibrancy (the frosted-glass background) is macOS-only — the window is
// created with the hudWindow effect in tauri.conf.json. This keeps that effect
// in sync with the user's `vibrancy` setting at runtime: when disabled we clear
// the effect and tag <html> with `vibrancy-off` so native.css stops making the
// body transparent, leaving a normal solid (dark) window.
//
// Vibrancy is also forced off in native fullscreen. There the window lives in
// its own Space, where behind-window blending can't reliably sample the
// wallpaper: it flip-flops between a frosted look and a gray fallback as you
// swipe between Spaces / Mission Control. Forcing it off gives a consistent
// solid-dark fullscreen; the user's preference applies only when windowed.

const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toLowerCase().includes("mac");

/**
 * Reflects the `vibrancy` setting in the native window, suppressed while
 * fullscreen. Driven imperatively (no React mount point, mirrors windowTitle.ts)
 * off the settings store and the window's fullscreen state. No-op on non-macOS,
 * where the effect isn't available.
 */
export function initVibrancySync(): void {
  if (!isMac) return;

  const win = getCurrentWindow();
  let userEnabled = useSettingsStore.getState().vibrancy;
  let fullscreen = false;
  let current: boolean | null = null;

  const apply = () => {
    const enabled = userEnabled && !fullscreen;
    if (enabled === current) return;
    current = enabled;

    document.documentElement.classList.toggle("vibrancy-off", !enabled);

    const op = enabled
      ? win.setEffects({
          effects: [Effect.HudWindow],
          state: EffectState.Active,
        })
      : win.clearEffects();
    void op.catch(() => {});
  };

  apply();

  useSettingsStore.subscribe((s) => {
    userEnabled = s.vibrancy;
    apply();
  });

  // No dedicated fullscreen event, but tao emits a resize from
  // windowDidEnter/ExitFullScreen after flipping its flag, so re-querying
  // isFullscreen() on each resize reflects the settled state (mirrors
  // useIsFullscreen). Lifetime listener — no cleanup needed.
  const syncFullscreen = () => {
    void win
      .isFullscreen()
      .then((value) => {
        if (value !== fullscreen) {
          fullscreen = value;
          apply();
        }
      })
      .catch(() => {});
  };
  syncFullscreen();
  void win.onResized(syncFullscreen);
}
