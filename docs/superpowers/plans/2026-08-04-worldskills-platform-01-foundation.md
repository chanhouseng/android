# WorldSkills Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可測試、可登入並具備桌面／手機導覽的新平台骨架，供所有後續功能共用。

**Architecture:** 在 `platform/` 建立 Next.js App Router 單體。伺服器使用 Prisma 連接 PostgreSQL，自製單一管理者 Session；頁面預設由受保護 layout 包住。

**Tech Stack:** Next.js、TypeScript、Tailwind CSS、Prisma、PostgreSQL、Zod、bcryptjs、Vitest、Testing Library、Playwright、pnpm。

## Global Constraints

- 執行前先閱讀 `docs/superpowers/specs/2026-08-03-worldskills-kotlin-learning-platform-design.md` 和 `docs/superpowers/plans/2026-08-04-worldskills-platform-roadmap.md`。
- 使用 `superpowers:using-git-worktrees` 建立 Foundation 工作樹；分支為 `codex/worldskills-foundation`。
- 新應用只放在 `platform/`，不得修改現有學習內容。
- 所有業務頁面必須登入後才能進入；不建立註冊功能。
- 每項任務完成後按 roadmap 的 Review Protocol 執行規格審查及品質審查。

---

### Task 1: Scaffold Next.js And Test Harness

**Files:**
- Create: `platform/package.json`
- Create: `platform/pnpm-lock.yaml`
- Create: `platform/src/app/layout.tsx`
- Create: `platform/src/app/page.tsx`
- Create: `platform/src/lib/app-metadata.ts`
- Create: `platform/src/lib/app-metadata.test.ts`
- Create: `platform/vitest.config.ts`
- Create: `platform/vitest.setup.ts`
- Create: `platform/playwright.config.ts`
- Create: `.gitignore`

**Interfaces:**
- Produces: `APP_NAME: "KOTLIN//LAB"` and `APP_DESCRIPTION: string` from `@/lib/app-metadata`.
- Produces package scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`.

- [ ] **Step 1: Create the application scaffold**

Run from repository root:

```bash
pnpm dlx create-next-app@latest platform --ts --eslint --tailwind --app --src-dir --import-alias "@/*" --use-pnpm
cd platform
pnpm add zod
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

- [ ] **Step 2: Add test scripts and Vitest configuration**

Add these scripts to `platform/package.json`:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Create `platform/vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

Create `platform/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Write the failing metadata test**

Create `platform/src/lib/app-metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { APP_DESCRIPTION, APP_NAME } from "./app-metadata";

describe("app metadata", () => {
  it("uses the approved product identity", () => {
    expect(APP_NAME).toBe("KOTLIN//LAB");
    expect(APP_DESCRIPTION).toContain("WorldSkills");
  });
});
```

- [ ] **Step 4: Run the test and verify the missing module failure**

Run: `cd platform && pnpm test -- src/lib/app-metadata.test.ts`

Expected: FAIL because `./app-metadata` does not exist.

- [ ] **Step 5: Add the minimal metadata module and root layout**

Create `platform/src/lib/app-metadata.ts`:

```ts
export const APP_NAME = "KOTLIN//LAB";
export const APP_DESCRIPTION = "WorldSkills Android Kotlin 備賽平台";
```

Use these constants in `src/app/layout.tsx` metadata and make `src/app/page.tsx` render the product name plus `系統準備中`.

- [ ] **Step 6: Verify the foundation harness**

Run:

```bash
cd platform
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 7: Commit the task**

```bash
git add .gitignore platform
git commit -m "chore: scaffold WorldSkills platform"
```

- [ ] **Step 8: Run both review gates**

Dispatch a spec reviewer, fix and re-review any gap; then dispatch a code-quality reviewer, fix and re-review any issue. Record both approvals before Task 2.

---

### Task 2: Environment Validation And Database Foundation

**Files:**
- Create: `platform/.env.example`
- Create: `platform/src/lib/env.ts`
- Create: `platform/src/lib/env.test.ts`
- Create: `platform/src/lib/db.ts`
- Create: `platform/prisma/schema.prisma`
- Create: `platform/prisma/seed.ts`
- Create: `platform/docker-compose.dev.yml`
- Modify: `platform/package.json`
- Modify: `platform/.gitignore`

**Interfaces:**
- Produces: one stable `env` contract for all worktrees: database/session/admin values; `LEGACY_CONTENT_ROOT`; `LOCAL_STORAGE_ROOT`; `STORAGE_DRIVER`; DeepSeek key/base URL/model/daily budget; S3 endpoint/region/bucket/access keys/path style.
- Produces: singleton `db: PrismaClient` from `@/lib/db`.
- Produces Prisma models `AdminUser` and `Session`.

- [ ] **Step 1: Install database dependencies**

```bash
cd platform
pnpm add @prisma/client bcryptjs
pnpm add -D prisma tsx @types/bcryptjs
```

Add scripts `db:generate`, `db:migrate`, `db:seed` using `prisma generate`, `prisma migrate dev`, and `tsx prisma/seed.ts`.

- [ ] **Step 2: Write the failing environment tests**

Create `platform/src/lib/env.test.ts` that calls an exported `parseEnv(input)` and verifies:

```ts
expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
expect(parseEnv(validInput).ADMIN_EMAIL).toBe("admin@example.com");
expect(parseEnv(validInput).DEEPSEEK_API_KEY).toBeUndefined();
```

- [ ] **Step 3: Run the environment test and verify failure**

Run: `cd platform && pnpm test -- src/lib/env.test.ts`

Expected: FAIL because `parseEnv` is missing.

- [ ] **Step 4: Implement strict environment parsing**

Create `platform/src/lib/env.ts` with a Zod schema. Require database URL, a session secret of at least 32 characters, valid admin email, an admin password of at least 12 characters, `LEGACY_CONTENT_ROOT` and `LOCAL_STORAGE_ROOT`. Set these exact defaults: `STORAGE_DRIVER=local`, `DEEPSEEK_BASE_URL=https://api.deepseek.com`, `DEEPSEEK_MODEL=deepseek-v4-flash`, `AI_DAILY_TOKEN_BUDGET=200000`, `S3_FORCE_PATH_STYLE=false`. Keep DeepSeek API Key and S3 credentials optional during Foundation; add conditional validation so `STORAGE_DRIVER=s3` requires endpoint, region, bucket and both access keys.

```ts
export function parseEnv(input: NodeJS.ProcessEnv) {
  return schema.parse(input);
}

export const env = parseEnv(process.env);
```

- [ ] **Step 5: Define the authentication schema**

Create `platform/prisma/schema.prisma` with PostgreSQL datasource and these exact models:

```prisma
model AdminUser {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  createdAt    DateTime  @default(now())
  sessions     Session[]
}

model Session {
  id        String    @id @default(cuid())
  tokenHash String    @unique
  expiresAt DateTime
  createdAt DateTime  @default(now())
  userId    String
  user      AdminUser @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Create `docker-compose.dev.yml` with one PostgreSQL service bound to `127.0.0.1:5432`, a named development volume and credentials matching a non-production `.env.local`. Do not expose PostgreSQL on public interfaces.

- [ ] **Step 6: Add the Prisma singleton and idempotent seed**

`src/lib/db.ts` must reuse a global Prisma client in development. `prisma/seed.ts` must hash `ADMIN_PASSWORD` with bcryptjs and upsert the single administrator by `ADMIN_EMAIL`; it must never print the password or hash.

- [ ] **Step 7: Verify schema and tests**

Start the isolated development database, then validate:

```bash
cd platform
docker compose -f docker-compose.dev.yml up -d postgres
pnpm db:generate
pnpm exec prisma validate
pnpm exec prisma migrate dev --name init_auth
pnpm db:seed
pnpm test -- src/lib/env.test.ts
pnpm typecheck
```

Expected: all commands exit 0.

- [ ] **Step 8: Commit and run both review gates**

```bash
git add platform/.env.example platform/.gitignore platform/package.json platform/pnpm-lock.yaml platform/prisma platform/src/lib
git commit -m "feat: add database and environment foundation"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 3: Single-Administrator Authentication

**Files:**
- Create: `platform/src/features/auth/password.ts`
- Create: `platform/src/features/auth/session.ts`
- Create: `platform/src/features/auth/session.test.ts`
- Create: `platform/src/features/auth/actions.ts`
- Create: `platform/src/features/auth/login-form.tsx`
- Create: `platform/src/app/login/page.tsx`
- Create: `platform/src/app/logout/route.ts`
- Create: `platform/src/app/(protected)/layout.tsx`
- Create: `platform/src/app/(protected)/page.tsx`
- Delete: `platform/src/app/page.tsx`

**Interfaces:**
- Produces: `login(formData: FormData): Promise<LoginState>` server action.
- Produces: `createSession(userId: string): Promise<void>`, `getCurrentUser(): Promise<AdminUser | null>`, `requireCurrentUser(): Promise<AdminUser>`, `deleteCurrentSession(): Promise<void>`.
- Cookie name: `worldskills_session`; token lifetime: 7 days.

- [ ] **Step 1: Write failing token hashing tests**

Test that `createRawSessionToken()` returns two different 64-character hex tokens and that `hashSessionToken("abc")` returns a stable SHA-256 hex digest without exposing the raw token.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd platform && pnpm test -- src/features/auth/session.test.ts`

Expected: FAIL because the session helpers do not exist.

- [ ] **Step 3: Implement session primitives**

Use `node:crypto`:

```ts
export const SESSION_COOKIE = "worldskills_session";
export const createRawSessionToken = () => randomBytes(32).toString("hex");
export const hashSessionToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
```

`createSession` stores only the hash in PostgreSQL and writes a Secure, HttpOnly, SameSite=Lax cookie. `getCurrentUser` hashes the cookie value, rejects expired sessions, and returns the related administrator. `requireCurrentUser` redirects to `/login` when absent.

- [ ] **Step 4: Write failing login action tests**

Mock the database and cookie boundary. Verify an unknown email or wrong password returns the same message `電郵或密碼不正確`, a correct password calls `createSession`, and no result contains the password hash.

- [ ] **Step 5: Implement login, logout and protected layout**

Validate FormData with Zod, compare using `bcrypt.compare`, and redirect successful login to `/`. The protected layout calls `requireCurrentUser`. Move the scaffold homepage content into `src/app/(protected)/page.tsx` and delete `src/app/page.tsx`, so only the protected route group owns `/`. The logout route deletes the database session, clears the cookie and redirects to `/login`.

- [ ] **Step 6: Add the login UI**

Create an accessible form with email, password, submit button, pending state and a generic error region using `aria-live="polite"`. Do not add registration or password-reset links.

- [ ] **Step 7: Verify authentication**

Run:

```bash
cd platform
pnpm test -- src/features/auth
pnpm lint
pnpm typecheck
pnpm build
```

Manually confirm `/` redirects to `/login`, correct credentials enter the app, logout clears access, and the cookie is HttpOnly.

- [ ] **Step 8: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/auth
git commit -m "feat: add single-admin authentication"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 4: Responsive Application Shell And Navigation

**Files:**
- Create: `platform/src/features/navigation/nav-items.ts`
- Create: `platform/src/features/navigation/nav-items.test.ts`
- Create: `platform/src/features/navigation/desktop-sidebar.tsx`
- Create: `platform/src/features/navigation/mobile-bottom-nav.tsx`
- Create: `platform/src/features/navigation/mobile-menu.tsx`
- Create: `platform/src/features/navigation/app-shell.tsx`
- Create: `platform/src/app/(protected)/[feature]/page.tsx`
- Modify: `platform/src/app/(protected)/page.tsx`
- Modify: `platform/src/app/(protected)/layout.tsx`
- Modify: `platform/src/app/globals.css`

**Interfaces:**
- Produces: `PRIMARY_NAV_ITEMS: NavItem[]`, `SECONDARY_NAV_ITEMS: NavItem[]`.
- `NavItem` fields: `label`, `href`, `icon`, `mobilePrimary`.
- Mobile primary order must be `/`, `/search`, `/training`, `/projects`.

- [ ] **Step 1: Write the failing navigation contract test**

```ts
expect(PRIMARY_NAV_ITEMS.filter((item) => item.mobilePrimary).map((item) => item.href))
  .toEqual(["/", "/search", "/training", "/projects"]);
expect(SECONDARY_NAV_ITEMS.map((item) => item.href)).toContain("/knowledge");
```

- [ ] **Step 2: Run the test and verify failure**

Run: `cd platform && pnpm test -- src/features/navigation/nav-items.test.ts`

Expected: FAIL because navigation contracts are missing.

- [ ] **Step 3: Implement approved navigation data**

Desktop order: dashboard, search, training, projects, knowledge, learning, documents, admin. Mobile bottom order: dashboard, search, training, projects. Mobile menu includes knowledge, learning, documents, admin and logout.

- [ ] **Step 4: Build responsive shell components**

Use semantic `<nav>` elements, `aria-current="page"`, visible keyboard focus and a skip link. Desktop sidebar appears from `lg`; bottom navigation appears below `lg` and reserves page padding so it never covers content.

- [ ] **Step 5: Add restrained visual tokens**

In `globals.css` define named CSS variables for background, surface, border, text, muted text, neon cyan, violet and danger. Implement dark surfaces and focus states now; defer particles and decorative animation to the deployment/polish plan.

- [ ] **Step 6: Add the dashboard skeleton**

The protected homepage must render the search field and links for AI training, projects, all knowledge points, learning items and recent content. Each link uses the approved route. Add a dynamic first-level page that accepts only `search`, `training`, `projects`, `knowledge`, `learning`, `documents`, `admin` and renders `此功能尚未在目前階段啟用`; call `notFound()` for every other value. Later static route files take precedence and replace these interim views without editing this catch-all page.

- [ ] **Step 7: Verify shell behavior**

Run:

```bash
cd platform
pnpm test -- src/features/navigation
pnpm lint
pnpm typecheck
pnpm build
```

At 390 px width confirm four bottom items in the exact order. At 1280 px confirm the full sidebar and no bottom bar. Keyboard through every link and confirm visible focus.

- [ ] **Step 8: Commit and run both review gates**

```bash
git add platform/src/app platform/src/features/navigation
git commit -m "feat: add responsive authenticated shell"
```

Run spec review, then quality review, with fix-and-re-review loops.

---

### Task 5: Foundation End-To-End Gate

**Files:**
- Create: `platform/e2e/auth-navigation.spec.ts`
- Create: `platform/e2e/helpers/auth.ts`
- Modify: `platform/playwright.config.ts`
- Create: `.github/workflows/platform-quality.yml`
- Create: `platform/README.md`

**Interfaces:**
- Produces: repeatable local quality commands and authenticated Playwright helper `loginAsAdmin(page)`.

- [ ] **Step 1: Write the failing E2E scenarios**

Cover unauthenticated redirect, invalid login, valid login, desktop sidebar links, mobile bottom-nav order and logout. Use environment credentials from the seeded test administrator.

- [ ] **Step 2: Run E2E and verify the intended failure**

Run: `cd platform && pnpm test:e2e -- e2e/auth-navigation.spec.ts`

Expected: FAIL until test database startup, seed and webServer settings are connected.

- [ ] **Step 3: Configure isolated E2E execution**

Configure Playwright `webServer` to run the Next test server and set `baseURL`. Document commands to start PostgreSQL, migrate, seed and run E2E. Never use the production database URL.

- [ ] **Step 4: Add the quality workflow**

`.github/workflows/platform-quality.yml` must set `defaults.run.working-directory: platform`, install pnpm with lockfile enforcement, start PostgreSQL service, migrate, seed, then run lint, typecheck, unit tests and build. Keep browser E2E as a separate job after installing the Playwright Chromium dependency.

- [ ] **Step 5: Run the full Foundation gate**

```bash
cd platform
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit and run both review gates**

```bash
git add .github/workflows/platform-quality.yml platform/e2e platform/playwright.config.ts platform/README.md
git commit -m "test: add foundation acceptance gate"
```

Run spec review, then quality review. After both approvals, merge Foundation into `codex/worldskills-platform` before creating the Content worktree.
