import { TITLEBAR_HEIGHT } from "@mason-gallery/core";
import { Box } from "@mui/material";

/**
 * Transparent draggable strip for the macOS overlay title bar.
 *
 * `titleBarStyle: "Overlay"` extends the webview under the (invisible) native
 * title bar, so the window is only draggable where we opt in with
 * `data-tauri-drag-region`. This strip sits above the content for that; the
 * native traffic lights are painted by macOS on top of the webview and stay
 * clickable. Its height (TITLEBAR_HEIGHT) matches Shell's content top-padding,
 * keeping the grid clear of the traffic lights.
 */
export default function MacDragRegion() {
  return (
    <Box
      data-tauri-drag-region
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: TITLEBAR_HEIGHT,
        zIndex: (theme) => theme.zIndex.drawer + 2,
      }}
    />
  );
}
