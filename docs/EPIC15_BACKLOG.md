# Epic 15 — Question Quality & Bias Coaching Backlog

Real-time AI feedback on questions being written in the builder. Detects leading questions, biases, confusing wording. Suggests rephrasings inline.

Maze parity : **Crafted Curiosity** (their question coaching feature).

Source de vérité : Notion → Epic 15 — Question Quality & Bias Coaching. BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID    | Titre                                                | Priority | Statut    |
|-------|------------------------------------------------------|----------|-----------|
| 15.1  | Real-time bias detection on questions                | High     | ⏳ To Do  |
| 15.2  | Inline rephrasing suggestions                        | High     | ⏳ To Do  |
| 15.3  | Question health score per block (visible indicator)  | Medium   | ⏳ To Do  |
| 15.4  | Feature flag `NEXT_PUBLIC_AI_QUESTION_COACH`         | High     | ⏳ To Do  |

**Stack** : OpenAI gpt-4o-mini (cheap + fast). Debounced 800ms on input. Cost loggé `feature='question_coach'`.

**Order** : 15.4 (flag) → 15.1 (core detection) → 15.2 (suggestions) → 15.3 (score badge).

---

## Story 15.1 — Real-time bias detection on questions

> As a Member writing questions in the builder, I want AI to flag biased / leading questions as I type, so that I avoid skewing my research before I even publish.

### Acceptance Criteria

**Given** I'm in the ConfigPanel of a question block (short_text, long_text, mcq, likert, nps, rating)
**When** I finish typing a question (debounced 800ms) like "Don't you think our pricing is too expensive?"
**Then** within 1s, a discreet warning appears below the question field: "⚠️ Leading question — assumes a position"

---

**Given** my question is neutral
**When** AI processes it
**Then** no warning appears (silent pass)

---

**Given** the feature flag is OFF
**When** I type
**Then** no warning ever appears (the check isn't triggered at all)

### Implementation notes
- Helper `lib/ai/question-coach.ts` : analyze() returns `{ issues: string[], score: 0-100, suggestions?: string[] }`
- Debounce 800ms via React `useDeferredValue` or `useDebouncedValue`
- Cache results per (question text) in component state to avoid re-runs on no-change

---

## Story 15.2 — Inline rephrasing suggestions

> As a Member who got a bias warning, I want one-click access to AI-suggested rephrasings, so that I can fix the question without leaving the panel.

### Acceptance Criteria

**Given** a bias warning is displayed
**When** I click "See suggestions"
**Then** AI proposes 2-3 alternative phrasings of the question (neutral, unambiguous), with reasoning ("Removes assumption", "Opens to negative experiences")

---

**Given** I see suggestions
**When** I click "Apply" on one
**Then** the question field updates with the chosen rephrasing, the warning disappears, and the action is undoable via Cmd+Z

### Implementation notes
- Second prompt template that returns 2-3 alternatives
- Apply uses standard setState undoable history

---

## Story 15.3 — Question health score per block

> As a Member configuring a question, I want a small visible indicator of the question's "health" (0-100), so that I see at a glance which blocks need attention.

### Acceptance Criteria

**Given** a question has been analyzed
**When** the BlockCard renders in the canvas
**Then** a small badge shows the health score color-coded (green ≥80, amber 60-79, red <60) — only displayed if the flag is on

---

**Given** a block has score <60
**When** I hover the badge
**Then** a tooltip lists the issues found ("Bias detected", "Ambiguous wording", "Too long: 24 words")

### Implementation notes
- Persist score on `block.config.question_health_score` for cross-session view
- Recompute on edit (debounce)

---

## Story 15.4 — Feature flag

> As the team, I want to gate this feature behind a flag, so that it can be rolled out progressively.

### Acceptance Criteria

**Given** the flag is OFF (default)
**When** I edit questions in the builder
**Then** no AI analysis is performed, no warnings shown, health badges hidden

---

**Given** the flag is ON
**When** I edit questions
**Then** all coaching features (15.1-15.3) are active

### Implementation notes
- Add `NEXT_PUBLIC_AI_QUESTION_COACH` to `lib/ai/flags.ts` + `flags-client.ts`
- Document in `.env.example`
