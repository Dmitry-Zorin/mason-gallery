import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import FolderOpenOutlined from "@mui/icons-material/FolderOpenOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogTitle,
  IconButton,
  Popover,
  Snackbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/plugins/counter.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "./ImageViewer.css";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { useViewerStore } from "@/stores/viewerStore";
import type { ContextMenuEntry } from "@/types/platform";

function getFileName(source: string): string {
  const sep = Math.max(source.lastIndexOf("/"), source.lastIndexOf("\\"));
  return source.substring(sep + 1);
}

const toolbarButtonSx = { color: "rgba(255,255,255,0.8)" } as const;

export default function ImageViewer() {
  const platform = usePlatform();
  const t = useI18n();
  const images = useViewerStore((s) => s.images);
  const currentIndex = useViewerStore((s) => s.currentIndex);
  const isViewerOpen = useViewerStore((s) => s.isViewerOpen);
  const closeViewer = useViewerStore((s) => s.closeViewer);
  const setCurrentIndex = useViewerStore((s) => s.setCurrentIndex);
  const removeImage = useViewerStore((s) => s.removeImage);
  const confirmDeleteSetting = useSettingsStore((s) => s.confirmDelete);
  const showDeleteToast = useSettingsStore((s) => s.showDeleteToast);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snackOpen, setSnackOpen] = useState(false);
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  // Live zoom level (minZoom is 1), kept in a ref so reading it in the click
  // handler doesn't force re-renders on every zoom step.
  const zoomLevelRef = useRef(1);

  const currentImage = images[currentIndex];

  const slides = images.map((img) => ({
    src: platform.getImageUrl(img.source),
    width: img.width ?? undefined,
    height: img.height ?? undefined,
  }));

  const executeDelete = useCallback(async () => {
    if (!platform.capabilities.canDeleteFiles) return;
    const img = images[currentIndex];
    if (!img) return;
    try {
      await platform.deleteFile(img.source);
      removeImage(currentIndex);
      if (showDeleteToast) {
        setSnackOpen(true);
      }
      if (images.length <= 1) {
        closeViewer();
      }
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  }, [
    platform,
    images,
    currentIndex,
    removeImage,
    closeViewer,
    showDeleteToast,
  ]);

  const requestDelete = useCallback(() => {
    if (!platform.capabilities.canDeleteFiles) return;
    if (confirmDeleteSetting) {
      setConfirmOpen(true);
    } else {
      executeDelete();
    }
  }, [
    platform.capabilities.canDeleteFiles,
    confirmDeleteSetting,
    executeDelete,
  ]);

  const copyImage = useCallback(async () => {
    const img = images[currentIndex];
    if (!img) return;
    try {
      const res = await fetch(platform.getImageUrl(img.source));
      const blob = await res.blob();
      // The async Clipboard API only accepts image/png, so re-encode via a
      // canvas — this makes Copy work regardless of the source format.
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      bitmap.close();
      const png = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (png) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": png }),
        ]);
      }
    } catch (err) {
      console.error("Failed to copy image:", err);
    }
  }, [images, currentIndex, platform]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // "Delete" is forward-delete (fn+⌫), absent on most Mac keyboards; the
      // Mac delete key (⌫, also ⌘⌫ for Move to Trash) reports as "Backspace".
      // Handle both so the shortcut works across platforms.
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        platform.capabilities.canDeleteFiles
      ) {
        e.preventDefault();
        requestDelete();
      }
    },
    [platform.capabilities.canDeleteFiles, requestDelete],
  );

  useEffect(() => {
    if (!isViewerOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isViewerOpen, handleKeyDown]);

  // Native right-click menu over the open viewer (desktop only). A
  // document-level listener avoids wrapping the lightbox's own DOM.
  useEffect(() => {
    if (!isViewerOpen || !platform.showContextMenu) return;
    const showMenu = platform.showContextMenu;
    const onContextMenu = (e: MouseEvent) => {
      const img = images[currentIndex];
      if (!img) return;
      const items: ContextMenuEntry[] = [];
      if (platform.capabilities.canRevealFile) {
        items.push({
          label: t.contextMenu.reveal,
          action: () => platform.revealFile(img.source),
        });
      }
      items.push({ label: t.contextMenu.copyImage, action: () => copyImage() });
      if (platform.capabilities.canDeleteFiles) {
        items.push(
          { separator: true },
          { label: t.contextMenu.delete, action: () => requestDelete() },
        );
      }
      e.preventDefault();
      void showMenu(items);
    };
    document.addEventListener("contextmenu", onContextMenu);
    return () => document.removeEventListener("contextmenu", onContextMenu);
  }, [
    isViewerOpen,
    platform,
    images,
    currentIndex,
    t,
    copyImage,
    requestDelete,
  ]);

  // The lightbox chrome stays hidden and is revealed only while the pointer is
  // moving (hover), then hides again after a short idle delay. Keyboard
  // navigation, clicks and wheel deliberately don't reveal it, so paging
  // through images keeps the chrome out of the way. A local `visible` flag
  // dedupes so the frequent mousemove events don't re-render while it's
  // already showing.
  useEffect(() => {
    if (!isViewerOpen) return;
    let visible = false;
    let timer: ReturnType<typeof setTimeout>;
    const set = (next: boolean) => {
      if (next !== visible) {
        visible = next;
        setControlsVisible(next);
      }
    };
    const reveal = () => {
      set(true);
      clearTimeout(timer);
      timer = setTimeout(() => set(false), 1000);
    };
    document.addEventListener("mousemove", reveal, { passive: true });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousemove", reveal);
      setControlsVisible(false);
    };
  }, [isViewerOpen]);

  if (!isViewerOpen) return null;

  const toolbarButtons: (string | React.ReactNode)[] = [];

  if (currentImage) {
    toolbarButtons.push(
      <Tooltip key="info" title={t.viewer.info}>
        <IconButton
          className="yarl__button"
          sx={toolbarButtonSx}
          onMouseEnter={(e) => setInfoAnchor(e.currentTarget)}
          onMouseLeave={() => setInfoAnchor(null)}
        >
          <InfoOutlined />
        </IconButton>
      </Tooltip>,
    );

    if (platform.capabilities.canRevealFile) {
      toolbarButtons.push(
        <Tooltip key="folder" title={t.viewer.revealInFolder}>
          <IconButton
            className="yarl__button"
            sx={toolbarButtonSx}
            onClick={() => platform.revealFile(currentImage.source)}
          >
            <FolderOpenOutlined />
          </IconButton>
        </Tooltip>,
      );
    }

    if (platform.capabilities.canDeleteFiles) {
      toolbarButtons.push(
        <Tooltip key="delete" title={t.viewer.deleteConfirm}>
          <IconButton
            className="yarl__button"
            sx={toolbarButtonSx}
            onClick={requestDelete}
          >
            <DeleteOutlined />
          </IconButton>
        </Tooltip>,
      );
    }
  }

  toolbarButtons.push("close");

  return (
    <>
      <Lightbox
        open={isViewerOpen}
        close={closeViewer}
        className={controlsVisible ? "mg-show-controls" : undefined}
        slides={slides}
        index={currentIndex}
        on={{
          view: ({ index }) => setCurrentIndex(index),
          // Track the live zoom level so `click` can tell a plain click at fit
          // from the click that browsers dispatch at the end of a pan-drag.
          zoom: ({ zoom }) => {
            zoomLevelRef.current = zoom;
          },
          // A single click at fit dismisses the viewer. While zoomed in a click
          // is the tail of a pan-drag (releasing a pan fires a click on the same
          // element), so leave the viewer open. Closing at fit also retires
          // double-click-to-zoom: the first click closes, so the second of a
          // would-be double-click never lands.
          click: () => {
            if (zoomLevelRef.current <= 1) closeViewer();
          },
        }}
        plugins={[Counter, Zoom]}
        // Instant slide-to-slide transitions: 0ms for swipe (drag) and
        // navigation (arrow keys / nav buttons). `fade` is left at its default
        // so the lightbox still fades in/out on open/close.
        animation={{ swipe: 0, navigation: 0 }}
        carousel={{
          // Drop the default 16px slide padding so images fill the viewport
          // edge-to-edge.
          padding: 0,
          // Open every image at fullscreen fit (the minimum zoom). YARL's
          // contain fit downscales large images to the viewport but pins
          // smaller-than-viewport images to their native size
          // (maxWidth: min(<native>px, 100%)), leaving them floating small.
          // Upscale just those — both dimensions within the viewport — to fill,
          // preserving aspect via the default object-fit: contain. Such images
          // already have maxZoom === 1, so stretching them can't disturb any
          // zoom/pan math; images at or above the viewport size keep YARL's
          // exact default sizing and stay zoomable to native.
          imageProps: (slide) => {
            const { width, height } = slide as {
              width?: number;
              height?: number;
            };
            if (
              typeof window === "undefined" ||
              !width ||
              !height ||
              width > window.innerWidth ||
              height > window.innerHeight
            ) {
              return {};
            }
            return {
              style: {
                width: "100%",
                height: "100%",
                maxWidth: "100%",
                maxHeight: "100%",
              },
            };
          },
        }}
        zoom={{
          scrollToZoom: true,
          // Cap zoom-in at the image's native resolution — the maximum is the
          // original pixels, never magnified beyond.
          maxZoomPixelRatio: 1,
        }}
        controller={{
          closeOnBackdropClick: true,
        }}
        toolbar={{
          buttons: toolbarButtons,
        }}
      />

      {/* Info popover */}
      <Popover
        open={Boolean(infoAnchor)}
        anchorEl={infoAnchor}
        onClose={() => setInfoAnchor(null)}
        disableRestoreFocus
        sx={{ pointerEvents: "none", zIndex: 10000 }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        {currentImage && (
          <div style={{ padding: 12, maxWidth: 400, pointerEvents: "auto" }}>
            <Typography variant="body2">
              {t.viewer.fileName}: {getFileName(currentImage.source)}
            </Typography>
            {currentImage.width && currentImage.height && (
              <Typography variant="body2">
                {t.viewer.dimensions}: {currentImage.width} x{" "}
                {currentImage.height}
              </Typography>
            )}
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {t.viewer.filePath}: {currentImage.source}
            </Typography>
          </div>
        )}
      </Popover>

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        sx={{ zIndex: 10000 }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DialogTitle>{t.viewer.deleteConfirm}</DialogTitle>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>
            {t.actions.close}
          </Button>
          <Button
            color="error"
            autoFocus
            onClick={() => {
              setConfirmOpen(false);
              executeDelete();
            }}
          >
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete success toast */}
      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{ zIndex: 10000 }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSnackOpen(false)}
        >
          {t.viewer.deleteSuccess}
        </Alert>
      </Snackbar>
    </>
  );
}
