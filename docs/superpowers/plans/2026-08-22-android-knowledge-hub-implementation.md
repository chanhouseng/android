# Android Notebook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current root index with a responsive React knowledge hub that merges the two knowledge sources, searches by Android component or function, and separates/filter projects without deleting legacy content.

**Architecture:** A Vite-built React SPA uses hash routes and imports generated JSON content. Pure migration and search modules stay independent of React; feature folders own the home, knowledge, and project experiences; existing project detail HTML and assets remain in place and are linked from the new index.

**Tech Stack:** React, TypeScript, Vite, React Router, Vitest, Testing Library, Cheerio, Playwright, CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-08-22-android-knowledge-hub-design.md`

## Global Constraints

- Reading requires no login; authentication, backend storage, and cross-device editing are outside this phase.
- Use hash-based routes so static hosting does not require rewrite rules.
- Preserve original Cantonese notes, explanations, code, images, legacy detail pages, and training assets.
- Do not show `page1.html`, `page2.html`, or other root legacy pages in the new navigation.
- Merge `knowledge/index.html` and `forgot.html` without a source or “easy to forget” marker.
- Group knowledge primarily by Android component; unresolved classifications must display as `待分類` and must not be guessed.
- Project types are `knowledge-project` for `world skill` and `assignment-project` for `homework`.
- Project status may be inferred only from explicit wording; otherwise use `unmarked`.
- Search must match component, function title, aliases, categories, keywords, descriptions, and code, case-insensitively for English and by substring for Chinese.
- The exact searches `progress`, `TabLayout`, and `AlertDialog 背景透明` must return relevant knowledge or project content.
- Support keyboard use, visible focus, reduced motion, readable code overflow, and a 320px minimum viewport.
- Do not stage or commit unrelated existing user changes; every commit command must list exact task files.

## File Structure

```text
index.html                              Vite document entry; replaces the old root menu
.gitignore                              excludes dependencies, build/test output, and design scratch files
package.json                            scripts and dependencies
pnpm-lock.yaml                          locked dependency graph
tsconfig.json                           shared TypeScript configuration
vite.config.ts                          React/Vitest configuration and relative build base
vitest.setup.ts                         Testing Library cleanup and DOM matchers
playwright.config.ts                    desktop/mobile end-to-end configuration
scripts/
  content-migration.mjs                 pure HTML extraction functions
  migrate-content.mjs                   migration CLI and JSON/report writer
  check-content-links.mjs               local detail/image/source link validation
src/
  main.tsx                              React mount point
  app/
    App.tsx                             HashRouter and routes
    AppShell.tsx                        desktop/mobile global navigation
  content/
    content.types.ts                    KnowledgeItem and ProjectItem contracts
    knowledge-classification.ts         explicit component mapping only
    generated/
      knowledge.json                    generated merged knowledge
      projects.json                     generated project metadata
      migration-report.json             counts, skipped blanks, ambiguous classifications
  features/
    home/
      HomePage.tsx                      search-first home and grouped results
    knowledge/
      KnowledgePage.tsx                 component/category filters and results
      KnowledgeItemCard.tsx             expandable note, code, media, and links
    projects/
      ProjectsPage.tsx                  project filters and search
      ProjectCard.tsx                   status, tags, image, detail/source actions
  search/
    search.ts                           normalization, scoring, grouped search
  shared/
    EmptyState.tsx                      actionable no-results and missing-link states
    SearchField.tsx                     labeled search input
    status.ts                           explicit project status detection and labels
  styles/
    tokens.css                          Android Notebook design tokens
    app.css                             responsive shell and shared layout
tests/
  fixtures/
    knowledge-source.html               deterministic accordion migration fixture
    projects-source.html                deterministic project-card fixture
  AppShell.test.tsx
  content-migration.test.ts
  search.test.ts
  KnowledgePage.test.tsx
  ProjectsPage.test.tsx
  HomePage.test.tsx
  check-content-links.test.ts
e2e/
  android-notebook.spec.ts              desktop/mobile critical flows
README.md                               local development, migration, build, and content rules
```

---

### Task 1: React Foundation and Application Shell

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/app.css`
- Create: `tests/AppShell.test.tsx`
- Modify: `index.html`
- Generate: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `App(): JSX.Element` with routes `/`, `/knowledge`, and `/projects` inside `HashRouter`.
- Produces: `AppShell(): JSX.Element` with accessible links named `首頁`, `知識庫`, and `專案`, and an `<Outlet />` for feature pages.
- Consumes: no earlier task output.

- [ ] **Step 1: Create package and tool configuration**

Create `package.json` with these scripts and dependencies:

```json
{
  "name": "android-notebook",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "migrate": "node scripts/migrate-content.mjs",
    "check:links": "node scripts/check-content-links.mjs",
    "e2e": "playwright test"
  },
  "dependencies": {
    "react": "latest",
    "react-dom": "latest",
    "react-router-dom": "latest"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "@vitejs/plugin-react": "latest",
    "cheerio": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
```

Create `.gitignore` with:

```gitignore
node_modules/
dist/
playwright-report/
test-results/
.superpowers/
```

Configure `vite.config.ts` with `base: "./"`, the React plugin, `test.environment: "jsdom"`, and `setupFiles: ["./vitest.setup.ts"]`. Configure `tsconfig.json` with `strict: true`, `jsx: "react-jsx"`, `moduleResolution: "Bundler"`, `resolveJsonModule: true`, and includes for `src`, `tests`, `e2e`, and the two config files.

- [ ] **Step 2: Install the dependency graph**

Run: `pnpm install`

Expected: exit 0 and a new `pnpm-lock.yaml`.

- [ ] **Step 3: Write the failing shell test**

Create `tests/AppShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { AppShell } from "../src/app/AppShell"

it("exposes only the three new primary destinations", () => {
  render(
    <MemoryRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<p>首頁內容</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

  expect(screen.getByRole("link", { name: "首頁" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "知識庫" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "專案" })).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "堂上練習" })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "自己練習" })).not.toBeInTheDocument()
})
```

- [ ] **Step 4: Run the shell test to verify it fails**

Run: `pnpm exec vitest run tests/AppShell.test.tsx`

Expected: FAIL because `src/app/AppShell.tsx` does not exist.

- [ ] **Step 5: Implement the minimal shell and routes**

Create `AppShell.tsx` with a semantic header/nav, `NavLink`s for the three destinations, an Android Notebook brand, and an `<Outlet />`. Create `App.tsx` as:

```tsx
import { HashRouter, Route, Routes } from "react-router-dom"
import { AppShell } from "./AppShell"

const Placeholder = ({ title }: { title: string }) => <h1>{title}</h1>

export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Placeholder title="首頁" />} />
          <Route path="knowledge" element={<Placeholder title="知識庫" />} />
          <Route path="projects" element={<Placeholder title="專案" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
```

Create `main.tsx` to mount `<App />`. Replace root `index.html` with a Traditional Chinese Vite entry that contains only `<div id="root"></div>` and `<script type="module" src="/src/main.tsx"></script>`.

Create `tokens.css` with the approved ink, Android green, Kotlin purple, gray-blue, amber, and red custom properties for light/dark appearance. Create `app.css` with only the responsive shell, visible `:focus-visible`, and reduced-motion baseline; feature layout arrives in later tasks.

- [ ] **Step 6: Run the shell test and build**

Run: `pnpm exec vitest run tests/AppShell.test.tsx && pnpm build`

Expected: 1 test PASS and the Vite build exits 0.

- [ ] **Step 7: Commit the foundation only**

```bash
git add .gitignore package.json pnpm-lock.yaml tsconfig.json vite.config.ts vitest.setup.ts index.html src/main.tsx src/app/App.tsx src/app/AppShell.tsx src/styles/tokens.css src/styles/app.css tests/AppShell.test.tsx
git commit -m "feat: scaffold Android Notebook application shell"
```

---

### Task 2: Structured Content Contracts and Legacy Migration

**Files:**
- Create: `src/content/content.types.ts`
- Create: `src/content/knowledge-classification.ts`
- Create: `src/shared/status.ts`
- Create: `scripts/content-migration.mjs`
- Create: `scripts/migrate-content.mjs`
- Create: `tests/fixtures/knowledge-source.html`
- Create: `tests/fixtures/projects-source.html`
- Create: `tests/content-migration.test.ts`
- Generate: `src/content/generated/knowledge.json`
- Generate: `src/content/generated/projects.json`
- Generate: `src/content/generated/migration-report.json`
- Read only: `knowledge/index.html`
- Read only: `forgot.html`
- Read only: `world skill/index.html`
- Read only: `homework/index.html`

**Interfaces:**
- Produces: `KnowledgeItem`, `KnowledgeMedia`, `ProjectItem`, `ProjectStatus`, and `ProjectType` types.
- Produces: `detectExplicitStatus(text: string): ProjectStatus`.
- Produces: `deriveProjectTags(text: string): string[]` from explicit technology words only.
- Produces: `extractKnowledgeDocument(html, sourcePath, classifications)` and `extractProjectDocument(html, sourcePath, type)` pure migration functions.
- Produces: generated JSON arrays imported by Tasks 3–6.
- Consumes: the existing four legacy source pages without modifying them.

- [ ] **Step 1: Define the failing migration fixtures and tests**

The knowledge fixture must include one real image, one paragraph, one `<pre>` block, one link, and one blank `code` accordion. The project fixture must include one complete card, one `未做晒` card, one `壞咗` card, and one blank card.

Create `tests/content-migration.test.ts` with these assertions:

```ts
import { readFileSync } from "node:fs"
import { extractKnowledgeDocument, extractProjectDocument } from "../scripts/content-migration.mjs"

it("merges useful accordion content without source labels or blank templates", () => {
  const html = readFileSync("tests/fixtures/knowledge-source.html", "utf8")
  const result = extractKnowledgeDocument(html, "knowledge/index.html", {
    "AlertDialog 背景透明": "AlertDialog",
  })

  expect(result.items).toHaveLength(1)
  expect(result.items[0]).toMatchObject({
    component: "AlertDialog",
    title: "AlertDialog 背景透明",
    media: [{ type: "image", src: "knowledge/img/dialog.png", alt: "AlertDialog 背景透明" }],
  })
  expect(result.items[0].codeBlocks[0].code).toContain("setBackgroundDrawable")
  expect(result.skipped).toEqual([expect.objectContaining({ reason: "blank-template" })])
})

it("maps only explicit project status language", () => {
  const html = readFileSync("tests/fixtures/projects-source.html", "utf8")
  const result = extractProjectDocument(html, "homework/index.html", "assignment-project")
  expect(result.items.map((item) => item.status)).toEqual([
    "complete",
    "in-progress",
    "broken",
  ])
  expect(result.skipped).toEqual([expect.objectContaining({ reason: "blank-card" })])
})
```

- [ ] **Step 2: Run migration tests to verify they fail**

Run: `pnpm exec vitest run tests/content-migration.test.ts`

Expected: FAIL because the migration module does not exist.

- [ ] **Step 3: Add the content types and explicit status mapping**

Create `content.types.ts` with the exact spec contracts, including:

```ts
export type ProjectStatus = "complete" | "in-progress" | "rebuild" | "broken" | "unmarked"
export type ProjectType = "knowledge-project" | "assignment-project"
export type KnowledgeMedia = { type: "image"; src: string; alt: string }

export type KnowledgeItem = {
  id: string
  component: string
  title: string
  category: string
  aliases: string[]
  keywords: string[]
  description?: string
  codeBlocks: Array<{ language: "kotlin" | "xml" | "text"; code: string; note?: string }>
  media: KnowledgeMedia[]
  relatedLinks: Array<{ label: string; href: string }>
}

export type ProjectItem = {
  id: string
  title: string
  type: ProjectType
  status: ProjectStatus
  summary: string
  tags: string[]
  image?: string
  detailHref?: string
  sourceHref?: string
}
```

Create `status.ts` so the matching order is `壞咗|壞左` → `broken`, `爛尾|要重新做|重新做過` → `rebuild`, `未做晒|未做完` → `in-progress`, explicit `完成|已完成` → `complete`, otherwise `unmarked`. Do not treat the absence of negative wording as completion.

- [ ] **Step 4: Add only explicit knowledge classifications**

Create `knowledge-classification.ts` as a title-to-component map. Use the following confirmed text/component pairs; all omitted titles fall back to `待分類`:

```ts
export const knowledgeClassification: Record<string, string> = {
  "獲得他的第幾個元素(0,1,...R)": "LinearLayout",
  "設定ScollView滑到那裏": "ScrollView",
  "打開google map": "Intent",
  "打開apps": "Intent",
  "動態加入多行layout": "LinearLayout",
  "日期選擇器最小可選日期設為「今天」": "DatePickerDialog",
  "Double": "Kotlin",
  "轉換日夜間模式": "AppCompatDelegate",
  "viewPager2因應內容大小而改變大小": "ViewPager2",
  "try catch 多用在日期不是這個格式就去轉試另一個格式": "LocalDate",
  "Bottom sheet Dialog 的背景設為透明": "BottomSheetDialog",
  "把 AlertDialog 變成全螢幕": "AlertDialog",
  "多行文字的輸入框": "EditText",
  "取消之前的待辦事項，然後安排 3 秒後執行某件事": "Handler",
  "重覆地做相向動作": "Animation",
  "底線、刪除線": "TextView",
  "ValueAnimator setDelay": "ValueAnimator",
  "editText passwordText 可見不可見": "EditText",
  "bottomNavigationView當點擊時才顯示文字，否則只顯示圖標": "BottomNavigationView",
  "progress 顏色設定": "ProgressBar",
  "substring的使用": "String",
}
```

Export `categoryByComponent(component: string)` from the same file. Map `LocalDate` to `日期與時間`; `Animation`, `ValueAnimator`, and `Handler` to `動畫與互動`; `Intent`, `LinearLayout`, `ScrollView`, `DatePickerDialog`, `ViewPager2`, `BottomSheetDialog`, `AlertDialog`, `EditText`, `TextView`, `BottomNavigationView`, and `ProgressBar` to `介面與元件`; unresolved or language-level items to `其他`.

The ambiguous titles `文字輸入驗證(常見的字元檢查方法)`, `bottomNavigationView不可向下拉`, `拍照可以儲存uri`, and `消取內容的關聯性` must remain `待分類` and appear in the migration report.

- [ ] **Step 5: Implement pure extractors and the migration CLI**

Use Cheerio in `content-migration.mjs`. Resolve a relative asset/link against the source file directory and normalize it to a site-root-relative forward-slash path. For knowledge:

- iterate `.accordion` elements;
- pair each with its immediate `.panel` sibling;
- skip a title equal to `code` when the panel has no text, image, or link;
- extract paragraph text to `description`;
- extract each `<pre>` into a code block, selecting `xml` when it contains an XML tag, `kotlin` when it contains Kotlin syntax, otherwise `text`;
- extract images into `media`, using the image `alt` or the knowledge title;
- extract anchors into `relatedLinks`;
- never add the source filename to keywords or labels.

For projects, iterate direct card containers, extract non-empty `h1`, the detail link, summary text, image, and the link following `題目：`. Determine status with the explicit matcher. Derive tags only when the title or summary contains an explicit dictionary term: `動畫`, `Fragment`, `RecyclerView`, `Spinner`, `BottomSheetDialog`, `PopupMenu`, `ViewPager`, `TabLayout` (also match the standalone word `tab`), `HTTP`, `API`, `JSON`, `相機`, `拍照`, `圖片`, `MediaPlayer`, `音樂`, `VideoView`, `影片`, `ScrollView`, `Chip`, `AlertDialog`, `Navigation`, `URI`, `資料處理`, or `拖放`. Normalize aliases such as `tab` to the display tag `TabLayout`; do not add tags based only on the project filename.

Create `migrate-content.mjs` to read the four current source files, combine both knowledge results without a source marker, write stable JSON sorted by source order, and write a report shaped as:

```json
{
  "knowledge": { "sourceItems": 0, "writtenItems": 0, "skipped": [], "needsClassification": [] },
  "projects": { "sourceItems": 0, "writtenItems": 0, "skipped": [], "missingLinks": [] }
}
```

The CLI must exit non-zero if `sourceItems !== writtenItems + skipped.length` for either content family.

- [ ] **Step 6: Run the migration tests**

Run: `pnpm exec vitest run tests/content-migration.test.ts`

Expected: both tests PASS.

- [ ] **Step 7: Generate and inspect the real content**

Run: `pnpm migrate`

Expected:

- exit 0;
- `knowledge.json` contains entries from both source pages without source labels;
- the five blank `code` accordions from `knowledge/index.html` and the final blank `code` accordion from `forgot.html` appear in `skipped`;
- blank project cards appear in `skipped`;
- ambiguous knowledge titles appear in `needsClassification`;
- source/written/skipped counts balance exactly.

- [ ] **Step 8: Commit migration code and generated data only**

```bash
git add src/content/content.types.ts src/content/knowledge-classification.ts src/shared/status.ts scripts/content-migration.mjs scripts/migrate-content.mjs tests/fixtures/knowledge-source.html tests/fixtures/projects-source.html tests/content-migration.test.ts src/content/generated/knowledge.json src/content/generated/projects.json src/content/generated/migration-report.json
git commit -m "feat: migrate legacy knowledge and project metadata"
```

---

### Task 3: Search, Ranking, and Filter Services

**Files:**
- Create: `src/search/search.ts`
- Create: `tests/search.test.ts`
- Read: `src/content/generated/knowledge.json`
- Read: `src/content/generated/projects.json`

**Interfaces:**
- Consumes: `KnowledgeItem[]` and `ProjectItem[]` from Task 2.
- Produces: `normalizeSearchText(value: string): string`.
- Produces: `searchKnowledge(items: KnowledgeItem[], query: string): KnowledgeSearchResult[]`.
- Produces: `searchProjects(items: ProjectItem[], options: ProjectSearchOptions): ProjectItem[]`.
- Produces: `searchAll(knowledge, projects, query): { knowledge: KnowledgeItem[]; projects: ProjectItem[] }`.

- [ ] **Step 1: Write failing search tests for the required queries and score order**

Create fixtures in `tests/search.test.ts` that include `ProgressBar`, `TabLayout`, and `AlertDialog` items, plus two projects. Assert:

```ts
expect(searchKnowledge(items, "progress")[0].item.component).toBe("ProgressBar")
expect(searchAll(items, projects, "TABLAYOUT").projects[0].tags).toContain("TabLayout")
expect(searchKnowledge(items, "AlertDialog 背景透明")[0].item.title).toContain("背景")
expect(searchKnowledge(items, "setBackgroundDrawable")[0].item.component).toBe("AlertDialog")
expect(searchProjects(projects, { query: "相機", types: [], statuses: [], tags: [] })).toHaveLength(1)
```

Add one ranking test where an exact component match sorts before a description-only match, and one test where combined type/status filters use AND semantics.

- [ ] **Step 2: Run search tests to verify they fail**

Run: `pnpm exec vitest run tests/search.test.ts`

Expected: FAIL because `src/search/search.ts` does not exist.

- [ ] **Step 3: Implement normalization, scoring, and deterministic filtering**

Implement `normalizeSearchText` with Unicode normalization, `.trim()`, whitespace collapse, and `.toLocaleLowerCase("zh-Hant")`. For the comparison-only Chinese form, remove the function words `的`, `設為`, and `變成` so `背景透明` matches `背景設為透明`; preserve the original displayed content.

Implement knowledge score weights exactly:

```ts
const SCORE = {
  exactComponent: 100,
  exactTitle: 95,
  componentPrefix: 80,
  titlePrefix: 75,
  aliasOrKeyword: 60,
  category: 45,
  description: 30,
  code: 20,
} as const
```

Split a multi-word query into tokens; every token must match at least one searchable field. Use the highest matching weight per token, sum the scores, and use source array index as the stable tie-breaker.

Implement project query matching over title, localized type/status labels, summary, and tags. Apply query, type, status, and tag predicates with AND semantics across filter groups and OR semantics within a group.

- [ ] **Step 4: Run search tests**

Run: `pnpm exec vitest run tests/search.test.ts`

Expected: all search and filter tests PASS.

- [ ] **Step 5: Commit the pure search service**

```bash
git add src/search/search.ts tests/search.test.ts
git commit -m "feat: add component-aware knowledge search"
```

---

### Task 4: Knowledge Library Experience

**Files:**
- Create: `src/features/knowledge/KnowledgePage.tsx`
- Create: `src/features/knowledge/KnowledgeItemCard.tsx`
- Create: `src/shared/SearchField.tsx`
- Create: `src/shared/EmptyState.tsx`
- Create: `tests/KnowledgePage.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: generated `KnowledgeItem[]` and `searchKnowledge` from Tasks 2–3.
- Produces: `KnowledgePage(): JSX.Element` with component/category filters and URL query state.
- Produces: `KnowledgeItemCard({ item }: { item: KnowledgeItem }): JSX.Element`.
- Produces: reusable `SearchField` and `EmptyState` components for Tasks 5–6.

- [ ] **Step 1: Write failing knowledge-page tests**

Render `KnowledgePage` inside `MemoryRouter` with an injectable three-item array. Assert:

- the component filters include `AlertDialog`, `ProgressBar`, and `待分類`;
- typing `背景透明` leaves only the AlertDialog item;
- choosing `ProgressBar` leaves only the progress item;
- expanding a result reveals its code, related link, and image with meaningful alt text;
- clearing a no-results state restores all items;
- the result count is inside an `aria-live="polite"` region.

- [ ] **Step 2: Run the knowledge tests to verify they fail**

Run: `pnpm exec vitest run tests/KnowledgePage.test.tsx`

Expected: FAIL because the page and shared components do not exist.

- [ ] **Step 3: Implement the reusable search and empty states**

`SearchField` must accept `{ value, onChange, label, placeholder }`, render a visible or screen-reader label, and use `type="search"`. `EmptyState` must accept `{ title, description, actionLabel, onAction }` and render a real button.

- [ ] **Step 4: Implement component-first knowledge browsing**

Import generated knowledge JSON in the route component. Derive sorted component counts and category counts from data. Keep query, component, and category in `URLSearchParams` so refresh preserves the view. Use a `<button aria-expanded>` per `KnowledgeItemCard`; render code in `<pre><code>`, images with extracted alt text, and links as normal anchors.

Do not render a source badge. Do not render blank code blocks, blank links, or a “forgot” filter.

Replace the knowledge placeholder route in `App.tsx` with `<KnowledgePage />`.

- [ ] **Step 5: Add responsive knowledge styles**

Use a two-column component index/content layout above 800px and a wrapping horizontal filter region below 800px. At 320px, content must be single-column; code blocks use `overflow-x: auto`; interactive targets remain at least 40px high; `prefers-reduced-motion` removes expansion transition.

- [ ] **Step 6: Run focused and existing tests**

Run: `pnpm exec vitest run tests/KnowledgePage.test.tsx tests/AppShell.test.tsx tests/search.test.ts`

Expected: all tests PASS.

- [ ] **Step 7: Commit the knowledge experience**

```bash
git add src/features/knowledge/KnowledgePage.tsx src/features/knowledge/KnowledgeItemCard.tsx src/shared/SearchField.tsx src/shared/EmptyState.tsx tests/KnowledgePage.test.tsx src/app/App.tsx src/styles/app.css
git commit -m "feat: build searchable component knowledge library"
```

---

### Task 5: Project Catalogue and Status Filters

**Files:**
- Create: `src/features/projects/ProjectsPage.tsx`
- Create: `src/features/projects/ProjectCard.tsx`
- Create: `tests/ProjectsPage.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: generated `ProjectItem[]`, `searchProjects`, `SearchField`, and status labels.
- Produces: `ProjectsPage(): JSX.Element` with combined query/type/status/tag filters.
- Produces: `ProjectCard({ project }: { project: ProjectItem }): JSX.Element`.

- [ ] **Step 1: Write failing project catalogue tests**

Use four projects covering both types and the statuses complete, in-progress, rebuild, and broken. Assert:

```tsx
expect(screen.getByRole("button", { name: "知識點項目" })).toBeInTheDocument()
expect(screen.getByRole("button", { name: "題目項目" })).toBeInTheDocument()
```

Then test that selecting `題目項目` and `待重做` together leaves only the matching assignment. Test that a missing detail link renders the text `詳情未提供` instead of an empty anchor. Test that an image error switches to an accessible `無預覽圖片` state.

- [ ] **Step 2: Run the project tests to verify they fail**

Run: `pnpm exec vitest run tests/ProjectsPage.test.tsx`

Expected: FAIL because the project components do not exist.

- [ ] **Step 3: Implement project cards without inventing metadata**

Render the original title and summary, localized type/status labels, only existing tags, an optional image, and valid detail/source actions. A missing `detailHref` or `sourceHref` is text, not a disabled anchor. On `<img onError>`, replace the image region with `無預覽圖片`.

- [ ] **Step 4: Implement combined filters and URL state**

Derive available tags from data. Store `q`, `type`, `status`, and `tag` in URL search parameters. Type/status/tag buttons must expose `aria-pressed`. Display the filtered count in an `aria-live="polite"` region and use `EmptyState` to clear all filters.

Replace the project placeholder route in `App.tsx` with `<ProjectsPage />`.

- [ ] **Step 5: Add the responsive project catalogue styles**

Use a two-column project list on medium/large screens and one column below 680px. Keep status text visible, do not encode state by color alone, and let filter buttons wrap rather than scroll off-screen.

- [ ] **Step 6: Run focused and regression tests**

Run: `pnpm exec vitest run tests/ProjectsPage.test.tsx tests/search.test.ts tests/AppShell.test.tsx`

Expected: all tests PASS.

- [ ] **Step 7: Commit the project catalogue**

```bash
git add src/features/projects/ProjectsPage.tsx src/features/projects/ProjectCard.tsx tests/ProjectsPage.test.tsx src/app/App.tsx src/styles/app.css
git commit -m "feat: add filterable Android project catalogue"
```

---

### Task 6: Search-First Home Integration

**Files:**
- Create: `src/features/home/HomePage.tsx`
- Create: `tests/HomePage.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/styles/app.css`
- Read only: `world skill/index.html`
- Read only: `homework/index.html`

**Interfaces:**
- Consumes: both generated content arrays, `searchAll`, and shared search/empty components.
- Produces: `HomePage(): JSX.Element` with grouped cross-content results and links preserving the selected query.
- Preserves: both legacy index files exactly as they exist; the new navigation does not expose them.

- [ ] **Step 1: Write failing grouped-home-search tests**

Render `HomePage` with injectable knowledge/projects. Assert the initial page shows the main heading, knowledge and project entry actions, and no legacy-page actions. Type `AlertDialog` and assert a `知識` result group appears. Type a project name and assert a `專案` result group appears. Type an unmatched query and assert the clear-search action restores the two entry actions.

- [ ] **Step 2: Run the home tests to verify they fail**

Run: `pnpm exec vitest run tests/HomePage.test.tsx`

Expected: FAIL because `HomePage.tsx` does not exist.

- [ ] **Step 3: Implement the search-first home**

Use the approved copy `找回做過的 Android 知識與專案。` and placeholder `搜尋 Progress、TabLayout、AlertDialog 背景透明…`. With an empty query, show only the knowledge/project entry sections and common component shortcuts derived from the first five component counts. With a non-empty query, render grouped results from `searchAll`; link knowledge results to `#/knowledge?q=...` and project results to `#/projects?q=...`.

Replace the home placeholder route in `App.tsx` with `<HomePage />`.

- [ ] **Step 4: Add the approved Android Studio-inspired home styles**

Make the command-style search the only dominant element. Use the component tree only as meaningful navigation, Android green for component identity, Kotlin purple for code/project accents, and restrained page transitions that disappear under reduced motion.

- [ ] **Step 5: Verify legacy indexes are read-only inputs**

Run:

```bash
git diff -- 'world skill/index.html' homework/index.html
```

Expected: the diff is identical to the pre-task diff; this task adds no redirect, banner, or navigation change to either file.

- [ ] **Step 6: Run home and complete unit/component tests**

Run: `pnpm test`

Expected: all tests PASS with no unhandled React warnings.

- [ ] **Step 7: Commit the integrated home and navigation**

```bash
git add src/features/home/HomePage.tsx tests/HomePage.test.tsx src/app/App.tsx src/styles/app.css
git commit -m "feat: add search-first Android Notebook home"
```

---

### Task 7: Link Validation, Responsive E2E, and Documentation

**Files:**
- Create: `scripts/check-content-links.mjs`
- Create: `tests/check-content-links.test.ts`
- Create: `playwright.config.ts`
- Create: `e2e/android-notebook.spec.ts`
- Modify: `README.md`
- Modify if verification reveals a scoped defect: files created in Tasks 1–6 only

**Interfaces:**
- Consumes: generated JSON and the completed SPA.
- Produces: `checkContentLinks({ root, knowledge, projects })` returning `{ missingImages, missingDetails, missingSources }`.
- Produces: final desktop/mobile acceptance evidence and documented maintenance commands.

- [ ] **Step 1: Write the failing link-check test**

Create a temporary fixture tree through Vitest and assert:

```ts
const result = checkContentLinks({ root, knowledge, projects })
expect(result.missingImages).toEqual(["homework/img/missing.png"])
expect(result.missingDetails).toEqual([])
expect(result.missingSources).toEqual(["train/missing/"])
```

The test must also verify that `http:`, `https:`, `mailto:`, `tel:`, and hash URLs are not treated as local filesystem paths.

- [ ] **Step 2: Run the link-check test to verify it fails**

Run: `pnpm exec vitest run tests/check-content-links.test.ts`

Expected: FAIL because the checker does not exist.

- [ ] **Step 3: Implement the reusable checker and CLI**

Resolve decoded local URLs against the repository root, strip query/hash fragments, and check `existsSync`. The CLI reads both generated JSON files, prints each missing path under `images`, `details`, or `sources`, and exits 1 if any generated clickable/image path is missing.

For items already reported by migration as missing, ensure the generated item omits that href/image before this final checker runs; do not create fake files.

- [ ] **Step 4: Run migration, unit tests, link checks, and build**

Run:

```bash
pnpm migrate
pnpm test
pnpm check:links
pnpm build
```

Expected: every command exits 0; migration counts balance; all tests pass; every rendered local asset/link exists; `dist/index.html` and versioned assets are produced.

- [ ] **Step 5: Configure desktop and mobile Playwright projects**

Create `playwright.config.ts` with a Vite web server and projects named `desktop` at 1440×900 and `mobile` at 390×844. Create `e2e/android-notebook.spec.ts` to verify:

```ts
test("finds knowledge by component and function", async ({ page }) => {
  await page.goto("/#/")
  await page.getByRole("searchbox").fill("AlertDialog 背景透明")
  await expect(page.getByRole("heading", { name: /知識/ })).toBeVisible()
  await page.getByRole("link", { name: /AlertDialog/ }).first().click()
  await expect(page.getByText("setBackgroundDrawable")).toBeVisible()
})

test("filters assignment projects by status", async ({ page }) => {
  await page.goto("/#/projects")
  await page.getByRole("button", { name: "題目項目" }).click()
  await page.getByRole("button", { name: "待重做" }).click()
  await expect(page.locator("[data-project-card]")).not.toHaveCount(0)
})
```

Add a parameterized home-search assertion for `progress`, `TabLayout`, and `AlertDialog 背景透明`, requiring at least one visible result for each. Add assertions that the mobile page has no horizontal document overflow and that keyboard Tab reaches the three main destinations and search field with visible focus.

- [ ] **Step 6: Install the Playwright Chromium runtime**

Run: `pnpm exec playwright install chromium`

Expected: exit 0 with the Chromium runtime available to the two configured projects.

- [ ] **Step 7: Run E2E in both viewports**

Run: `pnpm e2e`

Expected: all scenarios PASS in both the desktop and mobile projects.

- [ ] **Step 8: Document the content workflow**

Update `README.md` with these exact workflows:

- `pnpm install` — install dependencies;
- `pnpm migrate` — regenerate JSON after editing legacy knowledge/project indexes;
- `pnpm dev` — local reading/search preview;
- `pnpm test` — unit and component tests;
- `pnpm check:links` — validate rendered local paths;
- `pnpm build` — production build;
- knowledge classification rule: add an explicit title mapping or leave `待分類`;
- project status rule: explicit wording only, otherwise `未標記`;
- legacy pages/assets remain source-controlled and must not be moved.

- [ ] **Step 9: Review all changes and commit final verification tooling**

Run `git status --short` and confirm unrelated pre-existing modifications remain unstaged. Then:

```bash
git add scripts/check-content-links.mjs tests/check-content-links.test.ts playwright.config.ts e2e/android-notebook.spec.ts README.md
git commit -m "test: verify Android Notebook content and responsive flows"
```

- [ ] **Step 10: Run the final release gate from a clean generated state**

Run:

```bash
pnpm migrate
pnpm test
pnpm check:links
pnpm build
pnpm e2e
git status --short
```

Expected:

- migration counts balance with no silently dropped content;
- every unit, component, and E2E test passes;
- all generated local links and images exist;
- production build exits 0;
- only the user's pre-existing unrelated changes remain in `git status`.
