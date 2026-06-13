import { PlatformContext, Shell } from "@mason-gallery/core";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import MacDragRegion from "./components/MacDragRegion";
import Titlebar from "./components/Titlebar";
import UpdateChecker from "./components/UpdateChecker";
import { useNativeMenu } from "./lib/nativeMenu";
import { useIsFullscreen } from "./lib/useIsFullscreen";

// macOS uses the real system menu bar + native traffic lights via the overlay
// title bar (see lib.rs and tauri.conf.json), so the in-window titlebar is
// replaced by a thin transparent drag strip there.
const IS_MAC = navigator.platform.toLowerCase().includes("mac");

export default function App() {
  useNativeMenu();
  const isFullscreen = useIsFullscreen();

  // In fullscreen macOS hides the title bar (and traffic lights) entirely, so
  // the overlay drag strip and the 36px Shell reserves for it would leave a
  // blank band at the top. Drop the strip there to let content fill the screen.
  const macTitlebar = isFullscreen ? null : <MacDragRegion />;

  return (
    <PlatformContext.Provider value={tauriPlatformService}>
      <Shell
        titlebar={IS_MAC ? macTitlebar : <Titlebar />}
        updateChecker={<UpdateChecker />}
      />
    </PlatformContext.Provider>
  );
}
