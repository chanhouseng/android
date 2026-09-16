# Admin Homework Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a validated, non-persistent Homework input form and sandboxed App Shell preview to the authenticated local admin service.

**Architecture:** A shared contract validates scalar fields, a parse5-based server module validates the HTML node tree, and a pure renderer creates the preview document. The existing server adds a strictly gated preview route and CSS allowlist; the browser uses the shared contract, Session/CSRF, and a revocable Blob URL to display the result inside a capability-free sandbox.

**Tech Stack:** Node.js >= 20.6.0, native Node test runner and HTTP server, ES modules, `parse5@7.3.0`, HTML/CSS/vanilla JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-09-admin-homework-preview-design.md`

## Global Constraints

- Do not rewrite Batch 10A authentication or change fixed Session expiry behavior.
- Login request limit remains 4 KiB; Preview request limit is 512 KiB; `contentHtml` is at most 400 KiB UTF-8.
- Do not persist form data or use localStorage, sessionStorage, IndexedDB, a service worker, or draft files.
- Do not create or modify public Homework pages, content JSON, Training indexes, images, or build/publish output.
- Use only the existing design tokens and the prescribed Traditional Chinese interface copy.
- The iframe remains `<iframe id="preview-frame" title="Homework 預覽" sandbox>` with no `allow-*` permission.
- User HTML never enters the management page DOM and is never executed by the server.
- Work in the existing shared checkout and preserve unrelated changes.

---

### Task 1: Field contract and initial test harness

**Files:**
- Create: `tests/admin-preview.test.mjs`
- Create: `admin/shared/homework-preview-contract.mjs`

**Interfaces:**
- Produces: `HOMEWORK_PREVIEW_LIMITS`, `HOMEWORK_ID_PATTERN`, and `validateHomeworkPreviewInput(input)` returning `{ ok: true, value }` or `{ ok: false, errors }`.

- [ ] Write failing table-driven tests for required/type/length ID, title, description, and HTML rules, exact trimming semantics, UTF-8 byte size, and the successful normalized value.
- [ ] Run `node --test tests/admin-preview.test.mjs` and confirm failure is caused by the missing contract module.
- [ ] Implement field-specific errors with `field`, `code`, and Traditional Chinese `message`; preserve `id` and `contentHtml`, trim title/description, count Unicode code points, and measure HTML bytes with `Buffer.byteLength` or `TextEncoder`.
- [ ] Run `node --test tests/admin-preview.test.mjs` and `node --test tests/admin-auth.test.mjs` and confirm both pass.

### Task 2: Parsed HTML fragment validation

**Files:**
- Modify: `tests/admin-preview.test.mjs`
- Create: `admin/server/html-fragment-validator.mjs`
- Create: `package.json`
- Create: `package-lock.json`

**Interfaces:**
- Consumes: validated `contentHtml` and `{ reservedIds }`.
- Produces: `validateHtmlFragment(contentHtml, { reservedIds })` returning `{ ok: true, html: contentHtml }` or `{ ok: false, errors }`.

- [ ] Add failing tests for allowed section/table/details/pre-code content and every forbidden element group, doctype/full document, malformed markup/attributes, `h1`, event/style/unknown attributes, invalid/duplicate/reserved IDs, tabindex values, anchor schemes and rel rules, image rules, button type, error shape, and parser-provided line/column.
- [ ] Run the focused validator tests and confirm they fail because the module is absent.
- [ ] Create the minimal package metadata and install exactly `parse5@7.3.0`, committing the generated lockfile and no unrelated package.
- [ ] Implement a source-location-preserving parse, parse-error rejection, deterministic tree walk, element/attribute allowlists, decoded URL checks, ID registry, and element-specific rules; never serialize, sanitize, or rewrite accepted HTML.
- [ ] Run `node --test tests/admin-preview.test.mjs` and then both admin test files.

### Task 3: Pure Homework page renderer

**Files:**
- Modify: `tests/admin-preview.test.mjs`
- Create: `admin/server/homework-page-renderer.mjs`

**Interfaces:**
- Consumes: `renderHomeworkPage({ id, title, description, contentHtml, preview, assetBase })` with prevalidated fragment HTML.
- Produces: one complete HTML document string without side effects.

- [ ] Add failing tests for doctype/document structure, escaped title/description/id, unescaped validated fragment placement, preview badge, strict meta CSP, four CSS URLs built from `assetBase`, breadcrumb, back link, desktop/mobile App Shell containers, and lack of scripts/filesystem writes.
- [ ] Run the focused renderer tests and confirm failure is caused by the missing module.
- [ ] Implement a pure renderer with a local HTML escape helper and the current detail-page semantic structure.
- [ ] Run the renderer tests and the complete admin-preview file.

### Task 4: Authenticated Preview API and static CSS allowlist

**Files:**
- Modify: `tests/admin-preview.test.mjs`
- Modify: `admin/server/config.mjs`
- Modify: `admin/server/server.mjs`

**Interfaces:**
- Consumes: `validateHomeworkPreviewInput`, `validateHtmlFragment`, `renderHomeworkPage`.
- Produces: `POST <ADMIN_PATH>/api/preview`, success `{ previewHtml }`, validation `{ error: { code, message, fields } }`, and preview CSS GET routes.

- [ ] Add failing integration tests for route method/Allow, Origin, media type including charset, unauthenticated and expired Session, missing/wrong CSRF, pre-body auth ordering, 512 KiB limit including streamed input, invalid JSON, 422 contract and HTML errors, 200 output, fixed Session expiry, and all eight-only CSS resources.
- [ ] Run those tests and confirm expected 404/authorization/limit failures.
- [ ] Export a dedicated 524288-byte Preview limit from configuration while retaining Login's `bodyLimitBytes: 4096`.
- [ ] Refactor `readJson(request, response, limitBytes)` and pass the login or preview limit explicitly.
- [ ] Register the preview route and gate it in the prescribed order before parsing; return generalized errors without logging input or secrets.
- [ ] Add the exact preview asset allowlist and construct `assetBase` as an absolute URL from the trusted loopback origin plus `<ADMIN_PATH>/assets/`, because a Blob document is not a reliable hierarchical base for relative CSS URLs.
- [ ] Run admin-preview, admin-auth, and the combined admin tests.

### Task 5: Accessible editor and safe iframe lifecycle

**Files:**
- Modify: `tests/admin-preview.test.mjs`
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`

**Interfaces:**
- Consumes: `GET api/session`, shared field contract, `POST api/preview`.
- Produces: accessible form state, field errors, future URL/count feedback, and sandboxed Blob preview.

- [ ] Add failing static and VM/browser-contract tests for the four labelled fields, constraints, 390px viewport, prohibited controls/features, exact relative API, iframe sandbox/title, no management-page `innerHTML`, empty/loading/error/expired/ready states, Blob replacement and unload revocation, and preserving entered values on 401.
- [ ] Run the UI tests and confirm they fail against the placeholder.
- [ ] Build the semantic header, 44/56 workspace, field help/errors, supplied HTML example, preview button, iframe, status badge, publication notice, login-expiry link, and logout action in mobile-safe DOM order.
- [ ] Import and execute the shared browser-safe validator, update text with `textContent`, manage pending state, map server field errors, create/revoke Blob URLs, and retain in-memory field values on authentication expiry.
- [ ] Style solely with existing tokens for 390px through desktop, 44px controls, internal textarea scrolling, visible focus, empty/error panels, and reduced motion.
- [ ] Run admin-preview and admin-auth tests.

### Task 6: CSP, documentation, and full verification

**Files:**
- Modify: `tests/admin-preview.test.mjs`
- Modify: `admin/server/security-headers.mjs`
- Modify: `README.md`

**Interfaces:**
- Produces: management CSP with only `frame-src blob:` added and Batch 10B operating documentation.

- [ ] Add failing assertions that the management CSP includes `frame-src blob:` while excluding unsafe-inline, unsafe-eval, wildcard, and data/script relaxations.
- [ ] Update the security header policy by adding exactly `frame-src blob:`.
- [ ] Update README with opening instructions, supported fields, fragment/entity example, preview/loss behavior, unsupported image/Training/draft/publish features, and credential safety.
- [ ] Run `npm install`, `node --test tests/admin-preview.test.mjs`, `node --test tests/admin-auth.test.mjs`, `node --test tests/*.test.mjs`, `node scripts/validate-content.mjs`, and `node scripts/build-content-indexes.mjs --check`.
- [ ] Compare SHA-256 and byte content for `content/homework.json`, `homework/index.html`, and `training/files.json` with the initial snapshot; inspect the final diff for accidental persistence, upload, build, or publish artifacts.
- [ ] Start the configured local server without disclosing credentials and manually verify 390/768/1024/1440 layouts, keyboard operation/focus, safe and blocked preview cases, Session expiry retention, and console output; if credentials are unavailable, record manual browser verification as not executable rather than inventing a result.
