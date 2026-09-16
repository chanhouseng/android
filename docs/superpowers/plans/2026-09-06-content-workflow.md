# Content Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, repeatable metadata-driven workflow for Homework and World Skill index content.

**Architecture:** Keep static HTML as the deployed output. JSON metadata is validated and rendered through shared Node.js helpers into explicit generated regions; draft creation and single-folder Training publication use the same validation and containment rules.

**Tech Stack:** Vanilla HTML/CSS/JavaScript and Node.js built-in modules only.

**Spec:** `docs/superpowers/specs/2026-09-06-content-workflow-design.md`

## Global Constraints

- Preserve all existing public URLs, titles, descriptions, images, links, order, page layout, and teaching content.
- Never scan the whole `train/` tree in the new publisher.
- Do not modify `training/index.html`.
- Do not add dependencies.
- All generated user text must be HTML escaped.

---

### Task 1: Lock the workflow contracts with tests

**Files:**
- Create: `tests/content-workflow.test.mjs`

**Interfaces:**
- Consumes: current indexes and `training/files.json`.
- Produces: behavioral contracts for the content data and four CLI modules.

- [ ] Write tests for preservation, rendering, drafts, validation, publishing safety, idempotency, and check mode.
- [ ] Run `node --test tests/content-workflow.test.mjs` and confirm failures are caused by missing workflow files.

### Task 2: Add canonical content data and deterministic index builder

**Files:**
- Create: `content/homework.json`
- Create: `content/world-skills.json`
- Create: `scripts/content-core.mjs`
- Create: `scripts/build-content-indexes.mjs`
- Modify: `homework/index.html`
- Modify: `world skill/index.html`

**Interfaces:**
- Consumes: validated arrays ordered by positive integer `order`.
- Produces: `renderHomeworkCards(items)`, `renderWorldSkillSections(items)`, `buildContentIndexes(options)`.

- [ ] Extract the exact 33 Homework and 42 World Skill records from current HTML.
- [ ] Implement escaped deterministic renderers and marker replacement.
- [ ] Run the targeted tests, build once, then verify `--check` and a second build are byte-identical.

### Task 3: Add draft creation

**Files:**
- Create: `scripts/new-content.mjs`

**Interfaces:**
- Consumes: content kind, safe ID, and project root.
- Produces: one draft JSON record and one non-published App Shell detail page.

- [ ] Implement strict ID and collision validation with exclusive writes and rollback.
- [ ] Run draft creation tests for Homework, Exercise, duplicates, and traversal.

### Task 4: Add content validation

**Files:**
- Create: `scripts/validate-content.mjs`

**Interfaces:**
- Consumes: both JSON files, generated indexes, local files, and manifest folders.
- Produces: actionable diagnostics and a nonzero exit status on invalid content.

- [ ] Validate schema, uniqueness, order, containment, exact-case resources, Accordion IDs, draft exclusion, and generated links.
- [ ] Run success and isolated failure-case tests.

### Task 5: Add safe single-folder Training publishing

**Files:**
- Create: `scripts/publish-training-folder.mjs`

**Interfaces:**
- Consumes: one direct Training folder and the compatible manifest array.
- Produces: an atomic manifest merge preserving every other entry.

- [ ] Implement direct-child containment, symlink and sensitive-file rejection, recursive local scan, compatible entries, and deterministic merge.
- [ ] Run safe merge and no-write-on-error tests.

### Task 6: Document and verify the complete workflow

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the implemented commands.
- Produces: end-user steps for draft, assets, publication, validation, and rebuild.

- [ ] Document both content flows and the legacy full-scan warning.
- [ ] Run validation, check mode, targeted tests, the full test suite, link checks, and `git diff --check`.
