import type { ThemeOptions } from "@mui/material";

export type ThemeId =
  | "classic"
  | "indigo"
  | "teal"
  | "amber"
  | "dracula"
  | "nord"
  | "gruvbox"
  | "tokyoNight"
  | "catppuccin"
  | "oneDark"
  | "rosePine"
  | "monokai"
  | "coffee"
  | "oled";

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  palette: ThemeOptions["palette"];
}

// Accents use the lighter tones of each palette — saturated variants read
// poorly against the near-black dark surfaces.
export const THEMES: Record<ThemeId, ThemeDefinition> = {
  classic: {
    id: "classic",
    label: "Classic Coral",
    palette: {
      mode: "dark",
      primary: { main: "#f4606c" },
    },
  },
  indigo: {
    id: "indigo",
    label: "Indigo Slate",
    palette: {
      mode: "dark",
      primary: { main: "#818cf8" },
      background: { default: "#1a1a1f", paper: "#1e1e24" },
    },
  },
  teal: {
    id: "teal",
    label: "Teal Studio",
    palette: {
      mode: "dark",
      primary: { main: "#2dd4bf" },
      background: { default: "#14181a", paper: "#1a2422" },
    },
  },
  amber: {
    id: "amber",
    label: "Amber Mono",
    palette: {
      mode: "dark",
      primary: { main: "#f59e0b" },
      background: { default: "#1a1813", paper: "#242017" },
    },
  },
  dracula: {
    id: "dracula",
    label: "Dracula",
    palette: {
      mode: "dark",
      primary: { main: "#bd93f9" },
      secondary: { main: "#ff79c6" },
      background: { default: "#282a36", paper: "#21222c" },
    },
  },
  nord: {
    id: "nord",
    label: "Nord",
    palette: {
      mode: "dark",
      primary: { main: "#88c0d0" },
      background: { default: "#2e3440", paper: "#3b4252" },
    },
  },
  gruvbox: {
    id: "gruvbox",
    label: "Gruvbox",
    palette: {
      mode: "dark",
      primary: { main: "#fe8019" },
      background: { default: "#282828", paper: "#3c3836" },
    },
  },
  tokyoNight: {
    id: "tokyoNight",
    label: "Tokyo Night",
    palette: {
      mode: "dark",
      primary: { main: "#7aa2f7" },
      background: { default: "#1a1b26", paper: "#24283b" },
    },
  },
  catppuccin: {
    id: "catppuccin",
    label: "Catppuccin Mocha",
    palette: {
      mode: "dark",
      primary: { main: "#cba6f7" },
      background: { default: "#1e1e2e", paper: "#313244" },
    },
  },
  oneDark: {
    id: "oneDark",
    label: "One Dark",
    palette: {
      mode: "dark",
      primary: { main: "#61afef" },
      background: { default: "#282c34", paper: "#21252b" },
    },
  },
  rosePine: {
    id: "rosePine",
    label: "Rosé Pine",
    palette: {
      mode: "dark",
      primary: { main: "#ebbcba" },
      secondary: { main: "#c4a7e7" },
      background: { default: "#191724", paper: "#1f1d2e" },
    },
  },
  monokai: {
    id: "monokai",
    label: "Monokai",
    palette: {
      mode: "dark",
      primary: { main: "#a6e22e" },
      secondary: { main: "#f92672" },
      background: { default: "#272822", paper: "#3e3d32" },
    },
  },
  coffee: {
    id: "coffee",
    label: "Coffee",
    palette: {
      mode: "dark",
      primary: { main: "#d4a373" },
      secondary: { main: "#a3785a" },
      background: { default: "#2a211b", paper: "#3a2e25" },
    },
  },
  // Pure black background — OLED pixels switch off entirely.
  oled: {
    id: "oled",
    label: "OLED Black",
    palette: {
      mode: "dark",
      primary: { main: "#4cc9f0" },
      background: { default: "#000000", paper: "#0a0a0a" },
    },
  },
};

export const DEFAULT_THEME_ID: ThemeId = "classic";

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
