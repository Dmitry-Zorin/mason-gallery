import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Select,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import type {
  CachePolicy,
  ExtractedMode,
  FolderThumbnailsMode,
  ThumbRetain,
} from "@/types/platform";

const MB = 1024 * 1024;

export default function CacheSection() {
  const t = useI18n();
  const platform = usePlatform();

  const cachePolicy = useSettingsStore((s) => s.cachePolicy);
  const setCachePolicy = useSettingsStore((s) => s.setCachePolicy);
  const thumbnailSizes = useSettingsStore((s) => s.thumbnailSizes);
  const setThumbnailSizes = useSettingsStore((s) => s.setThumbnailSizes);
  const folderThumbnails = useSettingsStore((s) => s.folderThumbnails);
  const setFolderThumbnails = useSettingsStore((s) => s.setFolderThumbnails);

  const [thumbSizesText, setThumbSizesText] = useState(
    thumbnailSizes.join(", "),
  );
  const [clearConfirm, setClearConfirm] = useState<
    null | "thumbs" | "extracted"
  >(null);
  const [snack, setSnack] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);

  const updateCachePolicy = (patch: Partial<CachePolicy>) => {
    setCachePolicy({ ...cachePolicy, ...patch });
  };

  const commitThumbSizes = () => {
    const parsed = thumbSizesText
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0 && n <= 4096)
      .sort((a, b) => a - b);
    if (parsed.length > 0) {
      setThumbnailSizes(parsed);
      setThumbSizesText(parsed.join(", "));
    } else {
      // Empty/invalid input — revert to the last committed value rather than
      // persisting an empty array (the backend rejects `widths: []` anyway).
      setThumbSizesText(thumbnailSizes.join(", "));
    }
  };

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {t.cache.section}
      </Typography>

      {/* Extracted cache mode */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.cache.extractedMode}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={cachePolicy.extracted.mode}
        onChange={(e) =>
          updateCachePolicy({
            extracted: {
              ...cachePolicy.extracted,
              mode: e.target.value as ExtractedMode,
            },
          })
        }
        sx={{ mb: 2 }}
      >
        <MenuItem value="no-cache">{t.cache.extractedModeNoCache}</MenuItem>
        <MenuItem value="lru-capped">{t.cache.extractedModeLru}</MenuItem>
        <MenuItem value="unlimited">{t.cache.extractedModeUnlimited}</MenuItem>
      </Select>

      {cachePolicy.extracted.mode === "lru-capped" && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t.cache.extractedMaxSizePerSource}
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            value={
              cachePolicy.extracted.maxSizePerSource != null
                ? Math.round(cachePolicy.extracted.maxSizePerSource / MB)
                : ""
            }
            onChange={(e) => {
              const mb = Number.parseInt(e.target.value, 10);
              updateCachePolicy({
                extracted: {
                  ...cachePolicy.extracted,
                  maxSizePerSource:
                    Number.isFinite(mb) && mb > 0 ? mb * MB : undefined,
                },
              });
            }}
            slotProps={{ htmlInput: { min: 0 } }}
            sx={{ mb: 2 }}
          />
        </>
      )}

      {cachePolicy.extracted.mode !== "no-cache" && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t.cache.extractedMinFileSize}
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            value={
              cachePolicy.extracted.minFileSize != null
                ? Math.round(cachePolicy.extracted.minFileSize / MB)
                : ""
            }
            onChange={(e) => {
              const mb = Number.parseInt(e.target.value, 10);
              updateCachePolicy({
                extracted: {
                  ...cachePolicy.extracted,
                  minFileSize:
                    Number.isFinite(mb) && mb > 0 ? mb * MB : undefined,
                },
              });
            }}
            slotProps={{ htmlInput: { min: 0 } }}
            sx={{ mb: 2 }}
          />
        </>
      )}

      {/* Thumbnail retention */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.cache.thumbnailRetention}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={cachePolicy.thumbnails.retain}
        onChange={(e) =>
          updateCachePolicy({
            thumbnails: {
              ...cachePolicy.thumbnails,
              retain: e.target.value as ThumbRetain,
            },
          })
        }
        sx={{ mb: 2 }}
      >
        <MenuItem value="until-source-removed">
          {t.cache.thumbnailRetainUntilRemoved}
        </MenuItem>
        <MenuItem value="lru-capped">{t.cache.thumbnailRetainLru}</MenuItem>
      </Select>

      {cachePolicy.thumbnails.retain === "lru-capped" && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t.cache.thumbnailMaxTotalSize}
          </Typography>
          <TextField
            fullWidth
            size="small"
            type="number"
            value={
              cachePolicy.thumbnails.maxTotalSize != null
                ? Math.round(cachePolicy.thumbnails.maxTotalSize / MB)
                : ""
            }
            onChange={(e) => {
              const mb = Number.parseInt(e.target.value, 10);
              updateCachePolicy({
                thumbnails: {
                  ...cachePolicy.thumbnails,
                  maxTotalSize:
                    Number.isFinite(mb) && mb > 0 ? mb * MB : undefined,
                },
              });
            }}
            slotProps={{ htmlInput: { min: 0 } }}
            sx={{ mb: 2 }}
          />
        </>
      )}

      {/* Thumbnail sizes */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.cache.thumbnailSizes}
      </Typography>
      <TextField
        fullWidth
        size="small"
        value={thumbSizesText}
        placeholder={t.cache.thumbnailSizesHint}
        onChange={(e) => setThumbSizesText(e.target.value)}
        onBlur={commitThumbSizes}
        onKeyDown={(e) => {
          if (e.key === "Enter") commitThumbSizes();
        }}
        sx={{ mb: 2 }}
      />

      {/* Folder thumbnail mode */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.cache.folderThumbnails}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={folderThumbnails}
        onChange={(e) =>
          setFolderThumbnails(e.target.value as FolderThumbnailsMode)
        }
        sx={{ mb: 1 }}
      >
        <MenuItem value="off">{t.cache.folderThumbnailsOff}</MenuItem>
        <MenuItem value="lazy">{t.cache.folderThumbnailsLazy}</MenuItem>
      </Select>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 2 }}
      >
        {t.cache.folderThumbnailsHint}
      </Typography>

      {/* Clear actions */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          color="error"
          onClick={() => setClearConfirm("thumbs")}
        >
          {t.cache.clearThumbs}
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="error"
          onClick={() => setClearConfirm("extracted")}
        >
          {t.cache.clearExtracted}
        </Button>
      </Box>

      <Dialog
        open={clearConfirm !== null}
        onClose={() => setClearConfirm(null)}
      >
        <DialogTitle>
          {clearConfirm === "thumbs"
            ? t.cache.clearThumbs
            : t.cache.clearExtracted}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {clearConfirm === "thumbs"
              ? t.cache.clearThumbsConfirm
              : t.cache.clearExtractedConfirm}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirm(null)}>
            {t.archive.cancel}
          </Button>
          <Button
            color="error"
            onClick={async () => {
              const which = clearConfirm;
              setClearConfirm(null);
              try {
                if (which === "thumbs") {
                  await platform.clearThumbnails();
                } else if (which === "extracted") {
                  await platform.clearExtracted();
                }
                setSnack({
                  severity: "success",
                  message: t.cache.clearDone,
                });
              } catch (e) {
                console.error("Failed to clear cache:", e);
                setSnack({
                  severity: "error",
                  message: t.cache.clearError,
                });
              }
            }}
          >
            {t.cache.confirm}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack !== null}
        autoHideDuration={3000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        sx={{ zIndex: 10000 }}
      >
        <Alert
          severity={snack?.severity ?? "success"}
          variant="filled"
          onClose={() => setSnack(null)}
        >
          {snack?.message}
        </Alert>
      </Snackbar>
    </>
  );
}
