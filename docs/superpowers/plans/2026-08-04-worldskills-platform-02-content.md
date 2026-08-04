# WorldSkills Platform Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付可從首頁瀏覽全部知識點、查看完整項目、管理程式碼與 PDF／媒體的內容系統。

**Architecture:** 內容由 Prisma 模型保存，feature repository 隔離資料庫查詢，Server Actions 負責驗證與寫入，App Router 頁面只組合 DTO。正式內容與草稿分離；媒體先以抽象 storage 介面保存，雲端實作延後到部署計畫。

**Tech Stack:** Next.js、TypeScript、Prisma、PostgreSQL、Zod、React Server Components、Testing Library。

## Global Constraints

- 從已通過 Gate 1 的整合提交建立 `codex/worldskills-content` 工作樹。
- 知識點只包含標題、作用、程式碼、程式碼解釋、搜尋標籤／別名及內容關聯。
- 項目詳情順序必須符合設計規格；沒有影片時不渲染影片區塊。
- 練習程式碼只建立暫存副本，不更新正式 CodeFile。
- Content 完成後 `schema.prisma`、DTO 及 repository 介面成為 Search/Import 與 AI Training 的共同基線。
- 每項任務按 roadmap 執行規格審查及品質審查。

---

### Task 1: Content Schema And Shared DTO Contracts

**Files:**
- Modify: `platform/prisma/schema.prisma`
- Create: `platform/src/features/content/contracts.ts`
- Create: `platform/src/features/content/contracts.test.ts`
- Create: `platform/src/features/content/slug.ts`
- Create: `platform/src/features/content/slug.test.ts`

**Interfaces:**
- Produces content models: `Tag`, `KnowledgePoint`, `Project`, `ProjectStep`, `CodeFile`, `MediaAsset`, `Document`, `DocumentPage`.
- Produces workflow models needed by later parallel branches: `ImportJob`, `ImportCandidate`, `Question`, `Submission`, `LearningItem`, `AiUsageEvent`.
- Produces enums: `ContentStatus`, `DeviceType`, `MediaKind`, `DocumentIndexStatus`, `ImportKind`, `ImportStatus`, `QuestionType`, `SubmissionStatus`, `LearningReason`, `LearningStatus`.
- Produces DTOs: `KnowledgeSummary`, `KnowledgeDetail`, `ProjectSummary`, `ProjectDetail`, `DocumentSummary`.
- Produces `createUniqueSlug(title, existingSlugs): string`.

- [ ] **Step 1: Write failing slug and DTO validation tests**

Test these exact cases:

```ts
expect(createUniqueSlug("Activity Result API", [])).toBe("activity-result-api");
expect(createUniqueSlug("相機拍照", [])).toMatch(/^knowledge-/);
expect(createUniqueSlug("Activity Result API", ["activity-result-api"]))
  .toBe("activity-result-api-2");
```

Parse a complete `KnowledgeDetail` fixture and reject one missing `purpose`.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `cd platform && pnpm test -- src/features/content`

Expected: FAIL because contracts and slug helpers are absent.

- [ ] **Step 3: Define content models**

Add exact enum values:

```prisma
enum ContentStatus { DRAFT PUBLISHED }
enum DeviceType { PHONE TABLET BOTH }
enum MediaKind { IMAGE VIDEO VIDEO_LINK }
enum DocumentIndexStatus { PENDING INDEXED PARTIAL FAILED }
enum ImportKind { HTML PROJECT_DIRECTORY PDF }
enum ImportStatus { PARSING NEEDS_REVIEW READY CONFIRMED FAILED }
enum QuestionType { LOGIC KEYWORD }
enum SubmissionStatus { PENDING EVALUATED FAILED DONT_KNOW }
enum LearningReason { DONT_KNOW IMPORTANT_ERROR NEW_KNOWLEDGE AI_SEARCH }
enum LearningStatus { OPEN CONVERTED }
```

Define models with cuid IDs and timestamps. Required fields:

- `Tag`: unique `slug`, unique `name`, `aliases String[]`.
- `KnowledgePoint`: unique `slug`, `title`, `purpose`, `code`, `codeExplanation`, `aliases String[]`, status, tags, projects, documents.
- `Project`: unique `slug`, `title`, `summary`, `description`, optional year/module/device, status, steps, codeFiles, media, knowledge, documents, optional `fastSnippet`.
- `ProjectStep`: `projectId`, `position`, `title`, `description`, optional `imageAssetId`; unique project/position.
- `CodeFile`: `projectId`, `path`, `language`, `content`, `position`; unique project/path.
- `MediaAsset`: `kind`, optional `storageKey`, `mimeType`, `sizeBytes`, optional title/altText/posterStorageKey/externalUrl/projectId. IMAGE/VIDEO requires `storageKey`; VIDEO_LINK requires an HTTPS `externalUrl` and no storage key.
- `Document`: unique `slug`, `title`, `fileName`, `storageKey`, optional year/module/language/device, `indexStatus`, pages, projects, knowledge.
- `DocumentPage`: document ID, one-based `pageNumber`, extracted `text`, index status; unique document/page.
- `ImportJob`: kind, status, source reference, original name, warnings JSON, optional failure message, timestamps and candidates.
- `ImportCandidate`: job ID, entity type, payload JSON, confidence, selected flag, optional published entity reference; unique job/candidate key.
- `Question`: type, title, prompt, starter code, input data, requirements JSON, reference answer, fastest method, tags, new-knowledge flag, source metadata, prompt version, model ID and submissions.
- `Submission`: question ID, answer, status, evaluation JSON, optional raw AI response, prompt version, model ID, retry count and timestamps.
- `LearningItem`: reason, status, title, question text, optional user answer/evaluation/fastest method/reference answer/notes, optional question/submission/knowledge references and duplicate reference.
- `AiUsageEvent`: request key, category, model ID, reserved input/output tokens, actual input/output tokens, status and timestamps; unique request key.

Use these exact workflow fields so the later worktrees do not alter the schema:

```prisma
model ImportJob {
  id             String            @id @default(cuid())
  kind           ImportKind
  status         ImportStatus
  sourceRef      String
  originalName   String
  warnings       Json?
  failureMessage String?
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  candidates     ImportCandidate[]
}

model ImportCandidate {
  id              String    @id @default(cuid())
  jobId           String
  candidateKey    String
  entityType      String
  payload         Json
  confidence      Float
  selected        Boolean   @default(false)
  publishedType   String?
  publishedId     String?
  createdAt       DateTime  @default(now())
  job             ImportJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  @@unique([jobId, candidateKey])
}

model Question {
  id                    String       @id @default(cuid())
  type                  QuestionType
  title                 String
  prompt                String
  starterCode           String       @default("")
  inputData             String?
  requirements          Json
  referenceAnswer       String
  fastestMethod         String
  tags                  String[]
  introducesNewKnowledge Boolean      @default(false)
  sourceMetadata        Json?
  promptVersion         String
  modelId               String
  createdAt             DateTime     @default(now())
  submissions           Submission[]
  learningItems         LearningItem[]
}

model Submission {
  id             String           @id @default(cuid())
  questionId     String
  answer         String
  status         SubmissionStatus
  evaluation     Json?
  rawAiResponse  Json?
  promptVersion  String
  modelId        String?
  idempotencyKey String           @unique
  retryCount     Int              @default(0)
  createdAt      DateTime         @default(now())
  evaluatedAt    DateTime?
  question       Question         @relation(fields: [questionId], references: [id], onDelete: Cascade)
  learningItems  LearningItem[]
}

model LearningItem {
  id                   String         @id @default(cuid())
  reason               LearningReason
  status               LearningStatus @default(OPEN)
  title                String
  questionText         String
  userAnswer           String?
  evaluation           Json?
  fastestMethod        String?
  referenceAnswer      String?
  notes                String?
  questionId           String?
  submissionId         String?
  convertedKnowledgeId String?
  duplicateOfId        String?
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt
  question             Question?      @relation(fields: [questionId], references: [id], onDelete: SetNull)
  submission           Submission?    @relation(fields: [submissionId], references: [id], onDelete: SetNull)
  duplicateOf          LearningItem?  @relation("LearningDuplicates", fields: [duplicateOfId], references: [id], onDelete: SetNull)
  duplicates           LearningItem[] @relation("LearningDuplicates")
}

model AiUsageEvent {
  id                   String   @id @default(cuid())
  requestKey           String   @unique
  category             String
  modelId              String
  reservedInputTokens  Int
  reservedOutputTokens Int
  actualInputTokens    Int?
  actualOutputTokens   Int?
  status               String
  createdAt            DateTime @default(now())
  completedAt          DateTime?
}
```

- [ ] **Step 4: Implement Zod DTO schemas and slug helper**

DTOs must expose strings and arrays required by pages without leaking Prisma records. `KnowledgeDetail` includes `tags`, related project summaries and related document summaries. `ProjectDetail` includes ordered steps, ordered code files, media and related content.

- [ ] **Step 5: Generate and validate the migration**

```bash
cd platform
pnpm exec prisma migrate dev --name add_content_models
pnpm db:generate
pnpm exec prisma validate
pnpm test -- src/features/content
pnpm typecheck
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit and run both review gates**

```bash
git add platform/prisma platform/src/features/content
git commit -m "feat: define learning content model"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 2: Knowledge Repository, Admin Forms And Browse Page

**Files:**
- Create: `platform/src/features/content/knowledge-repository.ts`
- Create: `platform/src/features/content/knowledge-repository.test.ts`
- Create: `platform/src/features/content/knowledge-actions.ts`
- Create: `platform/src/features/content/knowledge-form.tsx`
- Create: `platform/src/features/content/knowledge-card.tsx`
- Create: `platform/src/app/(protected)/knowledge/page.tsx`
- Create: `platform/src/app/(protected)/knowledge/[slug]/page.tsx`
- Create: `platform/src/app/(protected)/admin/knowledge/new/page.tsx`
- Create: `platform/src/app/(protected)/admin/knowledge/[id]/edit/page.tsx`

**Interfaces:**
- Produces: `listKnowledge(filters): Promise<KnowledgeSummary[]>`.
- Produces: `getKnowledgeBySlug(slug): Promise<KnowledgeDetail | null>`.
- Produces: `saveKnowledge(input): Promise<{ id: string; slug: string }>`.
- Input fields: `id?`, `title`, `purpose`, `code`, `codeExplanation`, `aliases`, `tagNames`, `status`.

- [ ] **Step 1: Write failing repository tests**

Use a mocked Prisma boundary to verify published knowledge is ordered by title, a tag filter narrows results, details include related projects/documents, and drafts appear only when `includeDrafts` is true.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd platform && pnpm test -- knowledge-repository.test.ts`

Expected: FAIL because repository exports are missing.

- [ ] **Step 3: Implement repository queries**

Map Prisma results to DTOs inside the repository. Do not return Prisma objects from page loaders. Use one transaction in `saveKnowledge` to upsert normalized tags and connect relations.

- [ ] **Step 4: Write failing action validation tests**

Reject blank title, blank purpose, blank code explanation and an invalid status. Accept multiline Kotlin/XML code and comma-separated aliases; normalize aliases by trimming, lowercasing for comparison and preserving display text.

- [ ] **Step 5: Implement server actions and forms**

All actions begin with `await requireCurrentUser()`. Return field errors without throwing for expected validation failures. On success revalidate `/`, `/knowledge`, the detail route, and redirect to the saved detail page.

- [ ] **Step 6: Build browse and detail pages**

`/knowledge` displays every published knowledge point without requiring a search term and offers tag/API filters. `/knowledge/[slug]` renders title, purpose, highlighted code, code explanation, tags, related projects and related PDFs in that order.

- [ ] **Step 7: Verify knowledge flow**

```bash
cd platform
pnpm test -- src/features/content
pnpm lint
pnpm typecheck
pnpm build
```

Manually create a draft, preview it from admin, publish it, open it from the homepage `查看所有知識點`, and filter it by tag.

- [ ] **Step 8: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/content
git commit -m "feat: add knowledge library management"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 3: Project, Workflow And Complete Code Experience

**Files:**
- Create: `platform/src/features/content/project-repository.ts`
- Create: `platform/src/features/content/project-repository.test.ts`
- Create: `platform/src/features/content/project-actions.ts`
- Create: `platform/src/features/content/project-form.tsx`
- Create: `platform/src/features/content/project-card.tsx`
- Create: `platform/src/features/content/code-file-tree.tsx`
- Create: `platform/src/features/content/code-viewer.tsx`
- Create: `platform/src/features/content/practice-editor.tsx`
- Create: `platform/src/features/content/practice-draft.ts`
- Create: `platform/src/features/content/practice-draft.test.ts`
- Create: `platform/src/app/(protected)/projects/page.tsx`
- Create: `platform/src/app/(protected)/projects/[slug]/page.tsx`
- Create: `platform/src/app/(protected)/admin/projects/new/page.tsx`
- Create: `platform/src/app/(protected)/admin/projects/[id]/edit/page.tsx`

**Interfaces:**
- Produces: `listProjects(filters): Promise<ProjectSummary[]>`.
- Produces: `getProjectBySlug(slug): Promise<ProjectDetail | null>`.
- Produces: `saveProject(input): Promise<{ id: string; slug: string }>`.
- Produces browser-only `loadPracticeDraft(projectId, path)` and `savePracticeDraft(projectId, path, content)`; neither calls project update APIs.

- [ ] **Step 1: Write failing project ordering tests**

Verify steps and files are sorted by `position`, list filters accept year/module/device/tag, unpublished projects remain hidden outside admin, and a project with no video returns an empty media-video list.

- [ ] **Step 2: Implement project repository and transactional save**

Replace steps and code files inside one transaction only after validating duplicate positions and paths. Preserve unrelated media and links unless explicitly changed by the form.

- [ ] **Step 3: Write failing practice-draft tests**

Use a mocked `Storage` to verify draft keys include both project ID and file path, saving a draft leaves the repository untouched, and reset removes only the selected draft.

- [ ] **Step 4: Implement file tree, read-only viewer and practice editor**

Install CodeMirror packages for Kotlin/XML/JSON highlighting. The default viewer is read-only with line numbers, copy, file search and full-screen controls. `練習此檔案` opens an editable copy backed by browser storage and shows `原始檔案不會被修改`.

- [ ] **Step 5: Build the approved project pages**

List cards show title, summary, primary screenshot and tags. Detail order is exactly: introduction, optional demo video, illustrated workflow, feature breakdown, knowledge, complete file tree/viewer, fast snippets, related content. Omit the video section when no video exists.

- [ ] **Step 6: Build admin project form**

Support metadata, ordered workflow steps, feature breakdown, multiple code files, related knowledge/documents and fast snippet. Attachment upload controls call the Media API created in Task 4; until then render them disabled with the explicit text `完成媒體儲存設定後可上傳` so the current phase state is unambiguous.

- [ ] **Step 7: Verify project behavior**

Run unit tests, lint, typecheck and build. Manually open a project on mobile, switch files, search within code, create a practice draft, reload, and confirm formal code remains unchanged.

- [ ] **Step 8: Commit and run both review gates**

```bash
git add platform/package.json platform/pnpm-lock.yaml platform/src/app platform/src/features/content
git commit -m "feat: add project and code learning experience"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 4: Media And PDF Content

**Files:**
- Create: `platform/src/lib/storage/storage.ts`
- Create: `platform/src/lib/storage/local-storage.ts`
- Create: `platform/src/lib/storage/local-storage.test.ts`
- Create: `platform/src/features/content/media-actions.ts`
- Create: `platform/src/features/content/document-repository.ts`
- Create: `platform/src/features/content/document-repository.test.ts`
- Create: `platform/src/features/content/document-form.tsx`
- Create: `platform/src/app/api/media/[id]/route.ts`
- Create: `platform/src/app/(protected)/documents/page.tsx`
- Create: `platform/src/app/(protected)/documents/[slug]/page.tsx`
- Create: `platform/src/app/(protected)/admin/documents/new/page.tsx`

**Interfaces:**
- Produces: `Storage` with `put(key, bytes, contentType)`, `get(key)`, `delete(key)`, `exists(key)`.
- Produces: `LocalStorage` restricted to configured storage root.
- Produces: `listDocuments(filters)` and `getDocumentBySlug(slug)`.
- Upload allowlist: PDF, PNG, JPEG, WebP, MP4, WebM; reject all other MIME types.

- [ ] **Step 1: Write failing storage boundary tests**

Verify normal put/get round trip, duplicate key replacement is explicit, `../` traversal is rejected, and delete cannot escape the configured root.

- [ ] **Step 2: Implement local storage**

Resolve every key against the configured root and reject it unless the resolved path begins with the resolved root plus path separator. Create parent directories only after validation. Return streams rather than loading large videos fully into memory.

- [ ] **Step 3: Write and implement upload validation tests**

Reject executable MIME types, zero-byte files and files over configured limits. Use separate limits: 20 MB PDF/image, 500 MB video. Store sanitized generated keys, never user filenames as paths.

- [ ] **Step 4: Implement authenticated media delivery**

`/api/media/[id]` requires the current user, looks up `MediaAsset`, streams bytes with stored MIME type, supports range requests for video, and returns 404 for missing database record or object.

- [ ] **Step 5: Build PDF repository and pages**

Document list filters by year/module/language/device/index status. Detail displays metadata, original PDF viewer/download and ordered extracted pages. Show an explicit badge for pending, partial or failed index status.

- [ ] **Step 6: Connect project media controls**

Enable project screenshot/video upload and external video URL. Validate that `VIDEO_LINK` requires HTTPS, uploaded video requires MP4/WebM, and a project may have zero or one primary demo video.

- [ ] **Step 7: Verify media and PDF behavior**

Run tests, lint, typecheck and build. Manually test authenticated PDF display, mobile video playback, a range request, invalid upload rejection and a project with no video.

- [ ] **Step 8: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/content platform/src/lib/storage
git commit -m "feat: add protected media and PDF content"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 5: Content Dashboard And Gate 2 Acceptance

**Files:**
- Create: `platform/src/features/content/dashboard-repository.ts`
- Create: `platform/src/features/content/dashboard-repository.test.ts`
- Create: `platform/src/features/content/recent-content.ts`
- Modify: `platform/src/app/(protected)/page.tsx`
- Create: `platform/e2e/content.spec.ts`

**Interfaces:**
- Produces: `getDashboardContent(): Promise<{ recent: ContentReference[]; counts: ContentCounts }>`.
- Browser recent-content key: `worldskills_recent_content_v1`, maximum 10 entries.

- [ ] **Step 1: Write failing dashboard tests**

Verify all-knowledge link is always present, recent items are unique and limited to 10, unpublished content is excluded, and counts include knowledge/projects/documents.

- [ ] **Step 2: Implement dashboard repository and recent-content helper**

Recent browsing is device-local in this phase. Store only content type, ID, slug, title and viewed timestamp; never store code or protected attachment URLs in local storage.

- [ ] **Step 3: Complete dashboard cards**

Render search, AI training, projects, all knowledge, learning and recent content. Search and AI cards may link to their approved routes before those plans are implemented, but must not fake results.

- [ ] **Step 4: Add Content E2E coverage**

Seed one published knowledge point, one project with two files and no video, one project with a video link, and one PDF. Test homepage knowledge entry, knowledge browsing, project detail order, code practice isolation and authenticated PDF access.

- [ ] **Step 5: Run Gate 2**

```bash
cd platform
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e -- e2e/content.spec.ts
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/content platform/e2e/content.spec.ts
git commit -m "feat: complete content dashboard"
```

Run both reviews. Merge Content into `codex/worldskills-platform`, then create Search/Import and AI Training worktrees from the same resulting commit.
