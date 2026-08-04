# WorldSkills Android Kotlin 備賽平台 Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement the linked plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依序交付一個可登入、可搜尋、可管理學習內容、可用 DeepSeek 出題評分並可部署到華為雲或阿里雲的手機優先備賽平台。

**Architecture:** 在既有靜態網站旁新增 `platform/` 容器化 Next.js 單體，使用 PostgreSQL 保存結構化內容，以物件儲存保存大型附件。功能按 Foundation、Content、Search/Import、AI Training、PWA/Deployment 分期；每期必須產生可運作、可測試的增量。

**Tech Stack:** Next.js、TypeScript、PostgreSQL、Prisma、Vitest、Testing Library、Playwright、Docker Compose、DeepSeek API、S3 相容物件儲存。

## Global Constraints

- 唯一正式規格：`docs/superpowers/specs/2026-08-03-worldskills-kotlin-learning-platform-design.md`。
- 新應用只放在 `platform/`；現有根目錄 HTML、`homework/`、`knowledge/`、`pdf/`、`train/` 和媒體檔只作匯入來源，不移動、不刪除、不覆寫。
- 整站只有一位管理者；不建立公開瀏覽、註冊、社群或多人權限。
- DeepSeek API Key 只能存在伺服器環境變數。
- AI 只分析答案，不編譯或執行 Kotlin／Android 程式碼。
- AI 推薦「正確完成當前功能所需時間最短的方法」，不是整場比賽時間最佳化。
- 手機底部固定為首頁、搜尋、抽題、項目；首頁必須可直接進入全部知識點。
- 所有內容匯入先產生預覽，未確認前不得發布或修改來源檔。
- 所有程式碼變更採 TDD；先觀察測試失敗，再寫最小實作。
- 每項任務使用獨立實作者，完成後依序接受規格符合性審查與程式碼品質審查；任一審查失敗都交回原實作者修正後重審。
- 每項任務一個小提交；不得把其他任務或使用者既有變更混入提交。

## Plan Set

1. [Foundation](./2026-08-04-worldskills-platform-01-foundation.md)：應用骨架、測試、資料庫、登入、導覽與設計基礎。
2. [Content](./2026-08-04-worldskills-platform-02-content.md)：知識點、項目、程式碼、PDF 與媒體內容。
3. [Search and Import](./2026-08-04-worldskills-platform-03-search-import.md)：全站搜尋、舊內容匯入及備份。
4. [AI Training](./2026-08-04-worldskills-platform-04-ai-training.md)：DeepSeek、抽題、評分、答題紀錄與待學習。
5. [PWA and Deployment](./2026-08-04-worldskills-platform-05-pwa-deployment.md)：離線草稿、物件儲存、安全強化、容器與雲端交付。

## Specification Coverage

| Approved requirement | Owning plan/task |
|---|---|
| Single administrator login and protected site | Foundation Tasks 2-3 |
| Desktop sidebar and four-item mobile navigation | Foundation Task 4 |
| Homepage search, training, projects, all knowledge and learning entry | Foundation Task 4; Content Task 5 |
| Knowledge point purpose, code and explanation | Content Tasks 1-2 |
| Project introduction, optional video, workflow, knowledge and full code | Content Tasks 3-4 |
| Practice copies never overwrite formal code | Content Task 3 |
| Search knowledge, code, projects and PDF with AI fallback | Search/Import Tasks 1-2; AI Training Task 2 |
| Existing HTML/project/PDF preview import without source mutation | Search/Import Tasks 3-4 |
| Structured export, restore dry-run and GitHub/local backup artifact | Search/Import Task 5 |
| Mixed, logic and keyword question modes | AI Training Task 2 |
| Mobile code answer, saved draft and AI-only analysis | AI Training Tasks 3-4 |
| Fastest correct method for the current feature | AI Training Tasks 2 and 4 |
| Automatic learning items and knowledge conversion | AI Training Task 5 |
| DeepSeek key protection, retry and usage limits | AI Training Task 1; PWA/Deployment Task 3 |
| Offline recent reading and draft recovery | PWA/Deployment Task 1 |
| Huawei/Alibaba portable private media storage | PWA/Deployment Task 2 |
| Dark technology visual direction and reduced motion | PWA/Deployment Task 4 |
| Docker, HTTPS, cloud runbooks, backup rehearsal and final tests | PWA/Deployment Task 5 |

## Dependency Graph

```text
Foundation
    ↓
Content
    ├───────────────┐
    ↓               ↓
Search/Import   AI Training
    └───────┬───────┘
            ↓
    PWA/Deployment
```

Foundation 與 Content 是共享基線，不並行。Content 穩定資料模型及 repository 介面後，Search/Import 和 AI Training 可從同一提交建立兩個工作樹並行。兩者整合完成後再執行 PWA/Deployment。

## Worktree Strategy

- 整合分支：`codex/worldskills-platform`。
- Foundation：`codex/worldskills-foundation`。
- Content：從 Foundation 整合後建立 `codex/worldskills-content`。
- Search/Import：從 Content 整合後建立 `codex/worldskills-search-import`。
- AI Training：與 Search/Import 使用相同 Content 基線建立 `codex/worldskills-ai-training`。
- PWA/Deployment：Search/Import 與 AI Training 都整合後建立 `codex/worldskills-deployment`。

建立每個工作樹時必須使用 `superpowers:using-git-worktrees`。執行每份計畫時使用 `superpowers:subagent-driven-development`，不得讓兩個實作者同時修改 `platform/prisma/schema.prisma`、全域導覽、`platform/src/lib/env.ts` 或共享內容型別。

Search/Import 與 AI Training 可能各自新增 npm 依賴。整合時先保留兩個 `package.json` 的依賴聯集，再於整合分支執行 `pnpm install --lockfile-only` 重新產生一次 `pnpm-lock.yaml`；不得手動編輯 lockfile 或任意捨棄其中一個分支的依賴。

## Review Protocol For Every Task

1. 實作者完成測試、實作、完整驗證及任務提交。
2. 派出新的規格審查者，只讀該任務 diff、設計規格及任務驗收條件；輸出通過或具體缺口。
3. 若有缺口，原實作者修正、重跑測試、提交修正，再由規格審查者重審。
4. 規格通過後派出新的品質審查者，檢查可讀性、邊界、測試品質、安全性及過度設計。
5. 若有品質問題，原實作者修正、重跑測試、提交修正，再由品質審查者重審。
6. 兩階段都通過後，主代理才標記任務完成並開始下一項。

## Integration Gates

- Gate 1：Foundation 全部測試通過，登入保護與響應式導覽可用。
- Gate 2：Content 全部測試通過，可從首頁進入全部知識點並查看完整項目。
- Gate 3A：Search/Import 通過，可搜尋五類內容並安全預覽匯入。
- Gate 3B：AI Training 通過，可完成三種抽題入口、評分與待學習流程。
- Gate 4：全系統單元、整合及 E2E 測試通過，可備份還原並以 HTTPS 部署。

## Final Acceptance Commands

從 `platform/` 執行：

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
docker compose config
```

全部命令必須以退出碼 0 完成。最後依設計規格第 10 節逐項人工驗收手機導覽、搜尋、項目內容、AI 作答、待學習、匯入預覽、離線閱讀及備份還原。
