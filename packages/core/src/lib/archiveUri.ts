/**
 * Archive URI helpers — must stay byte-for-byte compatible with the Rust
 * `encode_archive_path` / `decode_archive_path` in
 * `packages/desktop/src-tauri/src/archive.rs`.
 *
 * Archive sources are encoded as `archive:///<encoded-path>#<entry>`. Only the
 * archive filesystem path is percent-encoded, and only the two characters that
 * would otherwise break the `#` boundary are escaped: `%` → `%25` and
 * `#` → `%23` (with `%` escaped first). The entry path is left raw and may
 * itself contain `#`, so parsing must split on the first `#` only.
 */

const ARCHIVE_PREFIX = "archive:///";

/** Percent-encode an archive filesystem path for embedding in an archive URI. */
export function encodeArchivePath(path: string): string {
  return path.replace(/%/g, "%25").replace(/#/g, "%23");
}

/**
 * Inverse of {@link encodeArchivePath}. Single left-to-right scan mapping
 * `%23` → `#` and `%25` → `%`, leaving any other `%`-sequence untouched.
 */
export function decodeArchivePath(encoded: string): string {
  let out = "";
  let i = 0;
  while (i < encoded.length) {
    if (encoded[i] === "%" && i + 3 <= encoded.length) {
      const code = encoded.slice(i + 1, i + 3);
      if (code === "23") {
        out += "#";
        i += 3;
        continue;
      }
      if (code === "25") {
        out += "%";
        i += 3;
        continue;
      }
    }
    out += encoded[i];
    i += 1;
  }
  return out;
}

/** Build the `archive:///<encoded-path>` source string for a locked archive. */
export function lockedArchiveSource(archivePath: string): string {
  return `${ARCHIVE_PREFIX}${encodeArchivePath(archivePath)}`;
}

/**
 * Extract the decoded archive filesystem path from an archive source URI, or
 * `null` if the source is not an archive URI.
 */
export function archivePathFromSource(source: string): string | null {
  if (!source.startsWith(ARCHIVE_PREFIX)) return null;
  const withoutScheme = source.slice(ARCHIVE_PREFIX.length);
  const hashIdx = withoutScheme.indexOf("#");
  const encoded =
    hashIdx === -1 ? withoutScheme : withoutScheme.slice(0, hashIdx);
  return decodeArchivePath(encoded);
}
