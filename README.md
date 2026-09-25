# LeetMentor

> **LeetMentor** — a local-first Leetcode AI mentor and DSA practice tracker, powered by the Google Gemini API (free tier).

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![Dexie IndexedDB](https://img.shields.io/badge/Dexie.js-IndexedDB-brightgreen.svg)](https://dexie.org/)
[![Vitest](https://img.shields.io/badge/Vitest-Passing-success.svg)](https://vitest.dev/)

---

## 1. Product Summary & Core Workflows

Spreadsheets track dates and links, but they cannot guide your thinking or review your code. This application provides a focused environment for mastering Data Structures & Algorithms with three AI-powered capabilities:

1. **Progressive Hints (Withholding Contract)**
   - When stuck, reveal hints in 4 strictly gated levels: **Nudge**, **Pattern**, **Pseudocode**, and **Solution**.
   - Level $N$ cannot be unlocked until level $N-1$ is read.
   - The mentor never volunteers a solution prematurely. Unlocking the full solution requires an explicit confirmation dialog (defaulting to "Not yet, let me try again").
   - Records the highest hint level consumed; problems solved with 0 hints receive an "Unassisted" badge.
   - No free-form chat input: preserves the withholding contract and safeguards free-tier quotas.

2. **Iterative Code Review Loop**
   - Paste solution attempts with language selection and optional commentary ("what I changed this time").
   - Code attempts are immutable and monotonically numbered ($1, 2, \dots, N$).
   - Gemini evaluates correctness (edge cases, failing inputs), time/space complexity vs. optimal, severity-sorted issues (**Critical**, **Major**, **Minor**), specific positives, and a single actionable `nextStep`.
   - A problem is only marked `Solved` after receiving a **PASS** verdict (or via an explicit manual override).
   - On a **REVISE** verdict, click "Fix and resubmit" to pre-fill attempt $N+1$ with the previous code for rapid iteration. Line-by-line diff viewing is available against prior attempts.

3. **Learning Notes Review & Active Recall**
   - Write markdown takeaways for every problem in an autosaving editor.
   - Disabled below 50 characters to encourage substantive reflection.
   - Gemini checks whether claims are factually accurate and generalizable beyond the specific problem.
   - Generates a reusable key takeaway and **3 active recall questions** (stored without answers) to test your conceptual understanding weeks later.

### Core Architectural Principles

- **Local-First:** All user data (problems, attempts, reviews, notes, hints) lives inside browser **IndexedDB** (the legacy-named `dsa-tracker` db — see [Legacy Identifiers](#legacy-identifiers-intentionally-not-renamed)) via Dexie.js. No backend, no accounts, and no sync server.
- **Works Offline:** Every feature except the three AI features works with zero network connection.
- **Zero Fabricated Data:** Problem details and statements are manually entered or pasted by the user — or auto-filled from the bundled offline LeetCode catalog (see below).
- **Privacy & Security:** Zero analytics, zero telemetry, and zero third-party CDN scripts.

### LeetCode Catalog Auto-Fill

The **Add Problem** (`/problem/new`) and **Edit Problem** forms start with a **Quick fill from LeetCode catalog** search box. Type a question number (e.g. `1`) or title (e.g. `Two Sum`), pick the match, and the form auto-fills number, title, URL, difficulty, topics, patterns, and a statement stub linking to the official description. Everything remains editable afterwards.

- **Coverage:** 4,055 questions (numbers, titles, URL slugs, difficulties mirrored from LeetCode's public listing; topic tags for the ~800 most-solved questions, patterns heuristically derived from those tags).
- **Offline & private:** the catalog ships inside the app bundle as a lazily-loaded chunk — no network request, no tracking.
- **Copyright-safe statements:** full LeetCode descriptions are not bundled; the stub points at the official page. Paste the full statement into the field for the best mentor quality.

### Voice Dictation in Learning Notes

Each problem's **Notes** tab has a **Dictate** button next to the character counter. Click to record, click Stop, and your words are transcribed into the editor at the cursor.

- **Gemini Flash by default (most accurate):** your recording is sent to your configured Gemini model for transcription — no model downloads, works in every browser, counts toward your daily AI quota like other AI features. Requires your API key; audio is sent to Google per the privacy notice above.
- **On-device Whisper fallback:** switch provider in Settings → Voice Transcription Provider for fully private, offline-capable transcription (Tiny ~40MB / Base ~150MB / Small ~300MB one-time downloads, then 100% local — mic audio never leaves your device).
- **Limits:** needs a microphone + localhost/HTTPS; recordings cap at 2 minutes per take.

---

## 2. Quick Start & Local Run

### Prerequisites

- Node.js 18+ (Node.js 20 or 22 LTS recommended)
- npm 9+

### Installation & Development

```bash
# 1. Clone repository
git clone https://github.com/aanand-mishra/LeetMentor.git
cd LeetMentor

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Available Scripts

| Command                 | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `npm run dev`           | Starts Vite development server with HMR                                  |
| `npm run build`         | Compiles TypeScript (`tsc -b`) and bundles static assets into `dist/`    |
| `npm run preview`       | Previews the production build locally                                    |
| `npm run lint`          | Runs ESLint (`--max-warnings 0`)                                         |
| `npm run format`        | Formats codebase with Prettier                                           |
| `npm run format:check`  | Checks code formatting                                                   |
| `npm run test`          | Runs Vitest unit and integration test suite                              |
| `npm run test:coverage` | Runs Vitest with v8 coverage analysis (verifies ≥70% coverage threshold) |

---

## 3. Obtaining a Free Gemini API Key

The application calls Google's Generative Language API directly from your browser (CORS-enabled). No backend proxy or build-time environment variables are needed.

### Step-by-Step Instructions:

1. Navigate to **[Google AI Studio](https://aistudio.google.com/)**.
2. Sign in with your Google account.
3. In the left navigation or top bar, click **"Get API key"** (or **"Create API key"**).
4. Click **"Create API key in new project"** (or choose an existing Google Cloud project).
5. Copy your newly created API key string.
6. Open **LeetMentor**, navigate to **Settings** (`/settings` or click the gear icon in the top header).
7. Paste the key into the **Google Gemini API Key** input.
8. Click **"Test connection"**. The app executes a minimal ping to verify connectivity.
9. The **Active Gemini Model** dropdown will dynamically populate with models supporting `generateContent` (e.g., `gemini-1.5-flash`, `gemini-2.0-flash`, `gemini-flash-lite-latest`). Flash-class models are selected by default to maximize free-tier limits.

---

## 4. Security & Privacy Notice (FR-8.2)

> **Important Security & Privacy Notice:**
>
> Your API key is stored unencrypted in this browser's IndexedDB and is sent directly from your browser to Google. Anyone with access to this browser profile, and any script running on this page, can read it. Use a key restricted to the Generative Language API, and revoke it if you share this device.
>
> Free-tier Gemini requests may be used by Google to improve their models. Do not paste confidential or employer-owned code.

---

## 5. Data Durability, Backups & Portability

### IndexedDB Storage

Unlike `localStorage` (which is synchronous, blocks the main thread, and is capped at ~5MB), LeetMentor uses **IndexedDB** via **Dexie.js**. This enables storing thousands of code attempts, comprehensive markdown notes, and AI critique history without hitting storage walls.

### Legacy Identifiers (intentionally not renamed)

This project was renamed from _Leetcode DSA Tracker_ to **LeetMentor**. A few internal
identifiers kept their old names on purpose, because they are **keys to data that already
exists in users' browsers**. Changing them would silently orphan that data.

| Identifier                                                                          | Where                                                                     | Why it stays                                                                                                                                                               |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dsa-tracker`                                                                       | `src/db/index.ts` (Dexie `super()`)                                       | The physical IndexedDB database name. Renaming it opens an empty DB and makes every existing problem, attempt, note, revision, setting and **Gemini API key** unreachable. |
| `dsa_welcome_banner_dismissed`                                                      | `src/db/index.ts`, `src/pages/HomePage.tsx`, `src/pages/SettingsPage.tsx` | Renaming re-shows the Quick Start Guide to every existing user.                                                                                                            |
| `dsa_first_run_seen`, `dsa_durability_dismissed_until`, `dsa_last_export_timestamp` | `src/components/layout/DataDurabilityBanner.tsx`                          | Same: purely UI dismissal state, not worth a one-time banner re-shuffle for users.                                                                                         |

If you ever _do_ want to migrate the database name, it needs a real data-migration step
(open the old DB, copy every table into a new one, then delete the old) — not a string edit.

### Backups (Export & Import)

Navigate to **Settings** (`/settings`) to manage your data:

- **Export Backup:** Downloads a single JSON file named `leetmentor-export-YYYY-MM-DD.json`.
  - **Security Guarantee:** The `geminiApiKey` is **strictly stripped** before serialization. Your API key is never exported.
- **Import Backup:** Select any previously exported JSON backup.
  - **Merge Mode:** Skips records whose IDs already exist in your local database; imports non-conflicting items.
  - **Replace Mode:** Completely wipes the local database before restoring the backup (requires typed confirmation).
- **Durability Reminders:** A dismissible banner alerts you on first run and if no export has been taken in over 14 days.

---

## 6. Demo & Sample Data

You can seed realistic data directly from the application UI without manual entry:

1. Navigate to **Settings** (`/settings`).
2. Scroll to the **Demo & Sample Data** section:
   - **Seed 20 sample problems:** Populates realistic Leetcode questions (Two Sum, 3Sum, LRU Cache, Merge Intervals, etc.) complete with past code attempts, line diffs, code reviews, markdown notes, and mentor hints.
   - **Seed 2,000 benchmark problems:** Populates a high-volume dataset to test search debounce (<100ms), multi-facet filtering, and table pagination.
3. To clear all data, scroll down to the **Danger Zone** and type `DELETE`.

---

## 7. Keyboard Shortcuts

Press `?` anywhere in the app to display the keyboard shortcut modal:

| Shortcut         | Action                              | Scope                                       |
| ---------------- | ----------------------------------- | ------------------------------------------- |
| `/`              | Focus problem search bar            | Global (suppressed inside inputs)           |
| `n`              | Navigate to Add Problem form        | Global (suppressed inside inputs)           |
| `g` then `h`     | Return to Home / Problem list       | Global (suppressed inside inputs)           |
| `Esc`            | Close dialog, modal, or review view | Everywhere                                  |
| `?`              | Show keyboard shortcuts modal       | Global (suppressed inside inputs)           |
| `Tab`            | Insert literal tab indentation      | Code editor textarea                        |
| `Esc` then `Tab` | Move keyboard focus out of editor   | Code editor textarea (accessibility escape) |

---

## 8. Technology Stack & Substitutions

Built strictly according to §3 of the product specification:

| Layer          | Chosen Technology               | Notes                                             |
| -------------- | ------------------------------- | ------------------------------------------------- |
| Framework      | React 18 + TypeScript           | `strict: true` enabled throughout                 |
| Build Tool     | Vite 6                          | Code-split bundle (<115KB initial gzip)           |
| Routing        | React Router v6                 | Client-side routing with hash tab retention       |
| Styling        | Tailwind CSS 3.4                | Class-based dark mode (`light`, `dark`, `system`) |
| Persistence    | IndexedDB via **Dexie.js**      | Multi-table ACID transactions                     |
| UI Icons       | Lucide React                    | Accessible, lightweight SVG icons                 |
| Code Highlight | `react-syntax-highlighter`      | Prism `vscDarkPlus` theme                         |
| Markdown       | `react-markdown` + `remark-gfm` | Notes preview and mentor responses                |
| Date Handling  | `date-fns`                      | Formatting and 14-day backup checks               |
| Testing        | Vitest + React Testing Library  | 14 test suites, 61 unit/integration tests         |
| Test Coverage  | `@vitest/coverage-v8`           | Storage (85.5%), utils (79.9%), prompts (88.6%)   |

**Substitutions against §3:**

- None. All specified core libraries were utilized cleanly without requiring deprecation workarounds.

---

## 9. Gemini Resilience & Quota Management (§7)

- **Single-Flight Queue:** At most one request is in-flight across the app. Additional requests enter a visible "Queued" state.
- **Client-Side Spacing:** Enforces a minimum 5-second gap between consecutive dispatches.
- **Exponential Backoff:** On HTTP 429 rate limits, retries at 1s, 2s, 4s, 8s before failing gracefully, respecting `Retry-After` headers if returned.
- **Precise Error Taxonomy:**
  - `429` → _"Gemini rate limit reached. Free tier allows a limited number of requests per minute and per day. Retrying in Ns…"_
  - `400` with `API_KEY_INVALID` → _"Your API key was rejected. Check it in Settings."_
  - `403` → _"This key does not have access to the Generative Language API. Enable it in Google AI Studio."_
  - Offline/Network failure → _"Could not reach Google. Check your connection. Everything else in the app works offline."_
- **No Silent Failures:** Inline failure toasts with persistent retry affordances. No full-page spinners.

---

## 10. License

MIT License. Designed for personal technical interview preparation.
