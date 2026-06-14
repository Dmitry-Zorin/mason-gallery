import { create } from "zustand";
import { getPlatform } from "@/context/PlatformContext";
import { DEFAULT_THEME_ID, type ThemeId } from "@/theme/themes";
import type { ColumnBreakpoints, LayoutMode, SortMethod } from "@/types";
import type {
  CacheCleanupStrategy,
  CachePolicy,
  FolderThumbnailsMode,
  PasswordStorageMode,
} from "@/types/platform";
import {
  DEFAULT_CACHE_POLICY,
  DEFAULT_THUMBNAIL_SIZES,
} from "@/types/platform";

interface SettingsState {
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
  cacheCleanupStrategy: CacheCleanupStrategy;
  passwordStorageMode: PasswordStorageMode;
  cachePolicy: CachePolicy;
  thumbnailSizes: number[];
  folderThumbnails: FolderThumbnailsMode;
  vibrancy: boolean;
  _hydrated: boolean;

  setFormats: (formats: string[]) => void;
  setSortMethod: (method: SortMethod) => void;
  setPageSize: (size: number) => void;
  setColumnGutter: (gutter: number) => void;
  setCornerRadius: (radius: number) => void;
  setTheme: (theme: ThemeId) => void;
  setBreakpoints: (bp: ColumnBreakpoints) => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setRowHeight: (height: number) => void;
  setShowGridPosition: (show: boolean) => void;
  setConfirmDelete: (v: boolean) => void;
  setShowDeleteToast: (v: boolean) => void;
  setCacheCleanupStrategy: (strategy: CacheCleanupStrategy) => void;
  setPasswordStorageMode: (mode: PasswordStorageMode) => void;
  setCachePolicy: (policy: CachePolicy) => void;
  setThumbnailSizes: (sizes: number[]) => void;
  setFolderThumbnails: (mode: FolderThumbnailsMode) => void;
  setVibrancy: (v: boolean) => void;
  hydrate: () => Promise<void>;
}

const DEFAULTS = {
  formats: [".webp", ".jxl", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".jfif"],
  sortMethod: "name-asc" as SortMethod,
  pageSize: 50,
  columnGutter: 0,
  cornerRadius: 8,
  theme: DEFAULT_THEME_ID,
  breakpoints: {
    0: 1,
    500: 2,
    800: 3,
    1200: 4,
    1600: 5,
    1920: 6,
    2560: 7,
  } as ColumnBreakpoints,
  layoutMode: "masonry" as LayoutMode,
  rowHeight: 1080,
  showGridPosition: true,
  confirmDelete: true,
  showDeleteToast: true,
  cacheCleanupStrategy: "auto-clean" as CacheCleanupStrategy,
  passwordStorageMode: "none" as PasswordStorageMode,
  cachePolicy: DEFAULT_CACHE_POLICY,
  thumbnailSizes: DEFAULT_THUMBNAIL_SIZES,
  folderThumbnails: "off" as FolderThumbnailsMode,
  vibrancy: true,
};

async function persist(key: string, value: unknown) {
  try {
    const platform = getPlatform();
    await platform.saveSettings(key, value);
  } catch (e) {
    console.error("Failed to persist setting:", key, e);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  _hydrated: false,

  setFormats: (formats) => {
    set({ formats });
    persist("formats", formats);
  },
  setSortMethod: (sortMethod) => {
    set({ sortMethod });
    persist("sortMethod", sortMethod);
  },
  setPageSize: (pageSize) => {
    set({ pageSize });
    persist("pageSize", pageSize);
  },
  setColumnGutter: (columnGutter) => {
    set({ columnGutter });
    persist("columnGutter", columnGutter);
  },
  setCornerRadius: (cornerRadius) => {
    set({ cornerRadius });
    persist("cornerRadius", cornerRadius);
  },
  setTheme: (theme) => {
    set({ theme });
    persist("theme", theme);
  },
  setBreakpoints: (breakpoints) => {
    set({ breakpoints });
    persist("breakpoints", breakpoints);
  },
  setLayoutMode: (layoutMode) => {
    set({ layoutMode });
    persist("layoutMode", layoutMode);
  },
  setRowHeight: (rowHeight) => {
    set({ rowHeight });
    persist("rowHeight", rowHeight);
  },
  setShowGridPosition: (showGridPosition) => {
    set({ showGridPosition });
    persist("showGridPosition", showGridPosition);
  },
  setConfirmDelete: (confirmDelete) => {
    set({ confirmDelete });
    persist("confirmDelete", confirmDelete);
  },
  setShowDeleteToast: (showDeleteToast) => {
    set({ showDeleteToast });
    persist("showDeleteToast", showDeleteToast);
  },
  setCacheCleanupStrategy: (cacheCleanupStrategy) => {
    set({ cacheCleanupStrategy });
    persist("cacheCleanupStrategy", cacheCleanupStrategy);
  },
  setPasswordStorageMode: (passwordStorageMode) => {
    set({ passwordStorageMode });
    persist("passwordStorageMode", passwordStorageMode);
  },
  setCachePolicy: (cachePolicy) => {
    set({ cachePolicy });
    persist("cachePolicy", cachePolicy);
    const platform = getPlatform();
    platform
      .setCachePolicy?.(cachePolicy)
      .catch((e) => console.error("Failed to sync cachePolicy to backend:", e));
  },
  setThumbnailSizes: (thumbnailSizes) => {
    // Keep cachePolicy.thumbnailSizes in sync — that is what the Rust backend
    // reads when resolving widths during a scan. The flat `thumbnailSizes`
    // field is retained for UI consumers that bind to it directly.
    const mergedPolicy = {
      ...get().cachePolicy,
      thumbnailSizes,
    };
    set({ thumbnailSizes, cachePolicy: mergedPolicy });
    persist("thumbnailSizes", thumbnailSizes);
    persist("cachePolicy", mergedPolicy);
    const platform = getPlatform();
    platform
      .setCachePolicy?.(mergedPolicy)
      .catch((e) => console.error("Failed to sync cachePolicy to backend:", e));
  },
  setFolderThumbnails: (folderThumbnails) => {
    set({ folderThumbnails });
    persist("folderThumbnails", folderThumbnails);
  },
  setVibrancy: (vibrancy) => {
    set({ vibrancy });
    persist("vibrancy", vibrancy);
  },

  hydrate: async () => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Settings hydration timed out")), 3000),
    );

    try {
      const platform = getPlatform();
      const settings = await Promise.race([platform.loadSettings(), timeout]);

      set({
        formats: settings.formats ?? DEFAULTS.formats,
        sortMethod: settings.sortMethod ?? DEFAULTS.sortMethod,
        pageSize: settings.pageSize ?? DEFAULTS.pageSize,
        columnGutter: settings.columnGutter ?? DEFAULTS.columnGutter,
        cornerRadius: settings.cornerRadius ?? DEFAULTS.cornerRadius,
        theme: settings.theme ?? DEFAULTS.theme,
        breakpoints: settings.breakpoints ?? DEFAULTS.breakpoints,
        layoutMode: settings.layoutMode ?? DEFAULTS.layoutMode,
        rowHeight: settings.rowHeight ?? DEFAULTS.rowHeight,
        showGridPosition:
          settings.showGridPosition ?? DEFAULTS.showGridPosition,
        confirmDelete: settings.confirmDelete ?? DEFAULTS.confirmDelete,
        showDeleteToast: settings.showDeleteToast ?? DEFAULTS.showDeleteToast,
        cacheCleanupStrategy:
          ((settings as Record<string, unknown>)
            .cacheCleanupStrategy as CacheCleanupStrategy) ??
          DEFAULTS.cacheCleanupStrategy,
        passwordStorageMode:
          ((settings as Record<string, unknown>)
            .passwordStorageMode as PasswordStorageMode) ??
          DEFAULTS.passwordStorageMode,
        cachePolicy: (() => {
          // Unify the two fields: `thumbnailSizes` (top-level, pre-existing)
          // and `cachePolicy.thumbnailSizes` (new, authoritative for Rust).
          // If a legacy install persisted only the flat field, fold it into
          // the policy so subsequent scans pick it up.
          const basePolicy = settings.cachePolicy ?? DEFAULTS.cachePolicy;
          const sizes =
            basePolicy.thumbnailSizes ??
            settings.thumbnailSizes ??
            DEFAULTS.thumbnailSizes;
          return { ...basePolicy, thumbnailSizes: sizes };
        })(),
        thumbnailSizes:
          settings.cachePolicy?.thumbnailSizes ??
          settings.thumbnailSizes ??
          DEFAULTS.thumbnailSizes,
        folderThumbnails:
          settings.folderThumbnails ?? DEFAULTS.folderThumbnails,
        vibrancy: settings.vibrancy ?? DEFAULTS.vibrancy,
        _hydrated: true,
      });
    } catch (e) {
      console.error("Failed to hydrate settings:", e);
      set({ _hydrated: true });
    }
  },
}));
