import { beforeEach, describe, expect, it, vi } from "vitest";
import { setPlatform } from "@/context/PlatformContext";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ImageBatch, PlatformService, ScanParams } from "@/types";

function platformStub(
  scanImages: PlatformService["scanImages"],
): PlatformService {
  return {
    capabilities: {
      canDeleteFiles: false,
      canRevealFile: false,
      canSelectFolder: true,
      hasCustomTitlebar: false,
      hasTitlebarActions: false,
      canAutoUpdate: false,
      canDragDropFolders: false,
      canBrowseArchives: false,
      canUseVibrancy: false,
    },
    scanImages,
    getImageUrl: (source) => source,
    getThumbUrl: () => "",
    deleteFile: async () => {},
    revealFile: async () => {},
    pickFolders: async () => null,
    onDragDrop: () => () => {},
    loadSettings: async () => ({}),
    saveSettings: async () => {},
    listDirectoryTree: async () => [],
    clearThumbnails: async () => {},
    clearExtracted: async () => {},
  };
}

beforeEach(() => {
  useAppStore.getState().reset();
  useViewerStore.getState().resetAndScan();
  useViewerStore.getState().reset();
  useSettingsStore.setState({
    formats: [".jpg"],
    sortMethod: "name-asc",
    pageSize: 50,
  });
});

describe("scanActions module surface", () => {
  it("exports the expected scan actions", async () => {
    const mod = await import("@/lib/scanActions");
    expect(typeof mod.startScan).toBe("function");
    expect(typeof mod.refresh).toBe("function");
    expect(typeof mod.incrementalRefresh).toBe("function");
    expect(typeof mod.openFolderAndScan).toBe("function");
    expect(typeof mod.startArchiveScan).toBe("function");
    expect(typeof mod.executeArchiveScan).toBe("function");
    expect(typeof mod.resetToDropZone).toBe("function");
    expect(typeof mod.expandLockedArchive).toBe("function");
  });
});

describe("reload semantics", () => {
  it("uses a full rescan for toolbar refresh actions", async () => {
    const scanImages = vi.fn(
      async (
        params: ScanParams,
        onBatch: (batch: ImageBatch) => void,
        onComplete: () => void,
        onCount?: (total: number) => void,
      ) => {
        onCount?.(1);
        onBatch({
          images: [
            {
              source: "/photos/a.jpg",
              relativePath: "a.jpg",
              width: 300,
              height: 200,
            },
          ],
          done: false,
        });
        onComplete();
      },
    );
    setPlatform(platformStub(scanImages));
    useAppStore.getState().setFolders(["/photos"]);
    useViewerStore.getState().appendImages([
      {
        source: "/photos/a.jpg",
        relativePath: "a.jpg",
        width: 100,
        height: 100,
      },
    ]);

    const { incrementalRefresh } = await import("@/lib/scanActions");
    await incrementalRefresh();

    expect(scanImages).toHaveBeenCalledTimes(1);
    expect(scanImages.mock.calls[0]?.[0]).toMatchObject({
      paths: ["/photos"],
      formats: [".jpg"],
      page_size: 50,
      sort_method: "name-asc",
    });
    expect(useViewerStore.getState().images).toEqual([
      {
        source: "/photos/a.jpg",
        relativePath: "a.jpg",
        width: 300,
        height: 200,
      },
    ]);
  });
});
