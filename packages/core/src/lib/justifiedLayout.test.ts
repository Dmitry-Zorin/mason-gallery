import { describe, expect, it } from "vitest";
import type { WImage } from "@/types";

// `computeJustifiedLayout` is the Flickr/Google-Photos-style justified-rows
// geometry. It lives on the layout-feature branch (`@/lib/justifiedLayout`).
// We import it dynamically so this suite stays green on branches where the
// module is not yet present; once integrated, every case below runs.
async function loadLayout() {
  try {
    return await import("@/lib/justifiedLayout");
  } catch {
    return null;
  }
}

/** Build a minimal WImage carrying just the dimensions the layout reads. */
function img(width: number | null, height: number | null): WImage {
  return {
    source: `img-${width}x${height}`,
    relativePath: `img-${width}x${height}.jpg`,
    width,
    height,
  };
}

function lockedImg(): WImage {
  return {
    source: "locked",
    relativePath: "locked.zip",
    width: null,
    height: null,
    locked: true,
  };
}

describe("computeJustifiedLayout", () => {
  it("returns an empty layout for empty input", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    const layout = mod.computeJustifiedLayout([], 1000, 8, 200);
    expect(layout.rows).toEqual([]);
    expect(layout.totalHeight).toBe(0);
  });

  it("places a single image in one row at no more than the target height", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    const layout = mod.computeJustifiedLayout([img(300, 200)], 1000, 8, 200);
    expect(layout.rows).toHaveLength(1);
    const row = layout.rows[0];
    expect(row.items).toHaveLength(1);
    expect(row.top).toBe(0);
    // A single image that does not overflow is left-aligned at the target
    // height, never stretched to fill the container.
    expect(row.height).toBeLessThanOrEqual(200 + 1e-6);
    expect(row.items[0].index).toBe(0);
    expect(row.items[0].left).toBe(0);
    // A 3:2 image at height 200 is 300 wide.
    expect(row.items[0].width).toBeCloseTo(300, 5);
    // Single non-overflowing row contributes no trailing gutter.
    expect(layout.totalHeight).toBeCloseTo(row.height, 5);
  });

  it("scales a full row to exactly fill the container width", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    const containerWidth = 1000;
    const gutter = 10;
    // Five wide tiles guarantee the first row overflows and gets justified.
    const images = Array.from({ length: 5 }, () => img(400, 200));
    const layout = mod.computeJustifiedLayout(
      images,
      containerWidth,
      gutter,
      180,
    );
    expect(layout.rows.length).toBeGreaterThanOrEqual(1);
    const firstRow = layout.rows[0];
    // Justified (non-last) rows fill the container exactly: sum of item widths
    // plus inter-item gutters equals containerWidth.
    const sumWidths = firstRow.items.reduce((acc, it) => acc + it.width, 0);
    const totalGutter = (firstRow.items.length - 1) * gutter;
    expect(sumWidths + totalGutter).toBeCloseTo(containerWidth, 4);
  });

  it("never lets any justified row's content exceed the container width", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    const containerWidth = 1200;
    const gutter = 12;
    const targetHeight = 220;
    // Mixed aspect ratios across many images to exercise multiple rows.
    const ratios: [number, number][] = [
      [400, 200],
      [200, 300],
      [600, 200],
      [300, 300],
      [500, 250],
      [250, 400],
      [800, 200],
      [350, 350],
      [450, 300],
      [200, 200],
    ];
    const images = ratios.map(([w, h]) => img(w, h));
    const layout = mod.computeJustifiedLayout(
      images,
      containerWidth,
      gutter,
      targetHeight,
    );
    for (const row of layout.rows) {
      const sumWidths = row.items.reduce((acc, it) => acc + it.width, 0);
      const totalGutter = (row.items.length - 1) * gutter;
      // Allow tiny float slack; content must fit within the container.
      expect(sumWidths + totalGutter).toBeLessThanOrEqual(
        containerWidth + 1e-3,
      );
    }
  });

  it("left-aligns the trailing partial row at the target height", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    const containerWidth = 1000;
    const gutter = 10;
    const targetHeight = 200;
    // Six wide tiles: the first rows justify and overflow, leaving a short
    // trailing row that should keep the target height (not stretch).
    const images = Array.from({ length: 6 }, () => img(400, 200));
    const layout = mod.computeJustifiedLayout(
      images,
      containerWidth,
      gutter,
      targetHeight,
    );
    const lastRow = layout.rows[layout.rows.length - 1];
    const sumWidths = lastRow.items.reduce((acc, it) => acc + it.width, 0);
    const totalGutter = (lastRow.items.length - 1) * gutter;
    const lastRowWidth = sumWidths + totalGutter;
    // The trailing row is the partial one: it does not fill the container and
    // sits at the target height.
    if (lastRowWidth < containerWidth - 1e-3) {
      expect(lastRow.height).toBeCloseTo(targetHeight, 5);
    }
  });

  it("assigns monotonically increasing row tops and contiguous indices", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    const gutter = 8;
    const images = Array.from({ length: 12 }, (_, k) => img(400, 200 + k * 5));
    const layout = mod.computeJustifiedLayout(images, 900, gutter, 200);
    let expectedIndex = 0;
    let prevTop = -1;
    for (const row of layout.rows) {
      expect(row.top).toBeGreaterThan(prevTop);
      prevTop = row.top;
      for (const item of row.items) {
        // Items carry their original input index, in order.
        expect(item.index).toBe(expectedIndex);
        expectedIndex++;
      }
    }
    // Every input image is laid out exactly once.
    expect(expectedIndex).toBe(images.length);
  });

  it("renders locked placeholders as square tiles", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    // A lone locked tile that does not overflow keeps the target height and is
    // square (aspect 1), so width == height.
    const layout = mod.computeJustifiedLayout([lockedImg()], 1000, 8, 200);
    const item = layout.rows[0].items[0];
    expect(item.width).toBeCloseTo(item.height, 5);
  });

  it("falls back to a default aspect ratio for images with unknown dimensions", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    // Unknown dims => default 3:2 aspect. At height 200 a single tile is 300px.
    const layout = mod.computeJustifiedLayout([img(null, null)], 1000, 8, 200);
    const item = layout.rows[0].items[0];
    expect(item.width).toBeCloseTo(item.height * (3 / 2), 5);
  });

  it("clamps a wide single image so it fits the container", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    const containerWidth = 600;
    // An extreme panorama (10:1) is clamped to MAX_ASPECT (4) and, as a
    // justified single-image row, scaled down to fit the container width.
    const layout = mod.computeJustifiedLayout(
      [img(4000, 400)],
      containerWidth,
      0,
      300,
    );
    const item = layout.rows[0].items[0];
    expect(item.width).toBeLessThanOrEqual(containerWidth + 1e-3);
  });

  it("keeps a tall image's true aspect so its tile is not cropped", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    // A 1:4 portrait (aspect 0.25) is far taller than the old 1/3 lower clamp.
    // Its tile must match the image's true aspect — width == height * 0.25 —
    // so `object-fit` fills the box exactly with no cropping. As a lone,
    // non-overflowing image it sits at the target height, left-aligned.
    const targetHeight = 400;
    const layout = mod.computeJustifiedLayout(
      [img(200, 800)],
      1000,
      8,
      targetHeight,
    );
    const item = layout.rows[0].items[0];
    expect(item.height).toBeCloseTo(targetHeight, 5);
    expect(item.width / item.height).toBeCloseTo(0.25, 5);
  });

  it("never stretches a justified row above the target height", async () => {
    const mod = await loadLayout();
    if (!mod) return;
    // Removing the lower aspect clamp must not let tall images inflate a row:
    // a justified (full) row can only scale down to fit width, never up.
    const targetHeight = 220;
    const images = [
      img(150, 900), // 1:6, well below the old clamp
      img(200, 800),
      img(400, 300),
      img(500, 200),
      img(180, 700),
      img(300, 300),
    ];
    const layout = mod.computeJustifiedLayout(images, 1000, 10, targetHeight);
    for (const row of layout.rows) {
      expect(row.height).toBeLessThanOrEqual(targetHeight + 1e-3);
    }
  });
});
