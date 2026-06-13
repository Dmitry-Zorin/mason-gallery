# CHANGELOG

## [Unreleased]

### added
- lazy folder-thumbnail pipeline (`folderThumbnails: "off" | "lazy"`): on-demand generation gated by an IntersectionObserver + dwell timer, drained by a LIFO queue with a bounded concurrency semaphore
- per-source cache policy (`no-cache` / `lru-capped` / `unlimited`) and configurable thumbnail widths
- dedicated source and thumbnail services backing a unified `sources` SQLite store

### changed
- split image delivery into separate original (`/image`) and thumbnail (`/thumb`) endpoints; the grid now builds a multi-width `srcSet` while the viewer always loads originals
- align the web and desktop platform service interfaces around the split-delivery model

### performance
- parallelize thumbnail generation during archive scans

### fixed
- improve the drag-and-drop DropZone experience

## [2.1.0] - 2026-04-11

### added
- archive browsing (zip / rar / 7z): inline-expand archives encountered during folder scans, click-to-unlock for locked archives, and encrypted password storage
- archive-to-folder migration detection via reverse path-segment matching

## [2.0.0] - 2026-04-08

### added
- introduce monorepo architecture (core, desktop, web, cli)
- add multi-platform support (desktop, web, cli)
- add folder sidebar and directory tree
- add position indicator and jump
- add incremental refresh and scan progress
- add i18n support

### changed
- migrate desktop to tauri v2 and react 19
- redesign UI with new layout and top menu bar
- introduce platform abstraction layer

### performance
- add axum-based local image server
- parallelize image scanning with rayon
- optimize virtual scrolling and layout prefill

### developer
- replace eslint + prettier with biome
- add github actions ci/cd

### breaking
- full rewrite, no migration from v1
