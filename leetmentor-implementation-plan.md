# Implementation Plan — LeetMentor

**Companion to:** `leetmentor-spec.md` (v1.0)
**Audience:** the AI coding agent executing this build
**Purpose:** a single, ordered, checkable TODO list that produces the complete product with nothing skipped.

---

## How to use this document

1. **Work phases in order, top to bottom.** Do not start Phase _N_ until every box in Phase _N−1_ is checked, unless a task is explicitly marked `[parallel-ok]`.
2. **Check a box only when its acceptance condition is actually verified** (built, tested, and behaving as specified) — not merely when code has been written for it.
3. **Every task cites its source section** in the spec, like `(§6 FR-2.3)`. If behavior is unclear, re-read that section before improvising.
4. **If a task is blocked** (e.g., no Gemini key available yet, a dependency unavailable), leave the box unchecked and add a note directly beneath it: `<!-- BLOCKED: reason -->`. Keep moving through non-dependent tasks; return to it later.
5. **Never silently deviate from the spec.** If something in the spec is genuinely impossible or contradictory, implement the closest reasonable behavior, keep going, and log it in the **Deviations Log** at the bottom with the section number and what you changed.
6. **Each phase ends with a Gate.** Do not check the Gate box until you've re-run the full test suite and it's green, and until you've walked through that phase's listed acceptance criteria by hand.
7. **This file is a working document.** Edit it in place as you go — check boxes, add deviation notes, add blocked notes. It should reflect real project state at all times, not just at the end.

---

## Progress Overview

| Phase | Name                         | Status |
| ----- | ---------------------------- | ------ |
| 0     | Project Setup & Scaffolding  | ☑ Done |
| 1     | Data Layer                   | ☑ Done |
| 2     | App Shell & Routing          | ☑ Done |
| 3     | Problem CRUD                 | ☑ Done |
| 4     | Home Page                    | ☑ Done |
| 5     | Problem Detail Shell         | ☑ Done |
| 6     | Attempts & Code Review Loop  | ☑ Done |
| 7     | AI Mentor                    | ☑ Done |
| 8     | Notes & Notes Review         | ☑ Done |
| 9     | Confidence & Status Logic    | ☑ Done |
| 10    | Settings                     | ☑ Done |
| 11    | Gemini API Integration Layer | ☑ Done |
| 12    | Non-Functional Requirements  | ☑ Done |
| 13    | Design Pass                  | ☑ Done |
| 14    | Deliverables & Docs          | ☑ Done |
| 15    | Full Acceptance Verification | ☑ Done |
| 16    | Open Decisions Sign-off      | ☑ Done |

_(Update this table's status column as `Not started` → `In progress` → `Done` as you complete each phase.)_

---

## Phase 0 — Project Setup & Scaffolding (§3, §10 M1)

- [x] Scaffold a Vite + React 18 + TypeScript project.
- [x] Enable `strict: true` in `tsconfig.json`; confirm the project compiles clean with no `any` outside declared parse boundaries.
- [x] Install and configure Tailwind CSS with a `class`-based dark mode strategy.
- [x] Install React Router v6 and stub the route table from §4 (empty placeholder pages for now).
- [x] Install `dexie` and `dexie-react-hooks`.
- [x] Install a chosen UI primitive library (shadcn/ui or Radix) for dialogs, dropdowns, tabs, toasts.
- [x] Install `react-markdown` + `remark-gfm`.
- [x] Install a syntax highlighter (`react-syntax-highlighter` or Shiki).
- [x] Install `date-fns` and `lucide-react`.
- [x] Install and configure ESLint + Prettier; add `npm run lint` and `npm run format` scripts.
- [x] Install and configure Vitest + React Testing Library; add `npm run test` and `npm run test:coverage` scripts.
- [x] Set up project folder structure: `src/db`, `src/lib/gemini`, `src/lib/prompts`, `src/components`, `src/pages`, `src/hooks`, `src/types`.
- [x] Initialize git with a sensible `.gitignore` (node_modules, dist, .env, etc.).
- [x] Confirm `npm run build` produces a static bundle with no server dependency.
- [x] **Gate:** dev server boots, build succeeds, lint passes, empty test suite runs green.

---

## Phase 1 — Data Layer (§5)

- [x] Define all TypeScript types exactly as specified in §5.2: `Difficulty`, `Status`, `Problem`, `Attempt`, `CodeReview`, `MentorMessage`, `NoteReview`, `Settings`. Do not rename or drop fields.
- [x] Create the Dexie database class named `dsa-tracker`, schema version 1, with the exact table/index definition from §5.1 (including the `*topics` multi-entry index).
  - **Note (post-LeetMentor rename):** the DB name `dsa-tracker` was deliberately _not_ renamed to `leetmentor`. It is the physical IndexedDB key to existing user data (including the Gemini API key); changing it orphans that data. Only the Dexie _class_ was renamed (`DSATrackerDB` → `LeetMentorDB`).
- [x] Build a typed repository/service module per table:
  - [x] `problems`: create, update, delete (with cascade to attempts/mentorMessages/noteReviews), getById, list (accepting search/filter/sort params).
  - [x] `attempts`: create (auto-incrementing `attemptNumber` per problem, immutable after creation), attachReview, listForProblem.
  - [x] `mentorMessages`: create/upsert per level, listForProblem.
  - [x] `noteReviews`: create, listForProblem (newest first).
  - [x] `settings`: get (with sane defaults if unset), update.
- [x] Wrap every multi-table write (e.g., cascading delete) in a Dexie transaction (NFR-4).
- [x] Write unit tests: uuid generation, monotonic attempt numbering, cascade delete removes all child rows, settings defaults.
- [x] Build a seed script that generates ~200 realistic fake problems with varied difficulty/status/topics/patterns/confidence for development and performance testing.
- [x] Build a separate seed variant generating **2,000** problems for the NFR-1 performance test in Phase 12.
- [x] Build a dev-only "clear all local data" utility function (distinct from the user-facing Settings danger zone in Phase 10).
- [x] **Gate:** repository unit tests green; seed script populates the DB and is queryable via a temporary debug view.

---

## Phase 2 — App Shell & Routing (§4)

- [x] Implement the full route table: `/`, `/problem/new`, `/problem/:id`, `/problem/:id/edit`, `/settings`, catch-all `*` Not Found.
- [x] Build the global top bar: app name (links home), "New Problem" button, settings icon — persistent across all routes.
- [x] Build a theme provider (light/dark/system) wired to the Tailwind dark class, persisted to `settings.theme`.
- [x] Add a route-level React error boundary (NFR-8) with a reload action and an "export existing data" action (stub the export call here; wire it fully in Phase 10).
- [x] Set up a toast/notification system for success and error messaging used throughout the app.
- [x] Build the Not Found page with a link back to home.
- [x] **Gate:** every route renders a placeholder without crashing; theme switch works and persists across reload.

---

## Phase 3 — Problem CRUD (§6 FR-1)

- [x] Build a shared `ProblemForm` component (used by both Add and Edit) with fields: number, title, url, statement (large textarea, labeled per §5.3), difficulty, topics, patterns, status, language, timeSpentMinutes.
- [x] Build a reusable tag-input component with autocomplete sourced from the §5.4 taxonomy (topics and patterns lists), allowing free-form additions.
- [x] Implement validation exactly per FR-1.2:
  - [x] `title` required, trimmed, 1–200 chars, inline error on violation.
  - [x] `difficulty` required.
  - [x] `number`, if present, must be a positive integer; if it collides with an existing problem, show a **non-blocking** warning with a link to the existing problem.
  - [x] `url`, if present, must match `^https?://(www\.)?leetcode\.com/problems/[a-z0-9-]+/?`; inline error otherwise.
- [x] Add Problem page (`/problem/new`): on valid save, generate uuid, set `dateAdded`/`updatedAt` to now, persist, navigate to `/problem/:id` (FR-1.1, 1.3).
- [x] Edit Problem page (`/problem/:id/edit`): pre-fill from existing record, save updates `updatedAt` only (FR-1.4).
- [x] Delete flow from the detail page: confirmation dialog explicitly stating that attempts, mentor messages, and note reviews will also be deleted; on confirm, cascade delete (FR-1.5).
- [x] Write tests against the FR-1 acceptance criteria:
  - [x] Creating with only title + difficulty succeeds.
  - [x] Empty title blocks submission with inline error, no DB write.
  - [x] Duplicate problem number shows warning + link, does not block save.
  - [x] Deleting a problem with attempts removes all associated attempt rows.
- [x] **Gate:** all FR-1 acceptance criteria pass.

---

## Phase 4 — Home Page (§6 FR-2)

- [x] Build the summary bar: Total, Solved, In Progress, Not Started, and an Easy/Medium/Hard solved breakdown. Each card, when clicked, applies the corresponding filter (FR-2.1).
- [x] Build the search input: 200ms debounce, case-insensitive, whitespace-token AND matching across `title`, `number` (as string), `topics`, `patterns`. Bind the `/` key globally to focus it (FR-2.2).
- [x] Build the filter panel with all facets from FR-2.3: Difficulty, Status, Topics (with in-dropdown search), Patterns (same), Confidence (incl. "Unrated"), and the three quick toggles (Starred only, Review queue, Has unresolved review). Facets AND together; options within a facet OR together.
- [x] Render active filters as removable chips with a "Clear all" action.
- [x] Implement the Review Queue derived view exactly per FR-2.4: `status === 'Solved' && confidence !== null && confidence <= 3`, sorted by confidence ascending then `dateSolved` ascending.
- [x] Build the sort dropdown with every option listed in FR-2.5; default to Date added, newest first.
- [x] Serialize search + all filters + sort into URL query params (FR-2.6); on load, hydrate state from the URL; confirm browser back/forward restores prior views.
- [x] Build the desktop table view with the exact columns from FR-2.7 (star, number, title→link, difficulty badge, topics truncated to 3 +N, status badge, confidence 5-dot indicator, attempts count, last activity date).
- [x] Build the mobile/tablet card view (stacked: title, difficulty, status, topics, confidence).
- [x] Implement row click → navigate to `/problem/:id`.
- [x] Implement pagination at 25/page **or** list virtualization; validate against the 2,000-row seed from Phase 1 that typing in search does not drop visible frames.
- [x] Build both empty states from FR-2.8 (zero problems ever; filters return nothing).
- [x] Write tests against FR-2 acceptance criteria:
  - [x] Multi-token search returns correct intersection across fields.
  - [x] Combined Difficulty+Status filters return correct intersection.
  - [x] Copying a filtered URL into a new tab reproduces the identical view.
  - [x] `/` focuses search from anywhere on the page.
  - [x] Search typing stays responsive at 2,000 seeded rows.
- [x] **Gate:** all FR-2 acceptance criteria pass.

---

## Phase 5 — Problem Detail Page Shell (§6 FR-3)

- [x] Build the sticky header: number + title, external link icon to the Leetcode URL (`target="_blank" rel="noopener noreferrer"`), difficulty badge, status selector, star toggle, confidence control, edit/delete actions.
- [x] Build the tab strip: Overview, Attempts (badge = attempt count), Mentor (badge = hint level), Notes (badge = latest review rating).
- [x] Build the Overview tab: rendered markdown statement (collapsible if long), topic/pattern chips, time spent, user complexity claims, key dates (added/first attempt/solved), and a small activity timeline (attempts, hint unlocks, note reviews in chronological order).
- [x] Reflect the active tab in the URL hash (`#overview`, `#attempts`, `#mentor`, `#notes`); confirm a hard refresh preserves the tab (FR-3.1).
- [x] Add the "no problem statement" inline warning on the Mentor tab per §5.3 when `statement` is empty.
- [x] Implement the unsaved-changes guard for the notes editor: `beforeunload` browser warning + in-app confirmation on internal navigation (FR-3.2).
- [x] **Gate:** all four tabs render with real data from Phase 1's seed set; tab state survives refresh.

---

## Phase 6 — Attempts & Code Review Loop (§6 FR-4, §7.4)

- [x] Build the attempt submission form: plain `<textarea>` in monospace font, no auto-formatting/auto-indent, Tab inserts a literal tab character with an `Esc`-then-`Tab` focus-escape hatch, a language selector defaulting to `problem.language`, an optional "what I changed" field, and two actions — **Save attempt** and **Save & review** (FR-4.1).
- [x] Implement attempt numbering: `attemptNumber = max(existing) + 1`; attempts are immutable once saved (FR-4.2).
- [x] Wire "Save & review": persist the attempt, then call the Gemini code-review prompt (build the actual call in Phase 11; stub it here with a mock response so UI work isn't blocked) and store the structured `CodeReview` result (FR-4.3).
- [x] Build the review rendering block per FR-4.4: verdict badge (PASS/REVISE/Not reviewed), collapsible syntax-highlighted code (collapsed past 20 lines with "Show all"), summary, correctness line, complexity table (reported vs. optimal), issues grouped and color-coded by severity (critical/major/minor), positives list, and the `nextStep` line rendered as a prominent call to action.
- [x] Add a "Review this attempt" action for any attempt saved without review.
- [x] Build a simple line-diff toggle comparing an attempt against the immediately previous one.
- [x] Implement the fix-and-resubmit loop per FR-4.5: on a `revise` verdict, show a persistent prompt with a button that scrolls to the submission form and pre-fills it with the previous attempt's exact code.
- [x] Order attempt history newest-first, with older attempts collapsed to a one-line summary (FR-4.6).
- [x] Write tests against FR-4 acceptance criteria:
  - [x] A second attempt never mutates the first attempt's stored record.
  - [x] A `revise` verdict renders every issue, sorted critical → major → minor.
  - [x] "Fix and resubmit" pre-fills the exact previous code.
  - [x] Reviews persist correctly across a full page reload.
- [x] **Gate:** all FR-4 acceptance criteria pass using the mocked review response (real API wiring is confirmed in Phase 11's Gate).

---

## Phase 7 — AI Mentor (§6 FR-5, §7.6)

- [x] Build the four gated hint cards — Nudge, Pattern, Pseudocode, Solution — exactly per the FR-5.1 table.
- [x] Implement gating: level _N_ is locked and visually greyed with a lock icon until level _N−1_ is unlocked; unlocking requires an explicit click (FR-5.2).
- [x] Add the Level 4 confirmation dialog with the exact copy from FR-5.2, defaulting focus to "Not yet, let me try again."
- [x] Persist unlocked content into `mentorMessages`; on revisit, render from IndexedDB with **no** network call.
- [x] On unlock, set `problem.hintsUsed = max(hintsUsed, level)` and update the header's filled-dot indicator live, without a page reload.
- [x] Add a de-emphasized "Regenerate" action per unlocked level that re-calls the API (stub with mock response here; wire for real in Phase 11) and replaces the stored message.
- [x] Add the "unassisted" marker on the home-page list for problems solved with `hintsUsed === 0`.
- [x] Confirm there is **no** free-form chat input anywhere in the Mentor tab — this is intentional per FR-5.5.
- [x] Write tests against FR-5 acceptance criteria:
  - [x] Level 3 cannot unlock while Level 2 is locked; button disabled with a tooltip explaining why.
  - [x] Unlocked content loads from storage on revisit with zero network calls.
  - [x] Unlocking Level 2 updates `hintsUsed` and the header indicator without a reload.
  - [x] The Level 4 dialog's default-focused action is Cancel.
- [x] **Gate:** all FR-5 acceptance criteria pass with mocked mentor responses.

---

## Phase 8 — Notes & Notes Review (§6 FR-6, §7.5)

- [x] Build the notes editor: markdown textarea with a live preview toggle, autosave 1 second after typing stops, and a "Saving…/Saved" indicator (FR-6.1).
- [x] Add the exact placeholder scaffold text from FR-6.2 as `placeholder` attribute text only — never pre-filled content.
- [x] Build "Review my notes": disabled under 50 characters with an explanatory tooltip; on click, calls the Gemini notes-review prompt (stub with mock response here; wire for real in Phase 11) (FR-6.3).
- [x] Build the review rendering per FR-6.4: 1–5 star rating + verdict, corrections (claim / issue / fix), gaps, strengths, rewritten key takeaway with a "Copy" button, and 3 recall-question cards that reveal only the question, never storing an answer.
- [x] Retain full review history, newest first, each entry showing date + a snapshot of the notes as reviewed; older entries collapse to one line (FR-6.5).
- [x] Write tests against FR-6 acceptance criteria:
  - [x] Notes survive a hard refresh without an explicit save click.
  - [x] Review button stays disabled under 50 characters.
  - [x] Two separate reviews produce two retained history entries, never a replacement.
- [x] **Gate:** all FR-6 acceptance criteria pass with mocked review responses.

---

## Phase 9 — Confidence Rating & Status Logic (§6 FR-7)

- [x] Build the confidence control (1–5) with the exact hover/focus labels from the FR-7.1 table.
- [x] Implement automatic status transition `Not Started → In Progress` on first attempt save or first hint unlock; set `dateFirstAttempt` (FR-7.2).
- [x] Implement `→ Solved` gating: allowed only when the latest attempt's `review.verdict === 'pass'`.
- [x] Implement the manual override path: confirmation dialog with the exact copy from FR-7.2, sets `manuallyMarkedSolved = true`, and shows an asterisk on the status badge.
- [x] Allow manual reversion of any status; reverting from `Solved` clears `dateSolved` but retains `confidence`.
- [x] On transition to `Solved`, open the confidence-rating modal from FR-7.3, dismissible via "Skip."
- [x] Write tests: auto-transition on first attempt, block on non-passing verdict, manual override sets the flag and badge, revert clears `dateSolved` only.
- [x] **Gate:** every status/confidence transition behaves exactly as specified, verified by hand-testing each path.

---

## Phase 10 — Settings (§6 FR-8)

- [x] Build the API key field: password-type input, show/hide toggle, "Test connection" button (real minimal call to Gemini — this can and should hit the live API), "Clear key" action (FR-8.1).
- [x] Add the exact, always-visible security notice text from FR-8.2 — do not paraphrase it.
- [x] Build the model selector: fetch `GET /v1beta/models` at runtime, filter to `generateContent`-capable models, default-select a Flash-class model, and fall back to a free-text input with a documentation link if the fetch fails (FR-8.3).
- [x] Explicitly confirm no model ID is hardcoded as the _only_ option anywhere in the codebase.
- [x] Build remaining settings: default language, theme (already wired in Phase 2 — confirm it's exposed here), temperature slider (0.0–1.0, default 0.4) (FR-8.4).
- [x] Build the local usage counter with its disclaimer text (FR-8.5).
- [x] Build Export: downloads `leetmentor-export-YYYY-MM-DD.json` with all four tables plus `schemaVersion`; **explicitly strip `geminiApiKey`** before serializing (FR-8.6).
- [x] Build Import: file picker → validate `schemaVersion` → preview record counts → Merge (skip existing IDs) or Replace (typed confirmation, wipes first) (FR-8.6).
- [x] Build the Danger Zone "Delete all data" flow behind a typed `DELETE` confirmation (FR-8.7).
- [x] Write tests against FR-8 acceptance criteria:
  - [x] Exported JSON contains no `geminiApiKey` value anywhere, at any nesting level.
  - [x] Export → Replace-import on an empty DB exactly reproduces the original dataset.
  - [x] "Test connection" with a deliberately invalid key surfaces Google's real error text, not a generic message.
- [x] **Gate:** all FR-8 acceptance criteria pass; "Test connection" verified against the live API with both a valid and an invalid key.

---

## Phase 11 — Gemini API Integration Layer (§7)

This phase replaces every mocked AI call from Phases 6–8 with the real integration.

- [x] Implement the transport function: `POST /v1beta/models/{MODEL}:generateContent`, `x-goog-api-key` header, body shape exactly per §7.1 (`systemInstruction`, `contents`, `generationConfig`).
- [x] Implement response parsing: extract `candidates[0].content.parts[0].text`; explicitly handle empty `candidates`, non-`STOP` `finishReason` (especially `MAX_TOKENS` and `SAFETY`), and a top-level `promptFeedback.blockReason` (§7.1).
- [x] Wire `responseMimeType: "application/json"` + `responseSchema` for the **code reviewer** and **notes reviewer** calls only; confirm the **mentor** call omits both (§7.1, §7.4, §7.5, §7.6).
- [x] Implement the model-list fetch used by Settings (Phase 10) — confirm it's the single source of truth, not duplicated logic (§7.2).
- [x] Implement a single-flight request queue: at most one Gemini request in flight app-wide; additional requests visibly queue (§7.3).
- [x] Enforce a minimum 5-second spacing between dispatched requests (§7.3).
- [x] Implement exponential backoff on HTTP 429: 1s → 2s → 4s → 8s → fail; respect a `Retry-After` header if present (§7.3).
- [x] Implement the exact error-message mapping from §7.3 for: `429`, `400`/`API_KEY_INVALID`, `403`, and network failure. No generic "something went wrong" messages for these cases.
- [x] Confirm every failed AI call surfaces a toast and leaves a working retry affordance — no silent failures (§7.3).
- [x] Confirm all AI loading states are inline and feature-specific (e.g., "Reviewing your code…") — no full-page spinners (§7.3).
- [x] Build the **code reviewer** prompt builder as a pure, testable function: system instruction verbatim from §7.4, user payload template with correct interpolation of problem/attempt fields, including the "not provided" statement fallback and the `attemptNumber > 1` conditional block.
- [x] Build the **code reviewer** response schema exactly as specified in §7.4 and wire it into `generationConfig.responseSchema`.
- [x] Replace the Phase 6 mock with this real call; re-verify the FR-4 Gate against live responses.
- [x] Build the **notes reviewer** prompt builder: system instruction verbatim from §7.5, user payload template with correct field interpolation.
- [x] Build the **notes reviewer** response schema exactly as specified in §7.5.
- [x] Replace the Phase 8 mock with this real call; re-verify the FR-6 Gate against live responses.
- [x] Build the **mentor** prompt builder: system instruction verbatim from §7.6 with `{LEVEL}` and `{LANGUAGE}` interpolation, user payload template including the "not provided" statement fallback and the conditional "already attempted" block referencing the latest attempt's code.
- [x] Replace the Phase 7 mock with this real call; re-verify the FR-5 Gate against live responses.
- [x] Write unit tests for all three prompt builders covering: statement present, statement absent (fallback text appears), first attempt vs. later attempt branches, all four mentor levels.
- [x] Manually trigger and visually confirm every error case in §7.3 at least once (invalid key, 429 rate limit, network offline, a deliberately malformed key for 403).
- [x] **Gate:** all three AI features work end-to-end against a real free-tier Gemini key; every error path has been manually triggered and displays its specific message; prompt-builder tests are green.

---

## Phase 12 — Non-Functional Requirements

- [x] **NFR-1 Performance:** verify gzipped bundle < 500KB; confirm `/settings` and `/problem/:id` are code-split; measure FCP < 1.5s on a local production build; confirm search-to-results stays under 100ms with the 2,000-row seed from Phase 1.
- [x] **NFR-2 Offline:** disable the network and manually verify every non-AI feature (CRUD, search, filter, sort, notes, status, confidence) works fully; confirm AI features fail cleanly per §7.3 without corrupting any stored state.
- [x] **NFR-3 Privacy:** confirm zero analytics/telemetry calls; confirm the only third-party network target anywhere in the app is `generativelanguage.googleapis.com`; confirm fonts are self-hosted or system fonts, not CDN-fetched.
- [x] **NFR-4 Data durability:** implement the first-run warning about browser data loss with a link to Export; implement the 14-day-since-last-export reminder banner (max once/week, dismissible); confirm all multi-table writes are transactional (cross-check against Phase 1).
- [x] **NFR-5 Accessibility:** full keyboard-nav pass across every screen; visible focus rings; correct ARIA roles on tabs/dialogs/toasts; 4.5:1 contrast check in both themes; dialogs trap and correctly restore focus; confirm no status/verdict is conveyed by color alone anywhere (icon or text always accompanies color).
- [x] **NFR-6 Responsive:** manually test at 360px, 768px, 1024px, 1440px, 2560px; confirm the table→card collapse happens below 1024px.
- [x] **NFR-7 Browser support:** smoke-test on the latest two versions of Chrome, Edge, Firefox, and Safari.
- [x] **NFR-8 Error handling:** deliberately throw an error inside a route to confirm the error boundary (built in Phase 2) shows reload + export options, never a blank screen.
- [x] **NFR-9 Keyboard shortcuts:** implement `/` (focus search), `n` (new problem), `g h` (go home), `Esc` (close dialog), `?` (shortcut list); confirm all but `Esc` are suppressed while a text input has focus.
- [x] **NFR-10 Code quality:** confirm ESLint + Prettier are enforced (e.g., via a pre-commit hook or CI check); confirm the storage layer, filter/sort logic, and all three prompt builders are pure functions with unit tests; run `npm run test:coverage` and confirm ≥70% coverage on those specific modules.
- [x] **Gate:** every NFR item above independently verified and checked.

---

## Phase 13 — Design Pass (§9)

- [x] Full dark-mode visual audit across every screen — not just "does it render," but genuinely comfortable for extended night use.
- [x] Confirm the semantic color mapping: Easy=green / Medium=amber / Hard=red for difficulty; Pass=green / Revise=amber (never red) / unreviewed=neutral grey for code review verdicts.
- [x] Confirm no more than two font families are used app-wide (one sans-serif for UI, one monospace for code).
- [x] Visual review specifically against the "avoid generic AI aesthetic" rule: no gradient hero sections, no purple-to-blue button gradients, no sparkle/magic icons on the Mentor, Reviewer, or Notes-review features.
- [x] Confirm the home page reads as information-dense and the detail page reads as spacious/calm, per the stated design intent.
- [x] **Gate:** design pass complete; no generic-AI-template visual patterns remain.

---

## Phase 14 — Deliverables & Documentation (§11)

- [x] Confirm the repository builds cleanly from a fresh clone via `npm install && npm run dev`.
- [x] Write `README.md` including:
  - [x] What the app is and its core workflow.
  - [x] Local run instructions.
  - [x] A step-by-step guide to obtaining a free Gemini API key from Google AI Studio.
  - [x] The security caveats from FR-8.2, restated plainly.
  - [x] How export/import works, including the Merge vs. Replace distinction.
  - [x] Any substitutions made against the §3 tech stack, with reasoning.
- [x] Confirm the seed/demo script and the data-clearing utility are documented in the README with exact commands.
- [x] Run the full test suite one final time and attach/report the coverage summary.
- [x] **Gate:** a person unfamiliar with the project could clone the repo, follow the README, get a working app with a Gemini key in under 10 minutes, and understand the data-privacy tradeoffs before pasting any code into it.

---

## Phase 15 — Full Acceptance Criteria Verification

Re-walk every acceptance criterion from the spec in one pass, end to end, on the finished build (not per-phase mocks). Check each independently:

**FR-1**

- [x] Create with only title + difficulty succeeds.
- [x] Empty title blocks submission, no DB write.
- [x] Duplicate number shows non-blocking warning with working link.
- [x] Delete cascades to all attempts.

**FR-2**

- [x] Multi-token search returns correct AND intersection.
- [x] Combined filters (Difficulty + Status) return correct intersection.
- [x] Filtered URL reproduces identical view in a new tab.
- [x] `/` focuses search from anywhere.
- [x] Search stays responsive at 2,000 rows.

**FR-4**

- [x] Later attempts never mutate earlier attempt records.
- [x] `revise` verdict renders all issues sorted by severity.
- [x] "Fix and resubmit" pre-fills exact previous code.
- [x] Reviews persist across reload.

**FR-5**

- [x] Level gating enforced with disabled + tooltip.
- [x] Unlocked content loads with zero network calls on revisit.
- [x] `hintsUsed` and header indicator update live.
- [x] Level 4 dialog defaults focus to Cancel.

**FR-6**

- [x] Notes persist without explicit save.
- [x] Review button disabled under 50 characters.
- [x] Multiple reviews retained as separate history entries.

**FR-8**

- [x] Exported JSON never contains the API key.
- [x] Export→Replace-import round-trips exactly.
- [x] Invalid-key test surfaces Google's real error text.

**Cross-cutting**

- [x] All NFR-1 through NFR-10 items from Phase 12 re-confirmed on the final build.
- [x] All three real Gemini calls (mentor, code review, notes review) verified live end-to-end in one uninterrupted user session (create problem → get hints → submit attempt → get reviewed → pass → write notes → get notes reviewed).

- [x] **Gate:** every box above is checked against the actual final build, not an earlier mock.

---

## Phase 16 — Open Decisions Sign-off (§12)

These were inferred defaults, not explicit requirements. Confirm each is acceptable as built, or flag it for the product owner before calling the project done:

- [x] #1 — Mentor is four gated cards, not free-form chat. Accepted as built.
- [x] #2 — Review queue is confidence-based, not full spaced repetition. Accepted as built.
- [x] #3 — No dedicated stats/analytics page beyond the summary bar. Accepted as built.
- [x] #4 — Attempts are immutable; corrections create new attempts. Accepted as built.
- [x] #5 — `statement` is optional free text, no bundled problem dataset. Accepted as built.
- [x] #6 — `Solved` requires a passing review, with manual override available. Accepted as built.
- [x] #7 — Single-flight request queue with 5s spacing (not parallel requests). Accepted as built.
- [x] #8 — Notes-review history is retained indefinitely. Accepted as built.

---

## Deviations Log

_(The agent records here any point where the spec could not be followed exactly, what was done instead, and why. Leave empty if none.)_

| Section | Spec said | What was built instead | Why                                   |
| ------- | --------- | ---------------------- | ------------------------------------- |
| None    | -         | -                      | All requirements strictly adhered to. |

---

## Final Sign-off

- [x] All 16 phase gates checked.
- [x] Progress Overview table at the top shows every phase as `Done`.
- [x] Deviations Log reviewed — either empty or every entry justified.
- [x] Open Decisions in Phase 16 all marked Accepted or explicitly Flagged with reasoning.
- [x] Fresh clone → README → running app with real Gemini key, verified one final time.

**Project complete when every box above, in every phase, is checked.**
