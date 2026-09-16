# 批次 10E-1：編輯 Homework 基本資料 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 讓已登入管理者只修改安全、可由現有 renderer 無損重建之 Homework 的 `title` 與 `description`，並以受鎖定且可回滾的交易同步三個正式檔案。

**Architecture:** 共享 contract 負責兩個欄位的結構及內容驗證；新的 metadata editor 以 parse5 來源位置及 renderer byte equality 判定 editability，並在既有 manifest 鎖內更新、驗證及回滾。清單 API 提供 `description`／`editable`，PATCH route 重用現有 Session、Origin、CSRF、JSON 及安全錯誤處理，前端以單一 dialog 完成編輯、確認及儲存。

**Tech Stack:** Node.js ESM、`node:test`、parse5 7.3、原生 HTTP、原生 `<dialog>`、現有 Design System CSS。

**Spec:** `docs/superpowers/specs/2026-09-13-admin-homework-metadata-edit-design.md`

## Global Constraints

- 只允許修改 `title` 與 `description`。
- 不修改 ID、order、status、resultPage、trainingFolder、主要內容 HTML 或任何圖片欄位及圖片 bytes。
- PATCH 必須依序驗證 Origin、Session、CSRF，再讀取 body。
- 所有正式寫入使用既有檔案鎖及原子文字寫入；失敗時三個正式檔案一起恢復。
- 所有伺服器錯誤對外只使用統一安全 JSON，不回傳實體路徑或 stack trace。
- 保留目前工作區所有原有修改；不建立 worktree、不重設、不刪除無關內容。
- 不執行 Git commit。

---

### Task 1: Metadata request contract

**Files:**
- Modify: `admin/shared/homework-preview-contract.mjs`
- Create: `tests/admin-homework-edit-metadata.test.mjs`

**Interfaces:**
- Consumes: `HOMEWORK_PREVIEW_LIMITS`、既有 `validateTrimmedText()`／`validateDescription()` 規則。
- Produces: `isHomeworkMetadataRequest(input): boolean`、`validateHomeworkMetadataInput(input): {ok:true,value:{title,description}} | {ok:false,errors:Array}`。

- [x] **Step 1: Write failing contract tests**

```js
test('metadata contract accepts exactly title and description and normalizes edges', () => {
  assert.equal(isHomeworkMetadataRequest({ title: ' 新名稱 ', description: ' 新簡介 ' }), true);
  assert.deepEqual(validateHomeworkMetadataInput({ title: ' 新名稱 ', description: ' 新簡介 ' }), {
    ok: true,
    value: { title: '新名稱', description: '新簡介' },
  });
});

test('metadata contract separates malformed shape from field validation', () => {
  assert.equal(isHomeworkMetadataRequest({ id: 'module-f', title: '名稱', description: '簡介' }), false);
  assert.equal(isHomeworkMetadataRequest({ title: '名稱' }), false);
  assert.deepEqual(validateHomeworkMetadataInput({ title: '', description: '<script>' }).errors.map(({ field, code }) => [field, code]), [
    ['title', 'required'],
    ['description', 'html_not_allowed'],
  ]);
});
```

- [x] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/admin-homework-edit-metadata.test.mjs`

Expected: FAIL because both exports are missing.

- [x] **Step 3: Implement the minimal shared contract**

```js
export function isHomeworkMetadataRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const keys = Object.keys(input).sort();
  return keys.length === 2 && keys[0] === 'description' && keys[1] === 'title';
}

export function validateHomeworkMetadataInput(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const title = validateTrimmedText('title', source.title, HOMEWORK_PREVIEW_LIMITS.titleCharacters, '顯示名稱');
  const description = validateDescription(source.description);
  const errors = [title.error, description.error].filter(Boolean);
  return errors.length ? { ok: false, errors } : {
    ok: true,
    value: { title: title.value, description: description.value },
  };
}
```

- [x] **Step 4: Add literal Unicode boundary cases and verify GREEN**

Add assertions for exactly 120/121 title characters, 500/501 description characters, non-string values, arrays and `<`／`>` HTML delimiters. Run the focused file and require all contract tests to pass.

---

### Task 2: Strict renderer editability inspection

**Files:**
- Create: `admin/server/homework-metadata-editor.mjs`
- Modify: `tests/admin-homework-edit-metadata.test.mjs`

**Interfaces:**
- Consumes: `parse()` from parse5、`resolveInside()`、`renderHomeworkPage()`、manifest record.
- Produces: `inspectHomeworkEditability({rootDirectory,item}): Promise<{editable:false}|{editable:true,pagePath,pageHtml,contentHtml}>` and `HomeworkMetadataEditError`.

- [x] **Step 1: Write a renderer-backed editable fixture and failing test**

```js
const pageHtml = renderHomeworkPage({
  id: 'module-f', title: 'Module F', description: '原簡介',
  contentHtml: '<section><h2>保留內容</h2></section>',
  preview: false, assetBase: '../assets/css/', scriptBase: '../assets/js/',
});
await writeFile(join(root, 'homework', 'module-f.html'), pageHtml);
const result = await inspectHomeworkEditability({ rootDirectory: root, item });
assert.equal(result.editable, true);
assert.equal(result.contentHtml, '<section><h2>保留內容</h2></section>');
```

- [x] **Step 2: Run and verify RED**

Run: `node --test tests/admin-homework-edit-metadata.test.mjs`

Expected: FAIL because the metadata editor module is missing.

- [x] **Step 3: Implement source-location traversal and renderer equality**

```js
function collectMarkedElements(node, state) {
  if (Array.isArray(node.attrs)) {
    const contentId = node.attrs.find(({ name }) => name === 'data-content-id');
    const original = node.attrs.find(({ name }) => name === 'data-original-content');
    if (contentId) state.contentIds.push({ node, value: contentId.value });
    if (original) state.originals.push(node);
  }
  for (const child of node.childNodes ?? []) collectMarkedElements(child, state);
}
```

Require `item.resultPage === `${item.id}.html``, a normal non-symlink file, exactly one matching ID node, exactly one original-content node with offsets, the exact renderer wrapper newline/indent, and byte-for-byte equality with `renderHomeworkPage()` using existing metadata.

- [x] **Step 4: Add rejection tests one behavior at a time**

Add separate tests for legacy unmarked HTML, `../world skill/`, missing file, symlink, missing marker, duplicate marker, mismatched ID, malformed wrapper and a manually changed renderer page. Each mutation must make `editable` false without leaking a filesystem path.

- [x] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/admin-homework-edit-metadata.test.mjs`

Expected: all editability cases pass.

---

### Task 3: Locked three-file update and rollback

**Files:**
- Modify: `admin/server/homework-metadata-editor.mjs`
- Modify: `tests/admin-homework-edit-metadata.test.mjs`

**Interfaces:**
- Consumes: `withFileLock()`、`writeTextAtomic()`、`buildContentIndexes()`、`validateContent()`、`inspectHomeworkEditability()`.
- Produces: `updateHomeworkMetadata({rootDirectory,id,metadata,dependencies,logger}): Promise<{updated,homework}>`.

- [x] **Step 1: Write the successful transaction test and verify RED**

```js
const before = await snapshotFixture(root);
const result = await updateHomeworkMetadata({
  rootDirectory: root,
  id: 'module-f',
  metadata: { title: '新名稱', description: '新簡介' },
});
assert.equal(result.updated, true);
assert.equal((await readManifest(root))[0].title, '新名稱');
assert.match(await readFile(join(root, 'homework/module-f.html'), 'utf8'), /<h1>新名稱<\/h1>/);
assert.match(await readFile(join(root, 'homework/index.html'), 'utf8'), /data-homework-name="新名稱"/);
assert.equal(extractOriginalContent(await readPage(root)), before.contentHtml);
```

Expected RED: `updateHomeworkMetadata` is not exported.

- [x] **Step 2: Implement the minimal locked transaction**

Inside `withFileLock(content/homework.json.lock)`, re-read manifest, distinguish missing ID (`404 homework_not_found`) from unsupported format (`409 homework_not_editable`), snapshot manifest/page/index bytes, build a spread-copy record replacing only the two allowed fields, render the page with the extracted content, atomically write page and manifest, rebuild indexes, validate, and check indexes.

```js
const updatedItem = { ...item, title: metadata.title, description: metadata.description };
const updatedRecords = records.map((record) => record === item ? updatedItem : record);
const updatedPage = renderHomeworkPage({
  id: item.id,
  title: metadata.title,
  description: metadata.description,
  contentHtml: inspection.contentHtml,
  preview: false,
  assetBase: '../assets/css/',
  scriptBase: '../assets/js/',
});
```

- [x] **Step 3: Prove non-editable data and image bytes remain unchanged**

Snapshot the entire original record and all referenced image hashes. After success, assert deep equality after replacing the expected `title`/`description`, exact original-content equality, unchanged record order, and identical image hashes.

- [x] **Step 4: Write rollback tests before rollback implementation**

Inject separate failures from the second formal write, index build, content validation and index check. For each case, assert rejection with `500 internal_error`, then compare all three formal files byte-for-byte to their original buffers.

- [x] **Step 5: Implement complete rollback and verify GREEN**

Once any formal write begins, catch every failure while still holding the lock and start all three restore operations with `Promise.allSettled()` so one restore error cannot prevent the other restores. Log only a fixed critical message if a restore fails; otherwise throw a path-free `HomeworkMetadataEditError(500, 'internal_error')`.

- [x] **Step 6: Write and pass a concurrency test**

Start two edits against the same fixture, hold the first transaction inside an injected validator, and assert the second does not enter its critical section until release. After both finish, JSON remains valid, index synchronized, and the final page/manifest/index all represent the same winning metadata.

---

### Task 4: Extend the published list contract

**Files:**
- Modify: `admin/server/homework-list.mjs`
- Modify: `tests/admin-homework-list.test.mjs`
- Modify: `tests/admin-homework-edit-metadata.test.mjs`

**Interfaces:**
- Consumes: `inspectHomeworkEditability({rootDirectory,item})`.
- Produces: each published list item includes exact `description: string` and `editable: boolean`.

- [x] **Step 1: Add failing list API assertions**

```js
assert.deepEqual(body.homeworks[0], {
  id: 'module-f', title: 'Module F', description: '練習內容',
  status: 'published', publishedAt: null,
  url: '/homework/module-f.html', editable: true,
});
assert.equal(body.homeworks.find(({ id }) => id === 'legacy').editable, false);
```

- [x] **Step 2: Verify RED**

Run: `node --test tests/admin-homework-list.test.mjs tests/admin-homework-edit-metadata.test.mjs`

Expected: FAIL because list items lack `description` and `editable`.

- [x] **Step 3: Add safe list enrichment**

Validate `description` as an existing manifest string, inspect published records in parallel, and return only the boolean to the browser. An unreadable or incompatible detail page becomes `editable: false`; invalid manifest structure remains the existing safe `invalid_manifest` error.

- [x] **Step 4: Verify GREEN and manifest immutability**

Run both focused files and compare the fixture manifest before/after the GET request byte-for-byte.

---

### Task 5: Protected PATCH HTTP route

**Files:**
- Modify: `admin/server/server.mjs`
- Modify: `tests/admin-homework-edit-metadata.test.mjs`
- Modify: `tests/admin-auth.test.mjs`

**Interfaces:**
- Consumes: `isHomeworkMetadataRequest()`、`validateHomeworkMetadataInput()`、`updateHomeworkMetadata()`.
- Produces: `PATCH <ADMIN_PATH>/api/homeworks/:id` with the spec error/status contract.

- [x] **Step 1: Add failing HTTP authorization and routing tests**

Cover wrong method/Allow header, malformed route ID, missing or expired Session, invalid Origin, invalid CSRF, unsupported media type and oversized/malformed JSON. Assert authentication, Origin and CSRF rejection happens before a streamed body is consumed.

- [x] **Step 2: Verify RED**

Run: `node --test tests/admin-homework-edit-metadata.test.mjs`

Expected: PATCH currently returns 404.

- [x] **Step 3: Implement dynamic exact route resolution**

Resolve static routes first, then recognize only an exact ASCII suffix after `${prefix}/api/homeworks/`. Validate suffix with `HOMEWORK_ID_PATTERN`; encoded, queried, fragmented, empty or slash-containing aliases fail closed. Add `PATCH` to the existing mutating Origin/JSON gate and set `Cache-Control: no-store` for both list and edit APIs.

- [x] **Step 4: Implement PATCH handler and errors**

Check live Session and CSRF before reading JSON, reject body shape with `400`, return field errors with `422`, then call the editor. Add fixed messages for `homework_not_found` and `homework_not_editable`; include `HomeworkMetadataEditError` in the safe catch allowlist.

- [x] **Step 5: Add success, 404, 409, 422 and 500 response tests**

Assert success response contains only ID/title/description/public URL, errors contain neither fixture root nor stack text, and every response contains `Cache-Control: no-store`.

- [x] **Step 6: Verify GREEN and auth regression**

Run:

```text
node --test tests/admin-homework-edit-metadata.test.mjs
node --test tests/admin-auth.test.mjs
```

Expected: both files pass.

---

### Task 6: Accessible edit and confirmation dialog

**Files:**
- Modify: `admin/index.html`
- Modify: `admin/admin.js`
- Modify: `admin/admin.css`
- Modify: `tests/admin-homework-edit-metadata.test.mjs`
- Modify: `tests/admin-homework-list.test.mjs`

**Interfaces:**
- Consumes: list `description`／`editable`, shared `validateHomeworkMetadataInput()`, PATCH response.
- Produces: safe list action, single two-state edit dialog, automatic post-save list refresh.

- [x] **Step 1: Add failing semantic markup tests**

Assert a labelled `<dialog>`, readonly Homework ID, title input `maxlength="120"`, description textarea `maxlength="500"`, live character count, URL output, field errors, cancel/save/back/confirm controls and a live save announcement.

- [x] **Step 2: Add failing client behavior tests**

Using the existing fake DOM/fetch harness, cover:

```js
assert.equal(legacyRow.textContent.includes('此舊項目暫不支援網站編輯'), true);
assert.equal(editButton.disabled, false);
assert.equal(saveButton.disabled, true); // unchanged
titleInput.value = '<img src=x onerror=alert(1)>';
titleInput.dispatchEvent(new Event('input'));
assert.equal(dialog.querySelector('img'), null);
assert.equal(newHomeworkTitle.value, '上方表單原內容');
```

Also assert edit/save double actions create one PATCH, 422/409/general failures retain values, 401 invokes the existing expired-session UI, success closes and refreshes, and refresh failure does not replace the save-success announcement.

- [x] **Step 3: Add dialog markup and restrained styles**

Reuse current tokens, `.publish-dialog` proportions and mobile breakpoint. Add an action stack in the list row, overflow-safe fields, 44px controls, visible `:focus-visible`, and no new color/font/radius literals.

- [x] **Step 4: Implement safe list actions and isolated dialog state**

Maintain a `Map` of the latest list records, create all labels and messages using `textContent`, and never read from or write to `#homework-form`. On open, copy ID/title/description/url into dedicated dialog elements and retain the trigger for focus restoration.

- [x] **Step 5: Implement validation and confirmation transition**

On every input, update Unicode count and enable Save only when the normalized valid value differs from the originals. First submit populates a text-only confirmation view. “返回修改” restores the editor without losing input.

- [x] **Step 6: Implement guarded PATCH submission**

While saving, prevent cancel/Escape and disable all dialog controls. Send one JSON PATCH with CSRF. On error, restore editor state and focus the relevant error; on success, close, announce success, then call `loadPublishedHomeworkList({queueIfBusy:true})` without converting refresh failure into save failure.

- [x] **Step 7: Run frontend-focused tests and verify GREEN**

Run:

```text
node --test tests/admin-homework-edit-metadata.test.mjs
node --test tests/admin-homework-list.test.mjs
node --test tests/admin-publish.test.mjs
```

Expected: dialog tests pass and publish/list regressions stay green.

---

### Task 7: Documentation, full verification and manual acceptance

**Files:**
- Modify: `README.md`
- Verify: all files changed in Tasks 1–6

**Interfaces:**
- Consumes: completed API, transaction and dialog.
- Produces: documented operator behavior and evidence-backed completion report.

- [x] **Step 1: Document the feature and safety boundary**

Add a concise README section covering the PATCH route, title/description-only scope, strict renderer compatibility, the currently editable count of zero, transaction/rollback behavior and the “legacy item unsupported” UI.

- [x] **Step 2: Run focused and management regressions**

```text
node --test tests/admin-homework-edit-metadata.test.mjs
node --test tests/admin-auth.test.mjs
node --test tests/admin-preview.test.mjs
node --test tests/admin-publish.test.mjs
node --test tests/admin-homework-list.test.mjs
```

- [x] **Step 3: Run the complete automated verification**

```text
node --test tests/*.test.mjs
node scripts/validate-content.mjs
node scripts/build-content-indexes.mjs --check
git diff --check
git status --short
```

Record exact pass/fail totals. If global `git diff --check` still reports only the pre-existing whitespace in unrelated files, run a scoped check for every 10E-1 tracked file and report both results without modifying unrelated content.

- [x] **Step 4: Prove production content was not changed by tests**

Capture SHA-256 before and after verification for `content/homework.json`, `homework/index.html`, every manifest-referenced Homework image, `training/files.json`, and all existing result pages. Require exact equality because tests operate only on temporary fixtures.

- [x] **Step 5: Exercise real success and rollback transactions on temporary copies**

Run one editor update against a complete temporary project fixture and confirm manifest/page/index agree. Inject a validation failure on another fresh fixture and confirm all three SHA-256 values equal their pre-operation values.

- [x] **Step 6: Perform responsive and accessibility acceptance**

Start the local admin server with test-only local credentials, log in, and inspect 390, 768, 1024 and 1440px. Confirm no horizontal overflow, readable mobile cards/dialog, long text containment, 44px controls, keyboard edit-confirm-cancel flow, focus return, live status text and zero browser console errors. Do not submit a PATCH against production content because all current entries are intentionally unsupported.

- [x] **Step 7: Review changed code and produce the final report**

Report files, UI operation, API security, editable and excluded Homework counts, exact tests, responsive/keyboard/console results, proof of unchanged content/images, proof of commit-or-rollback transaction behavior, excluded features, inherited workspace warnings and confirmation that no Git commit was made.
