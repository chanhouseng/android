# 批次 10F：編輯 Homework 主要內容 HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓已登入管理者安全載入、預覽並更新 renderer-compatible Homework 的主要內容 HTML，同時維持 manifest、Homework index、圖片及所有非內容欄位 byte-identical。

**Architecture:** 新的 content editor 在既有 manifest 鎖內重用 10E-1 editability inspector，提供內容讀取、SHA-256 revision、server-side preview 與單頁原子更新／回滾。獨立圖片驗證器把每個引用限制在 `homework/img/<id>/` 的普通非 symlink 檔案；管理頁使用另一個 dialog 與 sandbox iframe，只有 textarea 與最近成功預覽完全相同時才允許 PATCH。

**Tech Stack:** Node.js ESM、原生 HTTP、`node:test`、parse5 7.3、原生 `<dialog>`、sandbox iframe、現有 Design System CSS。

**Spec:** `docs/superpowers/specs/2026-09-15-admin-homework-content-edit-design.md`

## Global Constraints

- 唯一可修改的正式資料是可編輯詳細頁 `data-original-content` 內的主要內容 HTML。
- `content/homework.json`、`homework/index.html`、圖片及 Homework 其他欄位必須保持不變。
- 所有 POST／PATCH 在讀取 body 前依序完成 Origin、Session、CSRF 檢查。
- 主要內容最多 400 KiB UTF-8；HTML 安全規則完全沿用既有 preview contract 與 fragment validator。
- 所有正式寫入使用既有檔案鎖及原子寫入；失敗時詳細頁完整回滾。
- 不支援舊式 Homework；不新增第三方編輯器、圖片操作、草稿、刪除、Training 或部署功能。
- 保留工作區原有修改，不建立 worktree、不重設、不覆蓋或刪除無關內容。
- 不執行 Git commit。

---

### Task 1: Content request contract and revision

**Files:**
- Modify: `admin/shared/homework-preview-contract.mjs`
- Create: `admin/server/homework-content-editor.mjs`
- Create: `tests/admin-homework-edit-content.test.mjs`

**Interfaces:**
- Consumes: `HOMEWORK_PREVIEW_LIMITS`、`HOMEWORK_ID_PATTERN`、`TextEncoder`、`createHash`.
- Produces: `isHomeworkContentPreviewRequest(input): boolean`、`isHomeworkContentUpdateRequest(input): boolean`、`homeworkContentRevision({id,contentHtml}): string`.

- [x] **Step 1: Write failing exact-shape and revision tests**

```js
assert.equal(isHomeworkContentPreviewRequest({ contentHtml: '<p>內容</p>' }), true);
assert.equal(isHomeworkContentPreviewRequest({ id: 'module-f', contentHtml: '<p>內容</p>' }), false);
assert.equal(isHomeworkContentUpdateRequest({ contentHtml: '<p>內容</p>', revision: 'a'.repeat(64) }), true);
assert.equal(isHomeworkContentUpdateRequest({ contentHtml: '<p>內容</p>' }), false);
assert.equal(homeworkContentRevision({ id: 'module-f', contentHtml: '<p>內容</p>' }),
  'b99fae8e55eac9718a9fad6e852ad3e4eff5f2c8dd3fb098a05e91c5ecd54829');
```

- [x] **Step 2: Run focused test and verify RED**

Run: `node --test tests/admin-homework-edit-content.test.mjs`

Expected: FAIL because the request guards and content editor module do not exist.

- [x] **Step 3: Implement minimal exact-key guards and deterministic revision**

```js
export function isHomeworkContentPreviewRequest(input) {
  return isRecord(input) && Object.keys(input).length === 1 && typeof input.contentHtml === 'string';
}

export function isHomeworkContentUpdateRequest(input) {
  if (!isRecord(input) || Object.keys(input).sort().join(',') !== 'contentHtml,revision') return false;
  return typeof input.contentHtml === 'string' && /^[a-f0-9]{64}$/.test(input.revision);
}

export function homeworkContentRevision({ id, contentHtml }) {
  return createHash('sha256').update(id).update('\0').update(contentHtml, 'utf8').digest('hex');
}
```

- [x] **Step 4: Add literal malformed body and UTF-8 revision cases, then verify GREEN**

Test arrays, null, extra keys, uppercase／short revision, non-string HTML, and a Chinese content literal with a separately computed expected digest. Re-run the focused test and require all cases to pass.

---

### Task 2: Existing-image reference validator and preview rewrite

**Files:**
- Create: `admin/server/homework-content-images.mjs`
- Modify: `admin/server/homework-content-editor.mjs`
- Modify: `tests/admin-homework-edit-content.test.mjs`

**Interfaces:**
- Consumes: `extractImageSources()`、`isSafeContentImageFilename()`、`contentImagePath()`、`resolveInside()`、`lstat()`、`realpath()`.
- Produces: `validateExistingHomeworkImageReferences({rootDirectory,id,contentHtml}): Promise<{ok:true,images:Array}|{ok:false,errors:Array}>`、`rewriteContentImageSources({id,contentHtml,imageBaseUrl}): string`、`readHomeworkContentImage({rootDirectory,id,filename}): Promise<{bytes,mimeType}>`.

- [x] **Step 1: Write failing valid-image and cross-Homework tests**

```js
await writeFile(join(root, 'homework/img/module-f/screen-1.png'), PNG_BYTES);
assert.equal((await validateExistingHomeworkImageReferences({
  rootDirectory: root,
  id: 'module-f',
  contentHtml: '<img src="img/module-f/screen-1.png" alt="畫面">',
})).ok, true);
assert.deepEqual((await validateExistingHomeworkImageReferences({
  rootDirectory: root,
  id: 'module-f',
  contentHtml: '<img src="img/module-x/screen-1.png" alt="畫面">',
})).errors.map(({ code }) => code), ['invalid_existing_image']);
```

- [x] **Step 2: Verify RED, then implement lexical and physical path validation**

Run the focused test and require failure because the module is missing. Implement exact `img/${id}/${filename}` matching, reuse the safe filename predicate, reject missing/non-file/symlink targets, compare `realpath()` of the file to the real image-directory prefix, and return only safe field errors.

- [x] **Step 3: Add traversal, external, absolute, missing, directory and symlink tests**

Use literal sources such as `../module-x/a.png`, `/homework/img/module-f/a.png`, `https://example.test/a.png`, and `img/module-f/missing.png`. Create a symlink only when the platform permits it; otherwise mark that single case skipped while all other cases remain mandatory.

- [x] **Step 4: Write failing preview-only rewrite tests**

```js
const original = '<figure><img src="img/module-f/screen-1.png" alt="畫面"></figure>';
const rewritten = rewriteContentImageSources({
  id: 'module-f', contentHtml: original,
  imageBaseUrl: 'http://127.0.0.1:3000/private/api/homeworks/module-f/images/',
});
assert.match(rewritten, /src="http:\/\/127\.0\.0\.1:3000\/private\/api\/homeworks\/module-f\/images\/screen-1\.png"/);
assert.equal(original, '<figure><img src="img/module-f/screen-1.png" alt="畫面"></figure>');
```

- [x] **Step 5: Implement source-location replacements and image-byte reader**

Collect each `<img>` `src` attribute location with parse5, replace values from last offset to first, and leave all non-`src` bytes unchanged. `readHomeworkContentImage()` must repeat filename, lstat and realpath checks, then return a buffer plus `image/png`、`image/jpeg` or `image/webp` based on the allowed extension.

- [x] **Step 6: Verify GREEN**

Run: `node --test tests/admin-homework-edit-content.test.mjs`

Expected: valid existing files pass, every unsafe or absent reference fails, and rewrite tests prove the original storage string is unchanged.

---

### Task 3: Load, preview, locked update and rollback

**Files:**
- Modify: `admin/server/homework-content-editor.mjs`
- Modify: `tests/admin-homework-edit-content.test.mjs`

**Interfaces:**
- Consumes: `inspectHomeworkEditability()`、`readJson()`、`withFileLock()`、`writeTextAtomic()`、`validateHomeworkPreviewInput()`、`validateHtmlFragment()`、`validateContent()`、`buildContentIndexes({check:true})`、`renderHomeworkPage()`、Task 2 image functions.
- Produces: `loadHomeworkContent({rootDirectory,id})`、`previewHomeworkContent({rootDirectory,id,contentHtml,assetBase,imageBaseUrl})`、`updateHomeworkContent({rootDirectory,id,contentHtml,revision,dependencies,logger})`、`HomeworkContentEditError`.

- [x] **Step 1: Write failing content-load behavior**

```js
const loaded = await loadHomeworkContent({ rootDirectory: root, id: 'module-f' });
assert.deepEqual(loaded.homework, {
  id: 'module-f', title: 'Module F', url: '/homework/module-f.html',
  contentHtml: ORIGINAL_CONTENT,
  revision: homeworkContentRevision({ id: 'module-f', contentHtml: ORIGINAL_CONTENT }),
});
```

Add separate 404 and 409 assertions for missing and renderer-incompatible pages. Verify RED, implement a shared locked record loader, then verify GREEN.

- [x] **Step 2: Write failing safe-preview behavior**

Assert that a valid fragment produces a script-free `previewHtml` with preview CSP and protected rewritten image URL. Assert title and description come from the current manifest, not request data. Add 400 KiB, script, event handler, unsafe URL, missing image and cross-ID image cases with exact `validation_failed` field codes.

- [x] **Step 3: Implement preview pipeline in the required order**

```js
const input = validateHomeworkPreviewInput({
  id: item.id, title: item.title, description: item.description, contentHtml,
});
const fragment = input.ok && validateHtmlFragment(input.value.contentHtml);
const images = fragment.ok && await validateExistingHomeworkImageReferences({
  rootDirectory, id: item.id, contentHtml: fragment.html,
});
```

Only after all three checks pass, rewrite preview image URLs and call `renderHomeworkPage({ preview: true })`. Return field errors without paths.

- [x] **Step 4: Write successful update test and verify RED**

Snapshot manifest, index, detail page, image file list and hashes. Update to a literal safe fragment, then assert only the detail page differs; inspect it to prove the new exact content is present and all manifest metadata remains current.

- [x] **Step 5: Implement the minimal locked transaction**

Inside `content/homework.json.lock`, re-read the unique record and inspect the page, compare request revision to a fresh content revision, validate content and images, render with the lock-time title and description, snapshot the original page bytes, atomically write the new page, validate content, and run index check without rebuilding indexes.

- [x] **Step 6: Add revision and metadata-race tests**

Assert a stale revision returns `409 content_changed`. Simulate a metadata update before the content lock is acquired and prove the final page contains the newer title／description plus the new content. Start two content updates from one revision and prove only the first can succeed.

- [x] **Step 7: Write failure-injection tests before rollback code**

Inject separate failures from `writeText`, `validateProject` and `checkIndexes`. For each case require `500 internal_error`, then compare the detail page, manifest, index and images byte-for-byte with the snapshot.

- [x] **Step 8: Implement rollback and verify GREEN**

After a formal write starts, restore the original page with the injected `restoreText` while still holding the lock. If restoration fails, log only `Critical Homework content rollback failure.` and still return a path-free internal error. Re-run all focused module tests.

---

### Task 4: Protected HTTP routes

**Files:**
- Modify: `admin/server/server.mjs`
- Modify: `tests/admin-homework-edit-content.test.mjs`
- Modify: `tests/admin-auth.test.mjs`

**Interfaces:**
- Consumes: Task 1 request guards、Task 2 image reader、Task 3 load／preview／update functions.
- Produces: authenticated content GET, CSRF-protected preview POST and content PATCH, authenticated image GET.

- [x] **Step 1: Add failing route and method tests**

For each endpoint assert the correct method succeeds eventually, wrong methods return `405` with exact `Allow`, encoded/query/path aliases return 404 or safe 400, and all API responses use `Cache-Control: no-store`.

- [x] **Step 2: Verify RED and implement exact dynamic route parsing**

Recognize `/api/homeworks/:id/content`, `/content/preview`, and `/images/:filename` before the existing metadata PATCH fallback. Allow GET+PATCH on content, POST on preview and GET on images without creating a general file route.

- [x] **Step 3: Add authorization-before-body tests**

Send an incomplete streaming POST/PATCH body with missing Origin, missing/expired Session and wrong CSRF; prove each response arrives before the body completes. Add invalid media type, malformed JSON and over-limit request cases.

- [x] **Step 4: Implement handlers and unified errors**

Run mutating Origin handling before authentication, then verify Session and CSRF before `readJson(PREVIEW_BODY_LIMIT_BYTES)`. Validate exact body shape, forward validation field errors, map missing/legacy/conflict/internal states, and send image bytes with fixed MIME and `X-Content-Type-Options: nosniff` inherited from the security headers.

- [x] **Step 5: Add successful integration and leakage tests**

Through the real HTTP server, load content, preview it, PATCH it once, reload it, fetch a referenced image, and compare all protected files. Assert no response contains fixture root, Windows paths, stack text, revision inputs beyond the explicit success contract, Session data or exception strings.

- [x] **Step 6: Verify GREEN and authentication regression**

```text
node --test tests/admin-homework-edit-content.test.mjs
node --test tests/admin-auth.test.mjs
```

---

### Task 5: Accessible independent content editor dialog

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`
- Modify: `tests/admin-homework-edit-content.test.mjs`
- Modify: `tests/admin-homework-list.test.mjs`
- Modify: `tests/admin-publish.test.mjs`

**Interfaces:**
- Consumes: list `editable` boolean、content GET／preview POST／PATCH contracts、existing Session and Blob preview helpers.
- Produces: list action `編輯主要內容` and an isolated load/edit/preview/save/success dialog.

- [x] **Step 1: Add failing semantic markup tests**

Assert a labelled `<dialog>`, readonly ID/title, safe public link, textarea with byte-count description, loading/error/live status, update-preview/cancel/save controls, sandbox iframe with no capabilities, and a hidden success view containing `開啟公開 Homework` with `_blank` plus `noopener noreferrer`.

- [x] **Step 2: Add failing list-action behavior**

For `editable: true`, assert both `編輯基本資料` and `編輯主要內容` buttons exist. For `editable: false`, assert neither edit button exists and the single legacy message remains. Use HTML-like title text and assert no executable element is created.

- [x] **Step 3: Add failing dialog state-machine tests**

The fake DOM/fetch harness must assert:

```js
await contentEditButton.dispatch('click');
assert.equal(fetchCalls.at(-1).url, 'api/homeworks/module-f/content');
assert.equal(contentTextarea.value, ORIGINAL_CONTENT);
contentTextarea.value += '<p>變更</p>';
await contentTextarea.dispatch('input');
assert.equal(contentSave.disabled, true);
await contentPreview.dispatch('click');
assert.equal(contentSave.disabled, false);
```

Also cover UTF-8 byte count, 400 KiB boundary, preview Blob replacement/revocation, identical-content gating, and the fact that preview URL rewriting never changes textarea value.

- [x] **Step 4: Add guarded request and failure tests**

Dispatch preview or save twice concurrently and assert one request. Cover 401 retaining textarea, 422 field errors, `content_changed` reload instruction, generic failure, successful new revision and public link. Snapshot every upper publish-form value before opening and after all outcomes.

- [x] **Step 5: Implement restrained dialog markup and responsive styles**

Reuse existing tokens and `.publish-dialog`; use a two-column content workspace above 48rem and one column below. Apply `min-width: 0`, overflow wrapping, textarea resize rules, 44px actions, existing focus outline and existing loading/error/success components. Add no color, font, radius or shadow literals.

- [x] **Step 6: Implement isolated content editor state**

Keep distinct `contentEditingHomework`、`contentRevision`、`contentPreviewFingerprint`、`contentPreviewBusy` and `contentSaving` state. Create all manifest-derived labels with `textContent`／`value`, never `innerHTML`, and never read/write/reset `#homework-form`.

- [x] **Step 7: Implement preview and save guards**

Invalidate the preview fingerprint synchronously on every input. Preview through one POST into a script-disabled sandbox iframe `srcdoc`; enable save only for an exact current fingerprint match. PATCH once with content and loaded revision; on success show the safe public link, on 401 keep content while invoking the existing expired-session state, and on close clear the preview document and restore trigger focus.

- [x] **Step 8: Verify GREEN and front-end regressions**

```text
node --test tests/admin-homework-edit-content.test.mjs
node --test tests/admin-homework-list.test.mjs
node --test tests/admin-preview.test.mjs
node --test tests/admin-publish.test.mjs
```

---

### Task 6: Documentation and protected-file proofs

**Files:**
- Modify: `README.md`
- Verify: `content/homework.json`, `homework/index.html`, `homework/img/**`, all 10F source and test files.

**Interfaces:**
- Consumes: completed server and UI behavior.
- Produces: operator documentation and repeatable proof that out-of-scope data stays unchanged.

- [x] **Step 1: Document operation and safety boundary**

Add a concise README section describing the content button, required preview match, 400 KiB limit, existing-image-only rule, revision conflict response, exact editable-page boundary, single-page transaction and explicitly unchanged manifest/index/images.

- [x] **Step 2: Add project protected-content snapshots to the focused test**

At test start read buffers for `content/homework.json`, `homework/index.html` and recursively listed `homework/img/` files. At final test compare path list and buffers exactly, proving focused tests used temporary fixtures only.

- [x] **Step 3: Run the focused and management suites**

```text
node --test tests/admin-homework-edit-content.test.mjs
node --test tests/admin-auth.test.mjs
node --test tests/admin-preview.test.mjs
node --test tests/admin-publish.test.mjs
node --test tests/admin-homework-list.test.mjs
node --test tests/admin-homework-edit-metadata.test.mjs
node --test tests/admin-public-links.test.mjs
```

Record exact pass/fail totals.

---

### Task 7: Full verification and actual acceptance

**Files:**
- Verify: all project and 10F files; do not modify public data during browser acceptance.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: evidence-backed completion report.

- [x] **Step 1: Run full automated verification**

```text
node --test tests/*.test.mjs
node scripts/validate-content.mjs
node scripts/build-content-indexes.mjs --check
git diff --check
git status --short
```

If global `git diff --check` reports inherited whitespace in unrelated files, run a scoped trailing-whitespace check for every 10F file and report both results without changing unrelated content.

- [x] **Step 2: Verify protected SHA-256 snapshots**

Compare pre/post SHA-256 and image path lists for `content/homework.json`, `homework/index.html` and `homework/img/**`. Also inspect the 10F diff to confirm no manifest, index or image write code exists outside the detail-page transaction.

- [x] **Step 3: Exercise success, conflict and rollback on disposable fixtures**

Run a complete GET → preview → PATCH cycle against a temporary project copy; run two stale-revision PATCHes and require the second to return `409`; inject validation and index-check failures on fresh fixtures and require the page hash to return to its original value.

- [x] **Step 4: Perform responsive and accessibility acceptance**

Start the local admin service with test-only credentials. At 390, 768, 1024 and 1440px confirm no horizontal overflow, readable stacked/two-column dialog, 44px actions, long HTML/URL containment, keyboard open/edit/preview/cancel flow, visible focus, accessible live states and zero browser Console errors. Do not PATCH formal project content.

- [x] **Step 5: Produce the final report**

Report changed files, supported/excluded Homework counts and IDs, load/preview/save behavior, image checks, revision conflict protection, manifest/index/image proofs, rollback results, exact test totals, responsive/keyboard/console results, inherited workspace warnings, explicitly omitted features, and confirmation that no Git commit was created.
