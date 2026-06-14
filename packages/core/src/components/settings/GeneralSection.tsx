import AddIcon from "@mui/icons-material/Add";
import {
  Box,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import { THEME_IDS, THEMES, type ThemeId } from "@/theme/themes";
import type { SortMethod } from "@/types";

export default function GeneralSection() {
  const t = useI18n();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const sortMethod = useSettingsStore((s) => s.sortMethod);
  const setSortMethod = useSettingsStore((s) => s.setSortMethod);
  const pageSize = useSettingsStore((s) => s.pageSize);
  const setPageSize = useSettingsStore((s) => s.setPageSize);
  const columnGutter = useSettingsStore((s) => s.columnGutter);
  const setColumnGutter = useSettingsStore((s) => s.setColumnGutter);
  const cornerRadius = useSettingsStore((s) => s.cornerRadius);
  const setCornerRadius = useSettingsStore((s) => s.setCornerRadius);
  const formats = useSettingsStore((s) => s.formats);
  const setFormats = useSettingsStore((s) => s.setFormats);

  const [newFormat, setNewFormat] = useState("");

  const handleAddFormat = () => {
    const fmt = newFormat.trim().toLowerCase();
    if (fmt && !formats.includes(fmt.startsWith(".") ? fmt : `.${fmt}`)) {
      setFormats([...formats, fmt.startsWith(".") ? fmt : `.${fmt}`]);
      setNewFormat("");
    }
  };

  const handleRemoveFormat = (fmt: string) => {
    setFormats(formats.filter((f) => f !== fmt));
  };

  return (
    <>
      {/* Theme */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.settings.theme}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={theme}
        onChange={(e) => setTheme(e.target.value as ThemeId)}
        sx={{ mb: 2 }}
      >
        {THEME_IDS.map((id) => (
          <MenuItem key={id} value={id}>
            {THEMES[id].label}
          </MenuItem>
        ))}
      </Select>

      {/* Sort Method */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.settings.sortMethod}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={sortMethod}
        onChange={(e) => setSortMethod(e.target.value as SortMethod)}
        sx={{ mb: 2 }}
      >
        <MenuItem value="name-asc">{t.settings.nameAsc}</MenuItem>
        <MenuItem value="name-desc">{t.settings.nameDesc}</MenuItem>
        <MenuItem value="time-asc">{t.settings.timeAsc}</MenuItem>
        <MenuItem value="time-desc">{t.settings.timeDesc}</MenuItem>
      </Select>

      {/* Page Size */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.settings.pageSize}
      </Typography>
      <Slider
        value={pageSize}
        onChange={(_, v) => setPageSize(v as number)}
        min={10}
        max={200}
        step={10}
        valueLabelDisplay="auto"
        sx={{ mb: 2 }}
      />

      {/* Tile Spacing */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.settings.tileSpacing}
      </Typography>
      <Slider
        value={columnGutter}
        onChange={(_, v) => setColumnGutter(v as number)}
        min={0}
        max={8}
        step={1}
        valueLabelDisplay="auto"
        sx={{ mb: 2 }}
      />

      {/* Corner Radius */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.settings.cornerRadius}
      </Typography>
      <Slider
        value={cornerRadius}
        onChange={(_, v) => setCornerRadius(v as number)}
        min={0}
        max={16}
        step={1}
        valueLabelDisplay="auto"
        sx={{ mb: 2 }}
      />

      {/* Image Formats */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.settings.formats}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
        {formats.map((fmt) => (
          <Chip
            key={fmt}
            label={fmt}
            size="small"
            onDelete={() => handleRemoveFormat(fmt)}
          />
        ))}
      </Box>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <TextField
          size="small"
          placeholder={t.settings.addFormat}
          value={newFormat}
          onChange={(e) => setNewFormat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddFormat();
          }}
          sx={{ flex: 1 }}
        />
        <IconButton size="small" onClick={handleAddFormat}>
          <AddIcon />
        </IconButton>
      </Box>
    </>
  );
}
