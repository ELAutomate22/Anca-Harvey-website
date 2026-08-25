# Relationship Backup Format v1

Format identifier: `1.0`

Phase 7 produces a standard ZIP archive with one root directory, `Our-Relationship-Backup/`. JSON is canonical. CSV is supplementary and is always UTF-8 with RFC-style quote escaping. String cells beginning with spreadsheet formula characters are prefixed with an apostrophe to prevent formula execution; canonical JSON retains the exact original value. The format is intentionally portable and restore-aware, but this release does not implement restore/import.

## Archive layout

```text
Our-Relationship-Backup/
├── README.txt
├── manifest.json
├── relationship.json
├── data/
│   ├── profiles.json
│   ├── timeline.json
│   ├── memories.json
│   ├── movies.json
│   ├── games.json
│   ├── soundtrack.json
│   ├── activities.json
│   ├── bucket-list.json
│   └── letters.json
├── csv/
│   ├── memories.csv
│   ├── timeline.csv
│   ├── movie-watchlist.csv
│   ├── movie-history.csv
│   ├── movie-ratings.csv
│   ├── game-history.csv
│   ├── songs.csv
│   ├── activity-history.csv
│   ├── bucket-list.csv
│   └── letters.csv
├── media/                 # Full Backup only; present only when media is available
│   ├── memories/
│   └── letters/
└── warnings/
    └── missing-media.json # Present only when an indexed R2 object is unavailable
```

`manifest.json` is written after the media stream so its included-file counts and missing-media warnings describe the archive that was actually produced. ZIP entry order is not part of the format contract.

## Manifest

`manifest.json` is a `BackupManifestV1` object with:

- `backupFormatVersion`: always `"1.0"`;
- `exportType`: `"data"` or `"full"`;
- UTC ISO 8601 `createdAt` and `snapshotAt` values;
- safe relationship identity/title, timezone, and requester attribution;
- typed counts for each exported domain;
- included media count and D1-indexed byte total;
- the requester-draft option used for the snapshot;
- explicit locked-Letter and checksum policy flags;
- a media map containing stable media/entity IDs, portable archive paths, MIME type, size, original filename, and inclusion state;
- safe missing/unavailable-media warnings.

The media map never contains an R2 object key, private URL, signed URL, credential, or authentication record. Missing media stays in the map with `included: false` and a matching warning.

## Canonical JSON

Every ID and stored timestamp needed to reconstruct relationships between exported entities is preserved. Date-only values use `YYYY-MM-DD`. Instants use UTC ISO 8601. JSON property names are camelCase.

- `relationship.json`: relationship ID/title/start date/timezone, partner user IDs, timestamps, and format version.
- `profiles.json`: safe IDs, live display names, email addresses, and timestamps. Password/authentication fields are impossible in this type.
- `timeline.json`: custom entries. Automatic milestones remain derivable from the relationship start date.
- `memories.json`: full metadata, attribution, links from activity/bucket records, and safe media metadata. Data Only uses `archivePath: null`; Full Backup maps eligible originals to archive paths.
- `movies.json`: relationship watchlist, diary snapshots, notes, rewatches, and per-profile ratings. TMDB poster paths remain external references; poster binaries are not downloaded.
- `games.json`: relationship custom games, referenced built-in game snapshots, and history/outcomes/winners.
- `soundtrack.json`: metadata, approved outbound links, relationship notes, Our Song state, and Memory/artwork associations. Audio is never packaged.
- `activities.json`: custom/referenced catalogue rows, exclusions, saved activities, plans, and history with Memory links.
- `bucket-list.json`: status, target/completion information, attribution, ratings, notes, and Memory links.
- `letters.json`: export-policy result described below.

## Future Letter policy

Letter eligibility is frozen at `snapshotAt` and enforced in the D1 query before archive serialization.

| State at snapshot | Export behavior |
| --- | --- |
| Draft | Excluded by default. With `includeMyDrafts`, only the requester’s own draft body/media is eligible. The other partner’s drafts are never queried. |
| Sealed + locked | Safe metadata and page count only. No body, media metadata/binary, URL, R2 key, or hidden payload. |
| Ready but intentionally unopened | Safe metadata and page count only, identical protected-content boundary to locked. |
| Opened typed | Safe metadata plus typed body. |
| Opened handwritten | Safe metadata plus eligible original page media in Full Backup. |

Unlocking or opening a Letter after snapshot creation never changes that archive. A new backup is required. The backup API cannot perform the intentional Open action.

## Media rules

D1 relationship-owned `memory_media` and export-eligible `future_letter_media` rows are the only media index. The Worker never lists the bucket to discover backup content and never scans `public/`, `src/assets/`, a deployed static directory, or source code.

Memory media is stored once under `media/memories/`. Activity, bucket-list, soundtrack-artwork, and other cross-feature references reuse the Memory/media IDs and never duplicate the binary. Opened eligible Letter pages are stored under `media/letters/`. Original stored MIME/bytes are preserved; thumbnails and external/static derivatives are excluded.

Paths are derived only through the archive filename policy: forward slashes, normalized safe segments, bounded lengths, validated extensions, stable IDs, and collision suffixes. `.`/`..`, backslashes, control characters, Windows-reserved names, and untrusted raw path fragments cannot become archive paths.

## Streaming and integrity

The Worker uses a lazy Web Streams ZIP64-capable writer with STORE entries. Structured files are small bounded strings. Each R2 object body is handed directly to the ZIP stream and fully consumed before the next object is fetched. The Worker never creates a whole-archive buffer, a whole-video `ArrayBuffer`, or a `Promise.all` of media bodies.

Format v1 does not include per-file SHA-256 checksums. Web Crypto has no incremental digest API, and teeing multi-gigabyte bodies merely to hash them could violate the bounded-memory contract. ZIP CRC-32 still provides normal archive corruption detection. A future format may add checksums after a proven incremental Worker implementation.

The ZIP is not encrypted. Obsolete ZipCrypto is deliberately not used. Delivery requires an authenticated same-site HTTPS request, Full Backup recent authentication, and private/no-store response headers. Users are told to store the resulting archive somewhere they trust.

## Versioning and future restore

Readers must inspect `backupFormatVersion` before interpreting files. Additive compatible work may use a documented minor version; structural or semantic breaks require a new major version. Version `1.0` must not change silently.

A future restore implementation should validate every JSON structure, ID/reference, timestamp, MIME type, size, and archive path; allocate new private R2 keys rather than reuse old keys; and re-run current membership/Letter policies. Restore, merge, overwrite, and import are explicitly outside Phase 7.
