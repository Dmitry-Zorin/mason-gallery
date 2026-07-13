/**
 * Deterministic "random" ordering for the shuffle sort.
 *
 * A shuffle is expressed as a total order over each image's stable `source`
 * id, derived from a per-session seed. Because the order is a pure function of
 * `(seed, source)` it stays fixed while new batches stream in, while a folder
 * filter narrows the set, and across a re-scan (refresh) — the order only
 * changes when the seed changes (user re-shuffles) or the app restarts (a fresh
 * seed is minted when the store is created). See `useViewerStore.reshuffle`.
 */

/** Mix a numeric seed with a string into an unsigned 32-bit hash (FNV-1a
 * variant + a final avalanche step for good bit dispersion). */
function hashSource(seed: number, source: string): number {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < source.length; i++) {
    h = Math.imul(h ^ source.charCodeAt(i), 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * Build a comparator over image `source` ids for the given seed. Hashes are
 * memoized per source so a full sort hashes each source once. Ties fall back to
 * the raw source string, keeping the order total and deterministic.
 */
export function makeShuffleComparator(
  seed: number,
): (a: string, b: string) => number {
  const cache = new Map<string, number>();
  const keyOf = (source: string): number => {
    let key = cache.get(source);
    if (key === undefined) {
      key = hashSource(seed, source);
      cache.set(source, key);
    }
    return key;
  };
  return (a, b) => {
    const diff = keyOf(a) - keyOf(b);
    if (diff !== 0) return diff;
    return a < b ? -1 : a > b ? 1 : 0;
  };
}

/** A fresh 32-bit seed for a new shuffle. */
export function nextShuffleSeed(): number {
  return Math.floor(Math.random() * 0x1_0000_0000);
}
