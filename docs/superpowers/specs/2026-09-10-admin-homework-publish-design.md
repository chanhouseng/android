# Batch 10C — Homework image upload and publish design

Date: 2026-09-10

## Scope and invariants

Batch 10C extends the authenticated Batch 10B Homework editor. It adds one required cover image, up to ten optional content images, safe image-backed preview, and one-shot publication. It does not add drafts, editing, deletion, Training folders or ZIP files, a database, deployment, or changes to other content sections.

The existing Origin, Session, CSRF, rate limiting, preview validation, HTML fragment validation, renderer, content index builder, and content validator remain authoritative. Public project content is never used as a publish-test target.

## Chosen architecture

The request passes through four boundaries:

1. `server.mjs` authenticates the exact `/api/publish` route before reading the body.
2. `multipart-request.mjs` streams bounded parts into a random project-local `.admin-staging/<transaction-id>/uploads/` directory.
3. `image-upload-validator.mjs` validates safe names, sizes, magic bytes, detected MIME and extension, and exact HTML/image references.
4. `homework-publisher.mjs` prepares formal output in staging and commits it under one Homework publish lock, rebuilding and validating the index before declaring success.

The implementation pins `busboy@1.6.0` for streaming multipart parsing. Image detection is a small local validator limited to the exact PNG, JPEG and WebP signatures, after a 5 MiB per-file cap. `file-type@20.5.0` was evaluated and removed after npm audit reported two moderate denial-of-service advisories; the fixed 22.x line requires Node >=22 and conflicts with the project's Node >=20.6 contract. No framework or upload abstraction is introduced, and the final dependency audit reports zero known vulnerabilities.

Rejected alternatives:

- Buffering `request.formData()` or the complete body in memory: it weakens streaming size enforcement and staging guarantees.
- Writing uploads directly into `homework/img/`: invalid or interrupted requests could expose partial public state.
- Shelling out to existing scripts: user input must never enter a command string, and the existing exported functions are directly reusable.
- A general-purpose image-type dependency: its vulnerable Node-20-compatible release and much broader parser surface are unnecessary for exactly three accepted formats.

## Contracts and limits

`POST <ADMIN_PATH>/api/publish` accepts only `multipart/form-data` with exactly one `payload` field, exactly one `coverImage` file, and zero to ten `contentImages` files. Unknown or repeated singleton parts are rejected.

The JSON payload contains `id`, `title`, `description`, `coverAlt`, and `contentHtml`. Existing preview limits remain in force; `coverAlt` is required, trimmed, plain text, and at most 160 Unicode code points.

Image rules:

- cover: exactly one, at most 5 MiB;
- content images: at most ten, each at most 5 MiB, combined at most 30 MiB;
- accepted detected types: PNG (`.png`), JPEG (`.jpg`), WebP (`.webp`);
- request hard limit: 36 MiB, leaving bounded room above the maximum 35 MiB of files for the 400 KiB payload and multipart framing;
- content filenames: `^[a-z0-9_-]+\.(png|jpg|webp)$`, one extension only, no silent rename;
- empty, truncated, duplicate, mismatched, unsupported, encoded, traversed, NUL-containing, SVG/HTML and disguised files are rejected.

The browser-provided MIME is advisory only. The server's detected type selects the cover extension and must exactly match the content image filename extension. JPEG uses the single canonical extension `.jpg`; `.jpeg` is deliberately rejected by the safe-filename contract.

API errors retain the existing `{error:{code,message}}` envelope. Field-level validation uses `fields`. Status mapping is 400 malformed multipart/JSON, 401 unauthenticated, 403 Origin/CSRF, 405 method, 409 existing target, 413 size/count limits, 415 multipart/image type, 422 fields/HTML/reference/image content, and generalized 500 errors.

## Validation order

The publish handler enforces the following order:

1. exact route and method;
2. trusted Origin;
3. live Session;
4. exact CSRF token;
5. multipart Content-Type with boundary;
6. declared Content-Length and streamed request total;
7. multipart part/file limits while streaming to staging;
8. single payload JSON object;
9. shared Homework field contract including `coverAlt`;
10. existing HTML fragment validator;
11. staged image validation;
12. exact content-image reference set validation;
13. lock-protected JSON/page/image-directory conflict checks.

An unauthenticated request is rejected before a parser or staging transaction is created.

## Image and HTML reference model

For Homework ID `module-f`, every content image reference must be the literal value `img/module-f/<safe-filename>`. The validator compares exact source strings and exact sets; it performs no decoding, URL normalization or case folding. Thus missing uploads, unused uploads, another ID, encoded equivalence and case differences all fail. Repeated use of one uploaded image is allowed because the set still matches. Cover images are excluded from this relationship.

The validated HTML is preserved byte-for-byte. The server never rewrites image paths.

## Preview and browser state

The management page shows a cover card preview using an Object URL, future content-image paths with accessible copy buttons and status text, and an unchanged bare `sandbox` iframe.

After the server returns validated preview HTML, the client parses that complete document with `DOMParser`. It replaces only `img[src]` values that exactly match a selected content-image future path, using Data URLs produced from the selected files. It serializes the document and creates the existing preview Blob URL. User HTML is never assigned to management-page `innerHTML`.

The preview renderer's CSP permits `data:` only for `img-src`; it remains script-free. The formal renderer omits preview CSP, includes `site-navigation.js`, and includes `accordion.js` only when the validated content contains accordion hooks.

The publish button is derived from a state machine: authenticated + locally valid fields/images + successful latest preview + unchanged text/file fingerprint + exact image-reference match + not publishing. Any text or file change invalidates the preview and disables publication. Confirmation uses a native accessible dialog containing ID, title, result URL, cover path, content-image count, and the explicit absence of Training. Success preserves the form and exposes real links.

## Transaction and rollback

Each request owns `.admin-staging/<random-id>/` containing uploads, prepared formal HTML, and recovery copies. Before publication, no file is placed under public `homework/`.

`homework-publisher.mjs` prepares the formal page with `renderHomeworkPage({preview:false})`, then calls `withFileLock(content/homework.json.lock, ...)`. Under the lock it rereads JSON; checks the ID, result page and target directory again; computes `max(valid order) + 1`; and saves exact copies of `content/homework.json` and `homework/index.html`.

Commit order is:

1. move the staged image directory and HTML into previously verified absent targets;
2. atomically write the updated JSON;
3. run `buildContentIndexes()`;
4. run `validateContent()` and require `valid === true`;
5. run `buildContentIndexes({check:true})`;
6. remove the transaction directory and release the lock.

If any step after public placement fails, rollback atomically restores the saved JSON and index, removes only this transaction's new HTML and image directory, and then removes staging. If rollback itself fails, a secret-free critical message is logged and recovery material is retained. The API still returns only a generalized internal error.

This ordering means a crash before JSON/index changes leaves unreachable files but no entry-card publication. On startup, the service lists incomplete staging transaction directories and emits a generic warning; it never resumes or publishes them automatically. README recovery instructions require stopping the service, inspecting the retained copies, restoring only the matching transaction when needed, and rerunning validation/check before removal.

## Testing and content protection

`tests/admin-publish.test.mjs` exercises the contracts, stream limits, image detection/reference rules, API, concurrency, transaction, rollback, startup warning, and browser state in temporary fixture roots. The fixture copies or creates only the minimum real builder/validator assets needed. Dependency injection is limited to forced builder/validator/check failures; assertions inspect real filesystem effects.

Existing tests are relaxed only where they assert a permanent count of 33. They still lock the original 33 records, order, text, links and hashes as the prefix/baseline, then validate any appended item normally.

Before and after tests and manual QA, byte hashes of `content/homework.json`, `homework/index.html`, and `training/files.json` are compared, and test IDs are checked absent from the real `homework/` tree.
