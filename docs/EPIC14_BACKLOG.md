# Epic 14 — AI Study Builder Backlog

Researchers (especially non-experts) describe their research goal in plain text and AI generates a draft session with appropriate blocks. Reduces from-scratch time from 30min to 2min.

Maze parity : **AI Study Builder** (their USP n°1 marketing 2026).

Source de vérité : Notion → Epic 14 — AI Study Builder. BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID    | Titre                                                    | Priority | Statut    |
|-------|----------------------------------------------------------|----------|-----------|
| 14.1  | Goal-prompt → session blocks generator                   | High     | ⏳ To Do  |
| 14.2  | Per-block AI regeneration                                | High     | ⏳ To Do  |
| 14.3  | Template starter library (5+ research goals)             | Medium   | ⏳ To Do  |
| 14.4  | Cost preview + token estimate                            | Medium   | ⏳ To Do  |
| 14.5  | Multi-step refinement (AI propose → user adjust → refine)| Medium   | ⏳ To Do  |
| 14.6  | Feature flag `NEXT_PUBLIC_AI_STUDY_BUILDER`              | High     | ⏳ To Do  |

**Stack** : OpenAI gpt-4o-mini par défaut (provider abstraction `lib/ai/providers.ts`). Cost loggé via `logAIUsage({ feature: 'study_builder' })`.

**Order** : 14.6 (flag) → 14.1 (core) → 14.2 (regen per block) → 14.3 (templates) → 14.4 (cost preview) → 14.5 (refinement).

---

## Story 14.1 — Goal-prompt → session blocks generator

> As a Member, especially one without UX research training, I want to describe my research goal in plain language and have AI generate a draft session structure, so that I can start from a working baseline instead of a blank canvas.

### Acceptance Criteria

**Given** I'm on `/dashboard/projects/[id]/sessions/new` and AI Study Builder flag is ON
**When** I see a "Start with AI" option and type a prompt like "Je veux comprendre pourquoi les users abandonnent le checkout"
**Then** within 15s, AI generates a session with welcome + 4-7 blocks adapted to the goal

---

**Given** AI generated a draft session
**When** the result lands in the builder
**Then** I see all generated blocks marked with a small "✨ AI-generated" badge that disappears once I edit the block

---

**Given** the AI generation fails (timeout, API error)
**When** the failure happens
**Then** I'm shown a clear error + a "Start blank" fallback + the prompt is preserved for retry

---

**Given** AI uses an LLM call
**When** generated
**Then** the cost is logged via `logAIUsage({ feature: 'study_builder', ... })` and counted against quotas (Epic 8)

### Implementation notes
- Helper `lib/ai/study-builder.ts` : prompt template + JSON schema response
- Output : strict JSON `{ blocks: [{ blockType, config }] }` parsed and inserted via `addBlockAction`
- Use `gpt-4o-mini` (default) — ~$0.02 per generation

---

## Story 14.2 — Per-block AI regeneration

> As a Member who likes most of the AI-generated session but wants to tweak one block, I want to right-click any block and "Regenerate this block", so that I can iterate quickly without rebuilding the whole session.

### Acceptance Criteria

**Given** I have a session with at least one block
**When** I click "Regenerate" on a specific block (BlockCard menu)
**Then** AI receives the session's overall goal + the block's context (type, neighbors) and proposes a replacement of the same type with refined wording

---

**Given** the regenerated block is proposed
**When** I see it
**Then** I get a side-by-side preview (current vs proposed) with "Apply" / "Discard" buttons, and the proposed block doesn't overwrite my current one until I confirm

### Implementation notes
- Store original session goal on `sessions.ai_goal_prompt`
- Helper `regenerateBlock(blockId, sessionGoal, neighbors)`
- Side-by-side UI : modal with diff view

---

## Story 14.3 — Template starter library

> As a Member who doesn't want to write a goal from scratch, I want a library of pre-built research goals with one-click generation, so that I can start from common use-cases.

### Acceptance Criteria

**Given** I'm on the "Start with AI" screen
**When** I scroll below the goal input
**Then** I see at least 5 template goals: "NPS + open feedback", "Onboarding feedback", "Churn analysis", "Feature prioritization", "Prototype usability"

---

**Given** I click a template
**When** the template loads
**Then** the goal input pre-fills with a polished prompt, and I can click "Generate" without typing anything

### Implementation notes
- Templates stored in `lib/domain/study-templates.ts`
- Reuse existing template system pattern (Story 3.4)

---

## Story 14.4 — Cost preview + token estimate

> As a Pro user mindful of AI costs, I want to see an estimated token cost before triggering an AI generation, so that I can decide whether to proceed or refine the prompt first.

### Acceptance Criteria

**Given** I have a prompt in the input box
**When** I focus the "Generate" button
**Then** a small tooltip shows "Estimated cost: ~$0.03 (input ~500 tok, output ~1500 tok)"

---

**Given** my Free quota is low (<10% remaining of monthly AI findings/studies)
**When** I attempt to generate
**Then** an UpgradePrompt appears warning me before the call

### Implementation notes
- Token estimation : prompt length / 4 (chars per token approx) + fixed output budget
- Pricing : reuse `lib/ai/usage.ts` PRICES table

---

## Story 14.5 — Multi-step refinement

> As a Member who wants to iterate on the generated session conversationally, I want a chat-like refinement panel where I can ask AI to adjust the session, so that I get to my ideal session without rebuilding it manually.

### Acceptance Criteria

**Given** I have an AI-generated session
**When** I open the "Refine with AI" panel
**Then** I see a chat input where I can type things like "Remove the NPS question, add a question about pricing perception"

---

**Given** I send a refinement request
**When** AI processes it
**Then** the session updates in place with the requested changes (additions highlighted, deletions confirmed first)

---

**Given** I've used 3 refinement rounds
**When** I attempt a 4th on the same session
**Then** I see a Pro-upgrade prompt OR (on Pro) it continues unlimited

### Implementation notes
- Store refinement history on `sessions.ai_refinement_history` (jsonb)
- Use conversation context for AI calls (multi-turn)
- Quota : 3 refinements/session on Free, unlimited Pro

---

## Story 14.6 — Feature flag `NEXT_PUBLIC_AI_STUDY_BUILDER`

> As the team controlling rollout, I want a feature flag to gate AI Study Builder visibility, so that we can ship it dark and enable per-environment.

### Acceptance Criteria

**Given** `NEXT_PUBLIC_AI_STUDY_BUILDER=false` (default)
**When** I navigate to create a new session
**Then** the "Start with AI" option is hidden, only "Start blank" + "From template" remain

---

**Given** flag is `true`
**When** I navigate to create
**Then** "Start with AI" appears as primary CTA

### Implementation notes
- Add to `lib/ai/flags.ts` + `flags-client.ts`
- Document in `.env.example`
