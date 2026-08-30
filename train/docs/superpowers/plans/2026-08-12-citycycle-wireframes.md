# CityCycle Wireframes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one technical-neutral tablet wireframe to each of the six functional page sections in the CityCycle competition PDF.

**Architecture:** Extend the existing ReportLab builder with reusable wireframe primitives and six page-specific compositions. Insert each drawing immediately after the matching numbered page heading and verify the resulting PDF visually and structurally.

**Tech Stack:** Python, ReportLab, Poppler, pypdf.

## Global Constraints

- Every one of the six application pages must have exactly one wireframe.
- Application-facing text is English and enclosed in quotation marks in the written requirements.
- Wireframes describe layout and content only; they do not prescribe implementation technology or exact styling.
- Existing functionality requirements and JSON files remain unchanged.

---

### Task 1: Reusable Wireframe Renderer

**Files:**
- Modify: `build_citycycle_md_pdf.py`

**Interfaces:**
- Consumes: a page key detected from each numbered Markdown heading.
- Produces: `make_wireframe(page_key, styles)` returning a ReportLab flowable.

- [ ] Add reusable box, label, navigation, input, card, list and button drawing helpers.
- [ ] Add six page-specific layouts with all required visible regions.
- [ ] Insert each drawing directly after its corresponding page heading.
- [ ] Generate the PDF and confirm the renderer completes without errors.

### Task 2: Verification

**Files:**
- Verify: `Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.pdf`

**Interfaces:**
- Consumes: the generated PDF.
- Produces: a visually checked final PDF containing six unique wireframes.

- [ ] Extract PDF text and assert all six page names and six wireframe captions exist.
- [ ] Render every PDF page to PNG using Poppler.
- [ ] Inspect all rendered pages for clipping, overlap, broken glyphs and missing diagrams.
- [ ] Remove QA intermediates and deliver the final PDF.
