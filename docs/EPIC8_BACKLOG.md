# Epic 8 — Billing & Paywall Backlog

A user on the Free plan can experience Soleo's value, hit a quota, and convert to Pro via Stripe Checkout. A Pro user can self-manage their subscription via Customer Portal. The system enforces quotas centrally with a clear paywall UX that respects "no friction before value".

Source de vérité : Notion → Epic 8 — Billing. BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID  | Titre                                                            | Priority | Statut    |
|-----|------------------------------------------------------------------|----------|-----------|
| 8.1 | Plan-based quota foundation                                      | High     | ⏳ To Do  |
| 8.2 | Stripe products setup + Pricing page                             | High     | ⏳ To Do  |
| 8.3 | Stripe Checkout success + idempotent webhook sync                | High     | ⏳ To Do  |
| 8.4 | Customer Portal access for self-service                          | High     | ⏳ To Do  |
| 8.5 | UpgradePrompt UX (Tooltip + Modal + Banner)                      | Medium   | ⏳ To Do  |
| 8.6 | Free plan quota enforcement on critical actions                  | Medium   | ⏳ To Do  |
| 8.7 | AI follow-up Free tier cap (max 1 turn per question)             | Medium   | ⏳ To Do  |
| 8.8 | Read-only mode for expired subscription                          | Low      | ⏳ To Do  |

**Order** : 8.1 (foundation) → 8.2 → 8.3 → 8.4 → **8.5** (components) → **8.6** (use components) → 8.7 → 8.8.
> ⚠️ 8.5 doit être livrée avant 8.6 — la story 8.6 (enforcement) consomme les composants `<UpgradePrompt/>` `<UpgradeModal/>` `<UpgradeBanner/>` créés en 8.5.

**Plan tarifaire** : Free + Pro uniquement (24 €/mois ou 19 €/mois en annuel = 228 €/an). EUR pour MVP. Stripe Tax pour TVA EU.

---

## Story 8.1 — Plan-based quota foundation

> As a developer, I want a centralized quota system in `lib/billing/plans.ts` and `lib/billing/quotas.ts`, so that all feature gates throughout the app reference a single source of truth that's easy to update without scattered magic numbers.

### Acceptance Criteria

**Given** I import `PLAN_QUOTAS` from `lib/billing/plans.ts`
**When** I read it
**Then** I see a typed `{ free: PlanQuotas, pro: PlanQuotas }` object with all fields per the agreed grid (maxActiveProjects, maxResponsesPerMonth, aiTagSuggestPerMonth, aiAutoTag, aiFindingsPerMonth, aiFollowupMaxTurnsCap, etc.)

---

**Given** a teamId
**When** I call `getTeamPlan(teamId)`
**Then** it returns `'free'` or `'pro'` based on `teams.subscriptionStatus = 'active'` and `teams.planName`

---

**Given** a teamId + an action like `'create_project'` or `'use_ai_findings'`
**When** I call `checkQuota(teamId, action)`
**Then** it returns `{ allowed: boolean, reason?: string, currentUsage?: number, limit?: number }`, computing usage from `ai_usage_logs` and `block_responses` (no new tables)

---

**Given** repeated `checkQuota` calls for the same team within 60 seconds
**When** invoked
**Then** results are cached in-memory to keep latency under 50ms

---

**Given** an admin feature flag is OFF (e.g. `AI_AUTO_TAG=false`)
**When** I call `checkQuota(teamId, 'ai_auto_tag')`
**Then** it returns `{ allowed: false, reason: 'feature_disabled_admin' }` regardless of plan (admin flags supersede plan)

### Implementation notes
- `lib/billing/plans.ts` : `PLAN_QUOTAS` const typed (cf plan principal pour la grille)
- `lib/billing/quotas.ts` : `getTeamPlan`, `checkQuota`, `incrementUsage` (no-op pour MVP, on utilise des compteurs aggregate)
- Cache : `unstable_cache` Next ou simple Map in-memory keyed `${teamId}:${action}`
- Combine avec `lib/ai/flags.ts` existants (admin flags)

---

## Story 8.2 — Stripe products setup + Pricing page

> As a Free user evaluating Pro, I want a clear `/pricing` page with a single Pro plan and a monthly/annual toggle, so that the decision is binary (stay Free or upgrade Pro) without comparison-table fatigue.

### Acceptance Criteria

**Given** Stripe is configured (`BILLING_ENABLED=true`, products + prices created in Stripe)
**When** I visit `/pricing`
**Then** I see two columns: Free (current plan if logged in, with checkmark) + Pro with monthly/annual toggle (default annual)

---

**Given** I'm on the Free plan and click "Passer Pro" with annual selected
**When** the action runs
**Then** I'm redirected to Stripe Checkout for the annual price ID (228 EUR)

---

**Given** I'm not logged in and click "Passer Pro"
**When** the action runs
**Then** I'm redirected to `/sign-up?next=/pricing` so I authenticate first then return

---

**Given** the locale is `en`
**When** I view `/pricing`
**Then** prices show in USD (with EUR equivalent in small caption); FR locale shows EUR primary

### Implementation notes
- Créer 2 produits Stripe (1 Pro mensuel + 1 Pro annuel) via dashboard Stripe.com
- Stocker price IDs dans env vars : `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`
- Activer Stripe Tax dans le dashboard pour TVA EU (mandatory FR market)
- Refonte `app/(dashboard)/pricing/page.tsx` (existant comme stub)

---

## Story 8.3 — Stripe Checkout success + idempotent webhook sync

> As a user who just paid, I want my Pro features to unlock instantly after Stripe Checkout completes, so that I don't wait or get confused about whether my payment worked.

### Acceptance Criteria

**Given** I complete Stripe Checkout
**When** Stripe sends `customer.subscription.created` to `/api/stripe/webhook`
**Then** `teams.subscriptionStatus = 'active'`, `teams.planName = 'pro'`, `teams.stripeSubscriptionId` is set, all within 5s of payment

---

**Given** the webhook receives a duplicate event (same Stripe `event.id`)
**When** processed
**Then** it's processed exactly once (idempotency via storing event id in a `stripe_events_processed` table or similar)

---

**Given** an `invoice.payment_failed` event arrives
**When** processed
**Then** `teams.subscriptionStatus = 'past_due'`, an email is sent to the team owner via Resend, and an in-app banner appears next time they visit the dashboard

---

**Given** a `customer.subscription.deleted` event
**When** processed
**Then** `teams.subscriptionStatus = 'canceled'`, the cancellation date is stored, and the team enters read-only mode (Story 8.8)

### Implementation notes
- Compléter `app/api/stripe/webhook/route.ts` (stub existant SaaS Starter)
- Nouvelle migration : `stripe_events_processed (event_id PK, processed_at)` pour idempotence
- Vérifier signature Stripe webhook (`STRIPE_WEBHOOK_SECRET`)

---

## Story 8.4 — Customer Portal access for self-service

> As a Pro subscriber, I want to manage my subscription self-service (cancel, update card, change plan) via Stripe Customer Portal, so that I don't have to email support for routine actions.

### Acceptance Criteria

**Given** I'm on the Pro plan
**When** I visit `/dashboard/general`
**Then** I see a "Gérer mon abonnement" button in the Billing section

---

**Given** I click "Gérer mon abonnement"
**When** the action runs
**Then** I'm redirected to a Stripe Customer Portal session linked to my `stripeCustomerId`

---

**Given** I cancel via the portal
**When** I return to `/dashboard`
**Then** a banner shows "Votre abonnement prendra fin le YYYY-MM-DD" with a "Annuler la résiliation" link

---

**Given** I'm on the Free plan
**When** I visit `/dashboard/general`
**Then** the "Gérer mon abonnement" button is replaced by "Passer Pro" → `/pricing`

### Implementation notes
- Server action `createCustomerPortalSession()` qui appelle `stripe.billingPortal.sessions.create()`
- Redirect URL = `/dashboard/general` (return after portal)

---

## Story 8.5 — UpgradePrompt UX (Tooltip + Modal + Banner)

> As a Free user discovering paid features, I want clear, non-intrusive prompts to upgrade exactly when I hit a quota, so that I'm not annoyed at the wrong moment but I know how to unlock more.

### Acceptance Criteria

**Given** a feature button is disabled because of a Free quota
**When** I hover the disabled control
**Then** `<UpgradeTooltip/>` shows "Disponible avec Pro" + a link "Voir Pro" → `/pricing`

---

**Given** I trigger a hard-quota action (creating a 2nd project)
**When** the action returns `quota_exceeded`
**Then** `<UpgradeModal/>` opens centered on screen with the value prop, the cap reached, and a primary CTA "Passer Pro" → `/pricing`

---

**Given** I'm on Free and I've published 3+ sessions (success milestone)
**When** I land on `/dashboard`
**Then** `<UpgradeBanner/>` appears at the top: "Tu cartonnes ! Passer Pro débloque l'illimité."; banner is dismissable (cookie-stored), not re-shown for the rest of the session

---

**Given** I just signed up, just created my 1st project, just published my 1st session, just received my 1st response, or just generated my 1st findings draft
**When** I land on `/dashboard`
**Then** no UpgradeModal, no UpgradeBanner, and no UpgradeTooltip is shown (paywall is silent during the first-success journey)

### Implementation notes
- 3 composants : `<UpgradeTooltip/>`, `<UpgradeModal/>`, `<UpgradeBanner/>`
- Tous dans `components/billing/upgrade/`
- Wording : "Upgrade", "Passer Pro", "Débloquer" (pas "Acheter" ni "Payer")
- Banner cookie : `soleo_upgrade_banner_dismissed_<userId>`

---

## Story 8.6 — Free plan quota enforcement on critical actions

> As the system, I must enforce Free plan quotas on all gated actions, leveraging the UpgradePrompt components from Story 8.5, so that Free users hit limits and convert to Pro at the right moment.

### Acceptance Criteria

**Given** a Free team has 1 active project and tries to create a 2nd
**When** `createProjectAction` is called
**Then** the action returns `{ success: false, error: 'quota_exceeded' }` and the client opens `<UpgradeModal/>` (from Story 8.5)

---

**Given** a Free team has used 50 manual tag suggestions this calendar month
**When** the 51st `suggestTagsAction` is invoked
**Then** the bouton "Suggérer" is disabled in the UI (per `checkQuota` result) with an `<UpgradeTooltip/>` showing on hover

---

**Given** a Free team and a session block configured with `aiFollowUp: true, maxTurns: 3`
**When** a participant submits an answer
**Then** only 1 follow-up turn is generated (server-side cap to `PLAN_QUOTAS.free.aiFollowupMaxTurnsCap = 1`), even though the block config requested 3

---

**Given** a Free team has reached 3 AI findings drafts this month
**When** `generateFindingDraftAction` is invoked
**Then** it returns `{ success: false, error: 'quota_exceeded' }` and the "Suggérer brouillon IA" button is disabled with tooltip

---

**Given** a Free session is active with 30 participants and a 31st starts the link
**When** they reach the gate
**Then** they're allowed to participate up to participant #50; from #51 onward, the gate shows "Cette étude est complète, merci !" without consuming a participant slot

### Implementation notes
- Modifier les actions concernées : `createProjectAction`, `suggestTagsAction`, `generateFindingDraftAction`, `app/api/s/ai-followup/route.ts`, `app/s/[token]/actions.ts (saveBlockResponseAction)`
- Pattern : appeler `checkQuota()` au début de chaque action
- Côté client : recevoir `{ allowed: false, reason }` et trigger le bon composant Upgrade

---

## Story 8.7 — AI follow-up Free tier cap (max 1 turn per question)

> As a Free user, I want to use the AI follow-up feature on my open-text questions but capped at 1 relance per question, so that I get a real taste of the feature without unlimited token consumption.

### Acceptance Criteria

**Given** a Free team and a block with `aiFollowUp: true, maxTurns: 3`
**When** a participant submits an answer triggering the follow-up
**Then** exactly 1 follow-up turn is generated (server enforces `min(blockConfig.maxTurns, PLAN_QUOTAS.free.aiFollowupMaxTurnsCap)`)

---

**Given** a Pro team and the same block
**When** the participant submits
**Then** up to 3 turns are generated as configured (Pro has no cap)

---

**Given** the block is configured with `aiFollowUp: true` and team is Free
**When** the researcher opens the builder ConfigPanel for this block
**Then** the `maxTurns` selector shows "1" with a hint: "Plan gratuit limité à 1 relance · upgrade for up to 3"

---

**Given** the team upgrades from Free to Pro mid-session
**When** the next response triggers a follow-up
**Then** the new Pro cap (3 turns) applies immediately (no need to re-publish the session)

### Implementation notes
- Logique dans `app/api/s/ai-followup/route.ts` : `effectiveMaxTurns = min(blockConfig.maxTurns, planCap)`
- ConfigPanel : helper hook `useTeamPlan()` + render conditionnel sur le sélecteur

---

## Story 8.8 — Read-only mode for expired subscription

> As a user whose subscription has expired, I want to retain read access to my data for 30 days so I can decide to renew without losing my work, so that ending a subscription doesn't feel like data loss.

### Acceptance Criteria

**Given** my `subscriptionStatus = 'canceled'` and the cancellation date is < 30 days ago
**When** I log into `/dashboard`
**Then** I see a banner "Votre abonnement a expiré le YYYY-MM-DD. Renouvelez pour reprendre l'édition" and all create/edit actions are disabled (read-only mode)

---

**Given** read-only mode is active
**When** I try to create a project, edit a session, or trigger an AI action
**Then** the action is blocked with a clear "Abonnement expiré" message + "Renouveler" CTA

---

**Given** the cancellation date is > 30 days ago
**When** I log in
**Then** my account enters archived state — read-only persists, but a stronger banner indicates "Compte archivé" and account can only be restored by renewing

---

**Given** I'm in read-only mode and click "Renouveler"
**When** the action runs
**Then** I'm sent through Stripe Checkout to subscribe again (same flow as Story 8.3)

---

**Given** I renew successfully
**When** the webhook processes `customer.subscription.created`
**Then** `subscriptionStatus = 'active'`, the read-only banner disappears, and full access is immediately restored

### Implementation notes
- Helper `getSubscriptionState(team)` qui retourne `'active' | 'read_only' | 'archived' | 'free'`
- Composant `<ReadOnlyBanner/>` dans `(dashboard)/layout.tsx`
- Toutes les server actions ajoutent un check : `if state === 'read_only' return { error: 'subscription_expired' }`
