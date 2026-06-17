import type {
  ImageBatch,
  PlatformService,
  ScanParams,
  Settings,
} from "@mason-gallery/core";

const SETTINGS_KEY = "mason-gallery-settings";

interface FileEntry {
  id: string;
  handle: FileSystemFileHandle;
  blobUrl: string;
  width: number | null;
  height: number | null;
}

/**
 * Registry keyed by the file's relative path so a given file keeps a STABLE
 * source id and blob URL across re-scans. This is what makes incremental
 * refresh (which keeps images on screen) safe: retained files are never
 * revoked or re-registered, and the scan diff sees them as unchanged.
 */
class FileHandleRegistry {
  private byId = new Map<string, FileEntry>();
  private idByPath = new Map<string, string>();
  private nextId = 0;

  get(path: string): FileEntry | undefined {
    const id = this.idByPath.get(path);
    return id ? this.byId.get(id) : undefined;
  }

  register(
    path: string,
    handle: FileSystemFileHandle,
    blobUrl: string,
    width: number | null,
    height: number | null,
  ): FileEntry {
    const id = `web-file-${this.nextId++}`;
    const entry: FileEntry = { id, handle, blobUrl, width, height };
    this.byId.set(id, entry);
    this.idByPath.set(path, id);
    return entry;
  }

  getBlobUrl(id: string): string {
    const entry = this.byId.get(id);
    if (!entry) return id;
    return entry.blobUrl;
  }

  /** Revoke and drop every registered path not present in `keepPaths`. */
  revokeAbsent(keepPaths: Set<string>): void {
    for (const [path, id] of this.idByPath) {
      if (keepPaths.has(path)) continue;
      const entry = this.byId.get(id);
      if (entry) URL.revokeObjectURL(entry.blobUrl);
      this.byId.delete(id);
      this.idByPath.delete(path);
    }
  }

  clear(): void {
    for (const entry of this.byId.values()) {
      URL.revokeObjectURL(entry.blobUrl);
    }
    this.byId.clear();
    this.idByPath.clear();
  }
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

async function* walkDirectory(
  dirHandle: FileSystemDirectoryHandle,
  formats: Set<string>,
  pathPrefix = "",
): AsyncGenerator<{
  name: string;
  path: string;
  handle: FileSystemFileHandle;
}> {
  for await (const entry of dirHandle.values()) {
    const entryPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
    if (entry.kind === "file") {
      const ext = getExtension(entry.name);
      if (formats.has(ext)) {
        yield { name: entry.name, path: entryPath, handle: entry };
      }
    } else if (entry.kind === "directory") {
      yield* walkDirectory(entry, formats, entryPath);
    }
  }
}

async function getImageDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const { imageDimensionsFromStream } = await import("image-dimensions");
    const stream = file.stream() as ReadableStream<Uint8Array>;
    const result = await imageDimensionsFromStream(stream);
    if (result) {
      return { width: result.width, height: result.height };
    }
  } catch {
    // fallback to createImageBitmap
  }

  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return null;
  }
}

const registry = new FileHandleRegistry();

// Store directory handles for scanning
let storedDirHandles: FileSystemDirectoryHandle[] = [];

export const webPlatformService: PlatformService = {
  capabilities: {
    canDeleteFiles: false,
    canRevealFile: false,
    canSelectFolder: true,
    hasCustomTitlebar: false,
    hasTitlebarActions: true,
    canAutoUpdate: false,
    canDragDropFolders: true,
    canBrowseArchives: false,
    canUseVibrancy: false,
  },

  async scanImages(
    params: ScanParams,
    onBatch: (batch: ImageBatch) => void,
    onComplete: () => void,
    onCount?: (total: number) => void,
  ): Promise<void> {
    const formats = new Set(params.formats.map((f) => f.toLowerCase()));
    const batchSize = params.page_size;

    // Phase 1: Collect all file handles (fast, no dimension extraction)
    const fileHandles: {
      name: string;
      path: string;
      handle: FileSystemFileHandle;
    }[] = [];
    for (const dirHandle of storedDirHandles) {
      for await (const entry of walkDirectory(dirHandle, formats)) {
        fileHandles.push(entry);
      }
    }

    // Emit total count immediately
    if (onCount) {
      onCount(fileHandles.length);
    }

    // Phase 2: Process dimensions in batches. Files already registered (same
    // relative path) keep their existing blob URL + id, so an incremental
    // refresh never revokes a URL that on-screen <img>/viewer tags still point
    // at, and the scan diff sees retained files as unchanged.
    let batch: ImageBatch["images"] = [];

    for (const entry of fileHandles) {
      let fileEntry = registry.get(entry.path);
      if (!fileEntry) {
        const file = await entry.handle.getFile();
        const blobUrl = URL.createObjectURL(file);
        const dims = await getImageDimensions(file);
        fileEntry = registry.register(
          entry.path,
          entry.handle,
          blobUrl,
          dims?.width ?? null,
          dims?.height ?? null,
        );
      }

      batch.push({
        source: fileEntry.id,
        relativePath: entry.path,
        width: fileEntry.width,
        height: fileEntry.height,
      });

      if (batch.length >= batchSize) {
        onBatch({ images: batch, done: false });
        batch = [];
      }
    }

    // Revoke blob URLs for files that disappeared since the last scan.
    registry.revokeAbsent(new Set(fileHandles.map((e) => e.path)));

    if (batch.length > 0) {
      onBatch({ images: batch, done: true });
    } else {
      onBatch({ images: [], done: true });
    }
    onComplete();
  },

  getImageUrl(source: string): string {
    return registry.getBlobUrl(source);
  },

  getThumbUrl(): string {
    // Web platform has no thumbnail cache — waterfall fallbacks to <img src>.
    return "";
  },

  async clearThumbnails(): Promise<void> {
    // No-op: web has no local cache.
  },

  async clearExtracted(): Promise<void> {
    // No-op: web has no local cache.
  },

  async deleteFile(): Promise<void> {
    throw new Error("Delete is not supported in the web version");
  },

  async revealFile(): Promise<void> {
    throw new Error("Reveal in folder is not supported in the web version");
  },

  async pickFolders(): Promise<string[] | null> {
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: "read" });
      // New selection: drop the old registry so a same-named path in the new
      // root can't reuse a stale blob/handle from the previous folder.
      registry.clear();
      storedDirHandles = [dirHandle];
      return [dirHandle.name];
    } catch {
      return null;
    }
  },

  onDragDrop(callback: (paths: string[]) => void): () => void {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const items = e.dataTransfer?.items;
      if (!items) return;

      const handles: FileSystemDirectoryHandle[] = [];
      for (const item of items) {
        const handle = await item.getAsFileSystemHandle();
        if (handle?.kind === "directory") {
          handles.push(handle as FileSystemDirectoryHandle);
        }
      }

      if (handles.length > 0) {
        // New selection: drop stale blobs/handles from the previous folder.
        registry.clear();
        storedDirHandles = handles;
        callback(handles.map((h) => h.name));
      }
    };

    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("drop", handleDrop);
    };
  },

  async loadSettings(): Promise<Partial<Settings>> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return JSON.parse(raw) as Partial<Settings>;
      }
    } catch {
      // ignore
    }
    return {};
  },

  async saveSettings(key: string, value: unknown): Promise<void> {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      const settings = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      settings[key] = value;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  },

  async requestThumbnail(): Promise<{ enqueued: boolean; skipped: boolean }> {
    return { enqueued: false, skipped: true };
  },

  async cancelThumbnail(): Promise<void> {
    // No-op on web.
  },

  onThumbnailsReady(): () => void {
    return () => {};
  },

  async listDirectoryTree(): Promise<string[]> {
    const directories: string[] = [];

    async function walkDirs(
      dirHandle: FileSystemDirectoryHandle,
      prefix: string,
    ) {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "directory") {
          const path = prefix ? `${prefix}/${entry.name}` : entry.name;
          directories.push(path);
          await walkDirs(entry, path);
        }
      }
    }

    for (const dirHandle of storedDirHandles) {
      await walkDirs(dirHandle, "");
    }

    directories.sort();
    return directories;
  },
};
