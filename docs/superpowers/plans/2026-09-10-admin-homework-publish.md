# Batch 10C — Homework image upload and publish implementation plan

> Execute in place because Batch 10B is an uncommitted prerequisite in this checkout. Never publish a test item into the real project; every publication test and manual QA run uses a disposable fixture root.

**Goal:** Add secure image-backed Homework publication to the existing private editor while preserving the existing authentication, preview and content workflows.

**Architecture:** Authenticate before body reads, stream multipart parts into random project-local staging, validate images and exact HTML references, then commit the page/images/JSON/index under one publish lock with rollback. The browser maintains a preview fingerprint so only the exact successfully previewed state can be published.

**Stack:** Node.js ESM, native HTTP/filesystem APIs, parse5, busboy 1.6.0, a bounded three-format magic validator, browser DOMParser/FileReader/Object URLs, node:test.

---

## Task 1: Lock dependencies and shared publish contract

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `admin/shared/homework-preview-contract.mjs`
- Test: `tests/admin-publish.test.mjs`

1. Add focused tests for `coverAlt`, image limits, safe content filenames, canonical future paths, and stable validation ordering.
2. Run the new test and confirm it fails because the publish contract is absent.
3. Pin `busboy@1.6.0`; evaluate the Node-compatible `file-type` line, remove it after its audit advisories, and retain a bounded three-format detector instead.
4. Extend the shared module with publish limits/helpers and validation, delegating existing fields to the preview contract.
5. Run the focused tests until green, then run `admin-preview.test.mjs`.

## Task 2: Validate staged images and exact HTML references

**Files:**
- Create: `admin/server/image-upload-validator.mjs`
- Modify: `admin/server/html-fragment-validator.mjs`
- Test: `tests/admin-publish.test.mjs`

1. Add failing tests for valid PNG/JPEG/WebP, empty files, disguised/unsupported data, extension/type mismatch, unsafe/duplicate names, individual/aggregate/count limits, and exact reference-set matching.
2. Confirm failures identify the missing validator APIs.
3. Implement staged-file detection with strict PNG/JPEG/WebP signatures, accepted mappings, polyglot checks, and public-safe error objects.
4. Export a parse5-based image-source extractor from the HTML validator and implement exact set comparison without URL decoding or normalization.
5. Run focused tests green and rerun preview validator tests.

## Task 3: Stream multipart requests into staging

**Files:**
- Create: `admin/server/multipart-request.mjs`
- Modify: `.gitignore`
- Test: `tests/admin-publish.test.mjs`

1. Add failing tests for multipart-only parsing, missing/duplicate payload, duplicate cover, unknown parts, truncated requests, request/file/total/count limits, cleanup, and safe completion after 413.
2. Confirm the parser tests fail for the intended missing behavior.
3. Implement strict Content-Type parsing and Content-Length preflight, request byte counting, Busboy limits, random staging creation, file streaming with exclusive paths, and complete cleanup on ordinary errors.
4. Add `.admin-staging/` to `.gitignore`.
5. Run focused parser tests green.

## Task 4: Render formal pages

**Files:**
- Modify: `admin/server/homework-page-renderer.mjs`
- Modify: `tests/admin-preview.test.mjs`
- Test: `tests/admin-publish.test.mjs`

1. Add failing renderer tests for preview `img-src data:`, no preview scripts, formal no-preview-CSP, correct deep-page CSS/script paths, navigation script, conditional accordion script, and absence of admin/session data.
2. Confirm expected failures against the Batch 10B renderer.
3. Add a preview/formal conditional while keeping one renderer and preserving escaped shell fields plus validated content HTML.
4. Run renderer and all preview tests green.

## Task 5: Implement the locked publisher transaction

**Files:**
- Create: `admin/server/homework-publisher.mjs`
- Test: `tests/admin-publish.test.mjs`

1. Build a disposable fixture containing content JSON, both index templates, referenced assets and validation prerequisites.
2. Add failing tests for page/images/JSON/index output, `trainingFolder:null`, lock-time order, no Training link, conflicts, concurrency, same-ID races, cleanup, and forced build/validate/check rollback.
3. Confirm failures are due to the absent publisher.
4. Implement staging preparation, safe target resolution, one `withFileLock` transaction, lock-time conflict/order checks, exact recovery copies, public placement, atomic JSON, build/validate/check, rollback and recovery-retention signaling.
5. Run publisher tests green and verify fixture directories are removed.

## Task 6: Add the authenticated Publish API

**Files:**
- Modify: `admin/server/server.mjs`
- Modify: `admin/server/config.mjs` if only a named publish-request limit is needed
- Test: `tests/admin-publish.test.mjs`
- Test: `tests/admin-auth.test.mjs`
- Test: `tests/admin-preview.test.mjs`

1. Add failing integration tests for exact route/method, Origin → Session → CSRF → multipart order, expired sessions, pre-body rejection, field/HTML/image/reference errors, conflict status, 201 response, generalized 500, and startup stale-staging warning.
2. Confirm failures produce 404/missing-route behavior.
3. Refactor POST gates per route without changing login/preview/logout semantics; add publish parsing, validation and transaction orchestration.
4. Map known errors to the required uniform statuses and keep logs free of input/path/token details.
5. Run publish, auth and preview suites green.

## Task 7: Build the image and publication UI

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`
- Test: `tests/admin-publish.test.mjs`
- Test: `tests/admin-preview.test.mjs`

1. Add failing DOM/source and VM-client tests for fields, accepted formats, future paths, accessible copy feedback, cover Object URL lifecycle, Data URL iframe substitution, preview invalidation/fingerprint, publish eligibility, dialog summary/focus, duplicate-submit prevention, 401/409 handling, preserved form and success links.
2. Confirm failures reflect missing controls/state.
3. Add semantic file fields, cover card, path list, live statuses, publish button, native dialog and result panels.
4. Implement local image checks, exact selected-path map, FileReader conversion, DOMParser substitution, resource cleanup, preview fingerprint state machine, multipart request and response states.
5. Style with existing design tokens at 390/768/1024/1440 breakpoints and reduced-motion support.
6. Run publish and preview suites green.

## Task 8: Preserve the original 33 while allowing appended items

**Files:**
- Modify: `tests/homework.test.mjs`
- Modify: `tests/content-workflow.test.mjs`
- Test: those same files

1. Change count assertions to require at least 33 and compare the original 33 as an exact prefix.
2. Keep canonical JSON hash protection for the baseline records and validate all appended records/resources.
3. Run both suites and confirm no original-content protection was weakened.

## Task 9: Documentation and automated verification

**Files:**
- Modify: `README.md`
- Test: `tests/admin-publish.test.mjs`

1. Add README guidance for limits, safe filenames, literal HTML references, preview-before-publish, changed files, rollback, no Training, staging/recovery and Git exclusions.
2. Run, in order:
   - `node --test tests/admin-publish.test.mjs`
   - `node --test tests/admin-preview.test.mjs`
   - `node --test tests/admin-auth.test.mjs`
   - `node --test tests/*.test.mjs`
   - `node scripts/validate-content.mjs`
   - `node scripts/build-content-indexes.mjs --check`
3. Compare protected-file hashes to the recorded baseline and verify no real test ID page/directory exists.

## Task 10: Isolated browser acceptance and final review

**Files:**
- No real-site writes; use a disposable fixture and temporary environment only.

1. Read and follow the computer-use skill, start the fixture admin service, and perform login/preview/cover/content/path/dialog/success checks.
2. Confirm state invalidation and re-preview gating, then force one publisher failure in a fresh fixture and inspect rollback.
3. Inspect 390, 768, 1024 and 1440 widths; keyboard order/focus; and browser console.
4. Stop services, remove the disposable fixture, rerun the full automated verification and protected-content hash comparison.
5. Read and follow verification-before-completion, request code review, resolve findings with test-first fixes, then prepare the Batch 10C report and stop.
