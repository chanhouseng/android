# WorldSkills Platform AI Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 DeepSeek 驅動的功能邏輯題／關鍵字題、手機程式碼作答、結構化評估、答題紀錄及待學習流程。

**Architecture:** 所有 AI 請求經伺服器 AI Gateway，瀏覽器永遠不接觸 Key。Gateway 使用 OpenAI 相容 Chat Completions、Zod 驗證 JSON，並保存模型及提示詞版本；題目和評估分成兩次請求，失敗可獨立重試。

**Tech Stack:** Next.js、TypeScript、Prisma/PostgreSQL、Zod、OpenAI JavaScript SDK、DeepSeek V4 Flash、CodeMirror、Vitest、Playwright。

## Global Constraints

- 從通過 Gate 2 的 Content 基線建立 `codex/worldskills-ai-training` 工作樹。
- 不修改共享 Prisma schema；使用基線已定義的 Question、Submission、LearningItem。
- DeepSeek 官方 OpenAI 相容 Base URL 為 `https://api.deepseek.com`；模型由 `DEEPSEEK_MODEL` 配置，預設 `deepseek-v4-flash`，不得使用已停用的 legacy 模型名稱。
- AI 只分析文字答案，不宣稱通過編譯或執行。
- 評估優先推薦「正確完成當前功能所需時間最短的方法」。
- 抽題入口只提供隨機混合、功能邏輯題、關鍵字記憶題。
- AI 產生內容不直接成為正式知識點。
- 每項任務按 roadmap 執行兩階段審查。

---

### Task 1: DeepSeek Gateway And Structured Response Validation

**Files:**
- Create: `platform/src/features/ai/contracts.ts`
- Create: `platform/src/features/ai/deepseek-client.ts`
- Create: `platform/src/features/ai/deepseek-client.test.ts`
- Create: `platform/src/features/ai/errors.ts`

**Interfaces:**
- Consumes the Foundation environment contract: `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL=https://api.deepseek.com`, `DEEPSEEK_MODEL=deepseek-v4-flash`, `AI_DAILY_TOKEN_BUDGET=200000`.
- Produces `AiGateway.generate<T>({ system, user, schema, schemaName, idempotencyKey }): Promise<AiResponse<T>>`.
- `AiResponse` includes parsed data, model ID, request ID when available, input/output token counts and raw text.

- [ ] **Step 1: Install SDK and write failing gateway configuration tests**

```bash
cd platform
pnpm add openai
```

Using the Foundation `parseEnv` fixture, verify the gateway consumes the configured Base URL/model, a missing API key throws only when creating the gateway, and error messages never include key values.

- [ ] **Step 2: Write failing gateway tests**

Mock the SDK and cover valid JSON, fenced JSON, invalid JSON, schema mismatch, HTTP 429, timeout and a second identical idempotency request. Assert invalid output throws `AiResponseValidationError` with sanitized details.

- [ ] **Step 3: Implement the gateway**

Use the OpenAI-compatible client with server-only imports. Request JSON output, include the target JSON shape in the system prompt, strip only an outer Markdown fence, parse once and validate with Zod. Retry HTTP 429/5xx once with bounded jitter; never retry validation errors automatically.

```ts
const client = new OpenAI({
  apiKey: env.DEEPSEEK_API_KEY,
  baseURL: env.DEEPSEEK_BASE_URL,
});
```

- [ ] **Step 4: Add safe observability**

Log request ID, model, latency, token counts and error class. Do not log API Key, full PDF context, user code or raw AI response in production logs. Return typed retryable/non-retryable errors.

- [ ] **Step 5: Verify the gateway**

Run: `cd platform && pnpm test -- src/features/ai && pnpm lint && pnpm typecheck`

Expected: all commands exit 0.

- [ ] **Step 6: Commit and run both review gates**

```bash
git add platform/package.json platform/pnpm-lock.yaml platform/src/features/ai
git commit -m "feat: add validated DeepSeek gateway"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 2: Question Generation And Training Entry

**Files:**
- Create: `platform/src/features/training/contracts.ts`
- Create: `platform/src/features/training/prompts/question-v1.ts`
- Create: `platform/src/features/training/question-service.ts`
- Create: `platform/src/features/training/question-service.test.ts`
- Create: `platform/src/features/training/training-mode-picker.tsx`
- Create: `platform/src/features/training/question-view.tsx`
- Create: `platform/src/app/(protected)/training/page.tsx`
- Create: `platform/src/app/(protected)/training/questions/[id]/page.tsx`
- Create: `platform/src/app/(protected)/training/ask/page.tsx`

**Interfaces:**
- UI modes: `MIXED`, `LOGIC`, `KEYWORD`; stored Question types: `LOGIC`, `KEYWORD`.
- `GeneratedQuestion` fields: `title`, `type`, `prompt`, `starterCode`, `inputData`, `requirements[{ id, text }]`, `referenceAnswer`, `fastestMethod`, `tags`, `introducesNewKnowledge`.
- Produces `generateQuestion(mode, optionalSearchQuery): Promise<Question>`.

- [ ] **Step 1: Write failing schema tests**

Reject questions with no requirements, duplicate requirement IDs, missing reference answer, unsupported type or a `fastestMethod` that does not explain why it is faster. Accept JSON/CSV/XML input data as text.

- [ ] **Step 2: Write failing service tests**

Verify MIXED selects LOGIC or KEYWORD, requested types are preserved, website/PDF context is capped and source-labelled, open Android knowledge is allowed, and AI output is saved only after schema validation.

- [ ] **Step 3: Implement question prompt and context selection**

The system prompt identifies a WorldSkills Android Kotlin examiner. Require testable requirements, no impossible dependencies, no need to compile in the website, and a reference answer optimized for fastest correct completion of that feature. Select at most 12 relevant content excerpts and 24,000 characters total.

- [ ] **Step 4: Implement training entry pages**

`/training` shows exactly three mode cards. Starting a mode generates one question and redirects to its page. `/training/ask?query=` generates a question/answer context from a no-result search and marks it eligible for learning-item creation.

- [ ] **Step 5: Add generation failure behavior**

Show retry after the gateway's one internal retry fails. Do not create a Question row for invalid output. Preserve selected mode and search query across retry.

- [ ] **Step 6: Verify generation**

Run unit tests, lint, typecheck and build using a mocked gateway. Run one opt-in manual call with a real test API key and confirm the persisted model ID is `deepseek-v4-flash` or the configured replacement.

- [ ] **Step 7: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/training
git commit -m "feat: generate WorldSkills practice questions"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 3: Mobile Answer Editor, Drafts And Submission State

**Files:**
- Create: `platform/src/features/training/answer-editor.tsx`
- Create: `platform/src/features/training/answer-draft.ts`
- Create: `platform/src/features/training/answer-draft.test.ts`
- Create: `platform/src/features/training/submission-actions.ts`
- Create: `platform/src/features/training/submission-actions.test.ts`
- Create: `platform/src/features/training/submission-status.tsx`
- Modify: `platform/src/app/(protected)/training/questions/[id]/page.tsx`

**Interfaces:**
- Draft key: `worldskills_answer_<questionId>`, storing answer and updated timestamp.
- Produces `submitAnswer(questionId, answer): Promise<{ submissionId: string }>`.
- Produces `markDontKnow(questionId): Promise<{ submissionId: string; learningItemId: string }>`.

- [ ] **Step 1: Write failing draft tests**

Verify per-question isolation, save/load, explicit clear, recovery after reload and rejection of a draft larger than 200 KB.

- [ ] **Step 2: Implement the mobile editor**

Use CodeMirror with Kotlin as default and optional XML mode. Support horizontal scroll, line numbers, paste, undo, full screen, local draft timestamp and a persistent submit bar that does not cover the final lines.

- [ ] **Step 3: Write failing submission tests**

Reject blank answers and answers over 200 KB. Require ownership/authentication. Save status `PENDING`, prompt version and question snapshot atomically. A repeated idempotency key returns the existing submission.

- [ ] **Step 4: Implement submit and “I do not know” actions**

Submitting saves first, then queues/starts evaluation. `我不會` creates a Submission with an empty answer plus a LearningItem reason `DONT_KNOW`; it must not call evaluation.

- [ ] **Step 5: Preserve answers through failures**

Clear browser draft only after server confirms persistence. On network error keep the draft and show retry. On expired login return to the same question after authentication.

- [ ] **Step 6: Verify mobile answer flow**

Run tests and manually test at 390 px: type multiline Kotlin, horizontal scroll, reload recovery, offline submit failure, reconnect, successful submit and I-do-not-know.

- [ ] **Step 7: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/training
git commit -m "feat: add resilient mobile answer flow"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 4: Structured Evaluation And Retryable Results

**Files:**
- Create: `platform/src/features/training/prompts/evaluation-v1.ts`
- Create: `platform/src/features/training/evaluation-service.ts`
- Create: `platform/src/features/training/evaluation-service.test.ts`
- Create: `platform/src/features/training/evaluation-result.tsx`
- Create: `platform/src/features/training/retry-evaluation-action.ts`
- Create: `platform/src/app/(protected)/training/submissions/[id]/page.tsx`

**Interfaces:**
- `Evaluation` fields: `verdict`, `requirementResults`, `importantErrors`, `minimalChanges`, `fastestMethod`, `referenceAnswer`, `relatedTerms`, `disclaimer`.
- Verdict values: `PASS`, `PARTIAL`, `FAIL`.
- Required disclaimer: `AI 分析結果；程式碼未在 Android 環境編譯或執行。`

- [ ] **Step 1: Write failing evaluation contract tests**

Require one result for every requirement ID, reject unknown IDs, require concrete minimal changes for PARTIAL/FAIL, and require the exact disclaimer.

- [ ] **Step 2: Write failing service tests**

Verify question requirements, reference answer and user answer enter the prompt; project architecture preferences do not reduce correctness; fastest method is feature-scoped; valid output sets `EVALUATED`; failures set `FAILED` while preserving answer.

- [ ] **Step 3: Implement evaluation prompt and service**

Instruct DeepSeek to distinguish functional errors from optional improvements, avoid claiming compilation, recommend the smallest correction, and explain the fastest correct method for this feature. Save parsed evaluation plus model/prompt metadata and raw response in one transaction.

- [ ] **Step 4: Implement result page**

Render completed requirements, errors, minimal changes, fastest method, full reference answer and related links. Always show the disclaimer near verdict. A failed evaluation shows saved answer and `稍後重新評分`.

- [ ] **Step 5: Implement idempotent retry**

Retry creates no duplicate Submission. It transitions FAILED to PENDING, calls the current evaluation prompt, and increments retry count. Limit automatic/user retries to three per submission in one hour.

- [ ] **Step 6: Verify evaluation flow**

Run tests, lint, typecheck and build. With mocked outputs cover PASS, PARTIAL, FAIL, malformed JSON, timeout and successful retry.

- [ ] **Step 7: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/training
git commit -m "feat: evaluate practice answers with DeepSeek"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 5: Learning Items, Deduplication And Gate 3B

**Files:**
- Create: `platform/src/features/learning/contracts.ts`
- Create: `platform/src/features/learning/deduplicate.ts`
- Create: `platform/src/features/learning/deduplicate.test.ts`
- Create: `platform/src/features/learning/learning-repository.ts`
- Create: `platform/src/features/learning/learning-actions.ts`
- Create: `platform/src/features/learning/learning-card.tsx`
- Create: `platform/src/app/(protected)/learning/page.tsx`
- Create: `platform/src/app/(protected)/learning/[id]/page.tsx`
- Create: `platform/e2e/ai-training.spec.ts`

**Interfaces:**
- Learning reasons: `DONT_KNOW`, `IMPORTANT_ERROR`, `NEW_KNOWLEDGE`, `AI_SEARCH`.
- Learning status: `OPEN`, `CONVERTED`.
- Produces `findLearningDuplicates(candidate): Promise<LearningMatch[]>` and actions `retry`, `update`, `convertToKnowledge`, `merge`, `delete`.

- [ ] **Step 1: Write failing deduplication tests**

Normalize title, aliases and API terms. Score exact API overlap above generic text overlap. Return suggestions at threshold 0.75; never merge automatically.

- [ ] **Step 2: Implement automatic creation rules**

Create on I-do-not-know, FAIL or important PARTIAL, question marked new knowledge, and AI search supplement. Store question, answer, evaluation, fastest method and reference answer. Before create, return duplicate suggestions for user choice.

- [ ] **Step 3: Write failing conversion tests**

Conversion requires title, purpose, code and code explanation, creates a draft KnowledgePoint, marks LearningItem CONVERTED and retains Submission history. A transaction failure changes neither record.

- [ ] **Step 4: Implement learning pages and actions**

List shows reason/date/API tags. Detail supports answer again, edit notes, convert, merge and delete with confirmation. Converted items disappear from default open list but remain accessible from submission history.

- [ ] **Step 5: Add AI Training E2E**

Mock gateway responses at network boundary. Cover all three modes, draft recovery, submit/evaluate, I-do-not-know, failed evaluation retry, automatic learning creation, duplicate prompt and conversion to draft knowledge.

- [ ] **Step 6: Run Gate 3B**

```bash
cd platform
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e -- e2e/ai-training.spec.ts
pnpm build
```

- [ ] **Step 7: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/learning platform/e2e/ai-training.spec.ts
git commit -m "feat: complete AI learning workflow"
```

After both approvals, merge into `codex/worldskills-platform` without changing Search/Import files.

## Official DeepSeek References

- `https://api-docs.deepseek.com/guides/function_calling/`
- `https://api-docs.deepseek.com/quick_start/pricing`
- `https://api-docs.deepseek.com/updates/`
