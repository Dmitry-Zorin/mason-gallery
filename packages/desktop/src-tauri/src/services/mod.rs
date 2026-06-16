pub mod archive_service;
pub mod image_service;
pub mod policy;
pub mod source_service;
pub mod thumbnail_queue;
pub mod thumbnail_service;

use dashmap::DashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Per-entry async mutex coordinating concurrent extractions.
/// Key format: `"<source-hash>:<entry-hash>"`.
pub type ExtractLocks = Arc<DashMap<String, Arc<Mutex<()>>>>;

pub fn new_extract_locks() -> ExtractLocks {
    Arc::new(DashMap::new())
}

/// RAII guard returned by [`acquire_entry_lock`]. Holds the owned mutex guard
/// for the lifetime of the extraction and, on drop, prunes the `(key, Arc)`
/// entry from the [`ExtractLocks`] map when no other task is using it — keeping
/// the map from growing unboundedly across many one-shot extractions.
pub struct EntryLockGuard {
    locks: ExtractLocks,
    key: String,
    // Held until this guard drops. The strong-count below counts this guard's
    // internal Arc (`_guard`) plus the map's own ref.
    _guard: tokio::sync::OwnedMutexGuard<()>,
}

impl Drop for EntryLockGuard {
    fn drop(&mut self) {
        // `Drop::drop` runs while `_guard` is still alive, so the prune below
        // happens with the mutex still held: remove the entry only if its Arc
        // is held solely by the map (1) and this guard (1) — i.e. count <= 2.
        // The check runs inside DashMap's shard lock via `remove_if`, so a
        // concurrent waiter that cloned the Arc in `acquire_entry_lock` bumps
        // the count (to 3) and is not pruned mid-flight; a caller arriving
        // after removal simply inserts a fresh Arc. After this returns the
        // fields drop and the mutex is released.
        self.locks
            .remove_if(&self.key, |_, v| Arc::strong_count(v) <= 2);
    }
}

pub async fn acquire_entry_lock(
    locks: &ExtractLocks,
    source_hash: &str,
    entry_hash: &str,
) -> EntryLockGuard {
    let key = format!("{}:{}", source_hash, entry_hash);
    let mutex = locks
        .entry(key.clone())
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone();
    let guard = mutex.lock_owned().await;
    EntryLockGuard {
        locks: locks.clone(),
        key,
        _guard: guard,
    }
}
