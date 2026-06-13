import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

/**
 * Tracks the window's native fullscreen state.
 *
 * There's no dedicated fullscreen event, but tao emits a resize event from
 * `windowDidEnterFullScreen` / `windowDidExitFullScreen` *after* flipping its
 * fullscreen flag, so re-querying `isFullscreen()` on each resize reflects the
 * already-updated state — no race, no polling.
 */
export function useIsFullscreen(): boolean {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let active = true;

    const sync = () => {
      void win
        .isFullscreen()
        .then((value) => {
          if (active) setFullscreen(value);
        })
        .catch(() => {});
    };

    sync();
    const unlisten = win.onResized(sync);

    return () => {
      active = false;
      void unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  return fullscreen;
}
