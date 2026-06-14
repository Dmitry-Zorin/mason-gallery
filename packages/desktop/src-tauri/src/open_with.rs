//! "Open With" / drag-onto-icon support (macOS).
//!
//! When the app is launched on an image via Finder's "Open With" — or a folder
//! is dropped on the Dock icon — macOS delivers the paths as an open-documents
//! Apple Event, surfaced by Tauri as `RunEvent::Opened`. A file resolves to its
//! parent directory; a folder is used as-is. The result is scanned in the grid.
//!
//! On a cold start that event arrives during AppKit's window/document
//! restoration — *before* the `setup` hook has run and well before React has
//! mounted and attached its `open-paths` listener. So the state is a plain
//! `Arc` created before the app is built and captured directly by the
//! `RunEvent::Opened` handler: looking it up via `app.state()` that early would
//! panic (state not yet managed), and a panic inside the ObjC `openURLs:`
//! callback aborts the process. Derived folders are buffered until the frontend
//! signals readiness via `open_with_ready`; opens after that are emitted live.
//! The mutex makes the "buffer vs. emit" decision atomic with the readiness
//! flip, so no open is lost or handled twice.

use std::sync::{Arc, Mutex};

/// Event carrying folder paths to scan, listened for by the desktop frontend.
pub const OPEN_PATHS_EVENT: &str = "open-paths";

#[derive(Default)]
pub struct OpenState {
    /// Set once the frontend has attached its `open-paths` listener.
    ready: bool,
    /// Folders that arrived before the frontend was ready.
    pending: Vec<String>,
}

/// Shared open-with buffer. Cloned three ways — captured by the
/// `RunEvent::Opened` handler, managed for the `open_with_ready` command, and
/// all backed by the same `Mutex<OpenState>`.
pub type OpenWith = Arc<Mutex<OpenState>>;

/// Frontend handshake. Called once, immediately after the `open-paths`
/// listener is attached: marks the frontend ready and returns any folders
/// buffered during startup so the very first "Open With" is not dropped.
#[tauri::command]
pub fn open_with_ready(state: tauri::State<'_, OpenWith>) -> Vec<String> {
    let mut s = state.lock().unwrap();
    s.ready = true;
    std::mem::take(&mut s.pending)
}

/// Resolve opened URLs to the folder(s) to scan, then either emit them (if the
/// frontend is ready) or buffer them (if not). Must not panic: it runs inside
/// the non-unwinding ObjC `openURLs:` callback, where a panic aborts.
#[cfg(target_os = "macos")]
pub fn handle_open_urls(app: &tauri::AppHandle, state: &OpenWith, urls: &[tauri::Url]) {
    use tauri::{Emitter, Manager};

    let mut seen = std::collections::HashSet::new();
    let dirs: Vec<String> = urls
        .iter()
        .filter_map(|u| u.to_file_path().ok())
        .filter_map(|p| {
            // A folder opens itself; a file opens its containing folder.
            let dir = if p.is_dir() {
                p
            } else {
                p.parent()?.to_path_buf()
            };
            Some(dir.to_string_lossy().into_owned())
        })
        .filter(|d| seen.insert(d.clone()))
        .collect();

    if dirs.is_empty() {
        return;
    }

    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_focus();
    }

    let mut s = state.lock().unwrap();
    if s.ready {
        drop(s);
        let _ = app.emit(OPEN_PATHS_EVENT, dirs);
    } else {
        s.pending.extend(dirs);
    }
}
