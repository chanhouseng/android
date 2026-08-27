# Training File Browser Design

**Date:** 2026-08-27  
**Status:** Approved design, pending specification review

## Purpose

Add a static `/training/` page that presents the contents of `train/` as a searchable file browser. The page does not preview or extract question content. It shows folder and file names, lets visitors navigate the folder hierarchy, and downloads a file when its name is selected.

The page is for WorldSkills mobile application development practice materials. Its primary job is to make a large, unevenly named archive easy to browse without requiring a backend directory-listing service.

## Scope

The feature includes:

- a generated manifest describing visible folders and files under `train/`;
- a static `/training/` browser that consumes that manifest;
- hierarchical folder navigation with shareable URLs and breadcrumbs;
- global filename and path search;
- direct file downloads;
- responsive, accessible presentation inspired by the supplied directory-listing references;
- a link from the repository's root page to `/training/`;
- automated tests for manifest generation and browser behavior.

The feature does not include file previews, document content extraction, authentication, uploads, editing, or a backend service.

## Architecture

### Generated manifest

A Node.js script recursively scans `train/` and writes `training/files.json`. Keeping the scan outside the browser preserves static hosting: browsers cannot enumerate server directories, while a checked-in JSON manifest can be fetched from any ordinary static host.

The script records normalized, forward-slash-separated relative paths. Each entry has this shape:

```json
{
  "name": "Module A（en）.pdf",
  "path": "1. Module  A/Module A（en）.pdf",
  "parentPath": "1. Module  A",
  "type": "file",
  "extension": "pdf"
}
```

Folders use the same fields with `type: "folder"` and an empty `extension`. The manifest includes all ancestor folders needed to navigate to an included file.

The generator sorts folders before files and compares names with a locale-aware, numeric comparison so names such as `Module 2` appear before `Module 10`. The page also applies the same sort after filtering.

### Static browser

`training/index.html` is the `/training/` route on static hosts that serve directory indexes. Its JavaScript loads `files.json`, derives the current folder from the URL, and renders only the matching children until a search is active.

The current folder is encoded in a query parameter:

```text
/training/?path=1.%20Module%20%20A%2Fassets
```

Folder selection uses `history.pushState`; browser Back and Forward restore the corresponding folder. A malformed or nonexistent path falls back to the root and displays a brief notice.

### File links

The manifest stores paths relative to `train/`, never executable URLs. The browser creates same-origin URLs relative to `/train/`, encoding each path segment independently to preserve spaces, Unicode characters, parentheses, and literal hash or question-mark characters.

File anchors use the `download` attribute with the original filename. The visible label is only the filename. Folder entries are buttons or links that navigate inside the browser and never trigger downloads.

## Content and classification

The existing `train/` hierarchy is the classification system. The root lists first-level collections such as modules, years, competitions, or named exercises. Selecting a folder reveals its immediate child folders and files. No inferred Module A–E taxonomy is imposed because the archive already contains overlapping naming conventions and language variants.

The manifest excludes:

- hidden files and hidden directories whose names begin with `.`;
- `desktop.ini`, `Thumbs.db`, and `.DS_Store`;
- `train/docs/`, which contains development plans rather than training material;
- files with temporary editor suffixes such as `~` or `.tmp`;
- the manifest output itself if the output location changes in the future.

All other file types are downloadable, including PDFs, Word documents, spreadsheets, JSON, images, audio, video, archives, and supplied source or server files. This preserves the training package as stored rather than silently omitting supporting assets.

## Search

Search is global whenever the query is non-empty. It performs case-insensitive matching against both the entry name and full relative path. Unicode text is normalized before comparison so visually equivalent filenames remain discoverable.

Search results contain files only. Each result shows the filename as its primary label and the parent folder path as secondary context. This prevents thousands of matching folder and file entries from duplicating one another. Clearing the query returns the visitor to the folder they were browsing before search began.

The search field updates results as the user types. It has an accessible label, a visible clear control when populated, and a result-count announcement using a polite live region.

## Interface design

The visual direction follows the supplied lightweight directory-listing screenshots while improving hierarchy, responsiveness, and accessibility.

### Palette

- **Paper:** `#F7F8FA` — page background
- **Surface:** `#FFFFFF` — browser surface and controls
- **Ink:** `#253247` — primary text and path header
- **Muted:** `#687386` — metadata and secondary paths
- **Folder amber:** `#E5A524` — folder identity
- **Focus blue:** `#1769E0` — focus, active links, and search emphasis

### Typography

The interface uses the local system stack `"Segoe UI", "Noto Sans TC", sans-serif` for readable Chinese and Latin filenames. Breadcrumb paths and small file-type labels use `"Cascadia Mono", "SFMono-Regular", Consolas, monospace` to give the browser a practical file-system character without loading external fonts.

### Layout

The path header is the page's signature element: a large, persistent breadcrumb beginning with `~/train/`. It communicates location rather than acting as decoration.

On wide screens, immediate children appear in a three-column grid. Medium screens use two columns and phones use one. Each item is a restrained row with a file-type icon and filename; there are no preview cards, descriptions, thumbnails, or extracted content. Folders appear before files.

The search control sits alongside the path header on wide screens and below it on narrow screens. Keyboard focus is always visible. Motion is limited to a short opacity change when results refresh and is disabled by `prefers-reduced-motion`.

## States and error handling

- While the manifest loads, the page shows a small `正在載入檔案…` status.
- An empty folder shows `這個資料夾沒有可顯示的檔案。` and retains the breadcrumb.
- A search with no matches shows `找不到符合的檔案。` with a control to clear the query.
- A manifest fetch or parse failure shows `無法載入題目索引。請重新整理頁面。` and a retry control.
- An invalid `path` query returns to the manifest root and announces that the requested folder was not found.
- Broken downloads remain ordinary browser download failures; the page does not claim that a download succeeded.

## Accessibility

The page uses a real heading, navigation landmark for breadcrumbs, labeled search input, list semantics for entries, and native anchors for downloads. Folder controls are keyboard operable. Decorative icons are hidden from assistive technology; filenames remain the accessible names. Status changes and search counts are announced without stealing focus.

Color is not the only indicator of file or folder type. Text labels and distinct icons communicate the difference, and foreground/background combinations meet WCAG AA contrast.

## Testing

Tests use Node's built-in test runner so the static repository does not require a package installation.

Generator tests create a temporary fixture tree and verify:

- recursive folder and file discovery;
- system, hidden, temporary, and `train/docs/` exclusions;
- forward-slash path normalization;
- Unicode and space preservation;
- folder-first natural sorting;
- deterministic JSON output.

Browser logic is kept in importable pure functions and tested for:

- immediate-child selection for a folder;
- global case-insensitive and Unicode-normalized search;
- file-only search results;
- breadcrumb segment construction;
- per-segment URL encoding for folder and download links;
- invalid path fallback;
- folder-first natural sorting.

Final verification includes generating the real manifest, running all tests, serving the repository through a local static server, checking root and nested navigation, downloading representative Unicode-named files, exercising browser Back and Forward, and visually checking desktop and mobile widths.

## Update workflow

When files under `train/` change, run the documented index command before deployment. The command rewrites `training/files.json` deterministically, making manifest changes reviewable in Git. The root `README.md` documents this workflow alongside the exact command.

## Files affected

- `training/index.html` — static page structure
- `training/styles.css` — responsive visual system
- `training/app.js` — rendering, navigation, search, and download-link behavior
- `training/browser-core.js` — pure path, filtering, sorting, and URL helpers
- `training/files.json` — generated archive manifest
- `scripts/generate-training-index.mjs` — recursive manifest generator
- `tests/training-index.test.mjs` — generator tests
- `tests/training-browser.test.mjs` — browser-core tests
- `index.html` — link to the new `/training/` route
- `README.md` — manifest refresh instructions

