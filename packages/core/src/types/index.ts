export interface Thumbnail {
  source: string;
  width: number;
  height: number;
}

export interface WImage {
  source: string;
  relativePath: string;
  width: number | null;
  height: number | null;
  thumbnails?: Thumbnail[];
  /** DB id of the owning `sources` row (folder or archive). Present when the
   * backend has registered a source record for this entry. */
  sourceId?: number;
  /** True when this entry is a locked archive placeholder. Grid renders a lock
   * tile instead of an image; click opens the password dialog. */
  locked?: boolean;
}

/** A scanned image augmented with its position in the unfiltered list, used by
 * the grid layouts to open the viewer at the correct global index. */
export interface ImageCellData extends WImage {
  globalIndex: number;
}

export interface ImageBatch {
  images: WImage[];
  done: boolean;
}

export interface ScanParams {
  paths: string[];
  formats: string[];
  page_size: number;
  sort_method: SortMethod;
}

export type SortMethod = "name-asc" | "name-desc" | "time-asc" | "time-desc";

/** Grid layout strategy. `masonry` is the default Masonic column layout;
 * `justified` is the equal-row-height (Flickr-style) layout. */
export type LayoutMode = "masonry" | "justified";

/** Minimal scroll-geometry abstraction shared by both grid layouts so the
 * `~N / total` indicator and the Ctrl+G jump in HomePage work the same way
 * regardless of which layout is active. */
export interface GridGeometry {
  /** Total scrollable content height in px. */
  totalHeight: number;
  /** Approximate 0-based item index at the top of the viewport for a given
   * scroll offset. */
  indexAtOffset: (scrollTop: number, viewportHeight: number) => number;
  /** Pixel rect for a given item index, or undefined when not yet laid out. */
  offsetForIndex: (
    index: number,
  ) => { top: number; height: number } | undefined;
}

// Maps minimum screen widths (px) to column counts.
// Each entry means: "from this width up to the next entry, use N columns."
// Example: { 0: 1, 500: 2, 800: 3, 1200: 4, 1600: 5, 1920: 6, 2560: 7 }
//   0–499 px → 1 col, 500–799 px → 2 cols, …, ≥ 2560 px → 7 cols
export type ColumnBreakpoints = Record<number, number>;

export interface Settings {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  breakpoints: ColumnBreakpoints;
  showGridPosition: boolean;
}
