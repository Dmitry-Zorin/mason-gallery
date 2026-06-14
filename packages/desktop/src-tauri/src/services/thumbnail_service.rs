use crate::archive::compute_entry_hash;
use crate::database::Database;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// JPEG-equivalent quality (0–100) for lossy WebP thumbnail encoding. The
/// `image` crate's built-in WebP encoder is lossless-only, so we encode via
/// libwebp (the `webp` crate) instead.
const THUMB_WEBP_QUALITY: f32 = 80.0;

pub struct GeneratedThumbnail {
    pub width: u32,
    pub height: u32,
    pub relative_path: String,
    pub file_size: u64,
}

/// Per-entry stage timing for benchmarking. All values in nanoseconds.
#[derive(Debug, Clone, Copy, Default)]
pub struct StageTimings {
    pub decode_ns: u64,
    pub resize_ns: u64,
    pub encode_ns: u64,
    pub db_ns: u64,
}

impl StageTimings {
    pub fn add(&mut self, other: &StageTimings) {
        self.decode_ns += other.decode_ns;
        self.resize_ns += other.resize_ns;
        self.encode_ns += other.encode_ns;
        self.db_ns += other.db_ns;
    }
}

pub struct ThumbnailService {
    db: Arc<Database>,
    cache_dir: PathBuf,
}

impl ThumbnailService {
    pub fn new(db: Arc<Database>, cache_dir: PathBuf) -> Self {
        Self { db, cache_dir }
    }

    pub fn cache_dir(&self) -> &Path {
        &self.cache_dir
    }

    pub fn thumbs_root(&self) -> PathBuf {
        self.cache_dir.join("thumbs")
    }

    pub fn thumb_path(&self, source_hash: &str, entry_hash: &str, width: u32) -> PathBuf {
        self.thumbs_root()
            .join(source_hash)
            .join(format!("{}_{}.webp", entry_hash, width))
    }

    /// Lookup only — returns the existing file path, or None if no thumbnail
    /// has been generated at the requested width.
    pub fn resolve(
        &self,
        source_hash: &str,
        entry_hash: &str,
        width: u32,
    ) -> Option<PathBuf> {
        let p = self.thumb_path(source_hash, entry_hash, width);
        if p.exists() {
            Some(p)
        } else {
            None
        }
    }

    /// Generate multi-resolution thumbnails for an archive entry.
    ///
    /// Given the decoded source bytes and the requested widths (descending
    /// order is fine — we sort internally), produces one WebP per unique
    /// width <= the original width (upscaling disabled), records each in the
    /// `thumbnails` table, and returns descriptors for the caller.
    pub fn generate_for_entry(
        &self,
        source_id: i64,
        source_hash: &str,
        entry_path: &str,
        image_data: &[u8],
        widths: &[u32],
    ) -> Result<Vec<GeneratedThumbnail>, String> {
        self.generate_for_entry_cancelable(
            source_id,
            source_hash,
            entry_path,
            image_data,
            widths,
            None,
        )
    }

    /// Same as `generate_for_entry`, but checks `cancel` between resize steps
    /// and aborts early if the flag is set. Returns `Err("canceled")` on abort.
    pub fn generate_for_entry_cancelable(
        &self,
        source_id: i64,
        source_hash: &str,
        entry_path: &str,
        image_data: &[u8],
        widths: &[u32],
        cancel: Option<&Arc<AtomicBool>>,
    ) -> Result<Vec<GeneratedThumbnail>, String> {
        self.generate_for_entry_timed(
            source_id,
            source_hash,
            entry_path,
            image_data,
            widths,
            cancel,
        )
        .map(|(r, _)| r)
    }

    /// Instrumented variant: returns per-stage timings alongside the
    /// generated thumbnails. Used by the benchmark harness. All other
    /// callers should use `generate_for_entry` / `generate_for_entry_cancelable`
    /// which discard the timings.
    pub fn generate_for_entry_timed(
        &self,
        source_id: i64,
        source_hash: &str,
        entry_path: &str,
        image_data: &[u8],
        widths: &[u32],
        cancel: Option<&Arc<AtomicBool>>,
    ) -> Result<(Vec<GeneratedThumbnail>, StageTimings), String> {
        let canceled = |c: Option<&Arc<AtomicBool>>| -> bool {
            c.map(|f| f.load(Ordering::Acquire)).unwrap_or(false)
        };

        if canceled(cancel) {
            return Err("canceled".to_string());
        }

        let mut timings = StageTimings::default();
        let entry_hash = compute_entry_hash(entry_path);

        let t = Instant::now();
        let img = image::load_from_memory(image_data)
            .map_err(|e| format!("Failed to decode image: {}", e))?;
        timings.decode_ns = t.elapsed().as_nanos() as u64;
        let (orig_w, orig_h) = (img.width(), img.height());

        let mut sorted: Vec<u32> = widths.iter().copied().filter(|&w| w > 0).collect();
        sorted.sort_unstable();
        sorted.dedup();

        // Build the generation plan with the same "never upscale, stop once a
        // requested width meets/exceeds the original" semantics as before, so
        // the set of stored (requested width -> row) is unchanged.
        let aspect = orig_h as f32 / orig_w.max(1) as f32;
        // (requested_width, target_width, target_height), ascending by request.
        let mut plan: Vec<(u32, u32, u32)> = Vec::new();
        for &w in &sorted {
            let target_w = w.min(orig_w.max(1));
            let target_h = ((target_w as f32) * aspect).round().max(1.0) as u32;
            plan.push((w, target_w, target_h));
            if target_w >= orig_w {
                break;
            }
        }

        // Generate largest-first and chain each smaller size off the previous
        // (already downscaled) thumbnail instead of the full-resolution source.
        // Downscaling 4000px -> 2048 -> 1280 -> 512 is far cheaper than three
        // independent resizes from the original. Targets are strictly
        // descending (the plan dedups and stops at the original), so `prev`
        // always shrinks.
        let mut gen_order = plan.clone();
        gen_order.sort_by_key(|t| std::cmp::Reverse(t.1));

        // Per requested width: (height, relative_path, file_size).
        let mut produced: std::collections::HashMap<u32, (u32, String, u64)> =
            std::collections::HashMap::new();
        let mut prev: Option<image::DynamicImage> = None;

        for (req_w, target_w, target_h) in &gen_order {
            if canceled(cancel) {
                return Err("canceled".to_string());
            }

            let t = Instant::now();
            let thumb = match prev.as_ref() {
                Some(p) if p.width() > *target_w => p.thumbnail(*target_w, *target_h),
                _ if *target_w == orig_w && *target_h == orig_h => img.clone(),
                _ => img.thumbnail(*target_w, *target_h),
            };
            timings.resize_ns += t.elapsed().as_nanos() as u64;
            let th = thumb.height();

            if canceled(cancel) {
                return Err("canceled".to_string());
            }

            let out = self.thumb_path(source_hash, &entry_hash, *req_w);
            if let Some(parent) = out.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create thumb dir: {}", e))?;
            }
            let t = Instant::now();
            let rgba = thumb.to_rgba8();
            let encoded =
                webp::Encoder::from_rgba(&rgba, thumb.width(), th).encode(THUMB_WEBP_QUALITY);
            fs::write(&out, &*encoded)
                .map_err(|e| format!("Failed to save thumbnail: {}", e))?;
            timings.encode_ns += t.elapsed().as_nanos() as u64;

            let size = fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
            let rel = format!("thumbs/{}/{}_{}.webp", source_hash, entry_hash, req_w);
            produced.insert(*req_w, (th, rel, size));

            prev = Some(thumb);
        }

        // Persist every width and bump the cache tally in one transaction
        // (incremental — no O(N) re-sum of the source's thumbnails). Rows go in
        // the original ascending request order.
        let db_rows: Vec<(u32, u32, String, i64)> = plan
            .iter()
            .filter_map(|(req_w, _, _)| {
                produced
                    .get(req_w)
                    .map(|(th, rel, size)| (*req_w, *th, rel.clone(), *size as i64))
            })
            .collect();

        let t = Instant::now();
        self.db
            .replace_thumbnails_for_entry(source_id, entry_path, &db_rows)?;
        timings.db_ns += t.elapsed().as_nanos() as u64;

        let results: Vec<GeneratedThumbnail> = db_rows
            .into_iter()
            .map(|(width, height, relative_path, file_size)| GeneratedThumbnail {
                width,
                height,
                relative_path,
                file_size: file_size as u64,
            })
            .collect();

        Ok((results, timings))
    }

    /// Generate thumbnails for a loose filesystem file (folder entry).
    ///
    /// `entry_path` is the thumbnails-table entry key — the path relative to the
    /// folder root, stable across scans. `read_path` is the absolute filesystem
    /// path the source bytes are read from (the folder root joined with the
    /// relative entry). Returns `Err("canceled")` if the cancel flag trips
    /// mid-generation.
    pub fn generate_for_file(
        &self,
        source_id: i64,
        source_hash: &str,
        entry_path: &str,
        read_path: &Path,
        widths: &[u32],
        cancel: Option<&Arc<AtomicBool>>,
    ) -> Result<Vec<GeneratedThumbnail>, String> {
        let bytes = fs::read(read_path)
            .map_err(|e| format!("Failed to read {}: {}", read_path.display(), e))?;
        self.generate_for_entry_cancelable(
            source_id,
            source_hash,
            entry_path,
            &bytes,
            widths,
            cancel,
        )
    }

    /// Build an `mg-thumb://` URI for a given source/entry/width.
    pub fn build_uri(source_hash: &str, entry_hash: &str, width: u32) -> String {
        format!("mg-thumb:///{}/{}?w={}", source_hash, entry_hash, width)
    }

    pub fn clear_for_source(&self, source_id: i64, source_hash: &str) -> Result<(), String> {
        let dir = self.thumbs_root().join(source_hash);
        let _ = fs::remove_dir_all(&dir);
        self.db.delete_thumbnails_for_source(source_id)?;
        self.db.set_thumb_cache_size(source_id, 0)?;
        Ok(())
    }

    pub fn clear_all(&self) -> Result<(), String> {
        let _ = fs::remove_dir_all(self.thumbs_root());
        self.db.delete_all_thumbnails()
    }
}
