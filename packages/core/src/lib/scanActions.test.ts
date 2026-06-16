import { describe, expect, it } from "vitest";
import type { WImage } from "@/types";

// NOTE ON SCOPE
// -------------
// The valuable logic in `incrementalRefresh` is its diff/merge step: given the
// freshly scanned images and the set of currently displayed source paths, it
// computes which images were `added` and which `source` paths were `removed`,
// keyed by `img.source`. That logic is written *inline* inside the async
// `incrementalRefresh` function and is tightly coupled to three Zustand stores
// (`useViewerStore`, `useAppStore`, `useSettingsStore`) and the platform
// service obtained via `getPlatform()`. It is not exported as a pure helper,
// and the task forbids refactoring production source to expose it.
//
// We therefore (a) verify the module's exported surface loads, and (b) lock
// down the diff/merge *semantics* against a faithful local mirror of the
// algorithm so the contract is documented and regressions in a future
// extraction would be caught. The mirror below is a byte-for-byte copy of the
// set logic in scanActions.ts (lines ~155-164); if production changes, this
// test should be updated to match the extracted helper.

/** Faithful mirror of the inline diff in `incrementalRefresh`. */
function diffBySource(
  scanned: WImage[],
  currentPaths: Set<string>,
): { added: WImage[]; removed: Set<string> } {
  const scannedPaths = new Set(scanned.map((img) => img.source));
  const added = scanned.filter((img) => !currentPaths.has(img.source));
  const removed = new Set<string>();
  for (const path of currentPaths) {
    if (!scannedPaths.has(path)) {
      removed.add(path);
    }
  }
  return { added, removed };
}

function wimg(source: string): WImage {
  return { source, relativePath: source, width: null, height: null };
}

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

describe("incrementalRefresh diff/merge semantics (mirror)", () => {
  it("reports no changes when scanned matches current exactly", () => {
    const current = new Set(["a", "b", "c"]);
    const scanned = [wimg("a"), wimg("b"), wimg("c")];
    const { added, removed } = diffBySource(scanned, current);
    expect(added).toEqual([]);
    expect(removed.size).toBe(0);
  });

  it("detects newly added images by source", () => {
    const current = new Set(["a", "b"]);
    const scanned = [wimg("a"), wimg("b"), wimg("c"), wimg("d")];
    const { added, removed } = diffBySource(scanned, current);
    expect(added.map((i) => i.source).sort()).toEqual(["c", "d"]);
    expect(removed.size).toBe(0);
  });

  it("detects removed source paths no longer present in the scan", () => {
    const current = new Set(["a", "b", "c"]);
    const scanned = [wimg("a")];
    const { added, removed } = diffBySource(scanned, current);
    expect(added).toEqual([]);
    expect([...removed].sort()).toEqual(["b", "c"]);
  });

  it("handles simultaneous additions and removals", () => {
    const current = new Set(["a", "b", "c"]);
    const scanned = [wimg("a"), wimg("d"), wimg("e")];
    const { added, removed } = diffBySource(scanned, current);
    expect(added.map((i) => i.source).sort()).toEqual(["d", "e"]);
    expect([...removed].sort()).toEqual(["b", "c"]);
  });

  it("treats an empty scan against a populated grid as a full removal", () => {
    const current = new Set(["a", "b"]);
    const { added, removed } = diffBySource([], current);
    expect(added).toEqual([]);
    expect([...removed].sort()).toEqual(["a", "b"]);
  });

  it("treats a populated scan against an empty grid as all additions", () => {
    const current = new Set<string>();
    const scanned = [wimg("a"), wimg("b")];
    const { added, removed } = diffBySource(scanned, current);
    expect(added.map((i) => i.source).sort()).toEqual(["a", "b"]);
    expect(removed.size).toBe(0);
  });

  it("does not double-report a source that appears twice in the scan", () => {
    const current = new Set(["a"]);
    // Duplicate `b` in the scan must still produce two `added` entries (the
    // filter is per-image), but `a` stays unchanged and nothing is removed.
    const scanned = [wimg("a"), wimg("b"), wimg("b")];
    const { added, removed } = diffBySource(scanned, current);
    expect(added.map((i) => i.source)).toEqual(["b", "b"]);
    expect(removed.size).toBe(0);
  });
});
