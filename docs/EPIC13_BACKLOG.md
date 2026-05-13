# Epic 13 — Live Site Testing Backlog

Researchers test HTML prototypes (Claude Artifact / V0 / Bolt / handmade) or public URLs on real participants with full PostHog-style session recording (rrweb), click heatmaps, navigation flow diagrams, and per-participant timelines.

Source de vérité : Notion → Epic 13 — Live Site Testing. BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID    | Titre                                                          | Priority | Statut    |
|-------|----------------------------------------------------------------|----------|-----------|
| 13.1  | New `live_site_task` block type in Builder (with feature flag) | High     | ⏳ To Do  |
| 13.2  | HTML prototype upload (zip → Supabase Storage)                 | High     | ⏳ To Do  |
| 13.3  | Hosted prototype runtime + injected tracking JS                | High     | ⏳ To Do  |
| 13.4  | Public URL mode + iframe load detection + fallback             | Medium   | ⏳ To Do  |
| 13.5  | Tracking JS lib + rrweb integration                            | High     | ⏳ To Do  |
| 13.6  | Event ingestion API + DB schema                                | High     | ⏳ To Do  |
| 13.7  | Participant runtime UI (top bar + iframe + completion)         | High     | ⏳ To Do  |
| 13.8  | Session replay viewer (rrweb player) in dashboard              | High     | ⏳ To Do  |
| 13.9  | Click heatmap visualization                                    | Medium   | ⏳ To Do  |
| 13.10 | Navigation flow diagram                                        | Medium   | ⏳ To Do  |
| 13.11 | Per-participant timeline + aggregate metrics                   | Medium   | ⏳ To Do  |

## Feature flags

| Env var | Default | Effect |
|---|---|---|
| `NEXT_PUBLIC_LIVE_SITE_TASK` | `false` | Gates the whole block type. When OFF, block hidden from BlockPalette and `/proto/[token]` returns 404. |
| `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD` | `false` | Gates only the HTML upload mode within the block. When OFF, only `public_url` mode is selectable. |

Pendant le dev : `true` pour tester. Avant beta launch : `false` jusqu'à ce que le design + stabilité soient OK. Pattern identique aux flags AI (`NEXT_PUBLIC_AI_*`).

## Stack technique

- **Storage** : Supabase Storage, bucket `prototypes`, layout `{teamId}/{taskId}/{filename}`. Limit 50 MB / zip.
- **Hosting** : Next.js route `app/proto/[token]/[[...path]]/route.ts` — sert HTML + rewrite `<head>` pour injecter `<script src="/api/proto/tracking.js">`.
- **Tracking lib** : `rrweb` (BSD-3, ~150 KB gzipped). Capture DOM snapshots + clicks + nav + idle.
- **Transport** : POST batch toutes les 2s vers `/api/proto/events` (gzip JSON, fire-and-forget avec retry).
- **DB** : 4 nouvelles tables — `live_site_tasks`, `live_site_sessions`, `live_site_events`, `live_site_recordings`. Migration `0006_live_site_testing.sql` appliquée via psql (drift Drizzle existant).
- **Heatmap** : Canvas-based overlay sur le 1er DOM snapshot de chaque page, KDE des clicks.
- **Replay** : `rrweb-player` lib côté researcher dashboard.

## Privacy

- Consent participant via gate (Story 3.5 étendue avec wording dédié)
- rrweb `maskAllInputs: true` par défaut + `data-soleo-mask` opt-in
- Pas d'envoi vers PostHog cloud — tout en interne Supabase + Postgres

## Order d'exécution

1. **13.1** (block + flag foundation)
2. **13.5** (tracking lib rrweb)
3. **13.6** (DB + ingestion API)
4. **13.2** (HTML upload)
5. **13.3** (hosted runtime + injection)
6. **13.4** (public URL mode)
7. **13.7** (participant UI)
8. **13.8** (replay viewer)
9. **13.9** (heatmap)
10. **13.10** (flow diagram)
11. **13.11** (timeline + metrics)

## Hors-scope V1

- IA résumé narratif / friction detection (V2)
- Heatmap d'attention / scroll (V1 = clicks only)
- Annotations researcher en cours de replay
- Comparaison cross-participant automatique
- Export vidéo MP4 du replay
- Mode multi-onglet (proto qui ouvre plusieurs tabs)
- Snippet researcher pour leur propre site live (territoire HotJar)
- Retention policy team-level configurable

---

## Story 13.1 — New `live_site_task` block type in Builder

> As a researcher, I want a new "Live Site Task" block in the Builder with a config form, so that I can add a prototype-testing step to my study without having to leave Soleo.

### Acceptance Criteria

**Given** `NEXT_PUBLIC_LIVE_SITE_TASK=true`
**When** I open the BlockPalette in the Builder
**Then** I see a new "Live Site Task" entry with an icon (e.g. globe + cursor) and can add it to my session

---

**Given** `NEXT_PUBLIC_LIVE_SITE_TASK=false` (default)
**When** I open the BlockPalette
**Then** the "Live Site Task" entry does NOT appear, and any existing block of this type in a session is gracefully hidden/disabled with a "Feature disabled" message in the editor

---

**Given** I added a `live_site_task` block
**When** the ConfigPanel opens
**Then** I see fields: prompt (task to perform), instructions (longer description), mode (`html_upload` | `public_url` toggle), entry page (default "index.html"), optional goal URL pattern

---

**Given** I save the block config
**When** the session is published
**Then** the block is part of the participant flow at the configured position

### Implementation notes
- New file `lib/livesite/flags.ts` (server) + `flags-client.ts` (client) — pattern identique à `lib/ai/flags.ts`
- Block type registré dans `lib/domain/blocks.ts` (LiveSiteTaskConfig)
- ConfigPanel : nouveau form `LiveSiteTaskForm.tsx`
- BlockPalette : conditionnel sur `clientLiveSiteTaskEnabled()`

---

## Story 13.2 — HTML prototype upload

> As a researcher, I want to upload a `.zip` of my HTML prototype (e.g. Claude Artifact export, V0 download) up to 50 MB, so that Soleo can host and instrument the prototype for participant testing.

### Acceptance Criteria

**Given** `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD=true` and I'm in ConfigPanel with mode=`html_upload`
**When** I click "Upload zip" and select a valid .zip file <50 MB
**Then** the file is uploaded to Supabase Storage (`prototypes/{teamId}/{taskId}/`), extracted server-side, and the entry page (default index.html) is verified to exist

---

**Given** I upload a zip exceeding 50 MB or containing only non-HTML files
**When** the upload validates
**Then** I see a clear error message and no file is stored

---

**Given** `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD=false`
**When** I'm in the ConfigPanel
**Then** the `html_upload` mode is hidden/disabled; only `public_url` mode is selectable

---

**Given** I uploaded a zip and want to replace it
**When** I upload a new zip
**Then** the old files are deleted from Supabase Storage and the new ones take their place (no orphan files)

### Implementation notes
- Endpoint `app/api/proto/upload/route.ts` (researcher auth, multipart)
- `lib/livesite/storage.ts` : helpers extract + validate
- Use `adm-zip` or `unzipper` pour extraction
- Verify no path traversal (no `../` dans les paths du zip)

---

## Story 13.3 — Hosted prototype runtime + tracking injection

> As a participant, I want to interact with the researcher's prototype hosted on Soleo, so that I can complete the task as if I were on the real site.

### Acceptance Criteria

**Given** a prototype is uploaded for task X with token T
**When** I open `/proto/T/` (or `/proto/T/somepage.html`)
**Then** the HTML is served from Supabase Storage with the entry page as default, MIME types correct, assets loaded relatively

---

**Given** the served HTML has a `<head>` section
**When** the server-side rewrite runs
**Then** a `<script src="/api/proto/tracking.js">` tag is injected just before `</head>`, and a `<meta name="soleo-task" content="...">` carries token + sessionId

---

**Given** the participant session token is invalid or expired
**When** they request `/proto/T/`
**Then** the endpoint returns 403

---

**Given** `NEXT_PUBLIC_LIVE_SITE_TASK=false`
**When** any request comes to `/proto/[token]/*`
**Then** the route returns 404

### Implementation notes
- Route handler dans `app/proto/[token]/[[...path]]/route.ts`
- Cache Supabase Storage urls (signed URL pour 1h)
- Rewrite HTML via regex simple ou parse-then-inject (cheerio si besoin)
- CSP : `script-src 'self' soleo.app; default-src 'self' data: blob:`

---

## Story 13.4 — Public URL mode + iframe fallback

> As a researcher, I want to alternatively paste a public URL (deployed prototype on Vercel/Netlify) instead of uploading a zip, so that I can test prototypes already hosted elsewhere without re-uploading.

### Acceptance Criteria

**Given** I'm in ConfigPanel and select mode=`public_url`
**When** I paste a URL (e.g. `https://my-proto.vercel.app`)
**Then** the URL is validated (format + reachability via HEAD), saved on the block, and used as the iframe `src` at runtime

---

**Given** the public URL responds with `X-Frame-Options: DENY` or restrictive CSP
**When** the participant tries to load the iframe
**Then** within 5s of iframe load attempt, a fallback appears "Le prototype ne s'affiche pas ici. Ouvrir dans un nouvel onglet →" with a button that opens the URL in a new tab AND keeps the Soleo top bar with the Done button

---

**Given** the public URL is unreachable
**When** the iframe fails to load
**Then** the fallback message is shown immediately and the researcher receives a notification in the dashboard

---

**Given** a public URL is used
**When** events are captured
**Then** only navigation events (URL changes via postMessage from new tab) are captured; rrweb DOM snapshots are NOT available (cross-origin restriction)

### Implementation notes
- Server-side URL validation via fetch HEAD + max 3s timeout
- `<iframe onload>` + setTimeout 5s pour fallback
- New-tab tracking : window.opener.postMessage from the proto's tab (researcher informed via tracking script if their proto can include it)

---

## Story 13.5 — Tracking JS lib + rrweb integration

> As the system, I must provide a tracking JS lib that captures rrweb DOM snapshots + clicks + navigation + idle periods, so that the researcher gets a full session replay and event timeline.

### Acceptance Criteria

**Given** the tracking lib is loaded in a hosted prototype
**When** the participant interacts with the page
**Then** rrweb captures: full DOM snapshot at start, incremental DOM mutations, mouse moves (sampled), clicks (with selector + element text), input events (masked)

---

**Given** rrweb is configured with `maskAllInputs: true` and `maskTextSelector: 'input, [data-soleo-mask]'`
**When** the participant types in an `<input>`
**Then** the captured value is masked (replaced with `*` characters) in the recording

---

**Given** the participant doesn't interact for 3+ seconds
**When** the idle timer elapses
**Then** an `idle` event is emitted with the duration; the timer resets on any mouse move, click, or key press

---

**Given** events accumulate in memory
**When** the batch timer (every 2s) fires OR the buffer reaches 1MB
**Then** the batch is gzipped and POSTed to `/api/proto/events`; on failure, retry with exponential backoff (up to 3 retries)

---

**Given** the session recording size approaches the 10 MB cap (NFR13.2)
**When** the cap is reached
**Then** capture auto-stops, a "Session limit reached" event is emitted, and the participant can still complete the task

### Implementation notes
- New file `public/proto/tracking.js` (compiled standalone bundle) or served via Next.js route
- Lib `rrweb` + `pako` (gzip) ; bundle séparé
- Custom idle timer + click/nav listeners en complément des events rrweb natifs
- Bundle minified < 200 KB

---

## Story 13.6 — Event ingestion API + DB schema

> As the system, I must accept event batches from the tracking JS and persist them to a structured DB schema, so that the researcher dashboard can query events efficiently for replay, heatmap, and analytics.

### Acceptance Criteria

**Given** a POST to `/api/proto/events` with a valid session token + gzipped event batch
**When** the request is processed
**Then** events are decoded, parsed, and persisted to `live_site_events` (one row per event) and `live_site_recordings` (rrweb snapshots stored in Supabase Storage with a row referencing them)

---

**Given** the migration `0006_live_site_testing.sql` is applied
**When** the schema is inspected
**Then** the tables `live_site_tasks`, `live_site_sessions`, `live_site_events`, `live_site_recordings` exist with correct foreign keys and indexes (`(sessionId, timestamp)` on events)

---

**Given** the ingestion endpoint receives a malformed payload
**When** processed
**Then** it returns 400 with a clear error message and logs the issue (no crash, no data corruption)

---

**Given** 100 events arrive per second from a single participant
**When** the server processes them
**Then** no requests are dropped (batched insert per session), and the total ingestion latency is under 500ms p95

### Implementation notes
- Migration manuelle : `lib/db/migrations/0006_live_site_testing.sql` + apply via psql
- Schema Drizzle dans `lib/db/schema.ts` (4 nouvelles tables + relations)
- Endpoint `app/api/proto/events/route.ts`
- rrweb snapshots gros volume → Supabase Storage (pas dans Postgres)

---

## Story 13.7 — Participant runtime UI

> As a participant, I want a clear interface above the prototype iframe with the task instructions and a "Done" button, so that I know what to do and how to finish the task.

### Acceptance Criteria

**Given** I reach a `live_site_task` step in a participant session
**When** the page renders
**Then** I see a top bar (~56px) with: task prompt truncated to 1 line (full on hover/click), "J'ai terminé" button right-aligned, optional skip link; below the iframe loads the prototype

---

**Given** the researcher configured a goal URL pattern (e.g. `/thank-you`)
**When** the iframe navigates to a URL matching the pattern
**Then** the task is auto-completed (status=`goal`), the user sees a brief success indicator, and the session advances to the next block automatically (after 1s delay)

---

**Given** the participant clicks "J'ai terminé"
**When** the action runs
**Then** a `completion` event is emitted with `mode=manual`, the recording stops, the session advances

---

**Given** the participant clicks "Passer cette tâche"
**When** the action runs
**Then** a `completion` event with `mode=skipped` is emitted, the recording stops, the session advances

---

**Given** the iframe fails to load
**When** the failure is detected
**Then** the participant sees the fallback "Open in new tab" UX without losing access to the Done button

### Implementation notes
- New `components/participant/LiveSiteTaskBlock.tsx`
- Top bar fixe sticky en haut
- Goal URL detection via iframe `onLoad` event listening (postMessage from injected tracker)
- Fallback : open in new tab + Soleo modal "Click Done when finished"

---

## Story 13.8 — Session replay viewer

> As a researcher, I want to replay any participant session as a video, so that I can observe exactly what the participant did, including hesitations and dead ends.

### Acceptance Criteria

**Given** I'm on `/dashboard/.../participants/[token]` and the participant has a `live_site_task` recording
**When** I scroll to the replay section
**Then** I see a rrweb player with: play/pause, timeline scrubber, current time, total duration, speed control (1x/2x/4x), event sidebar (chronological list)

---

**Given** the player is playing
**When** I press spacebar
**Then** play/pause toggles; arrow keys jump ±5s in the timeline

---

**Given** an event in the sidebar is clicked
**When** I select it
**Then** the player seeks to that timestamp and visually highlights the related element

---

**Given** the recording is in progress (rare edge case)
**When** I open the replay viewer
**Then** I see a message "Session in progress — refresh to update" without a partial replay

### Implementation notes
- `rrweb-player` lib (standalone player component)
- Component `components/dashboard/LiveSiteReplay.tsx`
- Sidebar event timeline = `live_site_events` query
- Spacebar / arrows keyboard handlers

---

## Story 13.9 — Click heatmap visualization

> As a researcher, I want to see where participants clicked aggregated across all sessions, so that I can identify high-attention areas and missed CTAs.

### Acceptance Criteria

**Given** I'm on a `live_site_task` aggregate view
**When** I select a page URL from the dropdown
**Then** I see a heatmap canvas overlaid on the first DOM snapshot of that page, with clicks colored by frequency (transparent → cool blue → warm orange → red)

---

**Given** clicks are aggregated across N participants
**When** the canvas renders
**Then** kernel density estimation smooths the clicks into hotspots, and a legend shows the click count scale

---

**Given** no participants reached this page
**When** I select it in the dropdown
**Then** the heatmap shows an empty state "0 clics enregistrés sur cette page" instead of a blank canvas

---

**Given** the page snapshot is large (>1920px width)
**When** the heatmap renders
**Then** it scales responsively to fit the dashboard viewport while preserving click coordinate proportions

### Implementation notes
- Component `components/dashboard/LiveSiteHeatmap.tsx`
- Canvas 2D rendering ; simple KDE radial gradient
- Rendre le 1er snapshot rrweb d'abord (iframe sandboxed read-only)
- Color scale : transparent → #93c5fd → #fb923c → #ef4444

---

## Story 13.10 — Navigation flow diagram

> As a researcher, I want a visual diagram of how participants navigated through the prototype, so that I can spot common paths, dead ends, and the most-visited pages.

### Acceptance Criteria

**Given** I'm on the `live_site_task` aggregate view
**When** I scroll to the navigation flow section
**Then** I see a directed graph (Sankey-like or node-edge) where nodes are pages and edges are transitions, with edge thickness proportional to the number of participants who took that path

---

**Given** the entry page exists (default `index.html`)
**When** the diagram renders
**Then** the entry page is highlighted as the start node and the goal URL (if configured) is highlighted as the end node

---

**Given** a participant abandoned mid-flow
**When** the diagram shows their path
**Then** their final page is marked as a "drop-off" (smaller red indicator)

---

**Given** there are >20 unique pages visited
**When** the diagram would be too cluttered
**Then** lesser-visited pages are grouped under an "Other (N pages)" node, expandable on click

### Implementation notes
- Lib : `reactflow` ou `d3-sankey` ou simple `<svg>` custom
- Component `components/dashboard/LiveSiteFlowDiagram.tsx`
- Query : aggregate `live_site_events` where `type='navigate'` group by `from_url → to_url`

---

## Story 13.11 — Per-participant timeline + aggregate metrics

> As a researcher, I want to drill into a single participant's session AND see aggregate metrics across all participants, so that I have both granular insights and high-level patterns.

### Acceptance Criteria

**Given** I open a specific participant's `live_site_task` record
**When** the timeline view renders
**Then** I see a vertical list of events with: timestamp, page context, event type icon (click/nav/idle), event description ("Clicked 'Sign Up' button on /home", "Idle 8s on /pricing"), and a link to "Show in replay" that seeks the player

---

**Given** a participant didn't interact at all
**When** the timeline view renders
**Then** an empty state message clearly indicates "Le participant n'a pas interagi avec le prototype" + total time spent + completion status

---

**Given** I'm on the aggregate view
**When** the metrics section renders
**Then** I see: total participants, success rate (% reached goal OR clicked Done), median duration, abandon rate (% closed without completing), top 3 idle hotspots (page + median idle time)

---

**Given** the aggregate metrics are computed
**When** they need to refresh
**Then** they're computed live on each page load (no caching for MVP); if performance becomes an issue, materialized view later

### Implementation notes
- Component `components/dashboard/LiveSiteTimeline.tsx` (per-participant)
- Component `components/dashboard/LiveSiteAggregateMetrics.tsx`
- SQL queries simples sur `live_site_events` agrégées par task
