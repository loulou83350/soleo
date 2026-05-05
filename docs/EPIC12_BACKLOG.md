# Epic 12 — Onboarding & Activation Backlog

New users discover Soleo's value within their first session via guided onboarding (wizard, empty states, first-time tooltips), targeted activation emails, and a measured funnel via PostHog. Beta users can be tested in real conditions before any paywall is enabled.

Source de vérité : Notion → Epic 12 — Onboarding & Activation. BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID   | Titre                                                          | Priority | Statut    |
|------|----------------------------------------------------------------|----------|-----------|
| 12.1 | Onboarding wizard post-signup (3-4 steps)                      | High     | ⏳ To Do  |
| 12.2 | Activation checklist on dashboard                              | High     | ⏳ To Do  |
| 12.3 | Empty states (dashboard, project, session, findings)           | High     | ⏳ To Do  |
| 12.4 | Welcome email immediately on signup                            | High     | ⏳ To Do  |
| 12.5 | D+3 / D+7 drip reminder emails                                 | Medium   | ⏳ To Do  |
| 12.6 | First-time contextual tooltips on key features                 | Medium   | ⏳ To Do  |
| 12.7 | Activation funnel PostHog events + dashboard                   | Medium   | ⏳ To Do  |
| 12.8 | In-app help drawer (`?` button)                                | Low      | ⏳ To Do  |
| 12.9 | Quota approach email + paywall warming                         | Low      | ⏳ To Do  |

**Hors-scope** :
- Figma OAuth flow → reporté tant que Soleo n'est pas validé par Figma. On garde le PAT actuel.

**Order** : 12.1 → 12.2 → 12.3 (UX foundations) → 12.4 → 12.5 → 12.9 (emails) → 12.6 (tooltips) → 12.7 (PostHog funnel) → 12.8 (help drawer).

**Tooling** : Builder maison + PostHog feature flags (pas de SaaS Userflow/Appcues).

---

## Story 12.1 — Onboarding wizard post-signup (3-4 steps)

> As a brand-new user, I want a short guided wizard right after signup that explains the path to my first findings, so that I'm not dropped on an empty dashboard wondering where to start.

### Acceptance Criteria

**Given** I just completed signup
**When** I land on `/dashboard` for the first time
**Then** an onboarding wizard appears (modal or drawer) with 3-4 steps: welcome, name your team, create your 1st project (or skip with template), launch first session

---

**Given** I'm in the wizard
**When** I click "Skip" or close it
**Then** the wizard never re-appears (state persisted on `users.onboarding_completed_at` or similar)

---

**Given** I complete all wizard steps
**When** I exit
**Then** I'm dropped on `/dashboard` with my 1st project already visible (not empty state)

---

**Given** I'm offline or the wizard fails to load
**When** I see the error
**Then** I can still access the dashboard normally (wizard is enhancement, not blocker)

### Implementation notes
- Migration : add `users.onboarding_completed_at TIMESTAMP NULL` (or JSON column for future flexibility)
- Composant `<OnboardingWizard/>` mounté dans `(dashboard)/layout.tsx`, conditionné par `!user.onboardingCompletedAt`
- Skip = set `onboarding_completed_at = now()` mais flag `users.onboarding_skipped = true` pour analytics

---

## Story 12.2 — Activation checklist on dashboard

> As a Free user trying to figure out what to do next, I want a checklist at the top of my dashboard showing my progress through the activation milestones, so that I have a clear plan and feel motivated by ticking items off.

### Acceptance Criteria

**Given** I'm logged in to `/dashboard`
**When** the page renders
**Then** I see a checklist component with 4 items: ✅/⬜ "Crée ton 1er projet", "Publie ta 1ère session", "Reçois ta 1ère réponse", "Génère ton 1er rapport IA"

---

**Given** I've completed all 4 milestones
**When** the dashboard renders
**Then** the checklist is hidden permanently OR replaced by a celebratory message "Tu as tout débloqué ✨" that fades after a few seconds

---

**Given** the checklist is visible
**When** I click an unchecked item
**Then** I'm taken directly to the relevant action (e.g. "Crée ton 1er projet" → opens the create-project modal)

---

**Given** I dismiss the checklist (small ✕ button)
**When** I revisit dashboard
**Then** it stays hidden for the rest of the session but reappears next login until completed (or fully dismissed via setting)

### Implementation notes
- Composant `<ActivationChecklist/>` rendu en haut du dashboard
- Logique de progression côté server (server component fetch les flags depuis `users` + count `projects`/`sessions`/`responses`/`findings`)
- Dismissal session-only via `sessionStorage`, full-dismiss via `users.activation_checklist_dismissed`

---

## Story 12.3 — Empty states (dashboard, project, session, findings)

> As a user landing on a screen with no content yet, I want a clear empty state that tells me what this screen will eventually contain and how to populate it, so that I'm not confused by blank canvases.

### Acceptance Criteria

**Given** I'm on `/dashboard` with 0 projects
**When** the page renders
**Then** I see an illustration + "Aucun projet pour l'instant" + 3-line pedagogy + primary CTA "Créer mon 1er projet"

---

**Given** I'm in a project with 0 sessions
**When** the project detail page renders
**Then** I see an empty state with CTA "Créer une session" + secondary link "Choisir un template" → TemplatePickerModal

---

**Given** I'm on a session dashboard with 0 responses
**When** rendered
**Then** I see an empty state showing the participant link with a copy button + "Partage ce lien pour collecter tes 1ères réponses"

---

**Given** I'm on findings page with no draft yet
**When** rendered
**Then** I see "Génère ton 1er rapport avec l'IA" CTA + "Ou écris-le toi-même" secondary action

### Implementation notes
- Composant générique `<EmptyState/>` (icon + title + description + 1-2 CTAs)
- 4 occurrences déjà identifiées + on l'étendra si besoin

---

## Story 12.4 — Welcome email immediately on signup

> As a new user, I want a welcome email that confirms my account + guides me to the next step, so that I feel oriented and have a doc/email to come back to.

### Acceptance Criteria

**Given** I just completed signup
**When** the server action `signUp` succeeds
**Then** Resend sends a welcome email to my address within 30 seconds, in my locale (FR or EN)

---

**Given** I open the welcome email
**When** I read it
**Then** it contains: greeting with my name, a 1-paragraph value reminder, the 3 first steps with a "Démarrer maintenant" CTA → `/dashboard`

---

**Given** Resend fails to send
**When** the failure is detected
**Then** the failure is logged but does not block signup or surface to the user (best-effort)

### Implementation notes
- Wrapper `lib/email/templates/welcome.ts` qui retourne `{ subject, html, text }` traduit selon locale
- Trigger dans `app/(login)/actions.ts` (la action `signUp`)
- Idempotence : si `users.welcome_email_sent_at` existe, ne pas re-envoyer

---

## Story 12.5 — D+3 / D+7 drip reminder emails

> As a user who signed up but didn't complete activation, I want gentle reminder emails at D+3 (no publish) and D+7 (no findings), so that I'm reminded to come back without feeling spammed.

### Acceptance Criteria

**Given** I signed up exactly 3 days ago and haven't published any session
**When** the daily Cron runs (or alternative: Vercel Cron or scheduled function)
**Then** Resend sends a D+3 email "Tu as commencé à explorer Soleo, voilà comment publier ta 1ère session"

---

**Given** I signed up exactly 7 days ago and haven't generated any findings
**When** the daily Cron runs
**Then** Resend sends a D+7 email "Tes participants ont répondu — voilà comment générer ton 1er rapport IA"

---

**Given** the email is sent
**When** I click the CTA
**Then** I'm taken back to `/dashboard` and the relevant activation step is highlighted

---

**Given** I unsubscribe via email link
**When** the unsubscribe webhook fires
**Then** my `users.email_drip_unsubscribed = true` flag is set, no further drip emails sent (transactional emails like password reset still go through)

### Implementation notes
- Vercel Cron Hobby = limité (déjà connu) → alternative : Cron via Supabase scheduled functions OR external Cron (Upstash / EasyCron)
- Migration : `users.email_drip_unsubscribed BOOLEAN DEFAULT false`, colonnes pour tracker `last_dN_email_sent_at` (idempotence)
- Templates `lib/email/templates/drip-d3.ts` + `drip-d7.ts`

---

## Story 12.6 — First-time contextual tooltips on key features

> As a user encountering an unfamiliar feature for the first time, I want a small, dismissable tooltip explaining what it does, so that I learn the feature without having to read external docs.

### Acceptance Criteria

**Given** I open the builder for the first time
**When** I hover or focus on a block type icon (e.g. "Bloc prototype")
**Then** I see a discreet tooltip with a 1-line description + "Got it" button to dismiss

---

**Given** I dismiss a tooltip
**When** I encounter it again later
**Then** it never re-appears (state persisted via `users.onboarding_tooltips_dismissed: string[]` column or equivalent)

---

**Given** the tooltip is visible
**When** the user is keyboard-navigating
**Then** the tooltip is announced via ARIA + can be dismissed with Escape

---

**Given** key targets (block types in builder, AI follow-up toggle, AI suggest button, findings AI button)
**When** discovered for the first time
**Then** each has a configured tooltip in `lib/onboarding/tooltips.ts` (or similar registry)

### Implementation notes
- Composant `<FirstTimeTooltip id="..." title="..." body="...">{children}</FirstTimeTooltip>` qui wrap n'importe quel élément
- Migration : `users.onboarding_tooltips_dismissed JSONB DEFAULT '[]'::jsonb`
- Liste des tooltip ids = registre central (~10-15 tooltips au début)

---

## Story 12.7 — Activation funnel PostHog events + dashboard

> As the PO, I want to see exactly where users drop off in their activation journey, so that I can prioritize fixes.

### Acceptance Criteria

**Given** the existing PostHog setup
**When** I review the events Soleo tracks
**Then** the activation funnel includes: signup_completed → project_created → session_created → session_published → first_response_received → findings_generated → findings_published

---

**Given** an event in the funnel is missing (e.g. `first_response_received` is not yet tracked)
**When** Story 12.7 ships
**Then** the missing events are added with proper team_id + timestamp, allowing PostHog to compute time-between-steps

---

**Given** the events are tracked
**When** I open PostHog → Insights → "Soleo Activation Funnel"
**Then** I see a funnel chart with conversion % at each step, time-to-step median, and a date filter

---

**Given** a user is unique-tracked
**When** they perform the same step twice (e.g. publish session N°2)
**Then** only the FIRST occurrence per user counts in the funnel (PostHog does this natively if using `posthog.identify` + funnel insight setup)

### Implementation notes
- 6 events sur 7 sont déjà trackés (PostHog Phase 2). Il manque `first_response_received`
- Ajouter le tracker côté client (en visite participant detail) ou côté server via posthog-node si on veut être robuste
- PostHog Insight à configurer manuellement dans le dashboard PostHog (ne pas builder Soleo-side)

---

## Story 12.8 — In-app help drawer (`?` button)

> As a user with a quick question, I want a help button always visible in the dashboard that opens a drawer with quick-start docs + contact info, so that I don't have to leave the app to get unblocked.

### Acceptance Criteria

**Given** I'm logged in to any `/dashboard/*` page
**When** I look at the bottom-right corner
**Then** I see a small "?" floating button

---

**Given** I click the `?` button
**When** the drawer opens
**Then** I see: a quick-start article (markdown rendered), a "Voir tous les guides" link, a contact section ("Email louis@soleo.app" or similar), a search input (V2 — placeholder for now)

---

**Given** the drawer is open
**When** I press Escape or click outside
**Then** the drawer closes smoothly

---

**Given** the drawer is being navigated by keyboard
**When** I tab through it
**Then** focus is trapped inside the drawer and ARIA roles are correct

### Implementation notes
- Composant `<HelpDrawer/>` mounté dans `(dashboard)/layout.tsx`
- Utiliser shadcn `<Sheet/>` ou `<Drawer/>` (à installer)
- Articles statiques en `content/help/*.mdx` (pas de CMS pour MVP)

---

## Story 12.9 — Quota approach email + paywall warming

> As a Free user nearing my quota, I want an email warning me at 80% so I'm not surprised when I hit the limit, so that I can decide proactively to upgrade or wait.

### Acceptance Criteria

**Given** my Free team usage is at 80% of any quota (projects, AI tag suggest, AI findings)
**When** the daily Cron runs
**Then** Resend sends a soft warning email "Tu approches de la limite Free — voilà ce qui se passera quand tu l'atteindras + comment passer Pro"

---

**Given** I just hit 100% of a quota (hard limit)
**When** the system detects the breach
**Then** an immediate transactional email is sent "Tu as atteint la limite Free de [feature]. Pour continuer, passe Pro"

---

**Given** I've already received a warning email this calendar month
**When** the Cron tries to re-send a warning
**Then** it skips (one warning per quota per month)

---

**Given** I unsubscribed from drip emails
**When** the warning Cron tries to send
**Then** the email is NOT sent (this is technically a transactional / quota notice — discutable, mais on respecte l'unsubscribe pour la prudence privacy)

### Implementation notes
- Dépend de l'Epic 8 (quotas définis et calculables) — Story 12.9 livrée APRÈS Story 8.1
- Templates `lib/email/templates/quota-warning.ts` + `quota-reached.ts` (transactional)
- Anti-spam : `email_quota_warnings_sent JSONB` track les envois mensuels par quota
