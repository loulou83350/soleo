---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories']
inputDocuments:
  - "~/.claude/plans/vectorized-jumping-raccoon.md (sections Epic 8 + 10 + 11)"
  - "lib/db/schema.ts"
  - "docs/EPIC5_BACKLOG.md (historical context)"
  - "docs/EPIC6_BACKLOG.md (historical context)"
  - "docs/EPIC7_BACKLOG.md (historical context)"
  - "docs/EPIC9_BACKLOG.md (historical context — Polish backlog)"
scope: "Epic 8 — Billing & Paywall, Epic 10 — Landing Page, Epic 11 — Internationalization (FR + EN)"
---

# Soleo — Epic Breakdown (Epics 8, 10, 11)

## Overview

This document captures the formal BMAD breakdown for the three remaining MVP-launch Epics:
- **Epic 8** — Billing (Stripe + paywall + plan-based quotas)
- **Epic 10** — Landing page (public marketing site)
- **Epic 11** — Internationalization (FR + EN)

Order of execution decided:
1. Epic 11 first (i18n foundation — refactoring after-the-fact would be costly)
2. Polish design pass (existing Epic 9 stories applied to migrate to new design tokens)
3. Epic 10 + Epic 8 in parallel (landing + billing share a coherent visual language)

Source artifacts (de-facto PRD/Architecture, since no formal docs exist):
- The session plan file (`~/.claude/plans/vectorized-jumping-raccoon.md`) — contains all the business decisions for the three Epics
- `lib/db/schema.ts` — current data model (Drizzle ORM + Postgres)
- Past Epic backlogs (5/6/7/9) — implementation context

## Requirements Inventory

### Functional Requirements

**Epic 8 — Billing**

FR8.1: The system MUST support a freemium model with two plans: Free (default) and Pro.
FR8.2: Pro MUST be available in two billing cycles: monthly (24 € / month) and annual (228 €/year, ~20% discount).
FR8.3: The system MUST enforce the Free plan quotas:
  - 1 active project max
  - 2 concurrent published sessions max
  - 30 participants per session max
  - 100 total responses per month max
  - 1 team member (solo)
  - 50 manual AI tag suggestions per month max
  - Auto-tagging disabled
  - 3 AI findings drafts per month max
  - AI follow-up: 1 turn max per question (vs 3 on Pro)
  - 7 days session recording retention
  - Findings published with "Made with Soleo" watermark
  - PDF export disabled
FR8.4: Pro plan MUST have no quotas on any limit listed in FR8.3 except `maxMembersPerTeam` which stays at 1 (V1 = solo Pro, Team plan deferred to post-MVP).
FR8.5: Soft limits (AI quotas, structural quotas like project count) MUST trigger an `<UpgradePrompt/>` (tooltip + link to /pricing or modal) instead of crashing.
FR8.6: Hard limits (creating a 2nd project on Free, creating a 3rd active session on Free) MUST present a blocking modal with upgrade CTA.
FR8.7: Mid-session participants MUST NOT be cut off — if a Free session goes from 30 to 50 participants, allow up to 50 then hard-block new ones.
FR8.8: Subscription expired MUST result in 30 days of read-only mode (browse only, no create/modify) before archival.
FR8.9: Stripe Checkout MUST be the primary checkout path (hosted by Stripe).
FR8.10: Stripe Customer Portal MUST be accessible from `/dashboard/general` for cancel/update card/change plan.
FR8.11: Stripe webhooks MUST sync `teams.subscriptionStatus` and `teams.planName` on `customer.subscription.created/updated/deleted` and `invoice.payment_failed/paid`.
FR8.12: Paywall placement rules:
  - NEVER on signup, first project, first session, first publish, first response, first findings
  - YES on quota hit (contextual)
  - YES in `/dashboard/general` (Billing tab — always visible)
  - YES on `/pricing` (canonical)
  - YES on subtle dismissable banner after the user has published 3+ sessions on Free

**Epic 10 — Landing page**

FR10.1: The root route `/` MUST render a public landing page when the user is not authenticated.
FR10.2: When the user is authenticated, the root MUST redirect to `/dashboard`.
FR10.3: The landing page MUST contain:
  - Hero with H1, subhead, primary CTA "Essayer gratuitement"
  - Features section (Builder, AI Interviewer, Findings, Insights)
  - Use-cases section (designer solo, équipe UX, agence)
  - Pricing section (links to /pricing or inlined)
  - FAQ
  - Footer with legal links + social
FR10.4: The landing page MUST be SEO-friendly:
  - Next.js metadata API (title, description, OG image, canonical)
  - sitemap.xml + robots.txt
  - Per-locale variants for SEO (fr/en — see Epic 11)

**Epic 11 — Internationalization (FR + EN)**

FR11.1: The application MUST support both `fr` (existing) and `en` (new) locales.
FR11.2: Locale routing MUST use URL prefix (`/fr/...`, `/en/...`) per next-intl best practice for App Router + SEO.
FR11.3: A locale middleware MUST detect the user's preference (cookie > Accept-Language header > default `fr`).
FR11.4: All user-facing strings MUST be sourced from translation files in `messages/<locale>/<namespace>.json` (or equivalent next-intl convention).
FR11.5: A language switcher MUST be visible in the dashboard header and on the landing page.
FR11.6: Currency MUST follow locale: EUR for `fr`, USD for `en` (with EUR fallback option later).
FR11.7: SEO metadata (title, description, OG) MUST be localized per page.
FR11.8: Email templates (Resend) MUST be localized per recipient locale.

**Epic 12 — Onboarding & Activation**

FR12.1: New users MUST see an onboarding wizard (3-4 steps) immediately after signup that introduces the path to first findings.
FR12.2: The dashboard MUST display an activation checklist with 4 milestones (1st project, 1st publish, 1st response, 1st findings) until completed.
FR12.3: Empty states MUST exist for: empty dashboard (no projects), empty project (no sessions), empty session (no responses), empty findings (no draft generated). Each MUST include a clear CTA + brief pedagogy.
FR12.4: A welcome email MUST be sent immediately on signup via Resend, summarizing the 1st step.
FR12.5: A D+3 reminder email MUST be sent if no session has been published.
FR12.6: A D+7 reminder email MUST be sent if no findings have been generated.
FR12.7: A quota-approach email (at 80% of any Free quota) MUST be sent (paywall warming, links to Epic 8 quota system).
FR12.8: First-time contextual tooltips MUST appear on key features when first encountered (block types in builder, AI follow-up toggle, AI suggest button, findings AI button) and dismiss permanently after first dismissal.
FR12.9: An in-app `?` button on every dashboard page MUST open a help drawer with quick-start docs + contact info.

### NonFunctional Requirements

NFR8.1: All quota checks MUST be type-safe, centralized in `lib/billing/plans.ts` and `lib/billing/quotas.ts`, with no quota magic numbers scattered across the codebase.
NFR8.2: Quota counters MUST be computed on-the-fly from existing tables (`ai_usage_logs`, `block_responses`) — no new tables for monthly counters at MVP.
NFR8.3: Stripe webhook MUST be idempotent (safe to receive duplicate events).
NFR8.4: Stripe Tax MUST be enabled for EU VAT compliance (mandatory for FR market).
NFR8.5: PostHog tracking already excludes `/s/*` and `/findings/*` — Epic 8 quota checks MUST NOT introduce cross-cutting tracking on those routes.
NFR8.6: Performance: a quota check MUST add < 50ms latency to a user action.
NFR10.1: Landing page Lighthouse score: ≥ 90 on Performance, ≥ 95 on SEO.
NFR10.2: Landing page MUST work without JS for the hero + critical CTAs (progressive enhancement).
NFR11.1: i18n switching MUST be done without a full page reload when possible (next-intl supports this).
NFR11.2: Translation file size budget: <100 KB per locale for the initial English bundle.
NFR11.3: Migration from hardcoded FR strings MUST not break any existing functionality (zero functional regression).
NFR12.1: Activation funnel events MUST be tracked via PostHog (already wired) — no extra tracking infrastructure for Epic 12.
NFR12.2: First-time tooltip dismissal state MUST be persisted (cookie or `users.onboarding_dismissed` JSON column) so they never re-appear after dismissal.

### Additional Requirements (from existing Architecture/State)

- **Starter Template**: Next.js 15 SaaS Starter (Vercel) — already in place. Stripe + Customer Portal scaffolding exists, just gated by `BILLING_ENABLED=false`.
- **Database**: Postgres via Supabase + Drizzle ORM. `teams` table already has Stripe columns (`stripeCustomerId`, `stripeSubscriptionId`, `stripeProductId`, `planName`, `subscriptionStatus`).
- **Migration drift**: known issue — `pnpm db:generate` is broken since 0003 snapshot drift. Apply migrations manually via `psql $POSTGRES_URL -f lib/db/migrations/NNNN_*.sql`.
- **Auth**: AUTH_SECRET-based session cookies (no Supabase Auth, no Clerk). Affects how locale is persisted (cookie compatible).
- **Email**: Resend already wired (RESEND_API_KEY env var). Templates currently FR-only.
- **Analytics**: PostHog client SDK already initialized in `(dashboard)/layout.tsx`. Excludes participant + public viewer routes.
- **AI Provider**: OpenAI configured (`gpt-4o-mini`). All AI features have feature flags (`NEXT_PUBLIC_AI_*` + `AI_AUTO_TAG`) — these flags persist across Epic 8.
- **Hosting**: Vercel. Env vars set per-environment (Production/Preview).
- **i18n library decision**: `next-intl` (App Router compatible, supports server components, recommended for Next.js 15).

### UX Design Requirements

**Note**: The user is doing a design pass after these stories are created. UX-DRs here capture what's *known to be needed* from a UX standpoint regardless of the visual design.

UX-DR8.1: A `<UpgradeTooltip/>` component on disabled buttons (gated by Free quota) — discreet, info-only.
UX-DR8.2: A `<UpgradeModal/>` component for hard limits (e.g. attempting to create a 2nd project on Free).
UX-DR8.3: A `<UpgradeBanner/>` component — soft, dismissable, top-of-dashboard suggestion shown after success milestones.
UX-DR8.4: The `/pricing` page MUST be clear, simple, with a single Pro plan toggle (monthly/annual). No tier comparison table for MVP (only one paid plan).
UX-DR8.5: Wording MUST use "Upgrade", "Passer Pro", "Débloquer" — never "Acheter" or "Payer" (per user direction).
UX-DR10.1: Landing hero MUST have a punchy H1 + subhead + 1 primary CTA + 1 secondary CTA (sign-in).
UX-DR10.2: Each feature card MUST have an icon, a 1-line title, a 2-line description.
UX-DR10.3: The use-cases section MUST have 3 personas (designer solo, équipe UX, agence) with brief copy.
UX-DR10.4: FAQ MUST use accordion pattern (one open at a time).
UX-DR10.5: Footer MUST include: links to legal pages (CGU/privacy/contact), language switcher, social icons (LinkedIn at minimum).
UX-DR11.1: Language switcher MUST be visible in the header (icon + current locale code) and accessible (keyboard, ARIA).
UX-DR11.2: Translation work MUST preserve typographic conventions per locale (FR: insécables avant `:` `?` `!` ; quotes `« »`).
UX-DR12.1: Onboarding components MUST be skippable / dismissable (no forced "next" friction).
UX-DR12.2: First-time tooltips MUST use a discreet visual pattern (small dot indicator + popover on click) — not an aggressive modal that blocks the UI.

### FR Coverage Map

This map ensures every FR is owned by exactly one Epic.

**Epic 11 — Internationalization**
- FR11.1 → next-intl install + locale config
- FR11.2 → URL prefix routing (`/fr/...`, `/en/...`)
- FR11.3 → locale middleware (cookie > Accept-Language > default)
- FR11.4 → translation files structure (`messages/<locale>/<ns>.json`)
- FR11.5 → language switcher UI
- FR11.6 → locale-aware currency (EUR/USD)
- FR11.7 → SEO metadata localized
- FR11.8 → Resend email templates localized
- NFR11.1, NFR11.2, NFR11.3 → performance + size + zero regression
- UX-DR11.1, UX-DR11.2 → switcher accessibility + typographic conventions

**Epic 10 — Landing page**
- FR10.1 → public root route render
- FR10.2 → auth-aware redirect to /dashboard
- FR10.3 → sections (hero / features / use-cases / pricing / FAQ / footer)
- FR10.4 → SEO (metadata, sitemap, robots, per-locale variants)
- NFR10.1, NFR10.2 → Lighthouse + progressive enhancement
- UX-DR10.1 → hero CTA pattern
- UX-DR10.2 → feature card pattern
- UX-DR10.3 → use-case personas
- UX-DR10.4 → FAQ accordion
- UX-DR10.5 → footer pattern

**Epic 8 — Billing**
- FR8.1 → Free / Pro plans
- FR8.2 → monthly + annual billing cycles
- FR8.3 → Free plan quotas (full grid)
- FR8.4 → Pro plan unlimited (except `maxMembersPerTeam=1`)
- FR8.5 → soft limits → UpgradePrompt
- FR8.6 → hard limits → UpgradeModal
- FR8.7 → mid-session participants graceful behavior
- FR8.8 → 30-day read-only mode for expired subs
- FR8.9 → Stripe Checkout (hosted)
- FR8.10 → Stripe Customer Portal access
- FR8.11 → webhook subscription sync (idempotent)
- FR8.12 → paywall placement rules (when to show, when not)
- NFR8.1 → centralized type-safe quotas
- NFR8.2 → counters via on-the-fly aggregation
- NFR8.3 → idempotent webhook
- NFR8.4 → Stripe Tax for EU VAT
- NFR8.5 → no PostHog cross-cutting on participant routes
- NFR8.6 → quota check < 50ms
- UX-DR8.1 → UpgradeTooltip
- UX-DR8.2 → UpgradeModal
- UX-DR8.3 → UpgradeBanner
- UX-DR8.4 → /pricing simplified (single Pro plan + cycle toggle)
- UX-DR8.5 → wording rules ("Upgrade", "Passer Pro", "Débloquer")

**Epic 12 — Onboarding & Activation**
- FR12.1 → onboarding wizard post-signup (Story 12.1)
- FR12.2 → activation checklist on dashboard (Story 12.2)
- FR12.3 → empty states across the app (Story 12.3)
- FR12.4 → welcome email (Story 12.4)
- FR12.5 → D+3 reminder email (Story 12.5)
- FR12.6 → D+7 reminder email (Story 12.5 — same drip story)
- FR12.7 → quota approach email at 80% (Story 12.9)
- FR12.8 → first-time tooltips (Story 12.6)
- FR12.9 → in-app help drawer (Story 12.8)
- NFR12.1, NFR12.2 → tracked via PostHog (Story 12.7) + dismissal persistence in tooltip story
- UX-DR12.1, UX-DR12.2 → applied across stories 12.1, 12.6, 12.8

All 36 FRs + 11 NFRs + 13 UX-DRs are covered. No requirement is orphaned.

## Epic List

The 3 Epics are structured around **distinct user-value outcomes** and are **standalone**: each delivers value independently and does not require future Epics to function.

### Execution order (driven by technical dependencies)

1. **Epic 11** first — i18n is foundational refactoring; doing it after Epic 8/10 would force re-extracting strings already added.
2. (Existing **Epic 9 — Polish & UX** stories applied — design tokens migration, see `docs/EPIC9_BACKLOG.md`)
3. **Epic 10 + Epic 8** in parallel — both rely on the new design system; landing's pricing section + billing's `/pricing` page share components.

### Epic 11: Internationalization (FR + EN)

**Goal**: Soleo users (researchers, participants, public viewers) can use the application in either French or English. The locale is auto-detected, persisted, and respected across navigation, metadata, and emails.

**User outcome**: A French researcher and an English researcher can both sign up, build sessions, view findings, and receive notifications, each in their preferred language. Currency adapts to locale.

**FRs covered**: FR11.1, FR11.2, FR11.3, FR11.4, FR11.5, FR11.6, FR11.7, FR11.8
**NFRs covered**: NFR11.1, NFR11.2, NFR11.3
**UX-DRs covered**: UX-DR11.1, UX-DR11.2

**Standalone**: ✅ Ships independently. The app remains FR-only and functional during the migration; English appears once translation files are populated.

**Dependencies**: None on Epic 8 / 10. Epic 8 and 10 will use `t()` from day one if Epic 11 ships first.

### Epic 10: Public Landing Page

**Goal**: Visitors who don't yet have an account discover Soleo via a public landing page that explains the product, presents the pricing, and converts them into signups.

**User outcome**: A new visitor lands on `soleo.app`, immediately understands what Soleo does, sees the value prop, the use-cases, the pricing, can answer their FAQ questions, and clicks "Essayer gratuitement" to sign up.

**FRs covered**: FR10.1, FR10.2, FR10.3, FR10.4
**NFRs covered**: NFR10.1, NFR10.2
**UX-DRs covered**: UX-DR10.1, UX-DR10.2, UX-DR10.3, UX-DR10.4, UX-DR10.5

**Standalone**: ✅ Ships independently. Without Epic 8, the pricing section can show the Free plan only or use placeholder text.

**Dependencies**:
- Soft on Epic 11 — landing should be available in FR + EN at SEO level. If shipped before Epic 11, can ship FR-only.
- Soft on Epic 8 — pricing section richer with Pro plan, but landing can reference "Pro coming soon".

### Epic 8: Billing & Paywall

**Goal**: A user on the Free plan can experience Soleo's value, hit a quota, and convert to Pro via Stripe Checkout. A Pro user can self-manage their subscription via Customer Portal. The system enforces quotas centrally, with a clear paywall UX that respects "no friction before value".

**User outcome**: A Free researcher can use Soleo to publish 1 session with up to 30 participants and get 3 AI findings drafts per month. When they hit a limit, they see a non-blocking paywall in context. They click "Upgrade", complete Stripe Checkout, and instantly unlock unlimited usage. They can cancel anytime via Stripe Customer Portal.

**FRs covered**: FR8.1, FR8.2, FR8.3, FR8.4, FR8.5, FR8.6, FR8.7, FR8.8, FR8.9, FR8.10, FR8.11, FR8.12
**NFRs covered**: NFR8.1, NFR8.2, NFR8.3, NFR8.4, NFR8.5, NFR8.6
**UX-DRs covered**: UX-DR8.1, UX-DR8.2, UX-DR8.3, UX-DR8.4, UX-DR8.5

**Standalone**: ✅ Ships independently. Without Epic 10, conversions still happen via direct sign-up + in-app paywall. Without Epic 11, ships in FR.

**Dependencies**:
- Soft on Epic 11 — currency adapts to locale (EUR/USD) only if i18n exists; otherwise defaults to EUR.
- Soft on Epic 10 — the `/pricing` page lives inside Epic 8; a landing pricing section consumes it.

---

**Total**: 4 Epics, all standalone, with clear FR coverage. 0 orphaned requirements.

### Epic 12: Onboarding & Activation

**Goal**: New users discover Soleo's value within their first session via a guided onboarding (wizard, empty states, first-time tooltips), targeted activation emails, and a measured funnel via PostHog. Beta users can be tested before any paywall is enabled.

**User outcome**: A signup user sees a wizard explaining the 3 steps to first finding, an activation checklist on their dashboard, an empty state with clear CTAs, contextual tooltips when they encounter complex features, and gets nurtured by emails (welcome, D+3 reminder if no publish, D+7 quota approach). The PO can measure exactly where users drop off in the activation funnel.

**FRs covered**: FR12.1, FR12.2, FR12.3, FR12.4, FR12.5, FR12.6, FR12.7, FR12.8, FR12.9
**NFRs covered**: NFR12.1, NFR12.2
**UX-DRs covered**: UX-DR12.1, UX-DR12.2

**Standalone**: ✅ Ships independently. Without Epic 8/10/11, the onboarding still works in FR (with i18n added once Epic 11 ships).

**Dependencies**:
- Soft on Epic 11 (emails + tooltips need to be translatable, but can ship FR-first)
- Soft on Epic 9 (design tokens — onboarding looks better with finished design system)
- Hard input from Epic 8: only FR8.12 (paywall placement) interacts with Epic 12 messages, but Epic 12 ships independently and is enriched by Epic 8 later.

**Hors-scope** (explicit):
- Figma OAuth flow (deferred — Soleo not yet validated by Figma, keep using PAT for now)

═══════════════════════════════════════════════════════════════════════════════

## Epic 11: Internationalization (FR + EN)

Soleo users (researchers, participants, public viewers) can use the application
in either French or English. Locale is auto-detected, persisted, and respected
across navigation, metadata, currency, and emails.

### Story 11.1: Setup next-intl + locale URL prefix routing

As a developer,
I want next-intl installed and configured with URL prefix routing,
So that pages can be served at `/fr/...` or `/en/...` per locale, and SEO benefits from per-locale URLs.

**Acceptance Criteria:**

**Given** a fresh checkout
**When** I install next-intl + add the locale middleware
**Then** `/fr/dashboard` and `/en/dashboard` both render correctly with the same component tree

---

**Given** the current localized routing is configured
**When** any internal `<Link/>` is used
**Then** the link automatically prepends the active locale (`<Link href="/dashboard">` becomes `/fr/dashboard` if locale is `fr`)

---

**Given** the existing routes (`/dashboard/*`, `/s/[token]`, `/findings/[token]`, `/sign-in`, `/sign-up`)
**When** the migration is applied
**Then** all routes still resolve, with `/s/[token]` and `/findings/[token]` exempt from the locale prefix (participant + public viewer routes stay un-prefixed for shareability)

### Story 11.2: Locale detection middleware (cookie > header > default)

As a user,
I want the app to remember my preferred language across sessions,
So that I don't have to choose it every time I visit.

**Acceptance Criteria:**

**Given** I have no `NEXT_LOCALE` cookie and `Accept-Language: fr-FR`
**When** I visit `/`
**Then** I'm redirected to `/fr`

---

**Given** I have a `NEXT_LOCALE=en` cookie
**When** I visit any URL
**Then** I see English content regardless of `Accept-Language`

---

**Given** no cookie + `Accept-Language: de-DE`
**When** I visit `/`
**Then** I'm redirected to the default locale `/fr` (no German support, fall back gracefully)

---

**Given** I switch language via the language switcher (Story 11.6)
**When** the switch happens
**Then** the `NEXT_LOCALE` cookie is updated and persists for 1 year

### Story 11.3: Extract FR translations into messages/fr/*.json

As a developer,
I want all existing hardcoded FR strings extracted into namespaced JSON files,
So that they can be translated and maintained as data instead of inlined in components.

**Acceptance Criteria:**

**Given** the existing components/pages
**When** an extraction pass is performed
**Then** `messages/fr/common.json`, `builder.json`, `findings.json`, `participant.json`, `billing.json`, `landing.json`, `dashboard.json`, `auth.json` exist and contain all extracted strings

---

**Given** a typical component string like `'Publier la session'` in `BuilderHeader.tsx`
**When** the file is refactored
**Then** the JSX uses `t('builder.publishSession')` and the key exists in `messages/fr/builder.json`

---

**Given** the existing test suite
**When** the refactor is complete
**Then** `pnpm test` passes (102/102 tests, no regression)

### Story 11.4: Refactor all components to use t() + getTranslations()

As a developer,
I want every user-facing string in components and server actions to come from translation files,
So that the codebase has zero hardcoded user-facing strings outside of the messages/ folder.

**Acceptance Criteria:**

**Given** the codebase
**When** scanned for hardcoded user-facing JSX text
**Then** no JSX text node contains a non-empty string that's not a `t()` call, a code identifier, or an explicitly-marked exempt string (e.g. brand name "Soleo")

---

**Given** a server action that returns an error message
**When** invoked
**Then** the message comes from `getTranslations()` (server-side equivalent of `useTranslations`)

---

**Given** the FR locale is active after the refactor
**When** navigating any existing page
**Then** the rendered output is visually identical to pre-refactor (same strings, same layout, no broken keys)

### Story 11.5: Generate EN translations + manual review

As a Pro user who speaks English,
I want to use Soleo in English with translations of equivalent quality to the FR version,
So that I'm not locked into a French-only product.

**Acceptance Criteria:**

**Given** all FR translation files exist (Story 11.3)
**When** an LLM-assisted EN generation runs (Claude/OpenAI)
**Then** `messages/en/*.json` files exist with parallel structure (same keys as FR)

---

**Given** the generated EN files
**When** I (the user/PO) review them
**Then** I can edit any translation that feels off and commit the corrections

---

**Given** the EN locale is active
**When** I navigate any page
**Then** no untranslated `t('foo.bar')` keys leak to the UI (every key has an EN value)

---

**Given** mid-string formatting (numbers, dates, plurals)
**When** rendered in EN
**Then** ICU MessageFormat is used for plurals/numbers (`{count, plural, one {# session} other {# sessions}}`)

### Story 11.6: Language switcher + locale-aware currency

As a user,
I want to switch language from any page via a visible header control, with prices automatically adapted to my locale,
So that I can change locale without finding hidden settings, and I see prices in a relevant currency.

**Acceptance Criteria:**

**Given** any page (logged in or out)
**When** I look at the top header
**Then** I see a language switcher control (icon + current locale code, e.g. "🌐 FR")

---

**Given** I click the switcher
**When** I select another locale
**Then** the page navigates to the equivalent URL in that locale, the cookie is updated, and the new language renders

---

**Given** the locale is `en`
**When** I view `/pricing` or any monetary value
**Then** prices show in USD (e.g. $24/mo); switching to `fr` shows EUR (24 €/mois)

---

**Given** the switcher is keyboard-navigated
**When** I tab to it + press Enter
**Then** the dropdown opens and I can select with arrows + Enter; ARIA labels announce "Language" and selected option

═══════════════════════════════════════════════════════════════════════════════

## Epic 10: Public Landing Page

Visitors who don't yet have an account discover Soleo via a public landing page
that explains the product, presents pricing, and converts them into signups.

### Story 10.1: Public landing route + auth-aware redirect

As a visitor,
I want to land on a marketing page when I visit the root URL,
So that I can understand the product before deciding to sign up.

**Acceptance Criteria:**

**Given** I'm not authenticated
**When** I visit `/` (or `/fr` / `/en`)
**Then** I see the landing page (not a 404, not an auto-redirect to sign-in)

---

**Given** I'm authenticated
**When** I visit `/`
**Then** I'm redirected to `/dashboard` (existing behavior preserved)

---

**Given** the page renders with JS disabled
**When** I view the source
**Then** the hero, primary CTA, and footer are visible (progressive enhancement — semantic HTML works without JS)

### Story 10.2: Hero section + Features section

As a visitor,
I want to immediately understand what Soleo does and what features it offers,
So that I can decide if it's relevant to me within ~10 seconds.

**Acceptance Criteria:**

**Given** I land on `/`
**When** I see the hero
**Then** I see an H1 (~50 chars), subhead (~150 chars), primary CTA "Essayer gratuitement", secondary CTA "Se connecter"

---

**Given** I scroll past the hero
**When** I reach the features section
**Then** I see 4 feature cards (Builder, AI Interviewer, Findings, Insights), each with an icon, a 1-line title, and a 2-line description

---

**Given** I'm on a mobile viewport (<640px)
**When** the hero renders
**Then** everything is readable without horizontal scroll, CTAs stack vertically, no truncated text

### Story 10.3: Use-cases section + inline pricing summary

As a visitor unsure if I'm the target persona,
I want to see use-cases that match my profession + a glimpse of pricing,
So that I feel "this is for me" and I'm not surprised by the cost on a separate page.

**Acceptance Criteria:**

**Given** I scroll to the use-cases section
**When** rendered
**Then** I see 3 personas: "Designer solo", "Équipe UX", "Agence", each with a brief paragraph + 1-2 example usage scenarios

---

**Given** I scroll past use-cases
**When** I reach the pricing summary
**Then** I see a comparison: Free vs Pro with the toggle Mensuel/Annuel + a "Voir les détails" link to `/pricing`

---

**Given** I click "Voir les détails"
**When** the navigation completes
**Then** I land on the full `/pricing` page (Epic 8 Story 8.2)

### Story 10.4: FAQ accordion + Footer

As a visitor with specific objections (security, refund, beta status),
I want my common questions answered before signup,
So that I don't bounce due to uncertainty.

**Acceptance Criteria:**

**Given** I scroll to the FAQ section
**When** rendered
**Then** I see at least 6 common questions in an accordion (RGPD/security, pricing, billing cycle, cancellation, support, English availability)

---

**Given** I click an accordion item
**When** it expands
**Then** any other open item collapses (one-at-a-time pattern, classic FAQ UX)

---

**Given** I scroll to the footer
**When** rendered
**Then** I see legal links (CGU, Privacy, Contact), language switcher, social icons (LinkedIn at minimum), and a small "Made in France 🇫🇷" tag

### Story 10.5: SEO metadata + sitemap + OG image

As a marketer,
I want the landing page properly indexed by search engines and rich on social shares,
So that organic traffic finds Soleo and previews look professional when shared.

**Acceptance Criteria:**

**Given** the landing page (per locale)
**When** crawled by Google or fetched by a social bot
**Then** it has unique `title`, `description`, `canonical`, `og:image` (1200×630), `og:title`, `og:description`, `twitter:card=summary_large_image`

---

**Given** a request to `/sitemap.xml`
**When** fetched
**Then** it lists all public routes (root + pricing + per-locale variants), with `<link rel="alternate" hreflang="...">` for cross-language equivalents

---

**Given** a request to `/robots.txt`
**When** fetched
**Then** it allows crawling of `/`, `/pricing`, `/sign-in`, `/sign-up`, blocks `/dashboard/*`, `/s/*`, `/findings/*`

---

**Given** a Lighthouse audit on `/fr` and `/en`
**When** the audit runs
**Then** SEO score ≥ 95 and Performance score ≥ 90

═══════════════════════════════════════════════════════════════════════════════

## Epic 8: Billing & Paywall

A user on the Free plan can experience Soleo's value, hit a quota, and convert
to Pro via Stripe Checkout. A Pro user can self-manage their subscription via
Customer Portal. The system enforces quotas centrally with a clear paywall UX
that respects "no friction before value".

### Story 8.1: Plan-based quota foundation

As a developer,
I want a centralized quota system in `lib/billing/plans.ts` and `lib/billing/quotas.ts`,
So that all feature gates throughout the app reference a single source of truth that's easy to update without scattered magic numbers.

**Acceptance Criteria:**

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

### Story 8.2: Stripe products setup + Pricing page

As a Free user evaluating Pro,
I want a clear `/pricing` page with a single Pro plan and a monthly/annual toggle,
So that the decision is binary (stay Free or upgrade Pro) without comparison-table fatigue.

**Acceptance Criteria:**

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

### Story 8.3: Stripe Checkout success + idempotent webhook sync

As a user who just paid,
I want my Pro features to unlock instantly after Stripe Checkout completes,
So that I don't wait or get confused about whether my payment worked.

**Acceptance Criteria:**

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

### Story 8.4: Customer Portal access for self-service

As a Pro subscriber,
I want to manage my subscription self-service (cancel, update card, change plan) via Stripe Customer Portal,
So that I don't have to email support for routine actions.

**Acceptance Criteria:**

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

### Story 8.5: UpgradePrompt UX (Tooltip + Modal + Banner)

As a Free user discovering paid features,
I want clear, non-intrusive prompts to upgrade exactly when I hit a quota,
So that I'm not annoyed at the wrong moment but I know how to unlock more.

**Acceptance Criteria:**

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

### Story 8.6: Free plan quota enforcement on critical actions

As the system,
I must enforce Free plan quotas on all gated actions, leveraging the UpgradePrompt components from Story 8.5,
So that Free users hit limits and convert to Pro at the right moment.

**Acceptance Criteria:**

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

### Story 8.7: AI follow-up Free tier cap (max 1 turn per question)

As a Free user,
I want to use the AI follow-up feature on my open-text questions but capped at 1 relance per question,
So that I get a real taste of the feature without unlimited token consumption.

**Acceptance Criteria:**

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

### Story 8.8: Read-only mode for expired subscription

As a user whose subscription has expired,
I want to retain read access to my data for 30 days so I can decide to renew without losing my work,
So that ending a subscription doesn't feel like data loss.

**Acceptance Criteria:**

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

═══════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════════

## Epic 12: Onboarding & Activation

New users discover Soleo's value within their first session via a guided
onboarding (wizard, empty states, first-time tooltips), targeted activation
emails, and a measured funnel via PostHog. Beta users can be tested in real
conditions before any paywall is enabled.

**Hors-scope**: Figma OAuth flow (deferred — keep PAT until Soleo is validated by Figma).

### Story 12.1: Onboarding wizard post-signup (3-4 steps)

As a brand-new user,
I want a short guided wizard right after signup that explains the path to my first findings,
So that I'm not dropped on an empty dashboard wondering where to start.

**Acceptance Criteria:**

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

### Story 12.2: Activation checklist on dashboard

As a Free user trying to figure out what to do next,
I want a checklist at the top of my dashboard showing my progress through the activation milestones,
So that I have a clear plan and feel motivated by ticking items off.

**Acceptance Criteria:**

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

### Story 12.3: Empty states (dashboard, project, session, findings)

As a user landing on a screen with no content yet,
I want a clear empty state that tells me what this screen will eventually contain and how to populate it,
So that I'm not confused by blank canvases.

**Acceptance Criteria:**

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

### Story 12.4: Welcome email immediately on signup

As a new user,
I want a welcome email that confirms my account + guides me to the next step,
So that I feel oriented and have a doc/email to come back to.

**Acceptance Criteria:**

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

### Story 12.5: D+3 / D+7 drip reminder emails

As a user who signed up but didn't complete activation,
I want gentle reminder emails at D+3 (no publish) and D+7 (no findings),
So that I'm reminded to come back without feeling spammed.

**Acceptance Criteria:**

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

### Story 12.6: First-time contextual tooltips on key features

As a user encountering an unfamiliar feature for the first time,
I want a small, dismissable tooltip explaining what it does,
So that I learn the feature without having to read external docs.

**Acceptance Criteria:**

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

### Story 12.7: Activation funnel PostHog events + dashboard

As the PO,
I want to see exactly where users drop off in their activation journey,
So that I can prioritize fixes.

**Acceptance Criteria:**

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

### Story 12.8: In-app help drawer (`?` button)

As a user with a quick question,
I want a help button always visible in the dashboard that opens a drawer with quick-start docs + contact info,
So that I don't have to leave the app to get unblocked.

**Acceptance Criteria:**

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

### Story 12.9: Quota approach email + paywall warming

As a Free user nearing my quota,
I want an email warning me at 80% so I'm not surprised when I hit the limit,
So that I can decide proactively to upgrade or wait.

**Acceptance Criteria:**

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
**Then** the email is NOT sent (this is technically a transactional / quota notice — discutable, but on respecte l'unsubscribe pour la prudence privacy)

═══════════════════════════════════════════════════════════════════════════════

## Summary

- **4 Epics**, all standalone
- **28 Stories** total (Epic 11: 6, Epic 10: 5, Epic 8: 8, Epic 12: 9)
- **36 FRs + 11 NFRs + 13 UX-DRs** all covered (per FR Coverage Map)
- **0 cross-story dependencies within an Epic** — each story can be implemented and tested in isolation given the previous stories of its Epic are done
- **Cross-Epic dependencies** are soft (currency adapts to locale only if Epic 11 is shipped, etc.) — none of the Epics is blocked by another
