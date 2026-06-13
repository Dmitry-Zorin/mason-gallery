import { setPlatform } from "@mason-gallery/core";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { tauriPlatformService } from "./adapters/TauriPlatformService";
import { initVibrancySync } from "./vibrancy";
import { initWindowTitleSync } from "./windowTitle";
import "@mason-gallery/core/src/index.css";
import "./native.css";

setPlatform(tauriPlatformService);

// Window vibrancy is macOS-only. Tag the root so native.css scopes its
// transparent surfaces to macOS; Windows/Linux stay opaque (a transparent
// window there would show the desktop through the UI).
if (navigator.platform.toLowerCase().includes("mac")) {
  document.documentElement.classList.add("is-mac");
}

// Keep the native window title in sync with the open folder/archive.
initWindowTitleSync();

// Apply the persisted window-vibrancy preference (macOS only).
initVibrancySync();

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
