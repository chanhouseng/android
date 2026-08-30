from pathlib import Path
import re

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(r"C:\Users\chanh\Desktop\andorid\website\train\Ai projeect")
SOURCE = ROOT / "CityCycle_Functionality_Test_Project_Draft_zh-TW.md"
OUTPUT = ROOT / "CityCycle_Functionality_Test_Project_Corrected_Wireframes_zh-TW.pdf"

FONT = "NotoSansTC"
FONT_BOLD = "NotoSansTC-Bold"
BLUE = colors.HexColor("#2E74B5")
DARK = colors.HexColor("#24364B")
MUTED = colors.HexColor("#667085")
LIGHT_BLUE = colors.HexColor("#E8EEF5")
GRID = colors.HexColor("#C7D0DB")
WIRE_BG = colors.HexColor("#F8FAFC")
WIRE_FILL = colors.HexColor("#EEF2F6")
WIRE_DARK = colors.HexColor("#475467")


def register_fonts():
    pdfmetrics.registerFont(TTFont(FONT, r"C:\Windows\Fonts\NotoSansTC-VF.ttf"))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, r"C:\Windows\Fonts\NotoSansTC-VF.ttf", subfontIndex=0))


class CompetitionDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        super().__init__(filename, **kwargs)
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates(PageTemplate(id="main", frames=frame, onPage=self.draw_page))

    def draw_page(self, canvas, doc):
        canvas.saveState()
        if doc.page > 1:
            canvas.setFont(FONT, 8)
            canvas.setFillColor(MUTED)
            canvas.drawRightString(A4[0] - 18 * mm, A4[1] - 12 * mm, "CityCycle Operations | Module A")
            canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"Page {doc.page}")
        canvas.restoreState()


def escape_text(text):
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"`([^`]+)`", r"<font name='NotoSansTC'>\1</font>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)
    return text


def make_styles():
    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "BodyTC",
        parent=styles["BodyText"],
        fontName=FONT,
        fontSize=9.2,
        leading=14.5,
        textColor=DARK,
        spaceAfter=4,
        wordWrap="CJK",
    )
    h1 = ParagraphStyle(
        "H1TC",
        parent=body,
        fontName=FONT_BOLD,
        fontSize=17,
        leading=23,
        textColor=BLUE,
        spaceBefore=10,
        spaceAfter=9,
        keepWithNext=True,
    )
    h2 = ParagraphStyle(
        "H2TC",
        parent=body,
        fontName=FONT_BOLD,
        fontSize=13,
        leading=18,
        textColor=BLUE,
        spaceBefore=9,
        spaceAfter=6,
        keepWithNext=True,
    )
    h3 = ParagraphStyle(
        "H3TC",
        parent=body,
        fontName=FONT_BOLD,
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#1F4D78"),
        spaceBefore=7,
        spaceAfter=4,
        keepWithNext=True,
    )
    bullet = ParagraphStyle(
        "BulletTC",
        parent=body,
        leftIndent=0,
        firstLineIndent=0,
        spaceAfter=2,
    )
    table_text = ParagraphStyle(
        "TableTC",
        parent=body,
        fontSize=8.3,
        leading=12,
        spaceAfter=0,
    )
    table_header = ParagraphStyle(
        "TableHeaderTC",
        parent=table_text,
        fontName=FONT_BOLD,
        textColor=colors.HexColor("#1F4D78"),
        alignment=TA_CENTER,
    )
    cover_kicker = ParagraphStyle(
        "CoverKicker",
        parent=body,
        fontName=FONT_BOLD,
        fontSize=13,
        leading=18,
        textColor=BLUE,
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    cover_title = ParagraphStyle(
        "CoverTitle",
        parent=body,
        fontName=FONT_BOLD,
        fontSize=27,
        leading=34,
        textColor=DARK,
        alignment=TA_CENTER,
        spaceAfter=10,
    )
    cover_subtitle = ParagraphStyle(
        "CoverSubtitle",
        parent=body,
        fontName=FONT_BOLD,
        fontSize=18,
        leading=24,
        textColor=colors.HexColor("#1F4D78"),
        alignment=TA_CENTER,
        spaceAfter=12,
    )
    wire_caption = ParagraphStyle(
        "WireCaptionTC",
        parent=body,
        fontName=FONT_BOLD,
        fontSize=8.2,
        leading=11,
        textColor=MUTED,
        alignment=TA_CENTER,
        spaceBefore=2,
        spaceAfter=0,
    )
    return {
        "body": body,
        "h1": h1,
        "h2": h2,
        "h3": h3,
        "bullet": bullet,
        "table": table_text,
        "table_header": table_header,
        "cover_kicker": cover_kicker,
        "cover_title": cover_title,
        "cover_subtitle": cover_subtitle,
        "wire_caption": wire_caption,
    }


def make_wireframe(page_key, styles):
    """Return a technology-neutral landscape-tablet wireframe."""
    width, height = 162 * mm, 72 * mm
    d = Drawing(width, height)

    def box(x, y, w, h, label=None, fill=WIRE_BG, radius=4, size=6.6, bold=False):
        d.add(Rect(x, y, w, h, rx=radius, ry=radius, fillColor=fill,
                   strokeColor=GRID, strokeWidth=0.7))
        if label:
            d.add(String(x + 6, y + h - 11, label, fontName=FONT_BOLD if bold else FONT,
                         fontSize=size, fillColor=WIRE_DARK))

    def label(x, y, text, size=6.4, bold=False, anchor="start"):
        d.add(String(x, y, text, fontName=FONT_BOLD if bold else FONT,
                     fontSize=size, fillColor=WIRE_DARK, textAnchor=anchor))

    def input_box(x, y, w, text):
        box(x, y, w, 18, fill=colors.white)
        label(x + 6, y + 6, text, 6.1)

    def button(x, y, w, text, primary=False):
        fill = colors.HexColor("#DCE8F5") if primary else colors.white
        box(x, y, w, 18, fill=fill)
        label(x + w / 2, y + 6, text, 6.1, bold=primary, anchor="middle")

    def rows(x, y, w, count, row_h=18, labels=None):
        for n in range(count):
            yy = y + (count - n - 1) * row_h
            box(x, yy, w, row_h - 3, fill=colors.white, radius=2)
            if labels and n < len(labels):
                label(x + 6, yy + 5, labels[n], 5.8)

    # Tablet shell, header and shared navigation.
    d.add(Rect(0, 0, width, height, rx=10, ry=10, fillColor=colors.white,
               strokeColor=DARK, strokeWidth=1.2))
    d.add(Rect(5, 5, 82, height - 10, rx=7, ry=7, fillColor=WIRE_FILL,
               strokeColor=None))
    label(14, height - 20, "CityCycle", 9, True)
    nav = ["Dashboard", "Stations", "Rental Console", "Active Rentals",
           "Smart Assistant", "Rental History"]
    active_names = {
        "Dashboard": "Dashboard", "Station Management": "Stations",
        "Rental Console": "Rental Console", "Active Rentals": "Active Rentals",
        "Smart Assistant": "Smart Assistant", "Rental History": "Rental History",
    }
    for i, item in enumerate(nav):
        yy = height - 45 - i * 24
        if item == active_names[page_key]:
            box(10, yy - 5, 72, 19, fill=colors.HexColor("#DCE8F5"), radius=3)
        label(16, yy + 1, item, 5.7, item == active_names[page_key])

    x0, cw = 98, width - 108
    label(x0, height - 22, page_key, 10, True)
    top = height - 44

    if page_key == "Dashboard":
        cards = ["Available Bikes", "Empty Docks", "Active Rentals", "Overtime"]
        card_w = (cw - 12) / 4
        for i, name in enumerate(cards):
            xx = x0 + i * (card_w + 4)
            box(xx, top - 38, card_w, 34, name, fill=WIRE_FILL, size=5.2, bold=True)
            label(xx + card_w - 7, top - 31, "00", 8, True, "end")
        input_box(x0, top - 62, cw, "Search stations")
        box(x0, 12, cw * .68, top - 78, "Station Status", bold=True)
        label(x0 + 6, top - 91, "Station / District / Available Bikes / Empty Docks / Health", 4.8, True)
        rows(x0 + 6, 20, cw * .68 - 12, 3, 17,
             ["Central / Downtown / 12 / 8 / Normal", "Harbour / Waterfront / 3 / 2 / Low", "Market / Central / 0 / 0 / Critical"])
        box(x0 + cw * .70, 12, cw * .30, top - 78, "Quick Actions", bold=True)
        for i, text in enumerate(["Start Rental", "Manage Stations", "View Active Rentals"]):
            button(x0 + cw * .70 + 6, top - 105 - i * 24, cw * .30 - 12, text, i == 0)

    elif page_key == "Station Management":
        input_box(x0, top - 20, cw * .31, "Station name or ID")
        input_box(x0 + cw * .32, top - 20, cw * .14, "District")
        input_box(x0 + cw * .47, top - 20, cw * .13, "Status")
        input_box(x0 + cw * .61, top - 20, cw * .15, "Urgency")
        input_box(x0 + cw * .77, top - 20, cw * .15, "Sort")
        button(x0 + cw * .93, top - 20, cw * .07, "Reset")
        box(x0, 12, cw * .50, top - 42, "Stations", bold=True)
        rows(x0 + 6, 20, cw * .50 - 12, 5, 18,
             ["ST-01 Central | 12 bikes | 8 docks | Normal", "ST-02 Harbour | 3 bikes | 2 docks | Low", "ST-03 Market | 0 bikes | 0 docks | Critical", "ST-04 Museum | 8 bikes | 4 docks | Normal", "ST-05 Garden | 5 bikes | 7 docks | Normal"])
        box(x0 + cw * .52, 12, cw * .48, top - 42, "Selected Station", bold=True)
        label(x0 + cw * .54, top - 61, "ID / Name / District / Capacity / Bikes / Docks / Health", 4.8)
        label(x0 + cw * .54, top - 74, "Bikes assigned to station", 5.5, True)
        rows(x0 + cw * .54, 20, cw * .44, 4, 15,
             ["BK-101  Standard  Available  82%", "BK-108  E-bike  Available  64%", "BK-112  Standard  Maintenance  --", "BK-116  E-bike  Available  91%"])

    elif page_key == "Rental Console":
        box(x0, 12, cw * .55, top - 4, "Rental Setup", bold=True)
        y = top - 32
        for text in ["Member ID / Name / Tier", "Bike ID / Type / Station", "Plan / Duration"]:
            input_box(x0 + 8, y, cw * .55 - 16, text)
            y -= 25
        box(x0 + 8, y + 4, 9, 9, fill=colors.white, radius=1)
        label(x0 + 22, y + 6, "Add insurance", 5.7)
        label(x0 + 8, 45, "Validation message", 5.2)
        button(x0 + 8, 20, 54, "Reset")
        button(x0 + 68, 20, cw * .55 - 76, "Start Rental", True)
        box(x0 + cw * .57, 12, cw * .43, top - 4, "Rental Summary", bold=True)
        summary = ["Member name", "Bike ID", "Start station", "Unlock fee", "Base price", "Discount", "Insurance"]
        for i, text in enumerate(summary):
            yy = top - 35 - i * 14
            label(x0 + cw * .59, yy, text, 5.8)
            label(x0 + cw - 8, yy, "--", 5.8, False, "end")
        d.add(Line(x0 + cw * .59, 31, x0 + cw - 8, 31, strokeColor=GRID))
        label(x0 + cw * .59, 19, "Estimated total", 6.2, True)
        label(x0 + cw - 8, 19, "CNY 0.00", 6.2, True, "end")

    elif page_key == "Active Rentals":
        input_box(x0, top - 20, cw * .46, "Member, bike or rental ID")
        input_box(x0 + cw * .48, top - 20, cw * .20, "Status")
        input_box(x0 + cw * .70, top - 20, cw * .20, "Ending Soon")
        button(x0 + cw * .92, top - 20, cw * .08, "Reset")
        label(x0, top - 34, "2 active rentals", 5.7, True)
        for i in range(2):
            yy = top - 88 - i * 55
            box(x0, yy, cw, 49, fill=colors.white)
            label(x0 + 8, yy + 36, f"R-00{i+1} | MB-0{i+1} Member Name | BK-10{i+1} E-bike", 5.4, True)
            label(x0 + 8, yy + 24, "City 60 | Central Station | 00:25:40 | CNY 12.00", 5.0)
            box(x0 + 8, yy + 10, cw * .50, 6, fill=colors.HexColor("#DCE8F5"), radius=2)
            label(x0 + cw - 116, yy + 36, "Active" if i == 0 else "Overtime", 5.7, True)
            button(x0 + cw - 78, yy + 10, 32, "Extend")
            button(x0 + cw - 41, yy + 10, 33, "Return", True)

    elif page_key == "Smart Assistant":
        box(x0, 12, cw * .42, top - 4, "Trip Preferences", bold=True)
        y = top - 34
        for text in ["Origin", "Destination"]:
            input_box(x0 + 8, y, cw * .42 - 16, text)
            y -= 27
        for text in ["Nearest bike", "Maximum availability", "Lowest estimated cost"]:
            box(x0 + 9, y + 3, 7, 7, fill=colors.white, radius=4)
            label(x0 + 21, y + 4, text, 5.2)
            y -= 15
        button(x0 + 8, 24, cw * .42 - 16, "Find Recommendation", True)
        box(x0 + cw * .44, 12, cw * .56, top - 4, "Recommended Trip", bold=True)
        detail = ["Start station", "Return station", "Suggested bike", "Plan", "Walking distance", "Estimated fee", "Warning / error message"]
        for i, text in enumerate(detail):
            yy = top - 33 - i * 13
            label(x0 + cw * .46, yy, text, 5.9)
            label(x0 + cw - 8, yy, "--", 5.9, False, "end")
        button(x0 + cw * .46, 24, cw * .52, "Apply Recommendation", True)

    elif page_key == "Rental History":
        input_box(x0, top - 20, cw * .34, "Rental, member or bike")
        input_box(x0 + cw * .36, top - 20, cw * .18, "Date range")
        input_box(x0 + cw * .56, top - 20, cw * .16, "Member")
        input_box(x0 + cw * .74, top - 20, cw * .16, "Status")
        button(x0 + cw * .92, top - 20, cw * .08, "Reset")
        box(x0, 12, cw * .62, top - 42, "Completed Rentals", bold=True)
        label(x0 + 6, top - 48, "Rental / Member / Bike / Duration / Status / Total", 4.5, True)
        rows(x0 + 6, 34, cw * .62 - 12, 5, 14,
             ["R-097 / MB-03 / BK-12 / 00:42:10 / Completed / CNY 18.00", "R-096 / MB-07 / BK-05 / 01:35:20 / Overtime / CNY 31.50", "R-095 / MB-02 / BK-19 / 00:29:08 / Completed / CNY 12.00", "R-094 / MB-09 / BK-08 / 00:58:40 / Completed / CNY 20.00", "R-093 / MB-01 / BK-03 / 01:12:03 / Overtime / CNY 26.50"])
        button(x0 + 6, 18, 42, "Previous")
        button(x0 + cw * .62 - 48, 18, 42, "Next")
        box(x0 + cw * .64, 12, cw * .36, top - 42, "Rental Detail", bold=True)
        for i, text in enumerate(["Rental ID", "Start station", "Return station", "Duration", "Unlock fee", "Base price", "Insurance", "Overtime", "Total charge"]):
            yy = top - 58 - i * 11
            label(x0 + cw * .66, yy, text, 5.5)
            label(x0 + cw - 8, yy, "--", 5.5, False, "end")

    caption = Paragraph("線框圖（內容及大致配置參考）", styles["wire_caption"])
    return KeepTogether([caption, Spacer(1, 3), d, Spacer(1, 6)])


def parse_table(lines, start, styles):
    rows = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
        if not all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
            rows.append(cells)
        i += 1
    data = []
    for ri, row in enumerate(rows):
        style = styles["table_header"] if ri == 0 else styles["table"]
        data.append([Paragraph(escape_text(cell), style) for cell in row])
    if not data:
        return None, i
    if len(data[0]) == 2:
        widths = [42 * mm, 120 * mm]
    elif len(data[0]) == 4:
        widths = [31 * mm, 47 * mm, 40 * mm, 44 * mm]
    else:
        widths = [162 * mm / len(data[0])] * len(data[0])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), LIGHT_BLUE),
                ("GRID", (0, 0), (-1, -1), 0.45, GRID),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table, i


def make_list(items, level, styles):
    left = 14 + level * 14
    flow_items = []
    for text in items:
        para = Paragraph(escape_text(text), styles["bullet"])
        flow_items.append(ListItem(para, leftIndent=left, value=None))
    return ListFlowable(
        flow_items,
        bulletType="bullet",
        start="◦" if level else "●",
        leftIndent=left,
        bulletFontName=FONT,
        bulletFontSize=7,
        bulletColor=DARK,
        spaceAfter=3,
    )


def build_story(text, styles):
    lines = text.splitlines()
    story = []
    i = 0
    first_h1_seen = False
    while i < len(lines):
        raw = lines[i].rstrip()
        stripped = raw.strip()
        if not stripped:
            i += 1
            continue

        if i == 0 and stripped == "# 練習測試題目":
            story.append(Spacer(1, 50 * mm))
            story.append(Paragraph("練習測試題目", styles["cover_kicker"]))
            if i + 1 < len(lines) and lines[i + 2].startswith("## "):
                subtitle = lines[i + 2][3:].strip()
                story.append(Paragraph(escape_text(subtitle), styles["cover_subtitle"]))
                i += 2
            if i + 2 < len(lines) and lines[i + 2].startswith("### "):
                title = lines[i + 2][4:].strip()
                story.append(Paragraph(escape_text(title), styles["cover_title"]))
                i += 2
            i += 1
            continue

        if stripped.startswith("|"):
            table, i = parse_table(lines, i, styles)
            story.append(Spacer(1, 4))
            story.append(table)
            story.append(Spacer(1, 7))
            continue

        if stripped.startswith("# "):
            if first_h1_seen:
                story.append(PageBreak())
            first_h1_seen = True
            story.append(Paragraph(escape_text(stripped[2:]), styles["h1"]))
            i += 1
            continue
        if stripped.startswith("## "):
            title = stripped[3:]
            story.append(Paragraph(escape_text(title), styles["h2"]))
            page_match = re.match(r'^[1-6]\. "([^"]+)" 頁面$', title)
            if page_match:
                story.append(make_wireframe(page_match.group(1), styles))
            i += 1
            continue
        if stripped.startswith("### "):
            story.append(Paragraph(escape_text(stripped[4:]), styles["h3"]))
            i += 1
            continue

        match = re.match(r"^(\s*)(?:\d+\.|-)\s+(.*)$", raw)
        if match:
            indent = len(match.group(1))
            level = 1 if indent >= 3 else 0
            items = []
            while i < len(lines):
                m = re.match(r"^(\s*)(?:\d+\.|-)\s+(.*)$", lines[i])
                if not m or (1 if len(m.group(1)) >= 3 else 0) != level:
                    break
                items.append(m.group(2).strip())
                i += 1
            story.append(make_list(items, level, styles))
            continue

        story.append(Paragraph(escape_text(stripped), styles["body"]))
        i += 1
    return story


def main():
    register_fonts()
    styles = make_styles()
    source_text = SOURCE.read_text(encoding="utf-8")
    story = build_story(source_text, styles)
    doc = CompetitionDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=20 * mm,
        bottomMargin=18 * mm,
        title="CityCycle Operations - Module A Functionality",
        author="",
        subject="Mobile Applications Development Functionality Test Project",
    )
    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    main()
