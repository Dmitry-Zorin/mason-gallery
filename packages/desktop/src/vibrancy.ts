import { useSettingsStore } from "@mason-gallery/core";
import { Effect, EffectState, getCurrentWindow } from "@tauri-apps/api/window";

// Window vibrancy (the frosted-glass background) is macOS-only — the window is
// created with the hudWindow effect in tauri.conf.json. This keeps that effect
// in sync with the user's `vibrancy` setting at runtime: when disabled we clear
// the effect and tag <html> with `vibrancy-off` so native.css stops making the
// body transparent, leaving a normal solid window.

const isMac =
  typeof navigator !== "undefined" &&
  navigator.platform.toLowerCase().includes("mac");

/**
 * Reflects the `vibrancy` setting in the native window. Driven imperatively off
 * the settings store so it needs no React mount point (mirrors windowTitle.ts).
 * No-op on non-macOS, where the effect isn't available.
 */
export function initVibrancySync(): void {
  if (!isMac) return;

  let current: boolean | null = null;
  const apply = (enabled: boolean) => {
    if (enabled === current) return;
    current = enabled;

    document.documentElement.classList.toggle("vibrancy-off", !enabled);

    const win = getCurrentWindow();
    const op = enabled
      ? win.setEffects({
          effects: [Effect.HudWindow],
          state: EffectState.Active,
        })
      : win.clearEffects();
    void op.catch(() => {});
  };

  apply(useSettingsStore.getState().vibrancy);
  useSettingsStore.subscribe((s) => apply(s.vibrancy));
}
