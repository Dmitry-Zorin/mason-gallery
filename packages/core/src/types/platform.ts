import type { ThemeId } from "../theme/themes";
import type {
  ColumnBreakpoints,
  LayoutMode,
  SortMethod,
  Thumbnail,
} from "./index";

export type { Thumbnail };

export type ExtractedMode = "no-cache" | "lru-capped" | "unlimited";
export type ThumbRetain = "until-source-removed" | "lru-capped";

export interface ExtractedPolicy {
  mode: ExtractedMode;
  maxSizePerSource?: number;
  minFileSize?: number;
}

export interface ThumbnailPolicy {
  retain: ThumbRetain;
  maxTotalSize?: number;
}

export interface CachePolicy {
  extracted: ExtractedPolicy;
  thumbnails: ThumbnailPolicy;
  /**
   * Thumbnail widths generated at scan time. The Rust backend resolves per-
   * source `SourceOverride.thumbnails.widths` on top of this; the frontend
   * never passes a widths array through the scan call itself.
   */
  thumbnailSizes: number[];
}

export interface SourceThumbnailOverride extends Partial<ThumbnailPolicy> {
  /**
   * Override the thumbnail widths for this specific source. When set it
   * replaces `CachePolicy.thumbnailSizes` wholesale; unset means "inherit
   * global". Must contain at least one value — the backend rejects empty
   * arrays in `setSourcePolicy`.
   */
  widths?: number[];
}

export type SourceOverride = {
  extracted?: Partial<ExtractedPolicy>;
  thumbnails?: SourceThumbnailOverride;
};

// Tuned for 2–4 columns on a 4K screen (physical tile widths 1920/1280/960):
// 512 fast placeholder · 1280 exact 3-col / serves 4-col · 2048 covers 2-col's
// 1920px with headroom so the settled image never upscales. Must stay in sync
// with the Rust `default_thumbnail_sizes()` in services/policy.rs.
export const DEFAULT_THUMBNAIL_SIZES = [512, 1280, 2048];

export const DEFAULT_CACHE_POLICY: CachePolicy = {
  extracted: { mode: "unlimited" },
  thumbnails: { retain: "until-source-removed" },
  thumbnailSizes: DEFAULT_THUMBNAIL_SIZES,
};

export type FolderThumbnailsMode = "off" | "lazy";

export interface Settings {
  formats: string[];
  sortMethod: SortMethod;
  pageSize: number;
  columnGutter: number;
  cornerRadius: number;
  theme: ThemeId;
  breakpoints: ColumnBreakpoints;
  layoutMode: LayoutMode;
  rowHeight: number;
  showGridPosition: boolean;
  confirmDelete: boolean;
  showDeleteToast: boolean;
  cachePolicy: CachePolicy;
  thumbnailSizes: number[];
  folderThumbnails: FolderThumbnailsMode;
  vibrancy: boolean;
}

export interface ScanParams {
  paths: string[];
  formats: string[];
  page_size: number;
  sort_method: SortMethod;
}

export interface ImageBatch {
  images: Array<{
    source: string;
    relativePath: string;
    width: number | null;
    height: number | null;
    thumbnails?: Thumbnail[];
  }>;
  done: boolean;
}

export interface PlatformCapabilities {
  canDeleteFiles: boolean;
  canRevealFile: boolean;
  canSelectFolder: boolean;
  hasCustomTitlebar: boolean;
  /**
   * Whether the visible titlebar already renders the primary action buttons
   * (Open Folder, sidebar toggle, Refresh, Settings). True on web and
   * Windows/Linux desktop, where the in-window `MenuBar` is the titlebar. False
   * on macOS, which uses the native system menu plus a button-less drag strip —
   * there those actions are surfaced inline in the content bar instead.
   */
  hasTitlebarActions: boolean;
  canAutoUpdate: boolean;
  canDragDropFolders: boolean;
  canBrowseArchives: boolean;
  /** Native window vibrancy (frosted glass) — macOS desktop only. */
  canUseVibrancy: boolean;
}

export type PasswordStorageMode = "none" | "plaintext";
export type CacheCleanupStrategy = "auto-clean" | "keep-all";

export interface ArchiveInfo {
  format: string;
  entryCount: number;
  totalSize: number;
  isSolid: boolean;
  isEncrypted: boolean;
}

export interface CacheStats {
  id: number;
  kind: "archive" | "folder";
  originPath: string;
  identitySegment: string;
  entryCount: number | null;
  thumbCacheSize: number;
  extractedCacheSize: number;
  isPinned: boolean;
  lastAccessed: string | null;
  policyOverride?: string | null;
}

export interface ScanArchiveParams {
  path: string;
  formats: string[];
  pageSize: number;
  sortMethod: string;
  password?: string;
}

export interface MigrationCandidate {
  sourceId: number;
  oldPath: string;
  kind: "archive" | "folder";
  matchScore: number;
}

export interface ContextMenuItem {
  /** Optional stable identifier (handy for tests/telemetry). */
  id?: string;
  label: string;
  /** Invoked when the user picks this item. */
  action: () => void | Promise<void>;
  /** Rendered greyed-out and unclickable when false. Defaults to true. */
  enabled?: boolean;
}

export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

export interface PlatformService {
  capabilities: PlatformCapabilities;

  scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void>;

  getImageUrl(source: string): string;

  /**
   * Show a native OS context menu at the current cursor position. Each entry
   * carries its own `action` callback, fired when the user picks it. Optional:
   * only the desktop platform implements it (native NSMenu on macOS); on web
   * it's absent and callers fall back to the browser's default menu.
   */
  showContextMenu?(items: ContextMenuEntry[]): Promise<void>;

  /**
   * Translate a thumbnail URI (`mg-thumb:///<sourceHash>/<entryHash>?w=<width>`)
   * into an actual fetchable URL. Returns an empty string on platforms that
   * don't serve thumbnails (web).
   */
  getThumbUrl(thumbId: string): string;

  deleteFile(path: string): Promise<void>;

  revealFile(path: string): Promise<void>;

  pickFolders(): Promise<string[] | null>;

  onDragDrop(callback: (paths: string[]) => void): () => void;

  loadSettings(): Promise<Partial<Settings>>;

  saveSettings(key: string, value: unknown): Promise<void>;

  listDirectoryTree(paths: string[]): Promise<string[]>;

  // Archive operations (desktop-only)
  pickArchive?(): Promise<string | null>;
  scanArchive?(
    params: ScanArchiveParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void>;
  getArchiveInfo?(path: string): Promise<ArchiveInfo>;
  getCacheStats?(): Promise<CacheStats[]>;
  clearThumbnails(sourceId?: number): Promise<void>;
  clearExtracted(sourceId?: number): Promise<void>;
  pinCache?(sourceId: number, pinned: boolean): Promise<void>;
  unlockArchive?(
    path: string,
    password: string,
    remember: boolean,
    storageMode?: PasswordStorageMode,
  ): Promise<void>;
  checkMigration?(path: string): Promise<MigrationCandidate | null>;
  confirmMigration?(sourceId: number, newPath: string): Promise<void>;
  startupCacheCleanup?(strategy: CacheCleanupStrategy): Promise<void>;
  setCachePolicy?(policy: CachePolicy): Promise<void>;
  setSourcePolicy?(
    sourceId: number,
    override: SourceOverride | null,
  ): Promise<void>;

  /**
   * Request on-demand thumbnail generation for a folder entry. Returns
   * `{ enqueued: true }` when a new task was queued, `{ enqueued: false }` if
   * the entry is already cached or already queued, and `{ skipped: true }` if
   * the file is below the minFileSize threshold (no thumbs will ever arrive).
   */
  requestThumbnail(
    sourceId: number,
    entryPath: string,
    widths?: number[],
  ): Promise<{ enqueued: boolean; skipped: boolean }>;

  /**
   * Cancel a pending or in-flight thumbnail request. Safe to call even if no
   * request is outstanding.
   */
  cancelThumbnail(sourceId: number, entryPath: string): Promise<void>;

  /**
   * Subscribe to thumbnail-ready events. Returns an unsubscribe function.
   * On the web platform this is a no-op that returns a no-op unsubscribe.
   */
  onThumbnailsReady(
    callback: (event: {
      sourceId: number;
      entryPath: string;
      thumbnails: Thumbnail[];
    }) => void,
  ): () => void;
}
