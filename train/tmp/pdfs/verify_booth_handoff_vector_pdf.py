from pathlib import Path

import pdfplumber
from PIL import Image
from pypdf import PdfReader

from vector_wireframes import WIRE_TYPES


ROOT = Path(__file__).resolve().parents[2]
PDF = ROOT / "output" / "pdf" / "Booth_Handoff_Module_A_3.5h_zh-TW.pdf"
RENDER_DIR = ROOT / "tmp" / "pdfs" / "vector_render_final"

EXPECTED_BY_PAGE = {
    3: ["Booth Handoff", "Import a handoff file to review the booth before taking over.", "Import File", "A1", "A2", "A3"],
    4: ["South Hall", "3 items", "2 of 3 acknowledged", "Continue Draft", "North Gate", "2026-08-31 12:20", "View Receipt", "Import File"],
    6: [
        "Import Review", "File: handoff_conflicts.bhf", "Booth: South Hall", "4 items", "1 duplicate",
        "Resolve duplicates to continue", "ST-001", "Counter tablet", "Ready", "Charged", "Duplicate",
        "ST-002", "Cable box", "Issue", "Seal is open", "Missing", "No note", "ST-003", "Sign holder", "Clean",
        "Cancel Import", "Choose Another File", "Continue",
    ],
    7: [
        "Import Review", "File: handoff_invalid.bhf", "Booth: East Desk", "Import unavailable",
        "File needs attention", "Problems", 'Line 3: Unsupported status "BROKEN".',
        "Line 4: Expected 4 item fields.", "Cancel Import", "Choose Another File",
    ],
    9: [
        "Resolve Duplicates", "Choose one record for each duplicate ID.", "Conflict 1 of 1", "ID: ST-001",
        "First record", "Counter tablet", "Ready", "Charged", "Later record", "Missing", "No note", "Back", "Use Selected",
    ],
    10: ["Resolve Duplicates", "First record", "Selected", "Later record", "Use Selected"],
    12: [
        "Handoff Check", "Booth: South Hall", "3 items", "Review every item before confirming.",
        "ST-001", "Counter tablet", "Ready", "Charged", "Acknowledged",
        "ST-002", "Cable box", "Issue", "Seal is open",
        "ST-003", "Sign holder", "Clean", "2 of 3 acknowledged", "Back", "Confirm Handoff",
    ],
    13: [
        "Handoff Check", "ST-001", "Counter tablet", "Ready", "Charged", "ST-002", "Cable box", "Issue",
        "Seal is open", "ST-003", "Sign holder", "Clean", "3 of 3 acknowledged", "Confirm Handoff",
    ],
    14: ["Confirm Handoff", "This will lock the current handoff.", "Cancel", "Confirm", "E1", "E2", "E3", "E4"],
    16: [
        "Handoff Receipt", "Booth: South Hall", "Confirmed: 2026-08-31 14:05", "Ready", "2", "Issue", "1",
        "Missing", "0", "Total", "3", "Attention Needed", "ST-002", "Cable box", "Seal is open",
        "Receipt exported", "Export Receipt", "Done",
    ],
    17: [
        "Handoff Receipt", "Booth: North Gate", "Confirmed: 2026-08-31 12:20", "Ready", "3", "Issue", "0",
        "Missing", "Total", "Attention Needed", "No attention needed", "Export canceled", "Export Receipt", "Done",
    ],
    18: ["Resume Draft?", "South Hall", "3 items", "2 of 3 acknowledged", "Discard", "Resume", "G1", "G2", "G3", "G4"],
}


def main():
    failures = []
    if not PDF.exists() or PDF.stat().st_size < 350_000:
        failures.append("PDF missing or unexpectedly small")

    reader = PdfReader(str(PDF))
    if len(reader.pages) != 26:
        failures.append(f"expected 26 pages, got {len(reader.pages)}")
    if reader.is_encrypted:
        failures.append("PDF is encrypted")

    with pdfplumber.open(str(PDF)) as doc:
        texts = [(page.extract_text() or "") for page in doc.pages]

    all_text = "\n".join(texts)
    if "+----------------------------------+" in all_text:
        failures.append("ASCII wireframe border remains in PDF")
    if "�" in all_text or "□" in all_text:
        failures.append("replacement glyph detected")

    for page_number, expected in EXPECTED_BY_PAGE.items():
        page_text = texts[page_number - 1]
        missing = [value for value in expected if value not in page_text]
        if missing:
            failures.append(f"page {page_number} missing: {missing}")

        raw = reader.pages[page_number - 1].get_contents().get_data()
        vector_ops = raw.count(b" c") + raw.count(b" re") + raw.count(b" l")
        if vector_ops < 20:
            failures.append(f"page {page_number} has too few vector path operators: {vector_ops}")

    # These pages contain only a state caption plus its vector wireframe.
    # Requirement IDs must not be overlaid on the wireframe itself.
    for page_number in [4, 6, 7, 9, 10, 12, 13, 16, 17]:
        if __import__("re").search(r"\b[A-G][0-9]+\b", texts[page_number - 1]):
            failures.append(f"page {page_number} still contains requirement-ID overlay text")

    images = sorted(RENDER_DIR.glob("page-*.png"))
    if len(images) != 26:
        failures.append(f"expected 26 rendered pages, got {len(images)}")
    for image_path in images:
        with Image.open(image_path) as image:
            image.verify()

    if len(WIRE_TYPES) != 12:
        failures.append(f"expected 12 vector wireframe mappings, got {len(WIRE_TYPES)}")

    if failures:
        print("FAIL")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print(
        f"PASS pdf_bytes={PDF.stat().st_size} pages={len(reader.pages)} "
        f"rendered_pages={len(images)} vector_wireframes={len(WIRE_TYPES)} "
        f"state_text_checks={len(EXPECTED_BY_PAGE)} ascii_wireframes=0 replacement_glyphs=0"
    )


if __name__ == "__main__":
    main()
