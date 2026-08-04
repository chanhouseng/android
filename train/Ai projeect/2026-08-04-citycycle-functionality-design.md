# CityCycle Functionality Test Project - Design Specification

## 1. Purpose

Create a technically neutral, competition-style Mobile Applications Development Functionality test project for a senior high school WorldSkills competitor. The task must be intentionally dense enough for a 2.5-hour competition session and must assess algorithms, state transitions, timers, persistence, drag-and-drop, validation, dynamic aggregation, lifecycle recovery, and platform sharing rather than merely rendering JSON.

## 2. Final Deliverables

All final deliverables will be placed in `Ai projeect/`:

- `CityCycle_Functionality_Test_Project_zh-TW.docx`
- `media-files/data/stations.json`
- `media-files/data/bikes.json`
- `media-files/data/pricing_rules.json`
- `media-files/data/active_rentals.json`
- `media-files/data/rental_history.json`
- `media-files/data/members.json`

The Word document is written in Traditional Chinese. All quoted UI strings remain in English so marking can verify exact text independently of the chosen development platform.

## 3. Reference Format

The Word document follows the information architecture and visual rhythm of `2024_module_c_am/module_c_am.pdf` without presenting itself as an official WorldSkills document:

1. Geometric navy/teal cover page
2. Contents page
3. Introduction
4. Description of project and tasks
5. Application overview and device/time table
6. General Demands
7. Pages Demands
8. For each page: `Elements include` followed by `Functional requirements`
9. Instructions to the Competitor
10. A detailed 15-point marking scheme

Headers, footers, page number, date, version, and document code will imitate the restrained competition-document layout. No official WorldSkills logo will be embedded. Prototype screenshots are not required; a compact screen-flow overview will replace them.

## 4. Competition Scope

- Module: Functionality
- Duration: 2.5 hours
- Device: tablet, landscape orientation
- Technology: neutral; Android, iOS, Flutter, or another permitted platform may be used
- Connectivity: all core functionality works offline
- Input data: supplied JSON files
- Runtime persistence: all mutations, rentals, settings, and history survive app restart
- Application name: `CityCycle Operations`

## 5. Application Structure

The application uses a fixed navigation rail with these destinations:

1. Dashboard
2. Stations
3. Rentals
4. Assistant
5. History

The active destination is visibly highlighted. Navigation must not reset running rental timers.

## 6. Functional Modules

### 6.1 Dashboard

The Dashboard derives, rather than reads, the following values:

- total available bikes
- total empty docks
- active rental count
- overtime rental count
- station requiring bikes most urgently
- active rental that will enter overtime first

It groups completed rentals by start hour for the current date and displays an hourly line or bar chart. It updates immediately after rental, return, extension, or bike-transfer operations.

### 6.2 Station Management

Station cards show capacity, available bikes, empty docks, distance, and a derived health state.

Health-state rules:

- `Critical`: available bikes equals zero OR empty docks equals zero
- `Low`: not Critical, and available/capacity is at most 25% OR empty/capacity is at most 20%
- `Normal`: all other stations

Search and filters operate together. Sorting options are:

- urgency: Critical, Low, Normal; ties by station name
- available bikes: descending; ties by station name
- distance: ascending; ties by station name

An available bike can be dragged from its source station to another station. A transfer is rejected when the source bike is rented or under maintenance, or when the destination has no empty dock. A successful transfer updates both station summaries and persists the bike location.

### 6.3 Rental Console

The competitor selects a member, station, available bike, pricing plan, and optional insurance. The application validates:

- member ID must exist in `members.json`
- phone input must contain 8 to 12 digits
- the selected bike must still be available
- the member may have no more than two simultaneous Active or Overtime rentals

Estimated charge:

`unlock fee + (base block price x ceiling(billing minutes / 30) x (1 - member discount rate)) + insurance fee`

Every monetary result is rounded to two decimal places after the full calculation.

The JSON contains a 15-second Quick Test plan for marking, plus realistic 30- and 60-minute plans. Creating a rental sets the bike to rented, removes it from its station, stores start/end timestamps, and updates all dependent summaries.

### 6.4 Active Rentals

Rental state machine:

`Active -> Overtime -> Completed`

- Active rentals show a remaining-time countdown and progress indicator updated every second.
- At zero remaining time, the rental automatically becomes Overtime.
- Overtime duration counts upward.
- Overtime charge uses a started-block calculation from the selected pricing rule.
- Extension increases the planned end timestamp and base charge using the plan-specific extension duration.
- Ending a rental requires a destination station with at least one empty dock.
- Ending the rental changes the bike to available at the destination and creates a completed history record.
- When the app resumes or restarts, state is reconstructed from timestamps. The app must not depend on an in-memory timer having continued to run.

Final charge:

`estimated base charge + overtime rate x ceiling(overtime seconds / overtime block seconds)`

### 6.5 Smart Assistant

This is a deterministic local assistant, not a network or generative-AI feature. It supports exactly three suggested questions:

- `Report system status`
- `Which station needs bikes most?`
- `Which rental will become overtime first?`

System status reports derived totals. The most-needed station is the station with the lowest available-bike ratio among stations with an empty dock; ties use smaller distance, then station ID. The next overtime rental is the Active rental with the earliest planned end time; ties use rental ID. Empty states have exact required replies. Any other input returns `CityCycle is ready to assist.`

### 6.6 Rental History

History combines seed data with locally completed rentals. It supports simultaneous filters for member, station, and date. Date input accepts `yyyy/MM/dd`, `yyyy-MM-dd`, and `yyyyMMdd`. Each record shows actual duration, base charge, overtime charge, insurance, and total. A share action sends a plain-text summary through the operating system share mechanism.

## 7. JSON Data Design

### stations.json

Eight stations with ID, name, district, capacity, distance, and coordinates. Availability and health state are never stored directly.

### bikes.json

At least 28 bikes. Each record contains ID, type, status, battery percentage for e-bikes, and nullable current station ID. Data includes available, maintenance, and rented examples and deliberately fills one station to capacity.

### pricing_rules.json

Three plans, including a 15-second marking plan. Each plan defines runtime duration, billing minutes, base block price, unlock fee, insurance fee, extension duration, overtime block duration, and overtime rate.

### members.json

Six members with IDs, names, phone numbers, membership tiers, and discount rates. One member begins with two active rentals to test the rental limit.

### active_rentals.json

Three initial rentals linked to rented bikes and valid members. Two belong to the same member to test the simultaneous-rental limit. Start and planned-end timestamps are ISO 8601 values; the app reconstructs the current Active or Overtime state from those timestamps.

### rental_history.json

At least 16 completed rental records distributed across multiple dates and hours. The records enable deterministic dashboard chart and filtering tests.

## 8. Error Handling and Edge Cases

The task explicitly tests:

- no bikes at a station
- no empty dock at a return or transfer destination
- simultaneous rental limit
- a bike becoming unavailable before confirmation
- Active-to-Overtime automatic transition
- extending an already-overtime rental
- app background/restart timestamp recovery
- empty assistant results
- invalid date formats
- combined filter with no results
- deterministic tie-breaking

All rejected actions leave existing data unchanged and provide a clear in-app message.

## 9. Marking Allocation

Total: 15.0 points

- General Demands: 1.0
- Dashboard: 1.5
- Station Management: 2.5
- Rental Console: 2.5
- Active Rentals: 3.2
- Smart Assistant: 1.6
- Rental History: 1.2
- Usability and functional consistency judgement: 1.5

The detailed table in the Word document will split these into measurable 0.1-0.5 point aspects with exact test data and expected results.

## 10. Submission Rules

- Package/bundle identifier: `org.citycycle.functionality.xx`
- Project folder: `XX_CityCycle_Functionality`
- Executable: `XX_CityCycle_Functionality.apk` or `XX_CityCycle_Functionality.app`
- The project, executable, and source JSON files must be inside the project folder.
- `XX` represents the competitor workstation code.

## 11. Acceptance Criteria for Generated Artifacts

- Every JSON file parses successfully and all IDs/references are internally consistent.
- Seed capacity, bike locations, rented-bike states, and member rental-limit cases reconcile.
- The Word document contains no unresolved placeholders or conflicting formulas.
- The marking table totals exactly 15.0 points.
- The DOCX is rendered to PNG pages and every page is visually inspected for clipping, overlap, broken tables, missing glyphs, and footer/page-number defects.
