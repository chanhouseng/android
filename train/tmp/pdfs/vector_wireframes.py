from __future__ import annotations

from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Flowable, Paragraph


NAVY = colors.HexColor("#17324D")
BLUE = colors.HexColor("#29648A")
TEAL = colors.HexColor("#2F7D7A")
INK = colors.HexColor("#24313A")
MUTED = colors.HexColor("#60717D")
LINE = colors.HexColor("#8799A5")
SOFT = colors.HexColor("#F4F7F9")
PALE_BLUE = colors.HexColor("#EAF2F8")
PALE_TEAL = colors.HexColor("#EAF6F4")
PALE_RED = colors.HexColor("#FCEEEE")
PALE_GOLD = colors.HexColor("#FFF7E6")
WHITE = colors.white


WIRE_TYPES = [
    "home_empty",
    "home_state",
    "import_duplicate",
    "import_error",
    "resolve_unselected",
    "resolve_selected",
    "handoff_partial",
    "handoff_complete",
    "confirm_dialog",
    "receipt_attention",
    "receipt_empty",
    "resume_dialog",
]


WIRE_HEIGHTS = {
    "home_empty": 330,
    "home_state": 500,
    "import_duplicate": 675,
    "import_error": 500,
    "resolve_unselected": 575,
    "resolve_selected": 590,
    "handoff_partial": 675,
    "handoff_complete": 675,
    "confirm_dialog": 390,
    "receipt_attention": 640,
    "receipt_empty": 610,
    "resume_dialog": 430,
}


class VectorWireframe(Flowable):
    """ReportLab vector mobile wireframe with external spec-id annotations."""

    def __init__(self, wire_type: str, available_width: float):
        if wire_type not in WIRE_HEIGHTS:
            raise ValueError(f"Unknown wireframe type: {wire_type}")
        super().__init__()
        self.wire_type = wire_type
        self.width = available_width
        self.height = WIRE_HEIGHTS[wire_type]
        self.phone_w = 340
        self.phone_x = (available_width - self.phone_w) / 2
        self.phone_y = 8
        self.phone_h = self.height - 16
        self.inner_x = self.phone_x + 14
        self.inner_w = self.phone_w - 28

    def wrap(self, avail_width, avail_height):
        return min(self.width, avail_width), self.height

    def _paragraph(self, text, x, top, width, size=8.6, leading=11.2, bold=False, color=INK, align=0):
        style = ParagraphStyle(
            "wire",
            fontName="JhengHei-Bold" if bold else "JhengHei",
            fontSize=size,
            leading=leading,
            textColor=color,
            alignment=align,
            wordWrap="CJK",
            spaceAfter=0,
            spaceBefore=0,
        )
        para = Paragraph(escape(text), style)
        _, height = para.wrap(width, 1000)
        para.drawOn(self.canv, x, top - height)
        return height

    def _callout(self, code, y, side="left"):
        # Requirement IDs remain in the specification and crosswalk table only.
        # They are intentionally not drawn on the application wireframe.
        return None

    def _phone(self):
        c = self.canv
        c.setStrokeColor(NAVY)
        c.setFillColor(WHITE)
        c.setLineWidth(1.25)
        c.roundRect(self.phone_x, self.phone_y, self.phone_w, self.phone_h, 13, stroke=1, fill=1)

    def _app_bar(self, code, title):
        c = self.canv
        top = self.phone_y + self.phone_h
        bar_h = 43
        c.setFillColor(NAVY)
        c.roundRect(self.phone_x, top - bar_h, self.phone_w, bar_h, 13, stroke=0, fill=1)
        c.rect(self.phone_x, top - bar_h, self.phone_w, 13, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont("JhengHei-Bold", 12)
        c.drawString(self.inner_x, top - 27, title)
        self._callout(code, top - bar_h / 2)
        return top - bar_h - 13

    def _text(self, code, text, top, size=8.6, leading=11.2, bold=False, color=INK, gap=8):
        height = self._paragraph(text, self.inner_x, top, self.inner_w, size, leading, bold, color)
        self._callout(code, top - height / 2)
        return top - height - gap

    def _banner(self, code, text, top, tone="blue"):
        fill = {"blue": PALE_BLUE, "teal": PALE_TEAL, "red": PALE_RED, "gold": PALE_GOLD}[tone]
        stroke = {"blue": BLUE, "teal": TEAL, "red": colors.HexColor("#A34A4A"), "gold": colors.HexColor("#A87516")}[tone]
        h = 31
        c = self.canv
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.7)
        c.roundRect(self.inner_x, top - h, self.inner_w, h, 5, stroke=1, fill=1)
        self._paragraph(text, self.inner_x + 9, top - 8, self.inner_w - 18, 8.5, 10.5, True, stroke)
        self._callout(code, top - h / 2)
        return top - h - 9

    def _card(self, code, lines, top, height, selected=False, side="left", tone="plain"):
        c = self.canv
        fill = PALE_TEAL if selected else (PALE_GOLD if tone == "gold" else SOFT)
        stroke = TEAL if selected else LINE
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(1.0 if selected else 0.7)
        c.roundRect(self.inner_x, top - height, self.inner_w, height, 7, stroke=1, fill=1)
        cursor = top - 10
        for index, item in enumerate(lines):
            text, bold, color = item if len(item) == 3 else (item[0], item[1], INK)
            used = self._paragraph(text, self.inner_x + 10, cursor, self.inner_w - 20, 8.5 if not bold else 9, 10.5, bold, color)
            cursor -= used + (4 if index == 0 else 2)
        self._callout(code, top - height / 2, side)
        return top - height - 9

    def _button(self, code, label, x, top, width, disabled=False, side="left"):
        c = self.canv
        h = 31
        fill = colors.HexColor("#E6EBEF") if disabled else WHITE
        stroke = colors.HexColor("#AAB5BC") if disabled else BLUE
        text_color = colors.HexColor("#8B969D") if disabled else BLUE
        c.setFillColor(fill)
        c.setStrokeColor(stroke)
        c.setLineWidth(0.8)
        c.roundRect(x, top - h, width, h, 6, stroke=1, fill=1)
        c.setFillColor(text_color)
        c.setFont("JhengHei-Bold", 8.2)
        c.drawCentredString(x + width / 2, top - 20, label)
        self._callout(code, top - h / 2, side)
        return top - h

    def _primary_button(self, code, label, top, disabled=False, side="left"):
        c = self.canv
        h = 34
        c.setFillColor(colors.HexColor("#E6EBEF") if disabled else BLUE)
        c.setStrokeColor(colors.HexColor("#AAB5BC") if disabled else BLUE)
        c.setLineWidth(0.8)
        c.roundRect(self.inner_x, top - h, self.inner_w, h, 7, stroke=1, fill=1)
        c.setFillColor(colors.HexColor("#8B969D") if disabled else WHITE)
        c.setFont("JhengHei-Bold", 8.7)
        c.drawCentredString(self.inner_x + self.inner_w / 2, top - 22, label)
        self._callout(code, top - h / 2, side)
        return top - h - 9

    def _list_row(self, code, top, item_id, label, status, note, duplicate=False, acknowledged=None):
        height = 73 if acknowledged is None else 88
        c = self.canv
        c.setFillColor(WHITE)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.roundRect(self.inner_x, top - height, self.inner_w, height, 5, stroke=1, fill=1)
        x = self.inner_x + 9
        c.setFillColor(NAVY)
        c.setFont("Consolas-Bold", 8.2)
        c.drawString(x, top - 15, item_id)
        c.setFont("JhengHei-Bold", 8.3)
        c.drawString(x + 66, top - 15, label)
        c.setFillColor(TEAL if status == "Ready" else colors.HexColor("#A46612") if status == "Issue" else colors.HexColor("#A34A4A"))
        c.setFont("JhengHei-Bold", 7.8)
        c.drawString(x, top - 33, status)
        c.setFillColor(INK)
        c.setFont("JhengHei", 7.8)
        c.drawString(x + 66, top - 33, note)
        if duplicate:
            c.setFillColor(PALE_GOLD)
            c.setStrokeColor(colors.HexColor("#A87516"))
            c.roundRect(self.inner_x + self.inner_w - 66, top - 22, 55, 16, 4, stroke=1, fill=1)
            c.setFillColor(colors.HexColor("#8A5B0A"))
            c.setFont("JhengHei-Bold", 6.8)
            c.drawCentredString(self.inner_x + self.inner_w - 38.5, top - 17, "Duplicate")
        if acknowledged is not None:
            box_y = top - 68
            c.setFillColor(WHITE)
            c.setStrokeColor(BLUE)
            c.rect(x, box_y, 12, 12, stroke=1, fill=1)
            if acknowledged:
                c.setFillColor(BLUE)
                c.setFont("Consolas-Bold", 8)
                c.drawCentredString(x + 6, box_y + 2.5, "X")
            c.setFillColor(INK)
            c.setFont("JhengHei", 7.8)
            c.drawString(x + 18, box_y + 2.5, "Acknowledged")
        self._callout(code, top - height / 2)
        return top - height - 7

    def _summary_box(self, code, top, values):
        c = self.canv
        h = 85
        c.setFillColor(SOFT)
        c.setStrokeColor(LINE)
        c.roundRect(self.inner_x, top - h, self.inner_w, h, 6, stroke=1, fill=1)
        cols = 2
        cell_w = self.inner_w / cols
        for idx, (label, value) in enumerate(values):
            col, row = idx % 2, idx // 2
            x = self.inner_x + col * cell_w + 12
            y = top - 22 - row * 34
            c.setFillColor(MUTED)
            c.setFont("JhengHei", 7.4)
            c.drawString(x, y, label)
            c.setFillColor(NAVY)
            c.setFont("Consolas-Bold", 12)
            c.drawRightString(self.inner_x + (col + 1) * cell_w - 12, y - 1, str(value))
        self._callout(code, top - h / 2)
        return top - h - 9

    def _draw_home_empty(self):
        top = self._app_bar("A1", "Booth Handoff")
        top = self._text("A2", "Import a handoff file to review the booth before taking over.", top, 9, 12, gap=22)
        self._primary_button("A3", "Import File", top)

    def _draw_home_state(self):
        top = self._app_bar("A1", "Booth Handoff")
        top = self._text("A2", "Import a handoff file to review the booth before taking over.", top, 9, 12, gap=14)
        top = self._card("A4", [("South Hall", True, NAVY), ("3 items", False, INK), ("2 of 3 acknowledged", False, INK)], top, 72)
        top = self._primary_button("A5", "Continue Draft", top)
        top = self._card("A6", [("North Gate", True, NAVY), ("2026-08-31 12:20", False, INK)], top, 58)
        top = self._primary_button("A7", "View Receipt", top)
        self._primary_button("A3", "Import File", top)

    def _draw_import_duplicate(self):
        top = self._app_bar("B1", "Import Review")
        top = self._text("B2", "File: handoff_conflicts.bhf", top, gap=5)
        top = self._text("B3", "Booth: South Hall", top, gap=5)
        top = self._text("B4", "4 items • 1 duplicate", top, gap=7)
        top = self._banner("B5", "Resolve duplicates to continue", top, "gold")
        top = self._list_row("B6", top, "ST-001", "Counter tablet", "Ready", "Charged", duplicate=True)
        top = self._list_row("B6", top, "ST-002", "Cable box", "Issue", "Seal is open")
        top = self._list_row("B6", top, "ST-001", "Counter tablet", "Missing", "No note", duplicate=True)
        top = self._list_row("B6", top, "ST-003", "Sign holder", "Ready", "Clean")
        gap = 8
        half = (self.inner_w - gap) / 2
        self._button("B8", "Cancel Import", self.inner_x, top, half, side="left")
        top = self._button("B9", "Choose Another File", self.inner_x + half + gap, top, half, side="right") - 9
        self._primary_button("B10", "Continue", top)

    def _draw_import_error(self):
        top = self._app_bar("B1", "Import Review")
        top = self._text("B2", "File: handoff_invalid.bhf", top, gap=5)
        top = self._text("B3", "Booth: East Desk", top, gap=5)
        top = self._text("B4", "Import unavailable", top, gap=7)
        top = self._banner("B5", "File needs attention", top, "red")
        top = self._card(
            "B7",
            [
                ("Problems", True, colors.HexColor("#A34A4A")),
                ('Line 3: Unsupported status "BROKEN".', False, INK),
                ("Line 4: Expected 4 item fields.", False, INK),
            ],
            top,
            84,
        )
        gap = 8
        half = (self.inner_w - gap) / 2
        self._button("B8", "Cancel Import", self.inner_x, top, half, side="left")
        self._button("B9", "Choose Another File", self.inner_x + half + gap, top, half, side="right")

    def _draw_resolve(self, selected):
        top = self._app_bar("C1", "Resolve Duplicates")
        top = self._text("C2", "Choose one record for each duplicate ID.", top, 8.8, 11.5, gap=7)
        top = self._text("C3", "Conflict 1 of 1", top, bold=True, color=BLUE, gap=5)
        top = self._text("C4", "ID: ST-001", top, bold=True, gap=10)
        first_lines = [("First record", True, NAVY), ("Counter tablet", False, INK), ("Ready", False, TEAL), ("Charged", False, INK)]
        if selected:
            first_lines.append(("Selected", True, TEAL))
        top = self._card("C5", first_lines, top, 106 if selected else 92, selected=selected)
        if selected:
            self._callout("C7", top + 21, side="right")
        top = self._card("C6", [("Later record", True, NAVY), ("Counter tablet", False, INK), ("Missing", False, colors.HexColor("#A34A4A")), ("No note", False, INK)], top, 92)
        gap = 8
        half = (self.inner_w - gap) / 2
        self._button("C8", "Back", self.inner_x, top, half, side="left")
        self._button("C9", "Use Selected", self.inner_x + half + gap, top, half, disabled=not selected, side="right")

    def _draw_handoff(self, complete):
        top = self._app_bar("D1", "Handoff Check")
        top = self._text("D2", "Booth: South Hall • 3 items", top, bold=True, gap=5)
        top = self._text("D3", "Review every item before confirming.", top, gap=10)
        top = self._list_row("D4", top, "ST-001", "Counter tablet", "Ready", "Charged", acknowledged=True)
        top = self._list_row("D4", top, "ST-002", "Cable box", "Issue", "Seal is open", acknowledged=True)
        top = self._list_row("D4", top, "ST-003", "Sign holder", "Ready", "Clean", acknowledged=complete)
        top = self._text("D5", "3 of 3 acknowledged" if complete else "2 of 3 acknowledged", top + 1, bold=True, color=BLUE, gap=10)
        gap = 8
        half = (self.inner_w - gap) / 2
        self._button("D6", "Back", self.inner_x, top, half, side="left")
        self._button("D7", "Confirm Handoff", self.inner_x + half + gap, top, half, disabled=not complete, side="right")

    def _draw_confirm_dialog(self):
        top = self.phone_y + self.phone_h - 70
        panel_x = self.inner_x
        panel_w = self.inner_w
        panel_h = 210
        c = self.canv
        c.setFillColor(WHITE)
        c.setStrokeColor(NAVY)
        c.setLineWidth(1.0)
        c.roundRect(panel_x, top - panel_h, panel_w, panel_h, 9, stroke=1, fill=1)
        title_top = top - 22
        self._paragraph("Confirm Handoff", panel_x + 14, title_top, panel_w - 28, 12, 15, True, NAVY)
        self._callout("E1", title_top - 7)
        message_top = top - 75
        self._paragraph("This will lock the current handoff.", panel_x + 14, message_top, panel_w - 28, 9, 12, False, INK)
        self._callout("E2", message_top - 6)
        button_top = top - 145
        gap = 8
        half = (panel_w - 28 - gap) / 2
        self._button("E3", "Cancel", panel_x + 14, button_top, half, side="left")
        self._button("E4", "Confirm", panel_x + 14 + half + gap, button_top, half, side="right")

    def _draw_receipt(self, attention):
        top = self._app_bar("F1", "Handoff Receipt")
        if attention:
            booth, confirmed = "Booth: South Hall", "Confirmed: 2026-08-31 14:05"
            values = [("Ready", 2), ("Issue", 1), ("Missing", 0), ("Total", 3)]
        else:
            booth, confirmed = "Booth: North Gate", "Confirmed: 2026-08-31 12:20"
            values = [("Ready", 3), ("Issue", 0), ("Missing", 0), ("Total", 3)]
        top = self._text("F2", booth, top, bold=True, gap=5)
        top = self._text("F3", confirmed, top, gap=10)
        top = self._summary_box("F4", top, values)
        top = self._text("F5", "Attention Needed", top, bold=True, color=NAVY, gap=7)
        if attention:
            top = self._list_row("F5", top, "ST-002", "Cable box", "Issue", "Seal is open")
        else:
            top = self._card("F5", [("No attention needed", False, MUTED)], top, 43)
        top = self._banner("F7", "Receipt exported" if attention else "Export canceled", top, "teal" if attention else "gold")
        top = self._primary_button("F6", "Export Receipt", top)
        self._primary_button("F8", "Done", top)

    def _draw_resume_dialog(self):
        top = self.phone_y + self.phone_h - 55
        panel_x = self.inner_x
        panel_w = self.inner_w
        panel_h = 255
        c = self.canv
        c.setFillColor(WHITE)
        c.setStrokeColor(NAVY)
        c.setLineWidth(1.0)
        c.roundRect(panel_x, top - panel_h, panel_w, panel_h, 9, stroke=1, fill=1)
        title_top = top - 22
        self._paragraph("Resume Draft?", panel_x + 14, title_top, panel_w - 28, 12, 15, True, NAVY)
        self._callout("G1", title_top - 7)
        summary_top = top - 76
        self._paragraph("South Hall", panel_x + 14, summary_top, panel_w - 28, 10, 13, True, NAVY)
        self._paragraph("3 items", panel_x + 14, summary_top - 30, panel_w - 28, 9, 12, False, INK)
        self._paragraph("2 of 3 acknowledged", panel_x + 14, summary_top - 54, panel_w - 28, 9, 12, False, INK)
        self._callout("G2", summary_top - 29)
        button_top = top - 190
        gap = 8
        half = (panel_w - 28 - gap) / 2
        self._button("G3", "Discard", panel_x + 14, button_top, half, side="left")
        self._button("G4", "Resume", panel_x + 14 + half + gap, button_top, half, side="right")

    def draw(self):
        self._phone()
        if self.wire_type == "home_empty":
            self._draw_home_empty()
        elif self.wire_type == "home_state":
            self._draw_home_state()
        elif self.wire_type == "import_duplicate":
            self._draw_import_duplicate()
        elif self.wire_type == "import_error":
            self._draw_import_error()
        elif self.wire_type == "resolve_unselected":
            self._draw_resolve(False)
        elif self.wire_type == "resolve_selected":
            self._draw_resolve(True)
        elif self.wire_type == "handoff_partial":
            self._draw_handoff(False)
        elif self.wire_type == "handoff_complete":
            self._draw_handoff(True)
        elif self.wire_type == "confirm_dialog":
            self._draw_confirm_dialog()
        elif self.wire_type == "receipt_attention":
            self._draw_receipt(True)
        elif self.wire_type == "receipt_empty":
            self._draw_receipt(False)
        elif self.wire_type == "resume_dialog":
            self._draw_resume_dialog()
