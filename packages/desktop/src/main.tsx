import { setPlatform } from "@mason-gallery/core";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import { initWindowTitleSync } from "./windowTitle";
import "@mason-gallery/core/src/index.css";
import "./native.css";

setPlatform(tauriPlatformService);

// Keep the native window title in sync with the open folder/archive.
initWindowTitleSync();

// Suppress the webview's default context menu (Reload / Inspect Element /
// Save Image As…) in production so right-click feels native. Kept in dev so
// inspect-element still works.
if (import.meta.env.PROD) {
  document.addEventListener("contextmenu", (event) => event.preventDefault());
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
