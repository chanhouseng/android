# CityCycle Functionality Test — Wireframe Design

Date: 2026-08-06

## Objective

Add competition-style, low-fidelity wireframes to the existing technically neutral CityCycle Functionality Test Word document. The wireframes must clarify information hierarchy and required controls without prescribing an implementation framework, visual theme, or exact pixel styling.

## Deliverable

Update `CityCycle_Functionality_Test_Project_zh-TW.docx` in place and preserve the six existing JSON files unchanged.

## Visual language

- Monochrome and greyscale only.
- Tablet landscape canvas using a 16:10 proportion.
- Simple rectangles, dividers, placeholder icons, labels, tables, cards, chips, and modal outlines.
- Use the exact English UI strings already required by the task.
- Avoid platform-specific navigation bars, native widgets, Android/iOS terminology, or framework styling.
- Each figure carries the statement: `Wireframe is for layout reference only.`
- Numbered callouts identify required regions; a short legend follows each figure.

## Placement

Insert one wireframe directly after the functional requirements of each corresponding subsection in `Pages Demands`. Keep each figure and its caption together where possible. Do not create a separate wireframe appendix.

## Wireframe set

### WF-01 Dashboard

- Top application bar with title and current time area.
- Four summary cards: available bikes, empty docks, active rentals, overtime rentals.
- Station status list with station name, availability, empty docks, and status badge.
- Primary navigation to all required functional pages.

### WF-02 Station Management

- Search field and district/status filter controls.
- Station list or table on the left.
- Selected-station details on the right.
- Capacity, available bikes, empty docks, status, and bike list regions.
- Sorting and reset affordances are represented without prescribing their widget type.

### WF-03 Rental Console

- Member selector, bike selector, plan selector, and insurance option.
- Selected member and selected bike summary panels.
- Estimated fee breakdown.
- Validation/message area.
- Start Rental action and Reset action.

### WF-04 Active Rentals

- Search/filter region.
- Active rental cards or rows showing member, bike, station, plan, elapsed/remaining time, and live charge.
- Visual distinction for normal and overtime states using greyscale tone and labels.
- Extend and Return actions.

### WF-05 Smart Assistant

- Origin and destination selectors.
- Preference controls for nearest bike, maximum availability, or lowest estimated cost.
- Recommendation result with suggested start station, return station, bike, plan, distance, and estimated fee.
- No-result or warning message region.
- Apply Recommendation action.

### WF-06 Rental History

- Search, date range, member, station, and status filters.
- Sort control and reset action.
- History table with required summary fields.
- Selected-record detail area showing duration, fee components, overtime, and total charge.

## Neutrality and assessment boundaries

- Wireframes define required content and approximate grouping only.
- Competitors may rearrange components while preserving usability and all required functionality.
- Colours, typography, component library, navigation mechanism, and responsive implementation remain open.
- Wireframes do not expose calculation algorithms, expected outputs for hidden tests, or implementation hints.
- Existing marking values and total score remain unchanged at 15.0 points.

## Quality checks

- Exactly six wireframes are embedded in the Word document.
- Every wireframe has alternative text and a numbered caption.
- All labels are legible at normal Word zoom.
- Each wireframe appears in its matching page-demand subsection.
- No wireframe overlaps text, tables, headers, or footers.
- Existing JSON file hashes remain unchanged.
- DOCX reopens successfully and contains all original required sections.

