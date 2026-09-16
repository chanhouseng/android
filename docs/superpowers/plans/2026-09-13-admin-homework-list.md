# Admin Published Homework List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a session-protected, read-only list of published Homework records to the existing management page.

**Architecture:** A focused server module reads and validates the canonical Homework manifest and derives safe same-origin public URLs. The existing admin server exposes that module through an authenticated GET route, while `admin.js` renders an accessible responsive list after Session validation and refreshes it independently after successful publication.

**Tech Stack:** Node.js ESM, built-in HTTP server, browser DOM APIs, existing CSS token system, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-13-admin-homework-list-design.md`

## Global Constraints

- The list is read-only and uses only `content/homework.json`.
- Only records whose actual status is `published` may be returned.
- Do not add edit, delete, draft, search, filter, sort controls, pagination, Training, ZIP, database, deployment, or a second manifest.
- Preserve all pre-existing workspace changes and do not run `git commit`.
- Do not expose physical paths, stack traces, Session data, CSRF data, or arbitrary browser-supplied paths.
- Use `Cache-Control: no-store` and existing security headers for the list API.
- Preserve the form and keep a successful publish successful even if its automatic list refresh fails.

---

### Task 1: Lock the manifest-to-API contract with failing tests

**Files:**
- Create: `tests/admin-homework-list.test.mjs`
- Create: `admin/server/homework-list.mjs`
- Modify: `admin/server/server.mjs`

**Interfaces:**
- Produces: `loadPublishedHomeworks({ rootDirectory }) -> Promise<{ homeworks, total }>`.
- Produces: authenticated `GET <ADMIN_PATH>/api/homeworks`.

- [ ] **Step 1: Write focused failing tests**

  Build a temporary project manifest containing published and draft records. Assert literal response objects, including `publishedAt: null`, safe `/homework/...` URL resolution, `url: null`, and exact `total`. Add HTTP assertions for live, absent and expired Sessions, GET-only handling, `no-store`, safe malformed-manifest errors, no physical-path leakage, and byte-identical manifest contents before and after calls.

- [ ] **Step 2: Run the focused test in RED**

  Run `node --test tests/admin-homework-list.test.mjs`. Expected result: failure because the module and route do not exist.

- [ ] **Step 3: Implement the smallest server module and route**

  Read the fixed `content/homework.json`, parse and validate it, filter `status === "published"`, derive only same-origin public URLs relative to `/homework/`, map absent dates and pages to `null`, and return `total: homeworks.length`. Register the GET route, authenticate before reading the manifest, set `Cache-Control: no-store`, and map manifest failures to the existing JSON error envelope without exception details.

- [ ] **Step 4: Run the focused test in GREEN**

  Run `node --test tests/admin-homework-list.test.mjs`. Expected result: all API and manifest tests pass.

### Task 2: Lock the client states and rendering with failing tests

**Files:**
- Modify: `tests/admin-homework-list.test.mjs`
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`

**Interfaces:**
- Consumes: `GET api/homeworks` returning `{ homeworks, total }`.
- Produces: `loadPublishedHomeworkList()` in the admin client, called only after authenticated Session loading and after a successful publish.

- [ ] **Step 1: Add failing behavior tests for the real client script**

  Run `admin.js` in the existing lightweight browser harness. Assert the loading copy appears before a deferred response; success renders the literal count and item values; empty and error branches show the approved copy; retry is disabled while busy; an HTML-like title remains text; valid links have `_blank` and `noopener noreferrer`; 401 uses the expired-Session path; and inputs retain their original values.

- [ ] **Step 2: Run the focused test in RED**

  Run `node --test tests/admin-homework-list.test.mjs`. Expected result: the new client behavior assertions fail.

- [ ] **Step 3: Add semantic list markup and safe DOM rendering**

  Insert the panel after `.admin-workspace`. Add state, count, retry, header and list hooks. In `admin.js`, use `createElement`, `textContent`, attributes and `replaceChildren`; never concatenate untrusted HTML. Serialize refresh requests with a busy flag, load only after Session success, and keep publish success outside refresh failure handling.

- [ ] **Step 4: Add responsive styles using existing tokens**

  Extend the main grid with a list area. Use a desktop column grid, mobile cards at 48rem, `overflow-wrap: anywhere`, existing controls and focus styles, and no new literal colors or fixed card heights.

- [ ] **Step 5: Run the focused test in GREEN**

  Run `node --test tests/admin-homework-list.test.mjs`. Expected result: all server and client tests pass.

### Task 3: Document operation and verify regression safety

**Files:**
- Modify: `README.md`
- Verify: `content/homework.json`
- Verify: `homework/index.html`
- Verify: `training/files.json`

**Interfaces:**
- Consumes: completed API and admin UI.
- Produces: operator instructions and fresh verification evidence.

- [ ] **Step 1: Document the read-only list**

  Add a Batch 10D section explaining the post-login location, the no-date/no-page display, the authenticated no-CSRF GET route, automatic post-publish refresh, and excluded edit/delete features.

- [ ] **Step 2: Run focused and regression checks**

  Run the exact requested focused tests, all tests, content validation, index check and `git diff --check`. Expected result: every command exits 0.

- [ ] **Step 3: Verify manifest immutability independently**

  Hash `content/homework.json` before and after focused API/client tests and compare the literal SHA-256 values. Also inspect `git diff -- content/homework.json` to ensure the list feature has no manifest patch.

- [ ] **Step 4: Perform local responsive and accessibility acceptance**

  Start the authenticated service against the current project with test-only local credentials. At 390, 768, 1024 and 1440px, inspect the real list for horizontal overflow, long-value wrapping, desktop/mobile layout and console errors. Use keyboard navigation to confirm the open links, retry controls and focus outline remain operable. Do not publish test content.

- [ ] **Step 5: Record final scope and status**

  Run `git status --short`, enumerate only files added or changed for 10D, report the actual manifest count and automated-test totals, and explicitly list edit/delete/draft/search/filter/pagination/Training/deployment as not implemented.
