use crate::database::Database;
use crate::services::archive_service::{ArchiveService, ExtractResult};
use crate::services::image_service::ImageService;
use crate::services::policy::{parse_override, CachePolicy};
use crate::services::thumbnail_service::ThumbnailService;
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::collections::HashSet;
use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use tokio::net::TcpListener;

pub type AllowedRoots = Arc<RwLock<HashSet<PathBuf>>>;
pub type SharedPolicy = Arc<RwLock<CachePolicy>>;

pub struct ServerState {
    pub port: u16,
    pub token: String,
    pub allowed_roots: AllowedRoots,
}

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub image_svc: Arc<ImageService>,
    pub thumbnail_svc: Arc<ThumbnailService>,
    pub policy: SharedPolicy,
    /// Per-launch random token required on every request (`?t=`); paired with the
    /// bound port for Host-header validation. Guards the local server against
    /// other localhost processes and DNS-rebinding attacks.
    pub token: String,
    pub port: u16,
}

#[derive(serde::Deserialize)]
struct ImageQuery {
    path: Option<String>,
    t: Option<String>,
}

#[derive(serde::Deserialize)]
struct ThumbQuery {
    source: Option<String>,
    entry: Option<String>,
    w: Option<u32>,
    t: Option<String>,
}

fn content_type_for_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn compute_etag(path: &Path, metadata: &fs::Metadata) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    if let Ok(modified) = metadata.modified() {
        modified.hash(&mut hasher);
    }
    metadata.len().hash(&mut hasher);
    format!("\"{:x}\"", hasher.finish())
}

/// Constant-time-ish comparison of the request token against the expected one.
/// Avoids early-exit on the first differing byte to reduce timing signal.
fn token_ok(provided: Option<&str>, expected: &str) -> bool {
    let Some(provided) = provided else {
        return false;
    };
    if provided.len() != expected.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (a, b) in provided.bytes().zip(expected.bytes()) {
        diff |= a ^ b;
    }
    diff == 0
}

/// Validate the `Host` header against the local server's own address to harden
/// against DNS-rebinding. Only `127.0.0.1:<port>` and `localhost:<port>` are
/// accepted. A missing/unparseable header is rejected.
fn host_ok(headers: &HeaderMap, port: u16) -> bool {
    let Some(host) = headers.get(header::HOST).and_then(|h| h.to_str().ok()) else {
        return false;
    };
    host == format!("127.0.0.1:{}", port).as_str() || host == format!("localhost:{}", port).as_str()
}

/// Shared gate for both endpoints: reject before any work happens.
/// Returns `Some(response)` (403/401) on failure, `None` when authorized.
fn check_auth(headers: &HeaderMap, state: &AppState, token: Option<&str>) -> Option<Response> {
    if !host_ok(headers, state.port) {
        return Some(StatusCode::FORBIDDEN.into_response());
    }
    if !token_ok(token, &state.token) {
        return Some(StatusCode::UNAUTHORIZED.into_response());
    }
    None
}

/// Compute effective policy for an archive URI by merging per-source override
/// on top of the base. For non-archive URIs, returns the base unchanged.
fn effective_policy(state: &AppState, uri: &str) -> CachePolicy {
    let base = state.policy.read().map(|p| p.clone()).unwrap_or_default();
    if let Some(rest) = uri.strip_prefix("archive:///") {
        if let Some((archive_path, _)) = rest.split_once('#') {
            let archive_path = crate::archive::decode_archive_path(archive_path);
            if let Ok(Some(src)) = state.db.get_source_by_path(&archive_path) {
                if let Some(json) = src.policy_override.as_deref() {
                    if let Some(over) = parse_override(Some(json)) {
                        return base.merged_with(Some(&over));
                    }
                }
            }
        }
    }
    base
}

async fn image_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ImageQuery>,
) -> Response {
    if let Some(resp) = check_auth(&headers, &state, query.t.as_deref()) {
        return resp;
    }

    let raw_path = match query.path {
        Some(p) if !p.is_empty() => p,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'path' query parameter").into_response(),
    };

    let policy = effective_policy(&state, &raw_path);
    let resolved = match state.image_svc.resolve_original(&raw_path, &policy).await {
        Ok(r) => r,
        Err(msg) => {
            // Map to a status code, but never leak the raw error (which may
            // contain filesystem paths from {:?}-formatted archive errors) to
            // the HTTP body. Log details server-side instead.
            let (code, public) = if msg.starts_with("Forbidden") {
                (StatusCode::FORBIDDEN, "Forbidden")
            } else if msg.contains("PasswordRequired") || msg.contains("WrongPassword") {
                (StatusCode::UNAUTHORIZED, "Unauthorized")
            } else {
                (StatusCode::NOT_FOUND, "Not found")
            };
            eprintln!("image_handler: {} ({})", public, msg);
            return (code, public).into_response();
        }
    };

    serve_extract(resolved, &headers)
}

async fn thumb_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ThumbQuery>,
) -> Response {
    if let Some(resp) = check_auth(&headers, &state, query.t.as_deref()) {
        return resp;
    }

    let source_hash = match query.source {
        Some(s) if !s.is_empty() => s,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'source'").into_response(),
    };
    let entry_hash = match query.entry {
        Some(e) if !e.is_empty() => e,
        _ => return (StatusCode::BAD_REQUEST, "Missing 'entry'").into_response(),
    };
    let width = match query.w {
        Some(w) if w > 0 => w,
        _ => return (StatusCode::BAD_REQUEST, "Missing or invalid 'w'").into_response(),
    };

    let path = match state
        .thumbnail_svc
        .resolve(&source_hash, &entry_hash, width)
    {
        Some(p) => p,
        None => return StatusCode::NOT_FOUND.into_response(),
    };

    serve_file(&path, &headers)
}

fn serve_extract(result: ExtractResult, headers: &HeaderMap) -> Response {
    match result {
        ExtractResult::Cached(p) | ExtractResult::FreshPersisted(p) => serve_file(&p, headers),
        ExtractResult::Tempfile(temp_path) => {
            // Read the bytes out, then drop `temp_path` so the tempfile is cleaned up.
            let path_buf: PathBuf = temp_path.to_path_buf();
            let response = serve_file(&path_buf, headers);
            // `temp_path` drops here → deletes the file.
            drop(temp_path);
            response
        }
    }
}

fn serve_file(canonical: &Path, headers: &HeaderMap) -> Response {
    let metadata = match fs::metadata(canonical) {
        Ok(m) => m,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    if !metadata.is_file() {
        return StatusCode::NOT_FOUND.into_response();
    }

    let etag = compute_etag(canonical, &metadata);

    if let Some(if_none_match) = headers.get(header::IF_NONE_MATCH) {
        if let Ok(val) = if_none_match.to_str() {
            if val == etag {
                return StatusCode::NOT_MODIFIED.into_response();
            }
        }
    }

    let body = match fs::read(canonical) {
        Ok(b) => b,
        Err(_) => return StatusCode::NOT_FOUND.into_response(),
    };

    let ext = canonical
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        header::CONTENT_TYPE,
        content_type_for_ext(&ext).parse().unwrap(),
    );
    response_headers.insert(
        header::CACHE_CONTROL,
        "private, max-age=3600, immutable".parse().unwrap(),
    );
    response_headers.insert(header::ETAG, etag.parse().unwrap());

    (StatusCode::OK, response_headers, body).into_response()
}

pub async fn start_server(
    db: Arc<Database>,
    image_svc: Arc<ImageService>,
    thumbnail_svc: Arc<ThumbnailService>,
    policy: SharedPolicy,
) -> Result<(u16, String), Box<dyn std::error::Error>> {
    // Bind first so the port is known before building state (state carries the
    // port for Host-header validation).
    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0))).await?;
    let port = listener.local_addr()?.port();

    // Per-launch random token (32 hex chars = 128 bits) required on every request.
    let token: String = {
        use rand::RngCore;
        let mut bytes = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut bytes);
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    };

    let state = AppState {
        db,
        image_svc,
        thumbnail_svc,
        policy,
        token: token.clone(),
        port,
    };

    let app = Router::new()
        .route("/image", get(image_handler))
        .route("/thumb", get(thumb_handler))
        .with_state(state);

    tokio::spawn(async move {
        axum::serve(listener, app).await.ok();
    });

    Ok((port, token))
}

// Helper retained for compatibility with legacy callers; prefer direct service
// construction. Returns a pre-wired `ArchiveService`, though the server itself
// owns a single shared `Arc<ArchiveService>` via `ImageService`.
#[allow(dead_code)]
pub fn new_archive_service() -> ArchiveService {
    ArchiveService::new()
}
