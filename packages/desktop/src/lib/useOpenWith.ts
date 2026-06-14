import { startScan } from "@mason-gallery/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

/**
 * Handle folders opened from outside the app (macOS): "Open With →
 * MasonGallery" on an image scans the image's parent folder, and a folder
 * dropped on the Dock icon scans that folder. The Rust side (open_with.rs)
 * derives the folder paths and either buffers them — when the open races a
 * cold start, before this listener exists — or emits `open-paths` live.
 *
 * Attaching the listener first, then calling `open_with_ready`, guarantees the
 * handshake order the backend relies on: nothing emitted after readiness can
 * be missed, and anything buffered before it is drained exactly once.
 */
export function useOpenWith(): void {
  useEffect(() => {
    const unlistenPromise = listen<string[]>("open-paths", (event) => {
      if (event.payload.length > 0) startScan(event.payload);
    });

    unlistenPromise
      .then(() => invoke<string[]>("open_with_ready"))
      .then((pending) => {
        if (pending.length > 0) startScan(pending);
      })
      .catch((err) => console.error("open-with init failed:", err));

    return () => {
      unlistenPromise.then((fn) => fn()).catch(() => {});
    };
  }, []);
}
