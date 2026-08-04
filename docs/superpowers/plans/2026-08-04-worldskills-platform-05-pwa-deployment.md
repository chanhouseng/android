# WorldSkills Platform PWA And Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成離線閱讀與草稿、雲端物件儲存、安全強化、科技感視覺、Docker 部署、備份還原及正式驗收。

**Architecture:** Next.js、PostgreSQL、Nginx 以 Docker Compose 在單台 ECS 上運作，大型附件保存到同地域的私有物件儲存。PWA 快取應用殼與最近閱讀內容，不快取 Session、AI 回應 API 或管理寫入請求。

**Tech Stack:** Next.js PWA/Service Worker、IndexedDB、S3 相容 SDK、PostgreSQL、Docker Compose、Nginx、Vitest、Playwright、華為雲 ECS+OBS 或阿里雲 ECS+OSS。

## Global Constraints

- 從 Search/Import 與 AI Training 都整合後的提交建立 `codex/worldskills-deployment` 工作樹。
- 執行視覺工作前載入 `frontend-design` 技能；遵循已批准的深色科技方向，不改變導覽或核心流程。
- 私有內容不得透過公開 bucket URL 暴露；媒體只經登入後的應用 API 或短效簽名 URL 存取。
- ECS 與 OBS/OSS 建立在同一地域並使用內網端點。
- 不把 `.env`、API Key、資料庫 dump、備份 ZIP 或上傳附件提交到 Git。
- 每項任務按 roadmap 執行兩階段審查。

---

### Task 1: Installable PWA, Offline Reading And Draft Queue

**Files:**
- Create: `platform/src/app/manifest.ts`
- Create: `platform/public/icons/icon-192.png`
- Create: `platform/public/icons/icon-512.png`
- Create: `platform/public/sw.js`
- Create: `platform/src/lib/pwa/cache-policy.ts`
- Create: `platform/src/lib/pwa/cache-policy.test.ts`
- Create: `platform/src/lib/offline/indexed-db.ts`
- Create: `platform/src/lib/offline/draft-queue.ts`
- Create: `platform/src/lib/offline/draft-queue.test.ts`
- Create: `platform/src/features/offline/connection-banner.tsx`
- Create: `platform/src/features/offline/sync-drafts.tsx`
- Create: `platform/src/features/offline/service-worker-registration.tsx`
- Modify: `platform/src/app/layout.tsx`
- Modify: `platform/src/app/logout/route.ts`
- Create: `platform/src/app/logout/complete/page.tsx`
- Modify: `platform/next.config.ts`

**Interfaces:**
- Cacheable GET routes: published knowledge detail, project detail, protected media metadata and PDF page text already opened by this user.
- Never cache: `/api/auth/*`, `/api/ai/*`, mutation requests, login HTML, raw Session responses.
- Draft queue item: `{ id, kind, resourceId, payload, updatedAt, attempts }`.

- [ ] **Step 1: Write failing cache-policy tests**

Assert public shell/static assets use cache-first, content GET uses stale-while-revalidate, AI/auth/mutations use network-only, and protected responses without current-user cache marker are rejected.

- [ ] **Step 2: Implement and register the service worker**

Create `public/sw.js` with explicit install, activate and fetch handlers. Cache versioned static shell assets with cache-first, use stale-while-revalidate only for approved content GET responses carrying `X-WorldSkills-Cacheable: 1`, and return network-only for auth, AI, admin and all non-GET requests. Register `/sw.js` from a small client component and set service-worker response headers to JavaScript content type plus `no-cache, no-store, must-revalidate`. Do not write a blanket `/**` cache rule.

- [ ] **Step 3: Write failing draft-queue tests**

Verify upsert by kind/resource ID, newest draft wins, failed sync increments attempts, successful sync removes only that item, and three failures stop automatic retry until the user taps retry.

- [ ] **Step 4: Implement IndexedDB drafts and reconnect sync**

Move answer and content-form drafts behind one IndexedDB adapter. On reconnect show pending count, require confirmation before publishing content edits, and auto-retry only saved answer submissions that already have an idempotency key.

- [ ] **Step 5: Add manifest and installability**

Set name `KOTLIN//LAB`, standalone display, dark background/theme colors and 192/512 icons. Add offline and update banners. Respect iOS safe areas around the bottom navigation.

- [ ] **Step 6: Clear protected offline data on logout and verify PWA behavior**

Change the logout route to delete the server Session and redirect to `/logout/complete`. That client page messages the service worker to delete protected caches, clears IndexedDB drafts, then replaces its location with `/login`. Use Playwright offline mode: open a knowledge point and project online, switch offline, confirm both remain readable while logged in; confirm login, AI generation and unseen content fail with a clear network message; reconnect and sync a saved answer once; log out and confirm the previously cached protected pages are no longer served offline.

- [ ] **Step 7: Commit and run both review gates**

```bash
git add platform/next.config.ts platform/public platform/src/app platform/src/features/offline platform/src/lib/offline platform/src/lib/pwa
git commit -m "feat: add safe offline PWA behavior"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 2: Cloud Object Storage Adapter

**Files:**
- Create: `platform/src/lib/storage/s3-storage.ts`
- Create: `platform/src/lib/storage/s3-storage.test.ts`
- Create: `platform/src/lib/storage/create-storage.ts`
- Modify: `platform/src/lib/storage/storage.ts`
- Modify: `platform/src/app/api/media/[id]/route.ts`

**Interfaces:**
- Storage driver: `local | s3`.
- S3 configuration: endpoint, region, bucket, access key, secret key, path-style flag.
- Produces multipart-safe `put`, streamed `get`, range `getRange`, `delete`, `exists`, `checksum`.

- [ ] **Step 1: Write failing adapter contract tests**

Run the same contract suite against LocalStorage and an S3 mock: byte round-trip, MIME preservation, range reads, missing object, delete, traversal rejection and checksum.

- [ ] **Step 2: Install SDK and implement adapter**

Run `cd platform && pnpm add @aws-sdk/client-s3`. Use `S3Client`, `GetObjectCommand`, `PutObjectCommand`, `HeadObjectCommand` and `DeleteObjectCommand` with configurable endpoint and path-style mode. Keep buckets private. Store provider credentials only in environment variables and redact them from errors.

- [ ] **Step 3: Implement streamed/range delivery**

Update media route to translate HTTP Range into `getRange`, return 206 with correct headers and avoid buffering complete videos. Add `Cache-Control: private` and `Vary: Cookie`.

- [ ] **Step 4: Test each supported provider**

With a temporary private bucket, run the contract suite once against Huawei OBS and once against Alibaba OSS using separate environment files outside Git. Record required endpoint/path-style values in deployment docs; delete test objects after verifying them.

- [ ] **Step 5: Commit and run both review gates**

```bash
git add platform/package.json platform/pnpm-lock.yaml platform/src/app/api/media platform/src/lib/storage
git commit -m "feat: add portable cloud object storage"
```

Run spec review, then security-focused quality review, with fix-and-re-review loops.

---

### Task 3: AI Usage Limits And Security Hardening

**Files:**
- Create: `platform/src/features/security/rate-limit.ts`
- Create: `platform/src/features/security/rate-limit.test.ts`
- Create: `platform/src/features/security/upload-policy.ts`
- Create: `platform/src/features/security/upload-policy.test.ts`
- Create: `platform/src/proxy.ts`
- Modify: `platform/src/features/ai/deepseek-client.ts`
- Modify: `platform/src/features/content/media-actions.ts`
- Modify: `platform/next.config.ts`

**Interfaces:**
- AI limits: 10 requests/minute and configurable daily token budget for the sole administrator.
- Upload limits remain 20 MB PDF/image and 500 MB video.
- Security headers: CSP, frame-ancestors none, nosniff, strict referrer policy and HSTS in production.

- [ ] **Step 1: Write failing rate-limit tests**

Use mocked clock/database. Allow first ten requests, reject the eleventh with retry-after, reset after one minute, reject when daily token budget is exhausted, and never count failed validation as output-token usage.

- [ ] **Step 2: Implement persistent usage accounting**

Use the shared `AiUsageEvent` model and one transaction to reserve an estimated request budget before calling DeepSeek, then reconcile actual tokens from response usage. Release reservation on pre-request failure.

- [ ] **Step 3: Write and implement upload security tests**

Validate declared MIME plus magic bytes, sanitize display names, reject SVG/HTML/executables, and prevent double extensions from deciding storage type. Keep files private even when a forged filename is supplied.

- [ ] **Step 4: Add response security headers**

Build CSP from explicit self, approved font host if used, object-storage endpoint and no inline scripts except Next.js hashes/nonces. Confirm the code editor and video player still function.

- [ ] **Step 5: Run security checks**

Test unauthenticated API calls, cookie flags, API-key absence from browser bundles, upload attacks, rate-limit concurrency and CSP violations. Run lint, typecheck, tests and build.

- [ ] **Step 6: Commit and run both review gates**

```bash
git add platform/src/features/security platform/src/features/ai platform/src/features/content/media-actions.ts platform/src/proxy.ts platform/next.config.ts
git commit -m "feat: harden AI and media boundaries"
```

Run spec review, then security-focused quality review, with fix-and-re-review loops.

---

### Task 4: Distinctive Technology Visual Polish

**Files:**
- Create: `platform/src/styles/tokens.css`
- Create: `platform/src/styles/motion.css`
- Create: `platform/src/features/visuals/particle-field.tsx`
- Create: `platform/src/features/visuals/particle-field.test.tsx`
- Create: `platform/src/features/visuals/geometric-background.tsx`
- Modify: `platform/src/app/globals.css`
- Modify: `platform/src/app/layout.tsx`
- Modify: `platform/src/features/navigation/app-shell.tsx`
- Modify: dashboard, search, project, knowledge, training and learning presentation components only

**Interfaces:**
- Visual tokens expose semantic names for background, surfaces, text, borders, cyan/violet/pink accents, focus and danger.
- Particle field accepts `density: "low" | "medium"` and `disabled: boolean`.

- [ ] **Step 1: Load the required visual skill and audit existing screens**

Invoke `frontend-design`. Capture desktop and 390 px screenshots of dashboard, search, project detail, training answer and knowledge detail before changing styles.

- [ ] **Step 2: Write failing accessibility/motion tests**

Verify particles disable under `prefers-reduced-motion`, never receive pointer events, decorative geometry is aria-hidden, and text/code contrast meets WCAG AA.

- [ ] **Step 3: Implement typography and tokens**

Use Space Grotesk for Latin display headings, Noto Sans TC for Chinese/body text and JetBrains Mono for code through `next/font`; Next.js must self-host the generated font assets in the production build. Keep body/code readable and reserve Space Grotesk for headings and small system labels.

- [ ] **Step 4: Implement restrained geometry, gradients and particles**

Use geometric lines and low-density particles only behind dashboard/header areas. Keep reading and editor surfaces opaque. Disable continuous animation for reduced-motion and lower particle density on mobile.

- [ ] **Step 5: Apply consistent components without changing IA**

Polish cards, tabs, inputs, code viewer, evaluation states and navigation using shared tokens. Do not add new navigation items, reorder content or hide approved actions.

- [ ] **Step 6: Visual and accessibility verification**

Compare before/after screenshots at desktop and mobile. Run axe checks, keyboard navigation and reduced-motion tests. Confirm no glow reduces code/PDF legibility and no particle layer causes horizontal overflow.

- [ ] **Step 7: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features platform/src/styles
git commit -m "feat: apply technology-focused visual system"
```

Run spec review, then visual/code-quality review, with fix-and-re-review loops.

---

### Task 5: Docker Compose, Cloud Runbooks And Final Gate

**Files:**
- Create: `platform/Dockerfile`
- Create: `platform/docker-compose.yml`
- Create: `platform/docker-compose.production.yml`
- Create: `platform/.dockerignore`
- Create: `platform/deploy/nginx.conf`
- Create: `platform/deploy/healthcheck.ts`
- Create: `platform/scripts/backup.ps1`
- Create: `platform/scripts/restore.ps1`
- Create: `platform/docs/deployment-common.md`
- Create: `platform/docs/deployment-huawei.md`
- Create: `platform/docs/deployment-alibaba.md`
- Create: `platform/docs/operations.md`
- Create: `platform/e2e/final-acceptance.spec.ts`

**Interfaces:**
- Services: `web`, `postgres`, `nginx`; production attachments use OBS/OSS rather than container volumes.
- Health endpoint checks application and database without revealing secrets.
- Backup command exports PostgreSQL plus application archive; restore always verifies before writing.

- [ ] **Step 1: Write failing health and Compose checks**

Health returns 200 only when app and database are ready, 503 otherwise. `docker compose config` must resolve with `.env.example`-shaped test values and expose only Nginx ports 80/443.

- [ ] **Step 2: Build a non-root production image**

Use multi-stage build, pnpm lockfile enforcement, Next standalone output, non-root runtime user and read-only application filesystem. Run migrations as an explicit one-shot command before web startup, not concurrently in every replica.

- [ ] **Step 3: Configure Nginx and HTTPS boundary**

Proxy to web, set upload limits compatible with video policy, support streaming/range headers, add request timeouts appropriate for AI responses and redirect HTTP to HTTPS. Certificates remain mounted secrets outside Git.

- [ ] **Step 4: Write common and provider runbooks**

Common runbook covers domain DNS, firewall ports 22/80/443, Docker installation, secrets, migration, administrator seed, deploy, rollback and logs.

Before purchasing resources, record one explicit region choice:

- Chinese mainland ECS: complete ICP filing before public launch, display the filing number as required, and follow the applicable public-security filing process after launch.
- China (Hong Kong) or another non-mainland region: document that mainland ICP filing is not required for that hosting region, then verify latency from the user's normal mobile network before committing to the instance term.

Huawei runbook uses ECS plus a private OBS bucket in the same region, records OBS intranet endpoint, least-privilege IAM credentials and backup lifecycle.

Alibaba runbook uses ECS plus a private OSS bucket in the same region, records internal OSS endpoint, least-privilege RAM credentials and backup lifecycle.

- [ ] **Step 5: Implement and test backup/restore scripts**

Scripts require explicit paths, timestamp outputs, compute SHA-256, never overwrite an existing backup and perform restore verification before database/content writes. Test a full restore into a clean disposable environment.

- [ ] **Step 6: Run final automated acceptance**

```bash
cd platform
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
docker compose config
docker build -t worldskills-platform:test .
```

E2E covers login, knowledge browse, search, project/video/code, import preview, all training modes, evaluation retry, learning conversion, offline cached reading and backup dry-run.

- [ ] **Step 7: Run final manual acceptance**

On a real phone verify installability, bottom navigation, Chinese keyboard input, CodeMirror horizontal scroll, video playback, offline recently viewed content and reconnect draft sync. On the chosen cloud verify HTTPS, private object access, DeepSeek call, backup download and restore rehearsal.

- [ ] **Step 8: Commit and run both review gates**

```bash
git add platform/Dockerfile platform/docker-compose*.yml platform/.dockerignore platform/deploy platform/scripts platform/docs platform/e2e/final-acceptance.spec.ts
git commit -m "feat: complete production deployment"
```

Run final spec review and final code-quality/security review. Only after both approvals mark the platform implementation complete.

## Official Cloud References

- Huawei OBS: `https://support.huaweicloud.com/intl/en-us/usermanual-obs/en-us_topic_0045853662.html`
- Huawei ECS-to-OBS intranet: `https://support.huaweicloud.com/intl/en-us/bestpractice-obs/obs_05_0410.html`
- Alibaba ECS Docker Compose: `https://help.aliyun.com/en/ecs/user-guide/install-and-use-docker`
- Alibaba OSS bucket: `https://help.aliyun.com/en/oss/user-guide/create-a-bucket-4`
- Huawei ICP filing overview: `https://support.huaweicloud.com/intl/en-us/icprb-icp/ICP%20Filing-Service%20Overview.pdf`
- Alibaba personal website ICP filing: `https://help.aliyun.com/en/icp-filing/basic-icp-service/getting-started/quick-start-for-icp-filing-for-personal-websites`
