# Admin Homework Preview Design

## Scope

Batch 10B replaces the authenticated placeholder with an in-memory Homework editor and a safe preview. It does not persist drafts, upload files, alter public content, build indexes, publish Homework, or add Training support. Refreshing or closing the page intentionally loses all entered data.

## Architecture

The feature is split into four boundaries. `admin/shared/homework-preview-contract.mjs` owns field names, length limits, normalization, and user-facing field errors shared by browser and server. `admin/server/html-fragment-validator.mjs` parses the submitted fragment with `parse5@7.3.0`, rejects any node or attribute outside the allowlist, and returns the original string only after the full tree passes. Version 7.3.0 retains the required WHATWG tree and source-location support without raising the project's Node 20.6 minimum through its dependency graph. `admin/server/homework-page-renderer.mjs` accepts validated values and returns a complete App Shell HTML document without writing files. `admin/server/server.mjs` authenticates, authorizes, bounds, validates, and renders `POST <ADMIN_PATH>/api/preview` in the prescribed order.

The browser loads the existing session and CSRF token before enabling preview. It performs the shared basic validation for immediate feedback, posts to the relative `api/preview` URL, and places only the server-produced document into a Blob-backed sandboxed iframe. User HTML is never inserted into the management page DOM.

## Data contract

Input is `{ id, title, description, contentHtml }`. Basic validation returns either `{ ok: true, value }` or `{ ok: false, errors }`. The server trims `title` and `description`, preserves `id` and `contentHtml`, measures strings by Unicode characters where specified, and measures the HTML body with UTF-8 byte length.

`id` is 1–80 characters and matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`. `title` is 1–120 trimmed characters. `description` is 1–500 trimmed characters and plain text. `contentHtml` is required, at most 400 KiB UTF-8, is not reformatted, and is subsequently subjected to tree validation.

## HTML safety model

`parse5.parseFragment` builds the node tree with source locations and parse errors. A pre-parse document marker check rejects doctype and full-document-only elements that fragment parsing would otherwise normalize away. Parse errors that indicate malformed input reject the whole fragment. The validator then walks every element, attribute, and descendant in document order.

Only the specified content elements are accepted. Global attributes are limited to `class`, safe unique `id`, `role`, `title`, `aria-*`, `data-*`, and `tabindex` values `0` or `-1`. Event attributes and `style` are always rejected. Reserved App Shell IDs and duplicate fragment IDs are rejected.

Anchors allow relative/site-root paths and `https:` only. Entity-decoded, whitespace/control-obfuscated, protocol-relative, `javascript:`, `data:`, and `vbscript:` URLs fail closed. `_blank` requires both `noopener` and `noreferrer`. Images require non-empty `alt`, a local relative `src`, enumerated loading/decoding values, and reasonable positive integer dimensions. Buttons require exactly `type="button"`. The validator never sanitizes or partially previews rejected input.

## Renderer and preview document

The renderer HTML-escapes `id`, `title`, and `description`, inserts only a previously validated `contentHtml` fragment, and emits the same semantic App Shell structure used by current detail pages: desktop navigation container, main content, breadcrumb, back link, detail header, content region, and mobile navigation container. `assetBase` is required and used to construct links for `foundation.css`, `app-shell.css`, `accordion.css`, and `detail-page.css`.

Preview documents contain a restrictive meta CSP with no script permission, form submission, objects, or nested frames. Styles and images use `'self'`; CSP maintains a separate self-origin for local-scheme documents whose sandboxed runtime origin is opaque, so this remains compatible with both supported loopback hosts. Directives that browsers ignore in meta-delivered policies, such as `frame-ancestors`, are omitted. `preview: true` adds the visible `尚未發佈` status. The renderer is pure and performs no filesystem, request, authentication, or publication work.

## HTTP flow

`POST <ADMIN_PATH>/api/preview` validates route/method, Origin, JSON media type, Session, CSRF, 512 KiB request size, JSON syntax, fields, fragment, and renderer in that order. Login keeps its independent 4 KiB limit. Authentication is checked before the request body is read so an unauthenticated large request is not buffered. Validation failures return status 422 with `error.code = "validation_failed"` and a `fields` array. Unexpected errors use the existing generalized 500 response and never log secrets or submitted HTML.

The static allowlist adds only the eight preview CSS files: foundation, tokens, base, utilities, components, app-shell, accordion, and detail-page. No arbitrary path resolution is exposed.

## Management interface

The authenticated page uses the existing light token system with no public navigation. A 44/56 desktop split places a focused data-entry panel beside the preview. At 48rem and below it becomes one column, with the logout action after the preview content in DOM order. All controls are at least 44px, focus remains visible, the textarea scrolls internally, and the layout works at 390px without page overflow.

The form exposes Homework ID with its future URL, title, description with a live character count, and a large monospace HTML textarea with the supplied example and entity guidance. Preview has explicit empty, loading, validation/error, expired-session, and ready states. There is no publish, upload, Training, draft, storage, service worker, or animation feature.

## Blob and session lifecycle

After a 200 response, the browser creates a `text/html` Blob URL, revokes the prior URL, and assigns the new URL to `#preview-frame`. It revokes the current URL during page unload. The iframe has a bare `sandbox` attribute and no `allow-*` capabilities. A 401 response displays `登入已失效，請重新登入`, retains all form values in memory, disables further preview, and exposes a link back to the login entry.

## Security headers

The management page CSP keeps every Batch 10A directive and adds only `frame-src blob:`. It does not add inline/eval/script/data/wildcard permissions. All responses retain no-store, nosniff, no-referrer, and frame denial headers.

## Verification

Automated tests cover the field contract, parser allowlist and attributes, URL/entity handling, location reporting, renderer escaping/template/CSP, Preview API gate ordering and limits, UI structure and client behavior, static resource allowlisting, and byte-identical protected files. Final verification reruns admin-auth, admin-preview, the full suite, content validation, and index check, then compares SHA-256 hashes captured before implementation.

Manual browser checks cover 390, 768, 1024, and 1440px layouts, keyboard-only operation, visible focus, safe/unsafe preview behavior, session expiry without field clearing, and a clean console.
