import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Slider,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";
import type { LayoutMode } from "@/types";

function BreakpointRow({
  rangeLabel,
  count,
  unitLabel,
  canDelete,
  onChange,
  onDelete,
}: {
  rangeLabel: string;
  count: number;
  unitLabel: string;
  canDelete: boolean;
  onChange: (cols: number) => void;
  onDelete: () => void;
}) {
  // Local text state so the field can be cleared/retyped freely; commit
  // (clamped to 1–10) on blur or Enter, reverting to the last valid value when
  // the input is empty or out of range.
  const [text, setText] = useState(String(count));
  useEffect(() => {
    setText(String(count));
  }, [count]);

  const t = useI18n();

  const commit = () => {
    const val = Number.parseInt(text, 10);
    if (Number.isFinite(val) && val >= 1 && val <= 10) {
      if (val !== count) onChange(val);
      setText(String(val));
    } else {
      setText(String(count));
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
      <Typography variant="body2" sx={{ minWidth: 100 }} title={rangeLabel}>
        {rangeLabel}
      </Typography>
      <TextField
        size="small"
        type="number"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        slotProps={{ htmlInput: { min: 1, max: 10 } }}
        sx={{ width: 80 }}
      />
      <Typography variant="body2" color="text.secondary">
        {unitLabel}
      </Typography>
      {canDelete && (
        <IconButton
          size="small"
          aria-label={t.actions.delete}
          onClick={onDelete}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );
}

export default function ColumnsSection() {
  const t = useI18n();
  const breakpoints = useSettingsStore((s) => s.breakpoints);
  const setBreakpoints = useSettingsStore((s) => s.setBreakpoints);
  const layoutMode = useSettingsStore((s) => s.layoutMode);
  const setLayoutMode = useSettingsStore((s) => s.setLayoutMode);
  const rowHeight = useSettingsStore((s) => s.rowHeight);
  const setRowHeight = useSettingsStore((s) => s.setRowHeight);

  const [newBpWidth, setNewBpWidth] = useState("");

  return (
    <>
      {/* Layout mode */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t.settings.layout}
      </Typography>
      <Select
        fullWidth
        size="small"
        value={layoutMode}
        onChange={(e) => setLayoutMode(e.target.value as LayoutMode)}
        sx={{ mb: 2 }}
      >
        <MenuItem value="masonry">{t.settings.layoutMasonry}</MenuItem>
        <MenuItem value="justified">{t.settings.layoutJustified}</MenuItem>
      </Select>

      {/* Justified-rows target height */}
      {layoutMode === "justified" && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t.settings.rowHeight}
          </Typography>
          <Slider
            value={rowHeight}
            onChange={(_, v) => setRowHeight(v as number)}
            min={360}
            max={2160}
            step={60}
            valueLabelDisplay="auto"
            sx={{ mb: 2 }}
          />
        </>
      )}

      {/* Waterfall Column Breakpoints (masonry only) */}
      {layoutMode === "masonry" && (
        <>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t.settings.columns}
          </Typography>
          {(() => {
            const sortedKeys = Object.keys(breakpoints)
              .map(Number)
              .sort((a, b) => a - b);
            return sortedKeys.map((bp, i) => {
              const nextBp = sortedKeys[i + 1];
              const rangeLabel =
                nextBp !== undefined ? `${bp}–${nextBp - 1} px` : `≥ ${bp} px`;
              return (
                <BreakpointRow
                  key={bp}
                  rangeLabel={rangeLabel}
                  count={breakpoints[bp] ?? 1}
                  unitLabel={t.settings.columnsUnit}
                  canDelete={sortedKeys.length > 1}
                  onChange={(cols) =>
                    setBreakpoints({ ...breakpoints, [bp]: cols })
                  }
                  onDelete={() => {
                    const next = { ...breakpoints };
                    delete next[bp];
                    setBreakpoints(next);
                  }}
                />
              );
            });
          })()}
          <Box sx={{ display: "flex", gap: 1, mb: 2, alignItems: "center" }}>
            <TextField
              size="small"
              type="number"
              placeholder={t.settings.breakpointWidthPlaceholder}
              value={newBpWidth}
              onChange={(e) => setNewBpWidth(e.target.value)}
              slotProps={{ htmlInput: { min: 0 } }}
              sx={{ width: 100 }}
            />
            <IconButton
              size="small"
              aria-label={t.actions.add}
              onClick={() => {
                const w = Number.parseInt(newBpWidth, 10);
                if (!Number.isNaN(w) && w >= 0 && !(w in breakpoints)) {
                  setBreakpoints({ ...breakpoints, [w]: 1 });
                  setNewBpWidth("");
                }
              }}
            >
              <AddIcon />
            </IconButton>
          </Box>
        </>
      )}
    </>
  );
}
