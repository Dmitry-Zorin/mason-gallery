import {
  type RenderComponentProps,
  useMasonry,
  usePositioner,
  useResizeObserver,
} from "masonic";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import ImageTile from "@/components/ImageTile";
import {
  useContainerScroll,
  useContainerSize,
} from "@/hooks/useContainerObservers";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type {
  ColumnBreakpoints,
  GridGeometry,
  ImageCellData,
  WImage,
} from "@/types";

function getColumnCount(width: number, breakpoints: ColumnBreakpoints): number {
  const keys = Object.keys(breakpoints)
    .map(Number)
    .sort((a, b) => b - a);
  const maxColumns = Math.max(...Object.values(breakpoints), 1);
  for (const key of keys) {
    if (width >= key) {
      return Math.min(breakpoints[key] ?? 1, maxColumns);
    }
  }
  return 1;
}

function ImageCell({
  data,
  width: cellWidth,
}: RenderComponentProps<ImageCellData>) {
  return <ImageTile data={data} displayWidth={cellWidth} />;
}

interface WaterfallGridProps {
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  images: ImageCellData[];
  onGeometryReady?: (geometry: GridGeometry) => void;
}

export default function WaterfallGrid({
  scrollContainerRef,
  images,
  onGeometryReady,
}: WaterfallGridProps) {
  const scanId = useViewerStore((s) => s.scanId);
  const isRelayout = useViewerStore((s) => s.isRelayout);
  const breakpoints = useSettingsStore((s) => s.breakpoints);
  const columnGutter = useSettingsStore((s) => s.columnGutter);
  const selectedFolder = useAppStore((s) => s.selectedFolder);

  const { scrollTop, isScrolling } = useContainerScroll(scrollContainerRef);
  const { width, height } = useContainerSize(scrollContainerRef);

  const containerRef = useRef<HTMLElement>(null);
  const savedScrollRef = useRef<number | null>(null);
  const prevScanIdRef = useRef(scanId);

  // Capture scroll position before positioner resets on relayout
  if (scanId !== prevScanIdRef.current) {
    if (isRelayout && scrollContainerRef.current) {
      savedScrollRef.current = scrollContainerRef.current.scrollTop;
    } else {
      savedScrollRef.current = null;
    }
    prevScanIdRef.current = scanId;
  }

  // Restore scroll position synchronously after DOM update.
  // scanId is intentionally in deps to trigger after positioner reset.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scanId triggers the restore
  useLayoutEffect(() => {
    if (savedScrollRef.current !== null && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollRef.current;
      savedScrollRef.current = null;
    }
  }, [scanId, scrollContainerRef]);

  // Reset scroll to top when folder filter changes
  const prevFolderRef = useRef(selectedFolder);
  if (selectedFolder !== prevFolderRef.current) {
    prevFolderRef.current = selectedFolder;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }

  const safeWidth = Math.max(width, 1);
  const columnCount = getColumnCount(safeWidth, breakpoints);
  const positioner = usePositioner(
    { width: safeWidth, columnCount, columnGutter },
    [scanId, columnCount, selectedFolder, columnGutter],
  );

  // Expose a layout-agnostic geometry adapter so HomePage's index indicator and
  // Ctrl+G jump work identically across layouts. Methods read the live
  // positioner; the getter keeps `totalHeight` fresh as measurement progresses.
  const itemCount = images.length;
  const geometry = useMemo<GridGeometry>(
    () => ({
      get totalHeight() {
        return positioner.shortestColumn();
      },
      indexAtOffset: (offset) => {
        const total = positioner.shortestColumn();
        if (itemCount === 0 || total <= 0) return 0;
        const avg = total / (itemCount / columnCount);
        const idx = Math.round((offset / avg) * columnCount);
        return Math.max(0, Math.min(idx, itemCount - 1));
      },
      offsetForIndex: (index) => {
        const pos = positioner.get(index);
        return pos ? { top: pos.top, height: pos.height } : undefined;
      },
    }),
    [positioner, columnCount, itemCount],
  );

  useEffect(() => {
    onGeometryReady?.(geometry);
  }, [geometry, onGeometryReady]);

  // Pre-fill positioner with calculated heights from known dimensions.
  // This eliminates the "batch catch-up" freeze when scrolling to unmeasured regions,
  // because masonic's needsFreshBatch check sees measuredCount === itemCount.
  // Guard: skip when container hasn't been measured yet (width===0), otherwise
  // pre-fill runs with columnWidth≈1px producing tiny heights. When the real width
  // arrives, masonic's optsChanged branch copies those wrong heights into the new
  // positioner and the pre-fill loop is skipped (measuredCount===itemCount), causing
  // images to stack on top of each other.
  const measuredCount = positioner.size();
  if (width > 0 && measuredCount < images.length) {
    for (let i = measuredCount; i < images.length; i++) {
      const img = images[i] as WImage | undefined;
      if (img?.width && img.height && positioner.get(i) === undefined) {
        const displayHeight = positioner.columnWidth * (img.height / img.width);
        positioner.set(i, displayHeight);
      }
    }
  }

  const resizeObserver = useResizeObserver(positioner);

  const grid = useMasonry({
    positioner,
    resizeObserver,
    items: images,
    scrollTop,
    isScrolling,
    height,
    overscanBy: 5,
    render: ImageCell,
    containerRef,
  });

  if (images.length === 0 || width === 0) return <div className="p-2" />;

  return <div className="p-2">{grid}</div>;
}
