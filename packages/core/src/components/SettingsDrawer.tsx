import CloseIcon from "@mui/icons-material/Close";
import { Box, Divider, Drawer, IconButton, Typography } from "@mui/material";
import ArchiveSection from "@/components/settings/ArchiveSection";
import BehaviorSection from "@/components/settings/BehaviorSection";
import CacheSection from "@/components/settings/CacheSection";
import ColumnsSection from "@/components/settings/ColumnsSection";
import GeneralSection from "@/components/settings/GeneralSection";
import { usePlatform } from "@/context/PlatformContext";
import { useI18n } from "@/i18n";
import { useAppStore } from "@/stores/appStore";

export default function SettingsDrawer() {
  const t = useI18n();
  const isOpen = useAppStore((s) => s.isSettingsOpen);
  const setOpen = useAppStore((s) => s.setSettingsOpen);
  const canBrowseArchives = usePlatform().capabilities.canBrowseArchives;

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={() => setOpen(false)}
      sx={{
        "& .MuiDrawer-paper": { width: 340, overflowX: "hidden" },
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="h6">{t.settings.title}</Typography>
          <IconButton onClick={() => setOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <GeneralSection />
        <BehaviorSection />
        <ColumnsSection />

        {canBrowseArchives && (
          <>
            <ArchiveSection />
            <CacheSection />
          </>
        )}
      </Box>
    </Drawer>
  );
}
