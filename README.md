# Mason Gallery

![banner](./public/logo/banner.svg)

Masonry layout Image Viewer — desktop, web, and CLI.

[繁体中文](./doc/readme/zh-Hant.md)

## Monorepo Structure

```
packages/
├── core/       — Shared UI components, stores, types, i18n
├── desktop/    — Tauri desktop app (Windows, macOS, Linux)
├── web/        — Static web SPA (Chromium browsers)
└── cli/        — npm CLI that serves the web build locally
```

## Development

### Prerequisites

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install) (for desktop only)
- [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) (for desktop only)

```bash
bun install
```

### Desktop

```bash
bun run dev:desktop
```

### Web

```bash
bun run dev:web
```

### CLI

```bash
bun run build:cli
```

### Linting & Type Checking

```bash
bun run check     # biome ci + tsc --build
bun run format    # biome format --write
```
