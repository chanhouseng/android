from __future__ import annotations

import re
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Preformatted,
    Spacer,
    Table,
    TableStyle,
)

from vector_wireframes import VectorWireframe, WIRE_TYPES


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "Ai projeect" / "Module_A_Question_Generator_Kit" / "Booth_Handoff_Module_A_2026-08-31" / "Booth_Handoff_Module_A_3.5h_zh-TW.md"
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT = OUTPUT_DIR / "Booth_Handoff_Module_A_3.5h_zh-TW.pdf"

PAGE_W, PAGE_H = A4
MARGIN_X = 17 * mm
MARGIN_TOP = 18 * mm
MARGIN_BOTTOM = 17 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

NAVY = colors.HexColor("#17324D")
BLUE = colors.HexColor("#29648A")
TEAL = colors.HexColor("#2F7D7A")
PALE_BLUE = colors.HexColor("#EAF2F8")
PALE_TEAL = colors.HexColor("#EAF6F4")
PALE_GOLD = colors.HexColor("#FFF7E6")
INK = colors.HexColor("#24313A")
MUTED = colors.HexColor("#60717D")
GRID = colors.HexColor("#B9C8D2")
CODE_BG = colors.HexColor("#F6F8FA")


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont("JhengHei", r"C:\Windows\Fonts\msjh.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("JhengHei-Bold", r"C:\Windows\Fonts\msjhbd.ttc", subfontIndex=0))
    pdfmetrics.registerFont(TTFont("Consolas", r"C:\Windows\Fonts\consola.ttf"))
    pdfmetrics.registerFont(TTFont("Consolas-Bold", r"C:\Windows\Fonts\consolab.ttf"))


register_fonts()


class NumberedDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            rightMargin=MARGIN_X,
            leftMargin=MARGIN_X,
            topMargin=MARGIN_TOP,
            bottomMargin=MARGIN_BOTTOM,
            title="WorldSkills Module A - Booth Handoff",
            author="WorldSkills Module A Practice",
            subject="Mobile Applications Development practice test",
        )
        frame = Frame(
            MARGIN_X,
            MARGIN_BOTTOM,
            CONTENT_W,
            PAGE_H - MARGIN_TOP - MARGIN_BOTTOM,
            id="main",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(PageTemplate(id="content", frames=[frame], onPage=self._decorate_page))

    def _decorate_page(self, canvas, doc):
        canvas.saveState()
        page = canvas.getPageNumber()
        canvas.setStrokeColor(colors.HexColor("#D5E0E7"))
        canvas.setLineWidth(0.5)
        canvas.line(MARGIN_X, PAGE_H - 12 * mm, PAGE_W - MARGIN_X, PAGE_H - 12 * mm)
        canvas.setFont("JhengHei", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, PAGE_H - 9.2 * mm, "WorldSkills Module A Practice")
        canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 9.2 * mm, "Booth Handoff")
        canvas.line(MARGIN_X, 11 * mm, PAGE_W - MARGIN_X, 11 * mm)
        canvas.drawString(MARGIN_X, 7.5 * mm, "建議作答時間：3 小時 30 分鐘  |  總分：15.0 分")
        canvas.drawRightString(PAGE_W - MARGIN_X, 7.5 * mm, f"第 {page} 頁")
        canvas.restoreState()


base = getSampleStyleSheet()
styles = {
    "title": ParagraphStyle(
        "TitleZh",
        parent=base["Title"],
        fontName="JhengHei-Bold",
        fontSize=24,
        leading=31,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=7 * mm,
    ),
    "subtitle": ParagraphStyle(
        "SubtitleZh",
        parent=base["Heading1"],
        fontName="JhengHei-Bold",
        fontSize=17,
        leading=23,
        textColor=TEAL,
        spaceBefore=1 * mm,
        spaceAfter=5 * mm,
    ),
    "h2": ParagraphStyle(
        "H2Zh",
        parent=base["Heading2"],
        fontName="JhengHei-Bold",
        fontSize=14.5,
        leading=20,
        textColor=NAVY,
        borderColor=BLUE,
        borderWidth=0,
        borderPadding=(0, 0, 2.2 * mm, 0),
        spaceBefore=7 * mm,
        spaceAfter=3.5 * mm,
        keepWithNext=True,
    ),
    "h3": ParagraphStyle(
        "H3Zh",
        parent=base["Heading3"],
        fontName="JhengHei-Bold",
        fontSize=11.5,
        leading=16,
        textColor=BLUE,
        spaceBefore=4.5 * mm,
        spaceAfter=2 * mm,
        keepWithNext=True,
    ),
    "body": ParagraphStyle(
        "BodyZh",
        parent=base["BodyText"],
        fontName="JhengHei",
        fontSize=9.2,
        leading=14.2,
        textColor=INK,
        alignment=TA_LEFT,
        spaceAfter=1.8 * mm,
        wordWrap="CJK",
    ),
    "bullet": ParagraphStyle(
        "BulletZh",
        parent=base["BodyText"],
        fontName="JhengHei",
        fontSize=9.1,
        leading=14,
        textColor=INK,
        leftIndent=5.5 * mm,
        firstLineIndent=-3.5 * mm,
        spaceAfter=1.3 * mm,
        wordWrap="CJK",
    ),
    "number": ParagraphStyle(
        "NumberZh",
        parent=base["BodyText"],
        fontName="JhengHei",
        fontSize=9.1,
        leading=14,
        textColor=INK,
        leftIndent=7.5 * mm,
        firstLineIndent=-5.5 * mm,
        spaceAfter=1.4 * mm,
        wordWrap="CJK",
    ),
    "meta": ParagraphStyle(
        "MetaZh",
        parent=base["BodyText"],
        fontName="JhengHei",
        fontSize=10.3,
        leading=16,
        textColor=NAVY,
        backColor=PALE_BLUE,
        borderColor=colors.HexColor("#C8DCE9"),
        borderWidth=0.6,
        borderPadding=7,
        spaceAfter=2 * mm,
        wordWrap="CJK",
    ),
    "label": ParagraphStyle(
        "LabelZh",
        parent=base["BodyText"],
        fontName="JhengHei-Bold",
        fontSize=9.1,
        leading=13,
        textColor=NAVY,
        wordWrap="CJK",
    ),
    "table": ParagraphStyle(
        "TableZh",
        parent=base["BodyText"],
        fontName="JhengHei",
        fontSize=7.6,
        leading=10.6,
        textColor=INK,
        wordWrap="CJK",
    ),
    "table_header": ParagraphStyle(
        "TableHeaderZh",
        parent=base["BodyText"],
        fontName="JhengHei-Bold",
        fontSize=7.8,
        leading=10.8,
        textColor=colors.white,
        wordWrap="CJK",
    ),
    "code": ParagraphStyle(
        "Code",
        parent=base["Code"],
        fontName="Consolas",
        fontSize=7.2,
        leading=9.3,
        textColor=colors.HexColor("#1F2933"),
        leftIndent=0,
        rightIndent=0,
        spaceBefore=1.5 * mm,
        spaceAfter=3 * mm,
        borderColor=colors.HexColor("#B8C7D1"),
        borderWidth=0.7,
        borderPadding=7,
        backColor=CODE_BG,
    ),
}


def inline_markup(text: str) -> str:
    placeholders: list[str] = []
    text = text.replace("✓", "OK")

    def stash_code(match: re.Match) -> str:
        placeholders.append(f'<font name="Consolas" color="#163A59">{escape(match.group(1))}</font>')
        return f"@@CODE{len(placeholders) - 1}@@"

    text = re.sub(r"`([^`]+)`", stash_code, text)
    text = escape(text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    for index, value in enumerate(placeholders):
        text = text.replace(f"@@CODE{index}@@", value)
    return text


def paragraph(text: str, style: str = "body") -> Paragraph:
    return Paragraph(inline_markup(text), styles[style])


def table_widths(headers: list[str]) -> list[float]:
    count = len(headers)
    if count == 4 and headers[1] == "編號":
        return [0.23 * CONTENT_W, 0.10 * CONTENT_W, 0.57 * CONTENT_W, 0.10 * CONTENT_W]
    if count == 3 and headers[-1] == "分數":
        return [0.24 * CONTENT_W, 0.64 * CONTENT_W, 0.12 * CONTENT_W]
    if count == 4 and headers[0] == "檔名":
        return [0.22 * CONTENT_W, 0.15 * CONTENT_W, 0.27 * CONTENT_W, 0.36 * CONTENT_W]
    return [CONTENT_W / count] * count


def make_table(rows: list[list[str]]) -> Table:
    headers = rows[0]
    rendered: list[list[Paragraph]] = []
    for row_index, row in enumerate(rows):
        style = "table_header" if row_index == 0 else "table"
        rendered.append([Paragraph(inline_markup(cell), styles[style]) for cell in row])
    table = Table(rendered, colWidths=table_widths(headers), repeatRows=1, hAlign="LEFT", splitByRow=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.45, GRID),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAFC")]),
            ]
        )
    )
    return table


def parse_table(lines: list[str], start: int) -> tuple[Table, int]:
    raw_rows: list[list[str]] = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        cells = [cell.strip() for cell in lines[i].strip().strip("|").split("|")]
        if not all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            raw_rows.append(cells)
        i += 1
    return make_table(raw_rows), i


def build_story(markdown: str):
    lines = markdown.splitlines()
    story = []
    i = 0
    in_code = False
    code_lines: list[str] = []
    first_h2 = True
    wireframe_index = 0

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            if not in_code:
                in_code = True
                code_lines = []
            else:
                if wireframe_index >= len(WIRE_TYPES):
                    raise ValueError("More wireframe blocks than vector mappings")
                block = VectorWireframe(WIRE_TYPES[wireframe_index], CONTENT_W)
                wireframe_index += 1
                grouped = [block]
                if story and getattr(story[-1], "_keep_with_code", False):
                    grouped.insert(0, story.pop())
                story.append(KeepTogether(grouped))
                in_code = False
            i += 1
            continue

        if in_code:
            code_lines.append(line.rstrip())
            i += 1
            continue

        if not stripped:
            i += 1
            continue

        if stripped.startswith("|") and i + 1 < len(lines) and lines[i + 1].strip().startswith("|"):
            table, i = parse_table(lines, i)
            story.extend([table, Spacer(1, 3 * mm)])
            continue

        heading_match = re.match(r"^(#{1,3})\s+(.+)$", stripped)
        if heading_match:
            level = len(heading_match.group(1))
            title = heading_match.group(2)
            if level == 1:
                story.append(Spacer(1, 7 * mm))
                story.append(paragraph(title, "title"))
            elif level == 2 and title.startswith("Module A："):
                story.append(paragraph(title, "subtitle"))
            elif level == 2:
                if not first_h2 and re.match(r"(?:[4-9]|10|11|12|13|14|15|16)\.", title):
                    story.append(PageBreak())
                story.append(paragraph(title, "h2"))
                first_h2 = False
            else:
                story.append(paragraph(title, "h3"))
            i += 1
            continue

        if re.match(r"^\*\*.+?：\*\*", stripped):
            story.append(paragraph(stripped, "meta"))
            i += 1
            continue

        bullet_match = re.match(r"^-\s+(.+)$", stripped)
        if bullet_match:
            story.append(Paragraph(inline_markup(f"- {bullet_match.group(1)}"), styles["bullet"]))
            i += 1
            continue

        number_match = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        if number_match:
            story.append(Paragraph(inline_markup(number_match.group(2)), styles["number"], bulletText=f"{number_match.group(1)}."))
            i += 1
            continue

        body_flowable = paragraph(stripped, "body")
        if stripped.endswith("："):
            next_index = i + 1
            while next_index < len(lines) and not lines[next_index].strip():
                next_index += 1
            if next_index < len(lines) and lines[next_index].strip().startswith("```"):
                body_flowable.keepWithNext = True
                body_flowable._keep_with_code = True
        story.append(body_flowable)
        i += 1

    if wireframe_index != len(WIRE_TYPES):
        raise ValueError(f"Expected {len(WIRE_TYPES)} wireframes, generated {wireframe_index}")
    return story


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    markdown = SOURCE.read_text(encoding="utf-8")
    doc = NumberedDocTemplate(str(OUTPUT))
    story = build_story(markdown)
    doc.build(story)
    print(f"CREATED {OUTPUT}")


if __name__ == "__main__":
    main()
