import {
  getPlatform,
  incrementalRefresh,
  openFolderAndScan,
  resetToDropZone,
  startArchiveScan,
  useAppStore,
} from "@mason-gallery/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

/**
 * Dispatch a native-menu action id (emitted by the Rust menu on macOS) to
 * the matching app action. Mirrors the in-window MenuBar used on other
 * platforms.
 */
async function dispatch(action: string): Promise<void> {
  switch (action) {
    case "open_folder":
      await openFolderAndScan();
      break;
    case "open_archive": {
      const path = await getPlatform().pickArchive?.();
      if (path) await startArchiveScan(path);
      break;
    }
    case "reset":
      resetToDropZone();
      window.location.hash = "/";
      break;
    case "refresh":
      await incrementalRefresh();
      break;
    case "toggle_sidebar":
      useAppStore.getState().toggleSidebar();
      break;
    case "settings":
      useAppStore.getState().toggleSettings();
      break;
    case "about":
      window.location.hash = "/about";
      break;
    case "devtools":
      await invoke("open_devtools");
      break;
  }
}

/**
 * Listen for native macOS menu events. No-op on platforms without the
 * native menu (the `menu` event is never emitted there).
 */
export function useNativeMenu(): void {
  useEffect(() => {
    const unlisten = listen<string>("menu", (event) => {
      dispatch(event.payload).catch(console.error);
    });
    return () => {
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);
}
