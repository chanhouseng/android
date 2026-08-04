# CityCycle Functionality Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a competition-style Traditional Chinese Word test project and six internally consistent JSON data files for the CityCycle Operations Functionality module.

**Architecture:** A temporary bundled-Python builder owns deterministic JSON generation, reference validation, DOCX construction, and structural assertions. The final folder contains only the requested DOCX, JSON data, and the approved specification/plan; render PNGs remain in a temporary QA directory and are removed after inspection.

**Tech Stack:** Bundled Python 3, `python-docx`, standard-library `json`, document skill `render_docx.py`, Poppler rendering through the bundled runtime.

## Global Constraints

- Output directory: `C:/Users/chanh/Desktop/andorid/website/train/Ai projeect/`.
- Document language: Traditional Chinese; quoted UI strings remain English.
- Module: Functionality; duration: 2.5 hours; tablet landscape; technology neutral; offline core operation.
- DOCX structure follows `2024_module_c_am/module_c_am.pdf`: cover, contents, introduction, description, general demands, page demands, instructions, and marking scheme.
- Document style preset: `compact_reference_guide` with a named `competition_editorial_cover` override using navy `#073B5C`, teal `#0B8EAD`, mint `#88E2D2`, and an `editorial_cover` opening pattern.
- Final marking aspects total exactly 15.0 points.
- Final monetary values use two-decimal rounding after the full calculation.

---

### Task 1: Generate and validate deterministic JSON data

**Files:**
- Create: `C:/tmp/build_citycycle_artifacts.py`
- Create: `Ai projeect/media-files/data/stations.json`
- Create: `Ai projeect/media-files/data/bikes.json`
- Create: `Ai projeect/media-files/data/pricing_rules.json`
- Create: `Ai projeect/media-files/data/members.json`
- Create: `Ai projeect/media-files/data/active_rentals.json`
- Create: `Ai projeect/media-files/data/rental_history.json`

**Interfaces:**
- Produces station, bike, plan, member, active-rental, and history IDs consumed by the Word test cases.
- Produces `validate_data(output_dir: Path) -> dict[str, int]`, raising `AssertionError` on invalid references, capacity overflow, duplicate IDs, invalid rented-bike links, or missing rental-limit fixture.

- [ ] **Step 1: Implement deterministic datasets and `validate_data`**

```python
def unique(records, key):
    values = [record[key] for record in records]
    assert len(values) == len(set(values))

def validate_data(output_dir):
    stations = load_json(output_dir / "stations.json")["stations"]
    bikes = load_json(output_dir / "bikes.json")["bikes"]
    rentals = load_json(output_dir / "active_rentals.json")["active_rentals"]
    unique(stations, "station_id")
    unique(bikes, "bike_id")
    unique(rentals, "rental_id")
    assert sum(r["member_id"] == "M005" for r in rentals) == 2
```

- [ ] **Step 2: Run JSON generation and validation**

Run:

```powershell
& 'C:\Users\chanh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' C:\tmp\build_citycycle_artifacts.py --data-only
```

Expected: six JSON files and `JSON validation passed` with counts for 8 stations, 30 bikes, 3 plans, 6 members, 3 active rentals, and 18 history records.

### Task 2: Build the competition-style Word document

**Files:**
- Modify: `C:/tmp/build_citycycle_artifacts.py`
- Create: `Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`

**Interfaces:**
- Consumes exact IDs and expected results from Task 1.
- Produces a DOCX containing headings, numbered requirements, fixed-width tables, headers/footers, and a 15.0-point marking table.

- [ ] **Step 1: Configure page geometry and named styles**

```python
section.page_width = Inches(8.5)
section.page_height = Inches(11)
section.top_margin = Inches(0.72)
section.bottom_margin = Inches(0.72)
section.left_margin = Inches(0.78)
section.right_margin = Inches(0.78)
```

Use Aptos for Latin text and Microsoft JhengHei for East Asian text. Encode Normal, Heading 1, Heading 2, Heading 3, list, table, header, and footer spacing explicitly.

- [ ] **Step 2: Build cover, contents, and opening sections**

The cover says `Practice Test Project`, `Module A Functionality`, `CityCycle Operations`, `Mobile Applications Development`, `2.5 hours`, `Tablet - Landscape`, and `Technology Neutral`. The contents uses a static page-aware list that is checked against the final render.

- [ ] **Step 3: Build General Demands and six page-demand sections**

Each module contains separate `Elements include:` and `Functional requirements:` headings. Requirements include exact state formulas, sorting tie-breakers, validation, pricing calculations, timestamp recovery, drag-and-drop rejection, assistant answers, and three accepted date formats.

- [ ] **Step 4: Build instructions and detailed marking scheme**

The marking table contains columns `ID`, `Aspect`, `Type`, and `Mark`. Programmatically assert:

```python
assert round(sum(item["mark"] for item in marking_items), 2) == 15.00
```

- [ ] **Step 5: Save and structurally inspect DOCX**

Run the builder without `--data-only`, reopen the saved DOCX with `python-docx`, and assert required headings, quoted UI strings, six data filenames, and `Total 15.0` are present.

### Task 3: Render and visually verify every DOCX page

**Files:**
- Read: `Ai projeect/CityCycle_Functionality_Test_Project_zh-TW.docx`
- Create temporary: visualization QA `citycycle_docx_render/page-*.png`

**Interfaces:**
- Consumes the DOCX from Task 2.
- Produces visual evidence for layout approval; no QA image is a final deliverable.

- [ ] **Step 1: Render the DOCX**

Run:

```powershell
& 'C:\Users\chanh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\chanh\.codex\plugins\cache\openai-primary-runtime\documents\26.802.11031\skills\documents\render_docx.py' 'C:\Users\chanh\Desktop\andorid\website\train\Ai projeect\CityCycle_Functionality_Test_Project_zh-TW.docx' --output_dir 'C:\Users\chanh\.codex\visualizations\2026\08\03\019fc7f8-82b9-7b00-9a7e-24a17a68b35e\citycycle_docx_render' --emit_pdf
```

Expected: one PNG per Word page and a non-empty PDF in the QA directory.

- [ ] **Step 2: Inspect every PNG at 100%**

Check cover geometry, contents alignment, all headings, list wrapping, formulas, table cell padding, repeated marking headers, header/footer placement, page numbering, Chinese glyphs, and absence of clipping or overlap.

- [ ] **Step 3: Patch and re-render if defects exist**

Only adjust builder tokens or intentional page breaks, regenerate the DOCX, and repeat the full render inspection.

### Task 4: Final verification and cleanup

**Files:**
- Verify all six JSON files and final DOCX.
- Remove temporary builder and QA render directory after validation.

**Interfaces:**
- Produces the final user-facing artifact set.

- [ ] **Step 1: Run fresh data/document checks**

```powershell
& 'C:\Users\chanh\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' C:\tmp\build_citycycle_artifacts.py --verify-only
```

Expected: `JSON validation passed`, `DOCX structural validation passed`, and marking total `15.0`.

- [ ] **Step 2: Confirm output inventory**

Expected final requested files: one DOCX plus six JSON files. Confirm no render PNG/PDF is present in `Ai projeect`.

- [ ] **Step 3: Remove temporary build and render files**

Delete only the exact temporary builder and QA directory created by this plan, after resolving and confirming their absolute paths.
