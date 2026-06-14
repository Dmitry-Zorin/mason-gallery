import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, IconButton, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { useSettingsStore } from "@/stores/settingsStore";

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
        <IconButton size="small" onClick={onDelete}>
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

  const [newBpWidth, setNewBpWidth] = useState("");

  return (
    <>
      {/* Waterfall Column Breakpoints */}
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
  );
}
