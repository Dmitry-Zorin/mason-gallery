import { useAppStore } from "@mason-gallery/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

const APP_NAME = "MasonGallery";

type AppState = ReturnType<typeof useAppStore.getState>;

function basename(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, "");
  const sep = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return sep >= 0 ? trimmed.slice(sep + 1) : trimmed;
}

function titleFor(state: AppState): string {
  const source = state.archivePath ?? state.folders[0] ?? null;
  return source ? `${basename(source)} — ${APP_NAME}` : APP_NAME;
}

/**
 * Reflects the open folder/archive in the native window title, like a native
 * document app — it surfaces in ⌘-Tab, Mission Control and the Window menu
 * even when the title text is hidden in the overlay title bar (hiddenTitle).
 *
 * Driven imperatively off the store so it needs no React mount point.
 */
export function initWindowTitleSync(): void {
  let current = "";
  const apply = (state: AppState) => {
    const next = titleFor(state);
    if (next === current) return;
    current = next;
    void getCurrentWindow()
      .setTitle(next)
      .catch(() => {});
  };
  apply(useAppStore.getState());
  useAppStore.subscribe(apply);
}
