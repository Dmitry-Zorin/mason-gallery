import type { WImage } from "@/types";

export interface JustifiedItem {
  /** Index into the input images array. Carries the cell's globalIndex. */
  index: number;
  left: number;
  width: number;
  height: number;
}

export interface JustifiedRow {
  top: number;
  height: number;
  items: JustifiedItem[];
}

export interface JustifiedLayout {
  totalHeight: number;
  rows: JustifiedRow[];
}

/** Assumed aspect ratio for images whose intrinsic dimensions are unknown. */
const DEFAULT_ASPECT = 3 / 2;
/** Locked-archive placeholders have no dimensions; render them square to match
 * the masonry lock tile's `aspect-square` look. */
const LOCKED_ASPECT = 1;
/** Cap only *wide* aspect ratios: a very wide panorama dominates its row's
 * aspect-sum, shrinking the shared row height and collapsing every other image
 * in that row. Tall images have the opposite, harmless effect — they add little
 * to the aspect-sum, so they just take a narrow tile at the row's normal height
 * (a justified row is always <= the target height). Clamping tall images was
 * what forced them into a too-wide box, so `object-fit: cover` cropped them;
 * leaving their true aspect makes the tile match the image exactly — no crop. */
const MAX_ASPECT = 4;

function aspectOf(img: WImage): number {
  if (img.locked) return LOCKED_ASPECT;
  if (img.width && img.height && img.width > 0 && img.height > 0) {
    return Math.min(MAX_ASPECT, img.width / img.height);
  }
  return DEFAULT_ASPECT;
}

/**
 * Flickr / Google Photos style justified-rows geometry. Every row is scaled to
 * fill `containerWidth` while each image keeps its aspect ratio; the trailing
 * partial row is left-aligned at `targetRowHeight` (never stretched), unless a
 * single image would overflow, in which case it is scaled down to fit.
 *
 * Pure and O(n) — computed up front from intrinsic dimensions, no DOM
 * measurement, so the result can drive a windowed renderer directly.
 */
export function computeJustifiedLayout(
  images: WImage[],
  containerWidth: number,
  gutter: number,
  targetRowHeight: number,
): JustifiedLayout {
  const width = Math.max(containerWidth, 1);
  const rows: JustifiedRow[] = [];
  const n = images.length;

  let top = 0;
  let i = 0;

  while (i < n) {
    // Greedily accumulate images until the row, laid out at the target height,
    // would overflow the container width.
    let arSum = 0;
    let end = i;
    while (end < n) {
      const img = images[end];
      if (!img) break;
      arSum += aspectOf(img);
      end++;
      const naturalWidth = arSum * targetRowHeight + (end - i - 1) * gutter;
      if (naturalWidth >= width) break;
    }

    const count = end - i;
    const totalGutter = (count - 1) * gutter;
    const naturalWidth = arSum * targetRowHeight + totalGutter;
    // A row that reached the end without overflowing is the trailing partial
    // row: keep the target height and left-align instead of stretching.
    const isLastRow = end === n && naturalWidth < width;

    const rowHeight = isLastRow
      ? targetRowHeight
      : Math.max(1, (width - totalGutter) / arSum);

    const items: JustifiedItem[] = [];
    let left = 0;
    for (let k = i; k < end; k++) {
      const img = images[k];
      if (!img) continue;
      const w = aspectOf(img) * rowHeight;
      items.push({ index: k, left, width: w, height: rowHeight });
      left += w + gutter;
    }

    rows.push({ top, height: rowHeight, items });
    top += rowHeight + gutter;
    i = end;
  }

  // The final row contributes no trailing gutter to the scrollable height.
  const totalHeight = rows.length > 0 ? top - gutter : 0;
  return { totalHeight, rows };
}
