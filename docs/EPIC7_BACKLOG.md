# Epic 7 — AI Interviewer Backlog

Source de vérité : `Soleo — Project Tracker` (Notion), database "Stories", Epic 7.

| ID  | Titre                                              | Priority | Statut  | Commit       |
|-----|----------------------------------------------------|----------|---------|--------------|
| 7.1 | AI Follow-Up Configuration in the Builder          | High     | ✅ Done | feat 7.1     |
| 7.2 | AI Follow-Up Generation During Participant Session | High     | ✅ Done | feat 7.2     |
| 7.3 | AI Follow-Up Display in the Results Dashboard      | Medium   | ✅ Done | feat 7.3     |

---

## Vision Epic 7

Sur les blocs **Open text** (`short_text`, `long_text`), le researcher peut activer un mode "AI follow-up" qui, après la réponse du participant, génère **automatiquement une question de relance contextuelle** pour creuser. Jusqu'à 1, 2 ou 3 relances configurables. Le résultat : une vraie mini-conversation type entretien semi-structuré, sans intervention humaine.

C'est la feature la plus différenciante du produit — elle transforme Soleo d'un "form builder" en "AI-led interview platform".

### Contraintes techniques

- **Provider IA** : on passe par `lib/ai/providers.getActiveProvider()`. MVP = OpenAI `gpt-4o-mini` (clé déjà en place). Bascule transparente sur Anthropic ou Gemini si clé ajoutée.
- **Streaming** : on utilise SSE pour afficher la question progressivement côté participant.
- **Privacy** : `/s/*` n'est pas tracké côté analytics. Aucun PII envoyé au provider en plus du contexte de réponse strict. Coût loggé via `ai_usage_logs` (`feature='ai_followup'`, `userId=null`).

---

## Story 7.1 — AI Follow-Up Configuration in the Builder

### User story
> As a Member, I want to enable AI follow-up questioning on open-text blocks and set the number of turns, so that I can collect deeper qualitative insights from participants automatically.

### Acceptance Criteria

**Given** a Member selects an Open text block in the config panel
**When** the config panel renders
**Then** an "AI follow-up" toggle is visible (off by default); a "Max follow-up turns" selector (1, 2, or 3) appears only when the toggle is enabled

---

**Given** a Member enables the AI follow-up toggle and sets max turns
**When** the configuration is saved
**Then** the block stores `has_ai_follow_up: true` and `max_follow_up_turns: [value]`; a visual indicator on the BlockCard shows AI is enabled

---

**Given** a Member disables the AI follow-up toggle
**When** the configuration is saved
**Then** `has_ai_follow_up: false` and max turns config is cleared; the BlockCard indicator is removed

### Implémentation
- Persistence dans `block.config` (jsonb existant) : ajout des champs `has_ai_follow_up: bool`, `max_follow_up_turns: 1|2|3`
- Composants modifiés : `ShortTextConfig`, `LongTextConfig`, `BlockCard`
- Aucune migration DB — tout dans le `config` jsonb

---

## Story 7.2 — AI Follow-Up Generation During Participant Session

### User story
> As a participant, I want to receive a relevant follow-up question after my open-text answer, so that I can share more depth when I have more to say.

### Acceptance Criteria

**Given** a participant submits an answer to an AI-enabled open-text block
**When** the submission is processed
**Then** a POST to `/api/s/[token]/ai-followup` is made; the ParticipantQuestionScreen enters `ai-thinking` state showing a loading indicator for up to 3 seconds

---

**Given** the AI provider responds within 4 seconds
**When** the follow-up arrives via streaming
**Then** the screen transitions to `ai-follow-up` state; the question is displayed as a new question screen; an `aria-live` announcement is made

---

**Given** the AI provider times out or fails after 4 seconds
**When** the failure is detected
**Then** the session silently advances to the next block with no participant-facing error; failure is logged server-side

---

**Given** the participant does not want to answer the follow-up
**When** they click "Skip this question"
**Then** the session advances; the skipped turn is recorded but no answer is stored

---

**Given** the AI provider receives a request
**When** participant data is sent
**Then** only the current session context is sent — no persistent storage of participant data at the AI provider

### Implémentation
- Nouvelle table `ai_followup_turns` (migration `0005_*.sql`)
- Helper `lib/ai/followup.ts` (prompt + appel streaming via providers abstraction)
- Endpoint API `app/api/s/[token]/ai-followup/route.ts`
- State machine côté participant : `idle` → `ai-thinking` → `ai-follow-up` → (loop or next)
- Logging coût via `logAIUsage({ feature: 'ai_followup', sessionId, userId: null, ... })`

---

## Story 7.3 — AI Follow-Up Display in the Results Dashboard

### User story
> As a Member, I want to see AI follow-up exchanges alongside original responses in the dashboard, so that I can understand which responses were deepened and read the full conversation.

### Acceptance Criteria

**Given** a Member views a response that included AI follow-up turns
**When** the response detail renders
**Then** the AIConversationThread shows: original question → participant answer → AI follow-up question (labelled "AI follow-up", indented) → participant answer to follow-up

---

**Given** a Member views a response without AI follow-up
**When** the response detail renders
**Then** the standard single-answer layout appears — no thread component

---

**Given** a Member views the responses list
**When** AI-deepened responses exist
**Then** an "AI" badge is visible on each response that had at least one AI follow-up turn

---

**Given** the AIConversationThread renders for a screen reader
**When** it navigates the thread
**Then** the thread is readable in document order; "AI follow-up question" is announced before each AI-generated question

### Implémentation
- Composant `<AIConversationThread/>` réutilisable + `<AIBadge count={n}/>`
- Badge "AI" sur le header de chaque réponse approfondie (participant detail page)
- Intégration dans `app/(dashboard)/.../participants/[participantToken]/page.tsx` (Story 5.2)
- Repo helper `getTurnsForResponse(responseId)` + version batch pour la liste

### Scope V1 — décisions
- Badge wiré sur la **page détail participant** (vue canonique des réponses individuelles)
- **Pas** de badge sur la cross-participant summary (`BlockSummaryRenderer`) — la
  structure `TextSummary { samples: string[] }` n'a pas d'ID de réponse, ça nécessite
  un refactor du pipeline d'agrégation. À faire dans une story séparée si utile.
- **Pas** de badge sur `ParticipantTable` — la table liste des participants, pas des
  réponses. Pas pertinent.
