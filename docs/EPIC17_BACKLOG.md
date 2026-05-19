# Epic 17 — Advanced Research Methods Backlog

Tree Testing + Copy Testing + Mobile-first testing : méthodes que Maze couvre et Soleo n'a pas encore.

Source de vérité : Notion → Epic 17 — Advanced Research Methods. BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID    | Titre                                                  | Priority | Statut    |
|-------|--------------------------------------------------------|----------|-----------|
| 17.1  | Tree Testing block (info architecture navigation)      | High     | ⏳ To Do  |
| 17.2  | Tree Testing analytics (success, time, paths)          | Medium   | ⏳ To Do  |
| 17.3  | Copy Testing block (text variant preference)           | Medium   | ⏳ To Do  |
| 17.4  | Copy Testing analytics (winner + confidence interval)  | Medium   | ⏳ To Do  |
| 17.5  | Mobile-first testing dedicated mode                    | Medium   | ⏳ To Do  |
| 17.6  | Mobile replay viewer (portrait orientation)            | Low      | ⏳ To Do  |
| 17.7  | Feature flags TREE_TESTING + COPY_TESTING              | High     | ⏳ To Do  |

**Order** : 17.7 (flags) → 17.1 + 17.3 + 17.5 (blocks, en parallèle) → 17.2 + 17.4 (analytics) → 17.6 (mobile replay).

---

## Story 17.1 — Tree Testing block

> As a Member doing IA research, I want a Tree Testing block where I define a hierarchy and ask participants to find specific items, so that I can validate my information architecture.

### Acceptance Criteria

**Given** I add a Tree Testing block in the builder
**When** I open the ConfigPanel
**Then** I see fields: task prompt ("Find where to update your email"), hierarchical tree editor (drag-drop or text outline), expected correct path

---

**Given** I publish the session
**When** a participant reaches this block
**Then** they see the task prompt + an interactive tree (clickable nodes); their path is recorded (clicks, time per node, final answer)

### Implementation notes
- New block type `tree_test` in `lib/domain/blocks.ts`
- Tree stored as nested JSON in `config.tree`
- Path stored in `block_responses.value` (array of node IDs)

---

## Story 17.2 — Tree Testing analytics

> As a Member reviewing tree test results, I want analytics specific to IA testing, so that I know what % found the right item, how long it took, and which wrong paths were taken.

### Acceptance Criteria

**Given** participants have completed a tree test
**When** I view the block summary
**Then** I see: success rate (% on correct path), median time to find, most common wrong paths (top 5), abandon rate

---

**Given** a wrong path was taken N times
**When** I click it
**Then** I see the participants who took it + drill into their full session

### Implementation notes
- New analytics in `lib/analytics/summaries.ts` : `summarizeTreeTest(responses, correctPath)`
- Path comparison logic : longest common prefix + Levenshtein for "near misses"

---

## Story 17.3 — Copy Testing block

> As a Member testing copy variants, I want a Copy Testing block where I define multiple text variants and participants vote / rate, so that I can A/B test microcopy.

### Acceptance Criteria

**Given** I add a Copy Testing block
**When** I open the ConfigPanel
**Then** I can define a question + 2-5 text variants; choose mode = "Preference" (pick 1) or "Rating" (rate each on 1-5)

---

**Given** the session runs
**When** a participant reaches the block
**Then** they see the variants and select / rate per the configured mode

### Implementation notes
- New block type `copy_test` in `lib/domain/blocks.ts`
- Variant rendered in different orders (randomized) to avoid position bias
- Response stored as `{ winner: 'A', ratings: { A: 5, B: 3 } }` per mode

---

## Story 17.4 — Copy Testing analytics

> As a Member reviewing copy test results, I want to see the winning variant + confidence interval, so that I know if the winner is statistically significant.

### Acceptance Criteria

**Given** N participants have responded
**When** I view results
**Then** I see: % votes per variant (Preference mode) or mean rating per variant (Rating mode), Wilson confidence interval, and a "Winner" indicator only if margin is statistically significant (p<0.05 with N≥30)

### Implementation notes
- Statistical helpers : Wilson score interval, chi-square test
- Visual : bar chart with error bars

---

## Story 17.5 — Mobile-first testing dedicated mode

> As a Member testing mobile prototypes, I want a "Mobile" mode in `live_site_task` and `prototype_task` that forces vertical orientation + simulated mobile chrome, so that I get accurate mobile UX data even when participants are on desktop.

### Acceptance Criteria

**Given** I configure a prototype block with mode=mobile
**When** the participant reaches it
**Then** the iframe is constrained to 375×667 (or selectable common sizes), shown with a phone chrome decoration, in vertical orientation

---

**Given** the participant is on a real mobile device
**When** the block renders
**Then** the chrome decoration is hidden; the iframe takes full screen

### Implementation notes
- Add `mode: 'desktop' | 'mobile'` to prototype configs
- Mobile chrome = SVG phone frame around iframe
- Device detection via `navigator.userAgent` (existing pattern in SessionClient)

---

## Story 17.6 — Mobile replay viewer

> As a Member reviewing mobile prototype sessions, I want the rrweb replay to respect portrait orientation, so that the replay matches what the participant actually saw.

### Acceptance Criteria

**Given** a session was recorded in mobile mode
**When** I open the replay viewer in the dashboard
**Then** the player canvas is sized to mobile (375×667 or recorded viewport), with optional zoom controls

### Implementation notes
- rrweb-player viewport setting based on `recording.viewport_mode`
- Add zoom control to player UI

---

## Story 17.7 — Feature flags

> As the team, I want independent flags for tree and copy testing, so that we can ship them separately.

### Acceptance Criteria

**Given** `NEXT_PUBLIC_TREE_TESTING=false`
**When** I'm in the builder
**Then** the Tree Testing block doesn't appear in the palette

---

**Given** `NEXT_PUBLIC_COPY_TESTING=false`
**When** I'm in the builder
**Then** the Copy Testing block doesn't appear in the palette

---

**Given** flags are ON
**When** in builder
**Then** both blocks appear and function

### Implementation notes
- New flags : `NEXT_PUBLIC_TREE_TESTING`, `NEXT_PUBLIC_COPY_TESTING`
- Mobile mode = not gated (built into existing prototype block config)
