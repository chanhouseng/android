# Homework and World Skill Content Workflow Design

## Goal

Use `content/homework.json` and `content/world-skills.json` as the single source for the two existing index pages while keeping detailed teaching content in HTML.

## Architecture

Static Node.js tools read validated JSON and replace only named generated regions in the existing index pages. Shared helpers own HTML escaping, path containment, ordering, URL segment encoding, manifest sorting, and diagnostics. Existing page CSS and browser-side search scripts continue to consume the same generated DOM attributes and classes, so the visual design and public URLs remain unchanged.

Legacy cards that intentionally lack an image, result page, or Training folder use explicit `null` values. Validation checks every declared published resource and never invents a missing resource.

## Commands

- `node scripts/build-content-indexes.mjs`
- `node scripts/build-content-indexes.mjs --check`
- `node scripts/new-content.mjs homework module-f`
- `node scripts/new-content.mjs exercise exercise25`
- `node scripts/validate-content.mjs`
- `node scripts/publish-training-folder.mjs "Module F"`

## Safety

The publisher accepts one direct `train/` child only, rejects traversal, absolute paths, symlinks, and sensitive files, then atomically replaces only that folder's manifest entries. It never invokes the legacy full-tree generator.

## Verification

Tests use temporary directories for creation, validation, publishing, and failure cases. The real manifest is read for compatibility but is not modified by tests.
