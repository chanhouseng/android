# WorldSkills Platform Search And Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付涵蓋知識點、程式碼、項目、PDF 的快速全站搜尋，以及不改動來源檔案的預覽式匯入與完整備份。

**Architecture:** 搜尋使用 PostgreSQL 查詢及應用層加權，不引入獨立搜尋服務。匯入器只讀配置好的 legacy root，將解析結果保存為 ImportCandidate；確認動作才透過 Content repositories 建立正式內容。

**Tech Stack:** Next.js、TypeScript、Prisma/PostgreSQL、Zod、Cheerio、PDF text extraction、Vitest、Playwright、ZIP streaming。

## Global Constraints

- 從通過 Gate 2 的 Content 基線建立 `codex/worldskills-search-import` 工作樹。
- 不修改共享 Prisma schema；使用 Content 基線已定義的 ImportJob 與 ImportCandidate。
- 搜尋現有內容不消耗 DeepSeek 額度；只有使用者點擊 AI 補充才進入 AI Training 提供的入口。
- 來源 HTML、資料夾、PDF、圖片及程式碼永遠只讀。
- 匯入預覽未確認前不能建立正式內容。
- 每項任務按 roadmap 執行兩階段審查。

---

### Task 1: Search Normalization, Ranking And Repository

**Files:**
- Create: `platform/src/features/search/contracts.ts`
- Create: `platform/src/features/search/normalize.ts`
- Create: `platform/src/features/search/normalize.test.ts`
- Create: `platform/src/features/search/search-repository.ts`
- Create: `platform/src/features/search/search-repository.test.ts`

**Interfaces:**
- Produces `SearchType = "knowledge" | "code" | "project" | "pdf"`.
- Produces `SearchResult { id, type, title, excerpt, href, tags, sourceLabel, score }`.
- Produces `normalizeSearchQuery(query): { raw, normalized, tokens }`.
- Produces `searchAll({ query, type?, limit }): Promise<SearchResult[]>`.

- [ ] **Step 1: Write failing normalization tests**

Cover trimmed repeated whitespace, case-insensitive English, preserved Kotlin punctuation, and mixed Chinese/English:

```ts
expect(normalizeSearchQuery("  ActivityResultContracts  ").normalized)
  .toBe("activityresultcontracts");
expect(normalizeSearchQuery("JSON 條件  顯示").tokens)
  .toEqual(["json", "條件", "顯示"]);
expect(normalizeSearchQuery("Intent.ACTION_VIEW").tokens)
  .toContain("intent.action_view");
```

- [ ] **Step 2: Implement normalization and excerpt highlighting**

Normalize Unicode to NFKC, lowercase Latin text, collapse whitespace and cap queries at 200 characters. Escape HTML before wrapping matched text in `<mark>`; never insert raw database text as HTML.

- [ ] **Step 3: Write failing ranking tests**

Seed/mimic one title match, alias match, code match, project-description match and PDF-page match. Assert score order is title, alias/API/tag, code, project, PDF. Assert drafts never appear.

- [ ] **Step 4: Implement repository queries and deterministic scores**

Use case-insensitive containment against title, aliases, tags and content fields. Assign base weights 500, 400, 300, 200 and 100 in the approved order, add 50 for exact normalized title, then sort score descending and title ascending. Return at most 50 unless a lower limit is requested.

- [ ] **Step 5: Verify search domain**

Run: `cd platform && pnpm test -- src/features/search && pnpm typecheck`

Expected: all tests pass and types are clean.

- [ ] **Step 6: Commit and run both review gates**

```bash
git add platform/src/features/search
git commit -m "feat: add weighted cross-content search"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 2: Search API And Mobile-First Results UI

**Files:**
- Create: `platform/src/app/api/search/route.ts`
- Create: `platform/src/features/search/search-form.tsx`
- Create: `platform/src/features/search/search-tabs.tsx`
- Create: `platform/src/features/search/search-result-card.tsx`
- Create: `platform/src/features/search/search-page.tsx`
- Create: `platform/src/features/search/search-page.test.tsx`
- Create: `platform/src/app/(protected)/search/page.tsx`
- Modify: `platform/src/app/(protected)/page.tsx`

**Interfaces:**
- `GET /api/search?q=<query>&type=<optional>` returns `{ results, query, counts }`.
- Empty query returns status 200 with empty results and never queries content tables.
- No-result AI link: `/training/ask?query=<encoded query>`.

- [ ] **Step 1: Write failing UI tests**

Verify the page shows tabs `全部｜知識點｜程式碼｜項目｜PDF`, result cards include type/source/excerpt/tags, empty query shows guidance, and no results show `詢問 DeepSeek` without calling an AI endpoint.

- [ ] **Step 2: Implement authenticated search API**

Require current user, validate q/type with Zod, cap query and return 400 for invalid type. Return per-type counts calculated before the optional tab filter.

- [ ] **Step 3: Implement URL-driven search UI**

Use `q` and `type` search parameters so results can be bookmarked and browser back works. Submit with GET semantics. Tabs preserve the query. Result cards link to canonical detail pages and expose copy only for code results.

- [ ] **Step 4: Connect both search entry points**

Homepage search and mobile fixed search link must reach the same `/search` page. Searching from the homepage navigates to `/search?q=...`.

- [ ] **Step 5: Verify search UI**

Run unit tests, lint, typecheck and build. Manually test Chinese, English, API name, code punctuation, empty query, no result and browser back.

- [ ] **Step 6: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/search
git commit -m "feat: add full-site search experience"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 3: Import Job State Machine And Preview UI

**Files:**
- Create: `platform/src/features/import/contracts.ts`
- Create: `platform/src/features/import/state-machine.ts`
- Create: `platform/src/features/import/state-machine.test.ts`
- Create: `platform/src/features/import/import-repository.ts`
- Create: `platform/src/features/import/import-actions.ts`
- Create: `platform/src/features/import/import-preview.tsx`
- Create: `platform/src/app/(protected)/admin/import/page.tsx`
- Create: `platform/src/app/(protected)/admin/import/[id]/page.tsx`

**Interfaces:**
- Import kinds: `HTML`, `PROJECT_DIRECTORY`, `PDF`.
- Import states: `PARSING`, `NEEDS_REVIEW`, `READY`, `CONFIRMED`, `FAILED`.
- Produces `createImportJob`, `saveCandidates`, `confirmCandidates`, `failImportJob`.

- [ ] **Step 1: Write failing transition tests**

Allow `PARSING → NEEDS_REVIEW|FAILED`, `NEEDS_REVIEW → READY|FAILED`, `READY → CONFIRMED|FAILED`. Reject every transition out of `CONFIRMED` and reject direct `PARSING → CONFIRMED`.

- [ ] **Step 2: Implement the state machine and repository**

Keep transition logic pure. Repository methods use conditional updates so two confirmation requests cannot publish the same candidate twice.

- [ ] **Step 3: Write failing confirmation tests**

Verify unselected candidates are ignored, selected candidates are validated through Content DTO schemas, one failed candidate rolls back all formal writes, source fields remain unchanged, and a repeated confirmation returns the existing result rather than duplicates.

- [ ] **Step 4: Implement preview and confirmation UI**

Display parsed title, type, extracted code/media counts, warnings and editable classification. Every candidate starts unselected when parsing confidence is low. Require explicit checkbox plus confirmation button before publishing.

- [ ] **Step 5: Verify job workflow**

Run: `cd platform && pnpm test -- src/features/import && pnpm typecheck`

Expected: all tests pass.

- [ ] **Step 6: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/import
git commit -m "feat: add safe import preview workflow"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 4: HTML, Project Directory And PDF Parsers

**Files:**
- Create: `platform/src/features/import/source-root.ts`
- Create: `platform/src/features/import/source-root.test.ts`
- Create: `platform/src/features/import/html-parser.ts`
- Create: `platform/src/features/import/html-parser.test.ts`
- Create: `platform/src/features/import/project-parser.ts`
- Create: `platform/src/features/import/project-parser.test.ts`
- Create: `platform/src/features/import/pdf-parser.ts`
- Create: `platform/src/features/import/pdf-parser.test.ts`
- Create: `platform/test/fixtures/import/knowledge.html`
- Create: `platform/test/fixtures/import/project/MainActivity.kt`
- Create: `platform/test/fixtures/import/project/activity_main.xml`
- Create: `platform/test/fixtures/import/sample.pdf`
- Modify: `platform/src/features/import/import-actions.ts`

**Interfaces:**
- `resolveLegacySource(relativePath): string` only resolves within `LEGACY_CONTENT_ROOT`.
- Parsers return `ParsedCandidate[]` and warnings; they never write formal records.

- [ ] **Step 1: Install parser dependencies and write source-root tests**

```bash
cd platform
pnpm add cheerio pdf-parse
```

Accept a normal relative path. Reject absolute paths, drive-letter paths, UNC paths, `..`, symlink escapes and paths outside configured root.

- [ ] **Step 2: Implement safe source resolution**

Resolve and realpath both root and candidate. Require candidate to equal root or begin with root plus separator. Open files read-only.

- [ ] **Step 3: Write and implement HTML parser tests**

Fixture contains headings, anchors, image, accordion button/panel and `<pre>` code. Extract title, summary, image reference and code blocks; preserve unknown text as notes and emit warnings instead of dropping it.

- [ ] **Step 4: Write and implement project directory parser tests**

Recursively include `.kt`, `.kts`, `.xml`, `.json`, `.csv`, `.md`; ignore build output, `.git`, binaries and files over 5 MB. Preserve relative paths and derive language from extension.

- [ ] **Step 5: Write and implement PDF parser tests**

Extract one-based pages, preserve empty pages, mark page failures, and return document status `INDEXED`, `PARTIAL` or `FAILED`. Never replace the original PDF object with extracted text.

- [ ] **Step 6: Connect parsers to import jobs**

Server action creates PARSING job, runs one parser, saves candidates/warnings and transitions to NEEDS_REVIEW. Catch parser exceptions, store a sanitized failure message and transition to FAILED.

- [ ] **Step 7: Verify import parsers**

Run tests, lint, typecheck and build. Manually preview one existing `knowledge/index.html`, one `homework` project and one Module A PDF without confirming them; verify source file hashes are unchanged.

- [ ] **Step 8: Commit and run both review gates**

```bash
git add platform/package.json platform/pnpm-lock.yaml platform/src/features/import platform/test/fixtures/import
git commit -m "feat: parse legacy learning sources"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 5: Structured Backup And Search/Import Gate

**Files:**
- Create: `platform/src/features/backup/export.ts`
- Create: `platform/src/features/backup/export.test.ts`
- Create: `platform/src/features/backup/restore.ts`
- Create: `platform/src/features/backup/restore.test.ts`
- Create: `platform/src/app/api/backup/export/route.ts`
- Create: `platform/src/app/(protected)/admin/backup/page.tsx`
- Create: `platform/e2e/search-import.spec.ts`

**Interfaces:**
- Backup archive contains `manifest.json`, `content/*.json` and `assets/<storage-key>`.
- Manifest includes schema version `1`, creation timestamp, record counts and SHA-256 for each asset.
- Restore is dry-run by default and requires an explicit confirmation token for writes.

- [ ] **Step 1: Write failing export tests**

Verify deterministic entity ordering, manifest version/counts, asset hash, omission of sessions/passwords/API keys, and authenticated-only route access.

- [ ] **Step 2: Implement streaming export**

Stream a ZIP response; do not buffer large videos. Export content DTOs rather than raw database rows. Include relation IDs/slugs required for restoration.

- [ ] **Step 3: Write failing restore dry-run tests**

Reject unknown schema versions, duplicate slugs, missing referenced assets and hash mismatches. Dry-run returns creates/updates/conflicts without writing. Confirmed restore performs one database transaction after asset verification.

- [ ] **Step 4: Implement backup admin page**

Provide export download, restore archive selection, dry-run report and a separate typed confirmation step. Never overwrite conflicting formal content silently.

- [ ] **Step 5: Add E2E and run Gate 3A**

Test five search tabs, score order, no-result AI link, HTML preview, PDF partial warning, confirmation idempotence, export and dry-run restore.

```bash
cd platform
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e -- e2e/search-import.spec.ts
pnpm build
```

- [ ] **Step 6: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/backup platform/e2e/search-import.spec.ts
git commit -m "feat: complete search import and backup flow"
```

After both approvals, merge this branch into `codex/worldskills-platform` without changing AI Training files.
