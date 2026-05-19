# Epic 16 — Insight Mining (Themes + Sentiment + Quality) Backlog

Cross-response pattern mining. Beyond per-response tagging (Story 5.3), the system identifies recurring themes across all responses to a question, classifies sentiment, and filters low-quality responses.

Maze parity : **Automated themes** + **25 quality metrics**.

Source de vérité : Notion → Epic 16 — Insight Mining. BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID    | Titre                                                 | Priority | Statut    |
|-------|-------------------------------------------------------|----------|-----------|
| 16.1  | Automated themes per question (cross-response)        | High     | ⏳ To Do  |
| 16.2  | Sentiment classification per response                 | Medium   | ⏳ To Do  |
| 16.3  | Quality metrics on responses (low-effort detection)   | Medium   | ⏳ To Do  |
| 16.4  | Theme + sentiment filtering in dashboard              | Medium   | ⏳ To Do  |
| 16.5  | Feature flag `NEXT_PUBLIC_AI_INSIGHT_MINING`          | High     | ⏳ To Do  |

**Stack** : OpenAI gpt-4o-mini. Themes : 1 appel agrégé par question. Sentiment + quality : 1 appel par réponse, fire-and-forget (comme auto-tag).

**Order** : 16.5 (flag) → 16.1 (themes manual trigger) → 16.2 (sentiment background) → 16.3 (quality background) → 16.4 (filters UI).

---

## Story 16.1 — Automated themes per question

> As a Member with 50+ open-text responses, I want AI to extract 3-7 recurring themes from all responses to a single question, so that I understand patterns in 30s instead of 30min of reading.

### Acceptance Criteria

**Given** I'm viewing a question's response summary in the dashboard
**When** I click "Extract themes"
**Then** AI returns 3-7 themes with: theme name (1-3 words), description, % of responses matching, 2-3 representative quotes

---

**Given** themes are extracted
**When** I see them
**Then** each theme card has a "Show all matching responses" link that filters the response list to that theme

---

**Given** the question type doesn't support themes (likert, rating, nps without comments)
**When** I view the summary
**Then** the "Extract themes" option is hidden

### Implementation notes
- New table `response_themes` (block_id, theme_label, description, percent_match, sample_response_ids[])
- Helper `lib/ai/themes.ts` : analyze all responses → return theme list
- Caching : themes valid until N+5 new responses arrive, then re-extract on demand

---

## Story 16.2 — Sentiment classification per response

> As a Member, I want each open-text response automatically classified as positive / negative / neutral / mixed, so that I can filter and prioritize my analysis.

### Acceptance Criteria

**Given** a new text response is saved
**When** processed (background, fire-and-forget like auto-tag)
**Then** a `sentiment` field is set on the response with value in {positive, negative, neutral, mixed} + confidence (0-1)

---

**Given** I'm viewing the response list for a question
**When** the page renders
**Then** each response card displays a small sentiment indicator (color dot or emoji)

---

**Given** sentiment classification is off (flag)
**When** new responses are saved
**Then** no AI call is made (sentiment field stays null)

### Implementation notes
- Column `block_responses.sentiment varchar(16)`, `block_responses.sentiment_confidence real`
- Migration `0007_insight_mining.sql` (with themes table + sentiment cols + quality cols)
- Trigger in `saveBlockResponseAction` (like auto-tag)

---

## Story 16.3 — Quality metrics on responses

> As a Member who wants to clean my dataset, I want AI to flag low-effort / spam / AI-generated responses, so that I can exclude them from my findings.

### Acceptance Criteria

**Given** a new text response is saved
**When** processed
**Then** a `quality_score` (0-100) and `quality_flags` (e.g. ["too_short", "repetitive", "likely_ai"]) are set on the response

---

**Given** I'm reviewing responses
**When** quality_score < 40
**Then** the response card shows a warning "Low quality — possible reasons: too short, repetitive" and the response is excluded by default from theme extraction (toggleable)

### Implementation notes
- Columns `quality_score int`, `quality_flags jsonb`
- Heuristics for "too_short" (< 20 chars), "repetitive" (cosine similarity to other responses), "likely_ai" (AI classifier)
- For "likely_ai" : prompt asking AI to detect AI-typed content

---

## Story 16.4 — Theme + sentiment filtering in dashboard

> As a Member exploring my data, I want to filter the response list by theme AND/OR sentiment AND/OR quality, so that I drill into specific subsets.

### Acceptance Criteria

**Given** themes and sentiment exist on responses
**When** I open the response list filter
**Then** I see filter chips for: themes (multi-select), sentiment (multi-select), quality (≥X threshold), tags (existing)

---

**Given** filters are applied
**When** the list renders
**Then** the response count updates live, and filters can be combined (AND semantics)

### Implementation notes
- Filter state in URL params (e.g. `?theme=onboarding&sentiment=negative&q=50`)
- DB query side : join with `response_themes` for theme filter

---

## Story 16.5 — Feature flag

> As the team, I want a single flag to gate themes + sentiment + quality features, so that we can roll out progressively.

### Acceptance Criteria

**Given** flag is OFF (default)
**When** I view a question summary or response list
**Then** "Extract themes", sentiment indicators, and quality flags are all hidden; no background AI runs

---

**Given** flag is ON
**When** I view
**Then** all insight mining features (16.1-16.4) are active

### Implementation notes
- Add `NEXT_PUBLIC_AI_INSIGHT_MINING` to flags
- Single flag gating both UI visibility AND background sentiment/quality jobs
