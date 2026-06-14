pub mod archive;
mod archive_commands;
pub mod archive_scan;
pub mod commands;
pub mod database;
mod open_with;
mod password;
mod server;
pub mod services;

use database::Database;
use server::{AllowedRoots, SharedPolicy};
use services::archive_service::ArchiveService;
use services::image_service::ImageService;
use services::policy::CachePolicy;
use services::source_service::SourceService;
use services::thumbnail_queue::ThumbnailQueue;
use services::thumbnail_service::ThumbnailService;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tauri::Manager;

pub struct CacheDir(pub PathBuf);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Created before the app is built so the macOS `RunEvent::Opened` handler
    // can hold it directly: that event can fire during window restoration,
    // before `setup` runs `app.manage`, so an `app.state()` lookup there would
    // panic — fatal inside the ObjC callback. `setup` manages a clone for the
    // `open_with_ready` command; both share the same buffer.
    let open_with = open_with::OpenWith::default();
    #[cfg(target_os = "macos")]
    let open_with_run = open_with.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _: Result<(), tauri::Error> = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_persisted_scope::init())
        .setup(move |app| {
            let allowed_roots: AllowedRoots = Arc::new(RwLock::new(HashSet::new()));

            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Failed to get app data dir: {}", e))?;
            let cache_dir = app_data_dir.join("archive-cache");

            let db = Arc::new(
                Database::new(&app_data_dir)
                    .map_err(|e| format!("Failed to initialize database: {}", e))?,
            );
            std::fs::create_dir_all(&cache_dir)
                .map_err(|e| format!("Failed to create cache dir: {}", e))?;

            app.manage(db.clone());
            app.manage(CacheDir(cache_dir.clone()));
            app.manage(open_with.clone());

            // Services
            let archive_svc = Arc::new(ArchiveService::new());
            let source_svc = Arc::new(SourceService::new(db.clone()));
            let thumbnail_svc = Arc::new(ThumbnailService::new(db.clone(), cache_dir.clone()));
            let extract_locks = services::new_extract_locks();
            let password_cache = Arc::new(password::PasswordCache::new());
            app.manage(password_cache.clone());
            let image_svc = Arc::new(ImageService::new(
                db.clone(),
                archive_svc.clone(),
                source_svc.clone(),
                password_cache.clone(),
                extract_locks.clone(),
                cache_dir.clone(),
                allowed_roots.clone(),
            ));
            app.manage(archive_svc.clone());
            app.manage(source_svc.clone());
            app.manage(thumbnail_svc.clone());
            app.manage(image_svc.clone());
            app.manage(extract_locks.clone());

            let policy: SharedPolicy = Arc::new(RwLock::new(CachePolicy::default()));
            app.manage(policy.clone());

            // Thumbnail request queue (LIFO) for lazy folder thumbnails. Run as
            // many concurrent generations as the machine has cores minus one
            // (leaving a core for the UI / scan), clamped to a sane floor. Each
            // task is CPU-bound (decode + resize + encode); with the DB tally now
            // updated in a single short transaction per entry, workers no longer
            // serialize on the connection lock, so this parallelism pays off.
            // The worker task is spawned below after the app handle is available.
            let thumb_concurrency = std::thread::available_parallelism()
                .map(|n| n.get().saturating_sub(1))
                .unwrap_or(4)
                .max(2);
            let thumb_queue = ThumbnailQueue::new(thumb_concurrency);
            app.manage(thumb_queue.clone());

            let worker_handle = app.handle().clone();
            let worker_queue = thumb_queue.clone();
            let worker_thumb_svc = thumbnail_svc.clone();
            let worker_source_svc = source_svc.clone();
            let worker_policy = policy.clone();
            tauri::async_runtime::spawn(async move {
                commands::run_thumbnail_worker(
                    worker_handle,
                    worker_queue,
                    worker_thumb_svc,
                    worker_source_svc,
                    worker_policy,
                )
                .await;
            });

            // Cache dir is an allowed root (thumbnail + extracted paths live under it).
            {
                let mut roots = allowed_roots.write().unwrap();
                if let Ok(canonical) = std::fs::canonicalize(&cache_dir) {
                    roots.insert(canonical);
                } else {
                    roots.insert(cache_dir.clone());
                }
            }

            let port = tauri::async_runtime::block_on(server::start_server(
                db.clone(),
                image_svc.clone(),
                thumbnail_svc.clone(),
                source_svc.clone(),
                policy.clone(),
                cache_dir.clone(),
            ))
            .map_err(|e| e.to_string())?;

            app.manage(server::ServerState {
                port,
                allowed_roots,
            });

            // macOS uses the real system menu bar instead of the in-window
            // titlebar (hidden in App.tsx). Other platforms keep the custom
            // titlebar and need no native menu.
            #[cfg(target_os = "macos")]
            setup_macos_menu(app)?;

            // Windows/Linux use a borderless custom header (CSD): the in-window
            // titlebar provides the menu and window controls. The base config
            // is decorated for macOS's overlay title bar, so strip decorations
            // on the other platforms to avoid a native title bar stacked above
            // the custom header. (Per-platform config can't do this here — the
            // tauri.<platform>.conf.json merge clobbers the windows array.)
            #[cfg(not(target_os = "macos"))]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_directory,
            commands::list_directory_tree,
            commands::delete_to_trash,
            commands::open_devtools,
            commands::get_image_server_port,
            commands::request_thumbnail,
            commands::cancel_thumbnail,
            archive_commands::scan_archive,
            archive_commands::get_archive_info,
            archive_commands::get_cache_stats,
            archive_commands::clear_thumbnails,
            archive_commands::clear_extracted,
            archive_commands::pin_cache,
            archive_commands::unlock_archive,
            archive_commands::check_migration,
            archive_commands::confirm_migration,
            archive_commands::startup_cache_cleanup,
            archive_commands::set_cache_policy,
            archive_commands::set_source_policy,
            open_with::open_with_ready,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        // On macOS, "Open With" on an image and folder-drop on the Dock icon
        // arrive here as `RunEvent::Opened`. The variant is macOS/iOS-only, so
        // the match is cfg-gated; other platforms run the loop with no handler.
        .run(move |_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &_event {
                open_with::handle_open_urls(_app, &open_with_run, urls);
            }
        });
}

/// Build and install the native macOS menu bar.
///
/// On macOS the in-window titlebar/menu is hidden (see App.tsx and
/// tauri.macos.conf.json), so the app's actions live in the real system
/// menu. Custom items emit a `menu` event carrying their id, which the
/// frontend dispatches to the matching action; predefined items (Quit,
/// Copy, Minimize, Enter Full Screen, …) are handled natively by macOS.
#[cfg(target_os = "macos")]
fn setup_macos_menu(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
    use tauri::Emitter;

    let h = app.handle().clone();

    let about = MenuItemBuilder::with_id("about", "About MasonGallery").build(&h)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings…").build(&h)?;
    let open_folder = MenuItemBuilder::with_id("open_folder", "Open Folder…")
        .accelerator("Cmd+O")
        .build(&h)?;
    let open_archive = MenuItemBuilder::with_id("open_archive", "Open Archive…")
        .accelerator("Shift+Cmd+O")
        .build(&h)?;
    let reset = MenuItemBuilder::with_id("reset", "Reset").build(&h)?;
    let refresh = MenuItemBuilder::with_id("refresh", "Refresh")
        .accelerator("Cmd+R")
        .build(&h)?;
    let toggle_sidebar = MenuItemBuilder::with_id("toggle_sidebar", "Toggle Sidebar")
        .accelerator("Cmd+B")
        .build(&h)?;
    let devtools = MenuItemBuilder::with_id("devtools", "Toggle Developer Tools")
        .accelerator("Alt+Cmd+I")
        .build(&h)?;

    let app_menu = SubmenuBuilder::new(&h, "MasonGallery")
        .item(&about)
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let file_menu = SubmenuBuilder::new(&h, "File")
        .item(&open_folder)
        .item(&open_archive)
        .separator()
        .item(&reset)
        .build()?;
    let edit_menu = SubmenuBuilder::new(&h, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let view_menu = SubmenuBuilder::new(&h, "View")
        .item(&refresh)
        .item(&toggle_sidebar)
        .separator()
        .item(&devtools)
        .build()?;
    let window_menu = SubmenuBuilder::new(&h, "Window")
        .minimize()
        .maximize()
        .separator()
        .fullscreen()
        .build()?;

    let menu = MenuBuilder::new(&h)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])
        .build()?;
    h.set_menu(menu)?;

    h.on_menu_event(move |app, event| {
        let _ = app.emit("menu", event.id().0.clone());
    });

    Ok(())
}
