# Strype Analytics — Captured Signals

Comprehensive reference for every signal the client emits after the event-queue refactor. Each batch sent to the ingest server has an **envelope** (identity + state) plus an **events array**. The DB stores the envelope into `users` / `sessions` and each event as one row in `events`.

---

## Envelope fields (sent with every batch)

These identify the user/session and ride along with every POST — they aren't event rows.

### `userId`
- **What:** Per-browser UUID.
- **Source:** `crypto.randomUUID()` minted on first page load.
- **Persistence:** `localStorage["StrypeAnalyticsUserId"]`.
- **Mechanism:** `initAnalyticsUserId()` reads the key at boot; if absent, mints a new UUID and writes it back. Same value across reloads on the same browser profile; different across browsers or incognito sessions.

### `sessionId`
- **What:** Per-page-load UUID.
- **Source:** `crypto.randomUUID()` per page load.
- **Persistence:** In-memory only.
- **Mechanism:** `initAnalyticsSession()` mints a fresh UUID on every boot. Reloading or opening a new tab creates a new sessionId, even for the same `userId`.

### `platform`
- **What:** `"editor"` or `"microbit"`.
- **Source:** Vite build flag (`#v-ifdef MODE == VITE_MICROBIT_MODE`) with `window.location.pathname` containing `"microbit"` as a fallback for the Python build.
- **Mechanism:** `initAnalyticsPlatform()` resolves once at boot.

### `countryCode` / `countryName`
- **What:** ISO 3166-1 alpha-2 code and human-readable name (either can be `null`).
- **Source:** `fetchUserCountry()` in `analyticsCountry.ts`.
- **Mechanism:** At bootstrap, tries three free IP-geolocation APIs in order: `ipwho.is` → `ipapi.co` → `api.country.is`. Each call has a small timeout; on failure or malformed payload, it falls through. If all three fail, derives a country from `navigator.languages` (e.g. `fr-FR` → `FR`). A bare locale like `en` (no region) yields `null`.

### `flushReason`
- **What:** Why this batch was sent.
- **Values:** `"interval" | "size_cap" | "critical" | "unload"`.
- **Mechanism:** set by whichever flush trigger fired (see "Flush mechanism" below). Operational only — useful for backend debugging.

---

## Session-state fields (referenced by events, not event rows themselves)

These live on the Pinia store and are referenced inside event payloads.

### `analyticsLocale`
- **What:** Current UI locale (e.g. `"en"`, `"zh"`, `"fr"`).
- **Source:** Mirrors `settingsStore.locale` via `settingsStore.$subscribe`.
- **Mechanism:** In `bootstrapApp.ts`, the first observed value seeds `analyticsLocale` without emitting an event — that initial value is carried by the `session_start` event payload. Any subsequent change emits a `locale_change` event (see below).

### `analyticsActiveSessionTime`
- **What:** Integer milliseconds of active editing time.
- **Source:** `sessionTracker.ts`.
- **Mechanism:** A `setInterval` ticks every 30 s. Each tick adds the elapsed time since the previous tick **only if** the user did `mousemove`, `keydown`, `click`, or `scroll` within the last 5 minutes. After 5 min of idleness, ticks no longer accumulate. The final value is sent in the `session_end` event as `activeDurationMs`.

### `analyticsFrameCount`
- **What:** Number of user-authored frames at session end.
- **Mechanism:** Computed once at session-end as `Object.values(frameObjects).filter(f => f.id > 0).length`. The `id > 0` filter excludes the three pseudo-container frames (imports / defs / main) whose ids are ≤ 0. Sent in the `session_end` event payload.

---

## Events

Each event has the same envelope shape: `{ eventId, eventType, recordTime, payload }`. `eventId` is a fresh UUID for idempotency (server uses `INSERT IGNORE`); `recordTime` is the ISO timestamp at enqueue time.

### `session_start`
- **Triggered by:** `bootstrapApp.ts`, immediately after identity, platform, and country are resolved.
- **Frequency:** Exactly once per session.
- **Payload:** `{ locale }` — the initial locale observed.
- **Why:** Marks the start of a session and records the locale at startup. Pairs with `session_end` to bound the session for analysis queries.

### `session_end`
- **Triggered by:** `sessionTracker.ts` `emitSessionEnd()` on `beforeunload` or `pagehide`. Guarded by a `sessionEnded` flag so it fires at most once per session.
- **Frequency:** Exactly once per session (where the unload path actually fires — `beforeunload` is unreliable on mobile Safari, `pagehide` is the modern fallback).
- **Payload:** `{ activeDurationMs, frameCount }`.
- **Delivery:** This event ends up in the unload batch, which is sent via `navigator.sendBeacon` so it survives tab close. Backgrounding the tab and returning does **not** emit a duplicate.

### `run`
- **Triggered by:**
  - `PythonExecutionArea.vue:530` — clicking the Run button on the Python build.
  - `Commands.vue:797` — clicking Flash/Run on the micro:bit build.
- **Mechanism:** call site does `enqueueAnalyticsEvent("run", computeFrameSnapshot())` then `flushAnalyticsQueue("critical")` for immediate delivery.
- **Payload:** The full output of `computeFrameSnapshot()`:
  - `frameTypeCounts` — `Record<frameType, count>` for every user frame, e.g. `{ if: 2, for: 1, varassign: 3, funcdef: 1, ... }`.
  - `importFrameCounts` — `{ import, fromimport, library }`. The three import-frame variants counted separately.
  - `sectionFrameCounts` — `{ imports, defs, main }`. Each frame is assigned to one of the three top-level Strype containers by walking `parentId` upward until it hits one of the container ids. Frames inside a `funcdef` inside `defs` are counted under `defs`.
  - `oopHint` — `true` iff the project has at least one `classdef` **and** at least one `funcdef`. A weak hint that the student is exploring OOP.
- **Why:** Correlates execution with the program structure at that moment.

### `save`
- **Triggered by:** `trackStorageLocation(target)` in `Menu.vue`, called from three save handlers (FS save, FS save-as, cloud save). The handler then calls `flushAnalyticsQueue("critical")` for immediate delivery.
- **Payload:** `{ storageLocation: "local" | "cloud" }`.
  - `StrypeSyncTarget.fs` → `"local"`.
  - `StrypeSyncTarget.gd` or `StrypeSyncTarget.od` → `"cloud"`.
  - Other targets → no event.
- **Why:** Tracks where students save their work.

### `menu_action`
- **Triggered by:** `trackMenuAction(actionId)` called from 9 menu handlers in `Menu.vue`.
- **Frequency:** One event per click; no client-side aggregation.
- **Payload:** `{ actionId }` where `actionId` is one of:
  - `reset_project`, `load_project`, `load_demo_open`
  - `api_docs`
  - `share_snapshot`, `share_cloud`
  - `download_python`, `download_hex` (micro:bit only)
  - `undo`, `redo`
- **Caveat:** `undo`/`redo` only fire when invoked from the menu — the keyboard shortcut path is not hooked into `trackMenuAction`.
- **Delivery:** Sits in the queue until the next interval (60 s) / size-cap (100) / critical / unload flush.

### `input_call`
- **Triggered by:** `trackInputCall()` hooked at:
  - `sInput()` in `execPythonCode.ts` — the Skulpt runtime, used by the micro:bit run path.
  - The Comlink prompt callback in `PythonExecutionArea.vue` — the Pyodide runtime, used by the Python build.
- **Payload:** `{}` — presence is the signal.
- **Why:** Counts every Python `input()` invocation during execution. The server can correlate by `session_id` + `record_time`.

### `output_chunk` — *coalesced*
- **Triggered by:** `trackOutputChars(n)` hooked in `outf()` (Skulpt) and the Comlink output callback (Pyodide). **Does NOT enqueue per call** — it accumulates into `analyticsPendingOutputChars` instead.
- **Mechanism:** Inside `flushAnalyticsQueue`, if `analyticsPendingOutputChars > 0` at flush time, exactly **one** `output_chunk` event is appended to the outgoing batch carrying the accumulated total, then the counter resets to zero.
- **Payload:** `{ chars }` — total character count emitted during the flush window.
- **Why coalesced:** a tight loop like `for i in range(100_000): print(i)` would otherwise produce 100k events. The coalescer keeps event count proportional to user behaviour, not machine behaviour.

### `demo_used`
- **Triggered by:** `trackUsedDemo(demoName, source)` from `Menu.vue` when a demo project is loaded. Empty demo names are silently dropped.
- **Payload:** `{ demoName, source }`.
  - `demoName` — the trimmed name (e.g. `"hello"`).
  - `source` — `"builtin"` for the bundled Python demos, `"mediacomp-strype"` for the graphics/sound demos.
- **Note:** No client-side dedup — repeated loads produce repeated events. The server tallies with `COUNT(*) GROUP BY payload.demoName`.

### `locale_change`
- **Triggered by:** `trackAnalyticsLocaleChange(newLocale)` invoked from the `settingsStore.$subscribe` callback in `bootstrapApp.ts` on every locale mutation.
- **Mechanism:**
  - The **first** observed locale only seeds `analyticsLocale` and does **not** emit an event (that initial state is carried by `session_start`).
  - A no-op change (same locale to itself) is ignored.
  - Any other change emits one event and updates `analyticsLocale`.
- **Payload:** `{ from, to }`.

---

## Flush mechanism

Four triggers, in order of importance:

| Trigger | `flushReason` | When |
|---|---|---|
| Periodic timer | `"interval"` | Every 60 s (`Analytics_batch_flush_ms`) from a `setInterval` started in `bootstrapApp.ts`. The main batching mechanism. Skips the POST if the queue is empty. |
| Size cap | `"size_cap"` | `enqueueAnalyticsEvent` checks queue length after each push; if `>= 100` (`Analytics_batch_max_events`), flushes immediately. Bounds memory and limits loss on tab crash. |
| Critical | `"critical"` | Explicitly called by `run` and `save` call sites right after enqueueing their event. Ensures high-signal user actions reach the server promptly. |
| Unload | `"unload"` | `beforeunload`, `pagehide`, and `visibilitychange === "hidden"` listeners in `bootstrapApp.ts`. Uses `navigator.sendBeacon` instead of `fetch` so it survives tab close. |

### Concurrency guard

`analyticsFlushInProgress` is a boolean mutex. If a flush is in flight, subsequent non-unload flush calls return early — preventing two concurrent batches from racing on failure-and-retry. Unload bypasses the guard (sendBeacon is fire-and-forget; ordering doesn't matter).

### Failure handling

If `fetch` rejects, or returns a non-2xx status, the batch is **prepended** back into the queue for the next flush. The queue is capped at `Analytics_queue_overflow_cap` (500); if exceeded, the **oldest** events are dropped to preserve recent activity.

### Idempotency

Every event has a `crypto.randomUUID()` `eventId`. The server could use `INSERT IGNORE` on the `event_id` PK so retries of a batch that already partially landed don't double-count.

### No-op when ingest URL unset

If `VITE_ANALYTICS_INGEST_URL` is empty or unset, `flushAnalyticsQueue` returns early without sending. Events still enqueue (bounded by the overflow cap), so flipping the env var on later picks up whatever is still in the queue.

---

## Tunables (`analyticsConstants.ts`)

| Constant | Default | Purpose |
|---|---|---|
| `Analytics_session_tick_ms` | 30 000 | How often `sessionTracker` ticks to accumulate active time. |
| `Analytics_session_idle_threshold_ms` | 300 000 | After 5 min of no input, ticks stop accumulating. |
| `Analytics_batch_flush_ms` | 60 000 | Periodic flush interval. |
| `Analytics_batch_max_events` | 100 | Size cap that forces an immediate flush. |
| `Analytics_queue_overflow_cap` | 500 | Hard limit on retained events; oldest dropped when exceeded. |
