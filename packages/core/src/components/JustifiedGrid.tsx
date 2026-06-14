import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import ImageTile from "@/components/ImageTile";
import {
  useContainerScroll,
  useContainerSize,
} from "@/hooks/useContainerObservers";
import {
  computeJustifiedLayout,
  type JustifiedRow,
} from "@/lib/justifiedLayout";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { GridGeometry, ImageCellData } from "@/types";

/** Tailwind `p-2` is 8px; the content box is the container minus padding both
 * sides. Kept in sync with the wrapper className below. */
const PADDING = 8;

/** Index of the last row whose `top` is <= offset (clamped to a valid row). */
function rowIndexAtOffset(rows: JustifiedRow[], offset: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid];
    if (row !== undefined && row.top <= offset) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

/** Index of the first row whose bottom edge is >= offset (i.e. first visible). */
function firstRowFromOffset(rows: JustifiedRow[], offset: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  let ans = rows.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid];
    if (row !== undefined && row.top + row.height >= offset) {
      ans = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return ans;
}

interface JustifiedGridProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  images: ImageCellData[];
  onGeometryReady?: (geometry: GridGeometry) => void;
}

export default function JustifiedGrid({
  scrollContainerRef,
  images,
  onGeometryReady,
}: JustifiedGridProps) {
  const scanId = useViewerStore((s) => s.scanId);
  const isRelayout = useViewerStore((s) => s.isRelayout);
  const columnGutter = useSettingsStore((s) => s.columnGutter);
  const rowHeight = useSettingsStore((s) => s.rowHeight);
  const selectedFolder = useAppStore((s) => s.selectedFolder);

  const { scrollTop } = useContainerScroll(scrollContainerRef);
  const { width, height } = useContainerSize(scrollContainerRef);

  const savedScrollRef = useRef<number | null>(null);
  const prevScanIdRef = useRef(scanId);

  // Capture scroll position before layout resets on relayout.
  if (scanId !== prevScanIdRef.current) {
    if (isRelayout && scrollContainerRef.current) {
      savedScrollRef.current = scrollContainerRef.current.scrollTop;
    } else {
      savedScrollRef.current = null;
    }
    prevScanIdRef.current = scanId;
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: scanId triggers the restore
  useLayoutEffect(() => {
    if (savedScrollRef.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
    }
  }, [scanId, scrollContainerRef]);

  // Reset scroll to top when the folder filter changes.
  const prevFolderRef = useRef(selectedFolder);
  if (selectedFolder !== prevFolderRef.current) {
    prevFolderRef.current = selectedFolder;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }

  const contentWidth = Math.max(width - PADDING * 2, 1);

  // Geometry is computed up front from intrinsic dimensions — no DOM
  // measurement — so it can drive windowing directly. Recomputed only when an
  // input that affects layout changes, never on scroll.
  const layout = useMemo(
    () => computeJustifiedLayout(images, contentWidth, columnGutter, rowHeight),
    [images, contentWidth, columnGutter, rowHeight],
  );

  // Layout-agnostic geometry adapter for HomePage's index indicator + Ctrl+G.
  const geometry = useMemo<GridGeometry>(() => {
    const rows = layout.rows;
    const rowStarts = rows.map((r) => r.items[0]?.index ?? 0);
    return {
      totalHeight: layout.totalHeight,
      indexAtOffset: (offset) => {
        if (rows.length === 0) return 0;
        return rowStarts[rowIndexAtOffset(rows, offset)] ?? 0;
      },
      offsetForIndex: (index) => {
        if (rows.length === 0) return undefined;
        // rowStarts is ascending; find the last row that starts at/below index.
        let lo = 0;
        let hi = rows.length - 1;
        let ans = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const rs = rowStarts[mid];
          if (rs !== undefined && rs <= index) {
            ans = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        const row = rows[ans];
        return row ? { top: row.top, height: row.height } : undefined;
      },
    };
  }, [layout]);

  useEffect(() => {
    onGeometryReady?.(geometry);
  }, [geometry, onGeometryReady]);

  if (images.length === 0 || width === 0) return <div className="p-2" />;

  // Window: render rows intersecting the viewport plus an overscan margin.
  const overscan = Math.max(height, 400);
  const top = scrollTop - overscan;
  const bottom = scrollTop + height + overscan;

  const rows = layout.rows;
  const start = firstRowFromOffset(rows, top);
  const cells: React.ReactNode[] = [];
  for (let r = start; r < rows.length; r++) {
    const row = rows[r];
    if (!row) break;
    if (row.top > bottom) break;
    for (const item of row.items) {
      const cell = images[item.index];
      if (!cell) continue;
      cells.push(
        <div
          key={cell.source || item.index}
          style={{
            position: "absolute",
            left: item.left,
            top: row.top,
            width: item.width,
            height: item.height,
          }}
        >
          <ImageTile data={cell} displayWidth={item.width} fillHeight />
        </div>,
      );
    }
  }

  return (
    <div className="p-2">
      <div style={{ position: "relative", height: layout.totalHeight }}>
        {cells}
      </div>
    </div>
  );
}
