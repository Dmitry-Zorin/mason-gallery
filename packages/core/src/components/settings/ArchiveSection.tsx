import { Button, Divider, MenuItem, Select, Typography } from "@mui/material";
import { useLocation } from "wouter";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type {
  CacheCleanupStrategy,
  PasswordStorageMode,
} from "@/types/platform";

export default function ArchiveSection() {
  const t = useI18n();
  const setOpen = useAppStore((s) => s.setSettingsOpen);
  const [, navigate] = useLocation();

  const cacheCleanupStrategy = useSettingsStore((s) => s.cacheCleanupStrategy);
  const setCacheCleanupStrategy = useSettingsStore(
    (s) => s.setCacheCleanupStrategy,
  );
  const passwordStorageMode = useSettingsStore((s) => s.passwordStorageMode);
  const setPasswordStorageMode = useSettingsStore(
    (s) => s.setPasswordStorageMode,
  );

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" sx={{ mb: 2 }}>
        {t.archive.settingsSection}
      </Typography>

      {/* Cache Cleanup */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.archive.cacheCleanup}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={cacheCleanupStrategy}
        onChange={(e) =>
          setCacheCleanupStrategy(e.target.value as CacheCleanupStrategy)
        }
        sx={{ mb: 2 }}
      >
        <MenuItem value="auto-clean">{t.archive.autoClean}</MenuItem>
        <MenuItem value="keep-all">{t.archive.keepAll}</MenuItem>
      </Select>

      {/* Password Storage */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.archive.passwordStorage}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={passwordStorageMode}
        onChange={(e) =>
          setPasswordStorageMode(e.target.value as PasswordStorageMode)
        }
        sx={{ mb: 2 }}
      >
        <MenuItem value="none">{t.archive.dontSave}</MenuItem>
        <MenuItem value="plaintext">{t.archive.plaintext}</MenuItem>
      </Select>
      {passwordStorageMode === "plaintext" && (
        <Typography
          variant="caption"
          color="warning.main"
          sx={{ display: "block", mt: -1, mb: 2 }}
        >
          {t.archive.plaintextWarning}
        </Typography>
      )}

      {/* Manage Cache Link */}
      <Button
        variant="outlined"
        size="small"
        fullWidth
        onClick={() => {
          setOpen(false);
          navigate("/cache");
        }}
      >
        {t.archive.manageCache}
      </Button>
    </>
  );
}
