import LockIcon from "@mui/icons-material/Lock";
import { usePlatform } from "@/context/PlatformContext";
import { useThumbnailRequest } from "@/hooks/useThumbnailRequest";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ImageCellData } from "@/types";

function archivePathFromSource(source: string): string | null {
  if (!source.startsWith("archive:///")) return null;
  const withoutScheme = source.slice("archive:///".length);
  const hashIdx = withoutScheme.indexOf("#");
  return hashIdx === -1 ? withoutScheme : withoutScheme.slice(0, hashIdx);
}

interface ImageTileProps {
  /** Cell data including `globalIndex`; also the fallback before the store
   * patches in freshly generated thumbnails. */
  data: ImageCellData;
  /** Rendered display width in px. Feeds the `sizes` attribute so the browser
   * picks the right srcSet candidate. Masonry passes the column width;
   * justified passes the computed box width. */
  displayWidth: number;
  /** When true the tile fills its parent box's height (justified fixed-box
   * layout); otherwise height follows the image aspect ratio (masonry). */
  fillHeight?: boolean;
}

/**
 * Presentational grid tile shared by both layouts. Owns the lock-placeholder
 * branch, the multi-width srcSet, the lazy-thumbnail request hook, and the
 * click-to-open behaviour. The two layouts differ only in how the tile is
 * sized: masonry lets the image's aspect ratio drive height; justified fixes
 * the box to a precomputed width × height.
 */
export default function ImageTile({
  data,
  displayWidth,
  fillHeight = false,
}: ImageTileProps) {
  const openViewer = useViewerStore((s) => s.openViewer);
  const platform = usePlatform();
  const folderThumbnails = useSettingsStore((s) => s.folderThumbnails);
  const cornerRadius = useSettingsStore((s) => s.cornerRadius);

  // Subscribe to this specific entry so patchThumbnails triggers a re-render
  // without re-rendering sibling tiles.
  const entry = useViewerStore((s) => s.images[data.globalIndex]) ?? data;

  const hookEnabled =
    folderThumbnails === "lazy" &&
    !entry.locked &&
    entry.sourceId !== undefined &&
    !(entry.thumbnails && entry.thumbnails.length > 0);

  const tileRef = useThumbnailRequest(entry, hookEnabled);

  if (entry.locked) {
    const archivePath = archivePathFromSource(entry.source);
    const archiveName = archivePath
      ? archivePath.split(/[\\/]/).pop() || archivePath
      : entry.relativePath;
    return (
      <button
        ref={tileRef as React.RefCallback<HTMLButtonElement>}
        type="button"
        className={`cursor-pointer overflow-hidden bg-neutral-100 dark:bg-neutral-800 transition-shadow hover:shadow-lg w-full border-none p-3 flex flex-col items-center justify-center gap-2 ${
          fillHeight ? "h-full" : "aspect-square"
        }`}
        style={{ borderRadius: cornerRadius }}
        onClick={() => {
          if (archivePath) {
            useAppStore.setState({ archivePasswordNeeded: archivePath });
          }
        }}
      >
        <LockIcon fontSize="large" />
        <span className="text-xs text-center break-all line-clamp-2">
          {archiveName}
        </span>
      </button>
    );
  }

  const thumbs = entry.thumbnails ?? [];
  const hasThumbs = thumbs.length > 0;

  // When folder thumbnails are enabled, never load the heavy original into the
  // grid: show a neutral placeholder until the generated thumbnail arrives (the
  // request hook above has already kicked off generation). The full-resolution
  // original is still used in the full-screen viewer.
  if (!hasThumbs && folderThumbnails !== "off") {
    return (
      <button
        ref={tileRef as React.RefCallback<HTMLButtonElement>}
        type="button"
        className={`cursor-pointer overflow-hidden bg-neutral-100 dark:bg-neutral-800 transition-shadow hover:shadow-lg w-full border-none p-0 block ${
          fillHeight ? "h-full" : ""
        }`}
        style={{ display: "block", borderRadius: cornerRadius }}
        onClick={() => openViewer(data.globalIndex)}
      >
        <div
          className={`${fillHeight ? "w-full h-full" : "w-full"} animate-pulse bg-neutral-300 dark:bg-neutral-700`}
          style={{
            borderRadius: cornerRadius,
            aspectRatio:
              !fillHeight && entry.width && entry.height
                ? `${entry.width} / ${entry.height}`
                : undefined,
          }}
        />
      </button>
    );
  }

  const srcSet = hasThumbs
    ? thumbs
        .map((t) => {
          const url = platform.getThumbUrl(t.source);
          return url ? `${url} ${t.width}w` : "";
        })
        .filter(Boolean)
        .join(", ")
    : undefined;

  // `sizes` reflects the rendered display width so the browser picks the right
  // srcset candidate.
  const sizes = displayWidth > 0 ? `${Math.round(displayWidth)}px` : undefined;

  // Fallback src: smallest thumbnail if we have them, otherwise the original.
  const firstThumb = thumbs[0];
  const fallback = firstThumb
    ? platform.getThumbUrl(firstThumb.source)
    : platform.getImageUrl(entry.source);

  return (
    <button
      ref={tileRef as React.RefCallback<HTMLButtonElement>}
      type="button"
      className={`cursor-pointer overflow-hidden bg-neutral-100 dark:bg-neutral-800 transition-shadow hover:shadow-lg w-full border-none p-0 block ${
        fillHeight ? "h-full" : ""
      }`}
      // `display: block` inline so the masonic gridcell wrapper has no inline
      // line box around the tile — its inherited line-height otherwise reserves
      // descender space below the image, which masonic measures as a per-row
      // gap. Inline because an unlayered global (MUI/lightbox) overrides the
      // layered Tailwind `block` utility on the image.
      style={{ display: "block", borderRadius: cornerRadius }}
      onClick={() => openViewer(data.globalIndex)}
    >
      <img
        src={fallback || platform.getImageUrl(entry.source)}
        srcSet={srcSet}
        sizes={sizes}
        alt=""
        loading="lazy"
        width={entry.width ?? undefined}
        height={entry.height ?? undefined}
        className={fillHeight ? "w-full h-full block" : "w-full block"}
        // Round the image itself, not just the button. WebKit doesn't reliably
        // clip a child <img> to the parent's border-radius via overflow:hidden,
        // so the square image corners would otherwise cover the button's
        // rounding. The img fills the button, so rounding it directly is what
        // the user actually sees.
        style={{
          display: "block",
          borderRadius: cornerRadius,
          // Justified mode fixes the box, so cover absorbs any mismatch when an
          // image's real dimensions differ from the assumed fallback aspect.
          objectFit: fillHeight ? "cover" : undefined,
          aspectRatio:
            !fillHeight && entry.width && entry.height
              ? `${entry.width} / ${entry.height}`
              : undefined,
        }}
      />
    </button>
  );
}
