import { FormControlLabel, Switch } from "@mui/material";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";

export default function BehaviorSection() {
  const t = useI18n();
  const platform = usePlatform();
  const showGridPosition = useSettingsStore((s) => s.showGridPosition);
  const setShowGridPosition = useSettingsStore((s) => s.setShowGridPosition);
  const confirmDelete = useSettingsStore((s) => s.confirmDelete);
  const setConfirmDelete = useSettingsStore((s) => s.setConfirmDelete);
  const showDeleteToast = useSettingsStore((s) => s.showDeleteToast);
  const setShowDeleteToast = useSettingsStore((s) => s.setShowDeleteToast);
  const vibrancy = useSettingsStore((s) => s.vibrancy);
  const setVibrancy = useSettingsStore((s) => s.setVibrancy);

  return (
    <>
      {/* Show Grid Position */}
      <FormControlLabel
        control={
          <Switch
            checked={showGridPosition}
            onChange={(e) => setShowGridPosition(e.target.checked)}
          />
        }
        label={t.settings.showGridPosition}
        sx={{ mb: 1 }}
      />

      {/* Confirm before delete */}
      <FormControlLabel
        control={
          <Switch
            checked={confirmDelete}
            onChange={(e) => setConfirmDelete(e.target.checked)}
          />
        }
        label={t.settings.confirmDelete}
        sx={{ mb: 1 }}
      />

      {/* Show delete toast */}
      <FormControlLabel
        control={
          <Switch
            checked={showDeleteToast}
            onChange={(e) => setShowDeleteToast(e.target.checked)}
          />
        }
        label={t.settings.showDeleteToast}
        sx={{ mb: platform.capabilities.canUseVibrancy ? 1 : 2 }}
      />

      {/* Window vibrancy — frosted glass (macOS desktop only) */}
      {platform.capabilities.canUseVibrancy && (
        <FormControlLabel
          control={
            <Switch
              checked={vibrancy}
              onChange={(e) => setVibrancy(e.target.checked)}
            />
          }
          label={t.settings.vibrancy}
          sx={{ mb: 2 }}
        />
      )}
    </>
  );
}
