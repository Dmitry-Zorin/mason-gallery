import { getPlatform } from "@/context/PlatformContext";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";

/**
 * Move the image at the given viewer-store index to trash and drop it from the
 * store. Returns false (and no-ops) when deletion isn't supported or the index
 * is stale. Usable outside React — the grid context menu and the shared
 * confirmation dialog both call it.
 */
export async function deleteImageAt(index: number): Promise<boolean> {
  const platform = getPlatform();
  if (!platform.capabilities.canDeleteFiles) return false;
  const img = useViewerStore.getState().images[index];
  if (!img) return false;
  try {
    await platform.deleteFile(img.source);
    useViewerStore.getState().removeImage(index);
    return true;
  } catch (err) {
    console.error("Failed to delete image:", err);
    return false;
  }
}

/**
 * Grid-tile delete entry point. Honours the `confirmDelete` setting: when on it
 * routes through the shared confirmation dialog (mounted in HomePage) by
 * stashing the index in the app store; otherwise it deletes immediately.
 */
export function requestDeleteImageAt(index: number): void {
  if (useSettingsStore.getState().confirmDelete) {
    useAppStore.setState({ pendingDeleteIndex: index });
  } else {
    void deleteImageAt(index);
  }
}
