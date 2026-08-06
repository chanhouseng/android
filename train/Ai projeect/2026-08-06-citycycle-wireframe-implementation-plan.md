# CityCycle Wireframe Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six competition-style monochrome tablet wireframes to the existing CityCycle Functionality Test Word document without changing its JSON data or 15-point assessment logic.

**Architecture:** A deterministic Python/Pillow builder renders six 1600 x 1000 PNG wireframes from explicit drawing functions. A python-docx integration pass inserts each image, caption, neutrality note, and callout legend immediately before the next page-demand subsection, then structural checks reopen the DOCX and inspect OOXML image metadata.

**Tech Stack:** Bundled Python runtime, Pillow, python-docx, OOXML inspection, PowerShell hashing, packaged DOCX renderer when LibreOffice is available.

## Global Constraints

- Monochrome and greyscale only.
- Tablet landscape canvas using a 16:10 proportion.
- Use the exact English UI strings already required by the task.
- Do not use Android, iOS, Flutter, React Native, or native-widget styling.
- Every figure includes `Wireframe is for layout reference only.`
- Existing marking values remain unchanged at exactly 15.0 points.
- All six existing JSON files must remain byte-for-byte unchanged.

---

### Task 1: Build deterministic wireframe assets

**Files:**
- Create: `C:/tmp/citycycle_wireframes.py`
- Create: `train/Ai projeect/media-files/wireframes/WF-01-dashboard.png`
- Create: `train/Ai projeect/media-files/wireframes/WF-02-station-management.png`
- Create: `train/Ai projeect/media-files/wireframes/WF-03-rental-console.png`
- Create: `train/Ai projeect/media-files/wireframes/WF-04-active-rentals.png`
- Create: `train/Ai projeect/media-files/wireframes/WF-05-smart-assistant.png`
- Create: `train/Ai projeect/media-files/wireframes/WF-06-rental-history.png`

**Interfaces:**
- Consumes: screen definitions keyed by `WF-01` through `WF-06`.
- Produces: `render_all(output_dir: Path) -> list[Path]`, returning six 1600 x 1000 RGB PNG paths.

- [ ] **Step 1: Record pre-edit JSON hashes**

Run `Get-FileHash -Algorithm SHA256 train/Ai projeect/media-files/data/*.json` and save the six hash values in memory for Task 3 comparison.

- [ ] **Step 2: Write reusable drawing primitives**

Implement `canvas()`, `panel()`, `label()`, `button()`, `field()`, `chip()`, `callout()`, and `footer_note()` with fixed greyscale tokens and Segoe UI-compatible fonts.

- [ ] **Step 3: Implement six screen renderers**

Implement `draw_dashboard`, `draw_station_management`, `draw_rental_console`, `draw_active_rentals`, `draw_smart_assistant`, and `draw_rental_history`. Each must include the controls and data regions listed in the approved design specification.

- [ ] **Step 4: Generate and validate assets**

Run the builder and assert that exactly six PNGs exist, each reports mode `RGB` and size `(1600, 1000)`, and each file is larger than 20 KB.

### Task 2: Integrate wireframes into the Word task

**Files:**
- Modify: `train/Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`
- Reuse: `C:/tmp/citycycle_wireframes.py`

**Interfaces:**
- Consumes: six PNG paths and section titles `1. Dashboard` through `6. Rental History`.
- Produces: `insert_wireframes(docx_path: Path, figures: list[WireframeSpec]) -> None`.

- [ ] **Step 1: Locate insertion boundaries**

For every target Heading 2 paragraph, locate the next Heading 2 or Heading 1 paragraph. Fail before writing if any target or boundary is missing.

- [ ] **Step 2: Insert each wireframe block**

Before the boundary, insert a page break, `Wireframe` Heading 3, figure caption, 6.45-inch-wide PNG, the exact neutrality statement, and a numbered callout legend. Apply keep-with-next and centered alignment where appropriate.

- [ ] **Step 3: Add accessibility metadata**

Set each picture's OOXML `wp:docPr/@name` to its figure ID and `wp:docPr/@descr` to a concise screen-specific alternative description.

- [ ] **Step 4: Save atomically**

Save to a sibling temporary DOCX, reopen it with python-docx, and replace the original only after structural validation succeeds.

### Task 3: Verify content integrity

**Files:**
- Verify: `train/Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`
- Verify: `train/Ai projeect/media-files/data/*.json`

**Interfaces:**
- Consumes: updated DOCX, pre-edit JSON hashes, expected figure IDs.
- Produces: a zero-exit validation report.

- [ ] **Step 1: Validate DOCX structure**

Reopen the document and assert six inline pictures, six `Wireframe is for layout reference only.` notes, six expected figure captions, all original Heading 1/2 sections, and visible `15.0` marking text.

- [ ] **Step 2: Validate OOXML metadata and placement**

Inspect `word/document.xml` and relationships to verify six media relationships, six non-empty alternative descriptions, and that each figure ID occurs between its target Heading 2 and the following page-demand heading.

- [ ] **Step 3: Confirm JSON immutability**

Re-run SHA-256 hashing and require exact equality with the six Task 1 hashes.

- [ ] **Step 4: Run accessibility audit**

Run the packaged `a11y_audit.py` and confirm the newly inserted images have alternative text. Report unrelated pre-existing document warnings separately.

### Task 4: Render and inspect delivery

**Files:**
- Verify: `train/Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`
- Temporary: visualization workspace render directory.

**Interfaces:**
- Consumes: structurally validated DOCX.
- Produces: page PNGs for internal QA when LibreOffice is available.

- [ ] **Step 1: Render the DOCX**

Run packaged `render_docx.py` against the updated Word file. If `soffice` is unavailable, record the permitted documents-skill fallback and do not claim visual render QA.

- [ ] **Step 2: Inspect all rendered pages**

At 100% zoom, verify readable labels, no clipping or overlap, consistent figure scaling, and clean page breaks. If rendering succeeded and a defect appears, adjust image width or paragraph spacing and repeat.

- [ ] **Step 3: Run final verification and clean temporary files**

Repeat Task 3 checks after the last edit, remove the temporary builder and QA-only render output, and leave the six wireframe PNG source assets with the Word deliverable.

