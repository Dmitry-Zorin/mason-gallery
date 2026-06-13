import { PlatformContext, Shell } from "@mason-gallery/core";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import MacDragRegion from "./components/MacDragRegion";
import Titlebar from "./components/Titlebar";
import UpdateChecker from "./components/UpdateChecker";
import { useNativeMenu } from "./lib/nativeMenu";

// macOS uses the real system menu bar + native traffic lights via the overlay
// title bar (see lib.rs and tauri.conf.json), so the in-window titlebar is
// replaced by a thin transparent drag strip there.
const IS_MAC = navigator.platform.toLowerCase().includes("mac");

export default function App() {
  useNativeMenu();
  return (
    <PlatformContext.Provider value={tauriPlatformService}>
      <Shell
        titlebar={IS_MAC ? <MacDragRegion /> : <Titlebar />}
        updateChecker={<UpdateChecker />}
      />
    </PlatformContext.Provider>
  );
}
