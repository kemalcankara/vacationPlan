# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page vacation planner (Turkish UI) for a 20–26 July London trip. No build step, no framework, no npm dependencies — plain HTML/CSS/vanilla JS served as static files. Data lives in `localStorage` and, when Firebase is configured, syncs live across everyone with the link via Firestore.

## Commands

```bash
python3 -m http.server 8080      # serve locally, then open http://127.0.0.1:8080
node --check app.js              # syntax-check the app (no test suite exists)
node --check data/trip-events.js # syntax-check the seed data
```

There is no test runner, linter, or bundler. `node --check` on the two JS files is the only verification step.

## Architecture

**Single source of truth is `state`** (`app.js`), shaped `{ events, selectedEventId, updatedAt }`. Every mutation calls `render()` then `persist()`. `render()` fully re-renders the board and day tabs from `state.events` (innerHTML rebuild, no diffing), and re-attaches all event listeners each time — so any DOM interaction must be wired inside the render functions, not once at startup.

**Three-layer persistence merge:**
1. `data/trip-events.js` sets `window.LONDON_STARTER_EVENTS` (+ `LONDON_STARTER_EVENTS_VERSION`) — the shared seed built from the user's tickets.
2. `localStorage` (`STORAGE_KEY`) — per-browser saved state.
3. Firestore doc `plans/{LONDON_PLAN_ID}` — shared live state when `firebase.config.js` has a real config.

On load, `mergeStarterEvents()` folds seed events into saved state, keyed by id then by `eventKey()` (`day::lowercased-title`). `mergeSeedEvent()` preserves user edits (any `updatedBy !== "Sistem"`) while letting seed updates through for untouched events. The Firestore `onSnapshot` handler re-runs the same merge on every remote change and re-persists; `suppressSave` guards against echo loops during remote-driven updates.

**Firebase is optional and lazy.** `initFirebase()` dynamically imports the Firebase SDK from gstatic only if `firebaseConfig.apiKey` exists; otherwise the app stays in "Yerel" (local) mode. Only `sharedState()` (events + updatedAt) is written to Firestore — `selectedEventId` stays local.

**Events** are normalized by `normalizeEvent()` (handles legacy `date` → `day` migration, infers `type` via `inferEventType()` keyword matching). `day` is one of `common`/`20`–`26`. Attachments are either external links (`url`) or embedded files (`dataUrl` + `kind` of `image`/`pdf`); see the file-attachment note below. `cleanupDemoEvents()` runs on every load to strip/relocate specific legacy demo entries.

**Plan cards open in a read-only view first.** Clicking a card runs `selectEvent()` → `openViewEvent()`, which renders the event (type, day/time, place, link, notes, image previews, PDF/link buttons, audit) into `#eventView` and only shows the edit form (`#eventForm`) when the user hits **Düzenle** (`openEditEvent()`). New plans (`openNewEvent()`) open the form directly. Both live inside the single `#eventDialog`; `showEventView()`/`showEventForm()` toggle which is visible, and `openEventDialog()` guards against calling `showModal()` on an already-open dialog.

## Conventions

- **UI text is Turkish.** Match existing tone in user-facing strings.
- **File attachments are embedded as data URIs, not uploaded to a backend.** Users can add images/PDFs directly (phone camera/gallery or computer) via the file picker in the edit form; there is still no Firebase Storage or any file server. Images are compressed client-side (`compressImage()`, max 1400px / JPEG ~0.72) and PDFs are read as-is (`readFileAsDataUrl()`); each file is rejected if it exceeds `MAX_ATTACHMENT_BYTES` (~900KB). External links (`url`) are still supported alongside embedded files. **Watch the size budget:** the whole shared plan (all events) must fit Firestore's ~1MB per-document limit, so keep embedded files small — do not add an upload-to-storage path unless the user explicitly asks to move off the free tier.
- **All user input goes through `escapeHtml()` / `escapeAttr()`** before hitting template literals — preserve this when adding rendered fields.

## Updating the plan from ticket files (see AGENTS.md)

When the user drops ticket/hotel/flight/reservation/screenshot files in `data/` and asks to update the plan:
1. Read every new source file; extract dates, times, places, counts, non-sensitive notes.
2. Update `data/trip-events.js` with **deterministic** event ids and bump `LONDON_STARTER_EVENTS_VERSION`.
3. **Never commit** raw tickets, screenshots, PDFs, phone numbers, emails, full booking refs, or ride ids — `.gitignore` already excludes common media types under `data/`. Keep seed data masked: times, areas, high-level labels, non-sensitive notes only.
4. Do not add `data/...` attachment URLs for raw files unless the user says the file is safe to publish.
5. Run `node --check` on both JS files, then commit and push to `origin/main`.
