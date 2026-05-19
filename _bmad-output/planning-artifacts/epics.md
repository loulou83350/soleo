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

**Epic 13 — Live Site Testing**

FR13.1: A new block type `live_site_task` MUST be available in the Builder, with config: prompt, instructions, mode (`html_upload` | `public_url`), entry page, optional goal URL for auto-detection of completion.
FR13.2: Researchers MUST be able to upload a `.zip` of an HTML prototype (HTML/CSS/JS/assets) up to 50 MB; the system extracts it and hosts on `soleo.app/proto/[token]/`.
FR13.3: When mode is `public_url`, the researcher pastes a URL; the system attempts to render it via iframe and provides a clear fallback message (with "Open in new tab" CTA) if `X-Frame-Options` blocks the iframe.
FR13.4: A tracking JS lib (~150 KB gzipped, using rrweb under the hood) MUST be injected into hosted HTML prototypes; it captures: DOM snapshots (rrweb), clicks (with selector + element text), URL navigation, idle periods (>3s without activity), and completion events.
FR13.5: Captured events MUST be transmitted in batches every 2 seconds to `/api/proto/events`, gzipped JSON payload, with retry on network failure.
FR13.6: Completion detection MUST be hybrid: a manual "J'ai terminé" button is always visible AND an optional goal URL pattern triggers auto-completion when the participant reaches it.
FR13.7: The participant runtime UI MUST display a Soleo top bar (task instructions + Done button) above the iframe, and respect the participant flow (gate, consent — Story 3.5 extended).
FR13.8: Researchers MUST be able to replay any participant session via an rrweb-based player in the dashboard, including timeline scrubbing, speed control (1x/2x/4x), and event timeline (click/nav/idle).
FR13.9: A click heatmap visualization MUST aggregate clicks per page across participants and render as a canvas overlay on the first DOM snapshot of each page.
FR13.10: A navigation flow diagram MUST aggregate page-to-page transitions across participants and render as a directed graph (sankey-style or simple node-edge).
FR13.11: A per-participant timeline view MUST list events in chronological order with timestamps, page context, and event type; aggregate metrics per task MUST include success rate, median duration, abandon rate, idle hotspots.
FR13.12: The whole `live_site_task` feature MUST be gated by env flag `NEXT_PUBLIC_LIVE_SITE_TASK`; the block type does not appear in the Builder palette and the runtime route returns 404 when OFF.
FR13.13: The HTML upload mode MUST be additionally gated by env flag `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD`; when OFF, only the `public_url` mode is available in the ConfigPanel.

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
NFR13.1: rrweb captures MUST mask all `<input>` text fields, password fields, and any element marked `data-soleo-mask` by default (privacy by default).
NFR13.2: Per-session recording size MUST be capped at 10 MB (sufficient for ~15 min of typical prototype interaction); recording auto-stops above this cap.
NFR13.3: Event ingestion MUST tolerate 100 events/sec/participant without backpressure (batched POST, fire-and-forget on failure).
NFR13.4: Hosted prototype files (HTML/CSS/JS) MUST be served with CSP that allows the Soleo tracking script but otherwise prevents external requests (sandbox-like).

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
UX-DR13.1: The participant top bar MUST be minimal: task instructions truncated to 1 line (full on click), Done button right-aligned, optional skip link. Fixed height ~56px.
UX-DR13.2: The replay player MUST follow the standard video player metaphor: play/pause, timeline scrubber, speed control, current-event label. Keyboard shortcuts: spacebar=play, arrows=skip.
UX-DR13.3: The click heatmap colors MUST be intuitive (no clicks=transparent, 1-2 clicks=cool blue, 5+=warm orange, 10+=red). Legend visible.
UX-DR13.4: Empty-state for sessions with no events MUST clearly indicate "Participant didn't interact" + show how long they stayed.

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

**Epic 13 — Live Site Testing**
- FR13.1 → New block type in Builder (Story 13.1)
- FR13.2 → HTML zip upload (Story 13.2)
- FR13.3 → Public URL mode + iframe fallback (Story 13.4)
- FR13.4 → Tracking JS + rrweb capture (Story 13.5)
- FR13.5 → Event ingestion API (Story 13.6)
- FR13.6 → Hybrid completion (manual + goal) (Story 13.7)
- FR13.7 → Participant runtime UI (Story 13.7)
- FR13.8 → Session replay viewer (Story 13.8)
- FR13.9 → Click heatmap (Story 13.9)
- FR13.10 → Navigation flow diagram (Story 13.10)
- FR13.11 → Per-participant timeline + aggregate metrics (Story 13.11)
- FR13.12 → `NEXT_PUBLIC_LIVE_SITE_TASK` flag (Story 13.1 — gating built-in from day 1)
- FR13.13 → `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD` flag (Story 13.2 — gating built-in from day 1)
- NFR13.1, NFR13.2 → enforced in tracking lib (Story 13.5)
- NFR13.3, NFR13.4 → enforced in ingestion + hosted runtime (Stories 13.3, 13.6)
- UX-DR13.1 → participant UI (Story 13.7)
- UX-DR13.2 → replay player (Story 13.8)
- UX-DR13.3 → heatmap (Story 13.9)
- UX-DR13.4 → empty state on per-participant timeline (Story 13.11)

All 49 FRs + 15 NFRs + 17 UX-DRs are covered. No requirement is orphaned.

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

### Epic 13: Live Site Testing

**Goal**: Researchers can test any HTML prototype (uploaded zip from Claude Artifacts / V0 / Bolt / hand-built) or public URL on real participants and observe their behavior in detail: clicks, navigation, idle moments, full session replay (rrweb-style).

**User outcome**: A researcher uploads a static HTML prototype to Soleo (or pastes a deployed URL), creates a `live_site_task` block with instructions and an optional goal page, and invites participants. Each participant completes the task in their browser (iframe + Soleo top bar). The researcher then reviews each session's full replay (video-like), sees the aggregate click heatmap, the navigation flow diagram, and per-participant metrics — all without leaving the Soleo dashboard.

**FRs covered**: FR13.1, FR13.2, FR13.3, FR13.4, FR13.5, FR13.6, FR13.7, FR13.8, FR13.9, FR13.10, FR13.11, FR13.12, FR13.13
**NFRs covered**: NFR13.1, NFR13.2, NFR13.3, NFR13.4
**UX-DRs covered**: UX-DR13.1, UX-DR13.2, UX-DR13.3, UX-DR13.4

**Standalone**: ✅ Ships independently. The feature is fully gated behind `NEXT_PUBLIC_LIVE_SITE_TASK` — when OFF, zero impact on the rest of the app. Doesn't depend on Epic 8 (billing), Epic 10 (landing), Epic 11 (i18n), or Epic 12 (onboarding).

**Dependencies**:
- Soft on Epic 11 — participant UI / replay viewer texts get translated when Epic 11 ships
- Soft on Epic 12 — first-time tooltip on the "Live site task" block type added in Story 12.6 once Epic 13 ships

**Differentiator**: With Epic 7 (AI Interviewer) already shipped, Epic 13 (Live Site Testing) is the 2nd major differentiator that positions Soleo between Maze / UserTesting / Hotjar — but with the "AI-led research platform" angle.

**Hors-scope** (explicit):
- AI summary / friction detection (kept for V2)
- Scroll/attention heatmaps (V1 = clicks only)
- Multi-tab prototype scenarios
- Annotations during replay
- MP4 export of replay
- "Researcher snippet on their own live site" — different model, not in this Epic

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

═══════════════════════════════════════════════════════════════════════════════

## Epic 13: Live Site Testing

Researchers test HTML prototypes (Claude Artifact / V0 / Bolt / handmade) or public URLs on real participants with full PostHog-style session recording (rrweb), click heatmaps, navigation flow diagrams, and per-participant timelines. Feature gated behind 2 independent flags (`NEXT_PUBLIC_LIVE_SITE_TASK` for the whole block, `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD` for the HTML upload mode specifically).

### Story 13.1: New `live_site_task` block type in Builder (with feature flag)

As a researcher,
I want a new "Live Site Task" block in the Builder with a config form,
So that I can add a prototype-testing step to my study without having to leave Soleo.

**Acceptance Criteria:**

**Given** `NEXT_PUBLIC_LIVE_SITE_TASK=true`
**When** I open the BlockPalette in the Builder
**Then** I see a new "Live Site Task" entry with an icon (e.g. globe + cursor) and add it to my session

---

**Given** `NEXT_PUBLIC_LIVE_SITE_TASK=false` (default)
**When** I open the BlockPalette
**Then** the "Live Site Task" entry does NOT appear, and any existing block of this type in a session is gracefully hidden/disabled with a "Feature disabled" message in the editor

---

**Given** I added a `live_site_task` block
**When** the ConfigPanel opens
**Then** I see fields: prompt (the task to perform), instructions (longer description), mode (`html_upload` | `public_url` toggle), entry page (default "index.html"), optional goal URL pattern (e.g. "/thank-you")

---

**Given** I save the block config
**When** the session is published
**Then** the block is part of the participant flow at the configured position

### Story 13.2: HTML prototype upload (zip → Supabase Storage)

As a researcher,
I want to upload a `.zip` of my HTML prototype (e.g. Claude Artifact export, V0 download) up to 50 MB,
So that Soleo can host and instrument the prototype for participant testing.

**Acceptance Criteria:**

**Given** `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD=true` and I'm in the `live_site_task` ConfigPanel with mode=`html_upload`
**When** I click "Upload zip" and select a valid .zip file <50 MB
**Then** the file is uploaded to Supabase Storage (`prototypes/{teamId}/{taskId}/`), extracted server-side, and the entry page (default index.html) is verified to exist

---

**Given** I upload a zip exceeding 50 MB or containing only non-HTML files
**When** the upload validates
**Then** I see a clear error message ("Zip too large: 60 MB > 50 MB max" or "No HTML file found") and no file is stored

---

**Given** `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD=false`
**When** I'm in the ConfigPanel
**Then** the `html_upload` mode is hidden/disabled; only `public_url` mode is selectable

---

**Given** I uploaded a zip and want to replace it
**When** I upload a new zip
**Then** the old files are deleted from Supabase Storage and the new ones take their place (no orphan files)

### Story 13.3: Hosted prototype runtime with injected tracking JS

As a participant,
I want to interact with the researcher's prototype hosted on Soleo,
So that I can complete the task as if I were on the real site.

**Acceptance Criteria:**

**Given** a prototype is uploaded for task X with token T
**When** I open `/proto/T/` (or `/proto/T/somepage.html`) from the participant runtime
**Then** the HTML is served from Supabase Storage with the entry page as default, MIME types correct, assets (CSS/JS/images) loaded relatively

---

**Given** the served HTML has a `<head>` section
**When** the server-side rewrite runs
**Then** a `<script src="/api/proto/tracking.js">` tag is injected just before `</head>`, and a `<meta name="soleo-task" content="...">` tag carries the token + sessionId

---

**Given** the participant session token is invalid or expired
**When** they request `/proto/T/`
**Then** the endpoint returns 403

---

**Given** `NEXT_PUBLIC_LIVE_SITE_TASK=false`
**When** any request comes to `/proto/[token]/*`
**Then** the route returns 404 (feature off entirely)

### Story 13.4: Public URL mode with iframe load detection + fallback

As a researcher,
I want to alternatively paste a public URL (deployed prototype on Vercel/Netlify) instead of uploading a zip,
So that I can test prototypes already hosted elsewhere without re-uploading.

**Acceptance Criteria:**

**Given** I'm in ConfigPanel and select mode=`public_url`
**When** I paste a URL (e.g. `https://my-proto.vercel.app`)
**Then** the URL is validated (format + reachability via HEAD), saved on the block, and used as the iframe `src` at runtime

---

**Given** the public URL responds with `X-Frame-Options: DENY` or CSP that blocks iframing
**When** the participant tries to load the iframe
**Then** within 5s of iframe load attempt, a fallback message appears "Le prototype ne s'affiche pas ici. Ouvrir dans un nouvel onglet pour tester →" with a button that opens the URL in a new tab AND keeps the Soleo top bar visible with the Done button

---

**Given** the public URL is unreachable (404/500/timeout)
**When** the iframe fails to load
**Then** the fallback message is shown immediately (no 5s wait) and the researcher receives a notification in the dashboard

---

**Given** a public URL is used
**When** events are captured
**Then** only navigation events (URL changes) are captured client-side via iframe message events; rrweb cannot capture DOM snapshots for cross-origin iframes, so the recording is degraded to nav+idle only

### Story 13.5: Tracking JS lib + rrweb integration

As the system,
I must provide a tracking JS lib that captures rrweb DOM snapshots + clicks + navigation + idle periods,
So that the researcher gets a full session replay and event timeline.

**Acceptance Criteria:**

**Given** the tracking lib is loaded in a hosted prototype
**When** the participant interacts with the page
**Then** rrweb captures: full DOM snapshot at start, incremental DOM mutations, mouse moves (sampled), clicks (with selector + element text), input events (with masking)

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
**Then** capture auto-stops, a "Session limit reached" event is emitted, and the participant can still complete the task (just no more recording)

### Story 13.6: Event ingestion API + DB schema

As the system,
I must accept event batches from the tracking JS and persist them to a structured DB schema,
So that the researcher dashboard can query events efficiently for replay, heatmap, and analytics.

**Acceptance Criteria:**

**Given** a POST to `/api/proto/events` with a valid session token + gzipped event batch
**When** the request is processed
**Then** events are decoded, parsed, and persisted to `live_site_events` (one row per event) and `live_site_recordings` (rrweb snapshots stored in Supabase Storage with a row referencing them)

---

**Given** the migration `0006_live_site_testing.sql` is applied
**When** the schema is inspected
**Then** the tables `live_site_tasks`, `live_site_sessions`, `live_site_events`, `live_site_recordings` exist with correct foreign keys and indexes (`(sessionId, timestamp)` on events for fast replay)

---

**Given** the ingestion endpoint receives a malformed payload
**When** processed
**Then** it returns 400 with a clear error message and logs the issue (no crash, no data corruption)

---

**Given** 100 events arrive per second from a single participant
**When** the server processes them
**Then** no requests are dropped (batched insert per session), and the total ingestion latency is under 500ms p95

### Story 13.7: Participant runtime UI (top bar + iframe + completion logic)

As a participant,
I want a clear interface above the prototype iframe with the task instructions and a "Done" button,
So that I know what to do and how to finish the task.

**Acceptance Criteria:**

**Given** I reach a `live_site_task` step in a participant session
**When** the page renders
**Then** I see a top bar (~56px height) with: task prompt truncated to 1 line (full text on hover/click), a "J'ai terminé" button right-aligned, an optional skip link, and below the iframe loads the prototype

---

**Given** the researcher configured a goal URL pattern (e.g. `/thank-you`)
**When** the iframe navigates to a URL matching the pattern
**Then** the task is auto-completed (status=`goal`), the user sees a brief success indicator, and the session advances to the next block automatically (after 1s delay for visual feedback)

---

**Given** the participant clicks "J'ai terminé"
**When** the action runs
**Then** a `completion` event is emitted with `mode=manual`, the recording stops, and the session advances to the next block

---

**Given** the participant clicks "Passer cette tâche"
**When** the action runs
**Then** a `completion` event with `mode=skipped` is emitted, the recording stops, the session advances

---

**Given** the iframe fails to load (X-Frame-Options or network)
**When** the failure is detected
**Then** the participant sees the fallback "Open in new tab" UX (per Story 13.4) without losing access to the Done button

### Story 13.8: Session replay viewer (rrweb player) in dashboard

As a researcher,
I want to replay any participant session as a video,
So that I can observe exactly what the participant did, including hesitations and dead ends.

**Acceptance Criteria:**

**Given** I'm on `/dashboard/.../participants/[token]` and the participant has a `live_site_task` recording
**When** I scroll to the replay section
**Then** I see a rrweb player with: play/pause button, timeline scrubber, current time, total duration, speed control (1x/2x/4x), event sidebar (chronological list of clicks/nav/idle)

---

**Given** the player is playing
**When** I press spacebar
**Then** play/pause toggles; arrow keys jump ±5s in the timeline

---

**Given** an event in the sidebar is clicked
**When** I select it
**Then** the player seeks to that timestamp and visually highlights the related element in the replay

---

**Given** the recording is in progress (participant still active) — rare edge case
**When** I open the replay viewer
**Then** I see a message "Session in progress — refresh to update" without a partial replay (avoid showing incomplete data)

### Story 13.9: Click heatmap visualization

As a researcher,
I want to see where participants clicked aggregated across all sessions,
So that I can identify high-attention areas and missed CTAs.

**Acceptance Criteria:**

**Given** I'm on a `live_site_task` aggregate view in the dashboard
**When** I select a page URL from the dropdown
**Then** I see a heatmap canvas overlaid on the first DOM snapshot of that page, with clicks colored by frequency (transparent → cool blue → warm orange → red)

---

**Given** clicks are aggregated across N participants
**When** the canvas renders
**Then** kernel density estimation smooths the clicks into hotspots (radius proportional to canvas size), and a legend shows the click count scale

---

**Given** no participants reached this page
**When** I select it in the dropdown
**Then** the heatmap shows an empty state "0 clics enregistrés sur cette page" instead of a blank canvas

---

**Given** the page snapshot is large (>1920px width)
**When** the heatmap renders
**Then** it scales responsively to fit the dashboard viewport while preserving click coordinate proportions

### Story 13.10: Navigation flow diagram

As a researcher,
I want a visual diagram of how participants navigated through the prototype,
So that I can spot common paths, dead ends, and the most-visited pages.

**Acceptance Criteria:**

**Given** I'm on the `live_site_task` aggregate view
**When** I scroll to the navigation flow section
**Then** I see a directed graph (Sankey-like or node-edge) where nodes are pages and edges are transitions, with edge thickness proportional to the number of participants who took that path

---

**Given** the entry page exists (default `index.html`)
**When** the diagram renders
**Then** the entry page is highlighted as the start node (e.g. green border) and the goal URL (if configured) is highlighted as the end node (e.g. gold border)

---

**Given** a participant abandoned mid-flow
**When** the diagram shows their path
**Then** their final page is marked as a "drop-off" (smaller red indicator on the node)

---

**Given** there are >20 unique pages visited
**When** the diagram would be too cluttered
**Then** lesser-visited pages are grouped under an "Other (N pages)" node, and the researcher can click to expand details

### Story 13.11: Per-participant timeline + aggregate metrics

As a researcher,
I want to drill into a single participant's session AND see aggregate metrics across all participants,
So that I have both granular insights and high-level patterns.

**Acceptance Criteria:**

**Given** I open a specific participant's `live_site_task` record
**When** the timeline view renders
**Then** I see a vertical list of events with: timestamp, page context, event type icon (click/nav/idle), event description ("Clicked 'Sign Up' button on /home", "Idle 8s on /pricing"), and a link to "Show in replay" that seeks the player

---

**Given** a participant didn't interact at all
**When** the timeline view renders
**Then** an empty state message clearly indicates "Le participant n'a pas interagi avec le prototype" + total time spent + completion status (per UX-DR13.4)

---

**Given** I'm on the aggregate view
**When** the metrics section renders
**Then** I see: total participants, success rate (% reached goal OR clicked Done), median duration, abandon rate (% closed without completing), top 3 idle hotspots (page + median idle time)

---

**Given** the aggregate metrics are computed
**When** they need to refresh
**Then** they're computed live on each page load (no caching for MVP — keep simple); if performance becomes an issue, we add a materialized view later

═══════════════════════════════════════════════════════════════════════════════

═══════════════════════════════════════════════════════════════════════════════

## Epic 14: AI Study Builder

**Goal**: Researchers (especially non-experts) describe their research goal in plain text and AI generates a draft session with appropriate blocks. Reduces from-scratch time from 30min to 2min.

**FRs covered**: FR14.1-14.6 (study generation, regeneration, templates, cost preview, refinement, flag).

### Story 14.1: Goal-prompt → session blocks generator

As a Member, especially one without UX research training,
I want to describe my research goal in plain language and have AI generate a draft session structure,
So that I can start from a working baseline instead of a blank canvas.

**Acceptance Criteria:**

**Given** I'm on `/dashboard/projects/[id]/sessions/new` and AI Study Builder flag is ON
**When** I see a "Start with AI" option and type a prompt like "Je veux comprendre pourquoi les users abandonnent le checkout"
**Then** within 15s, AI generates a session with welcome + 4-7 blocks adapted to the goal (likely: open-text "Raconte ton dernier achat", MCQ "Quels obstacles", likert "Confiance en notre site", AI follow-up enabled on key questions, thank_you)

---

**Given** AI generated a draft session
**When** the result lands in the builder
**Then** I see all generated blocks marked with a small "✨ AI-generated" badge that disappears once I edit the block (signals what's AI vs my edits)

---

**Given** the AI generation fails (timeout, API error)
**When** the failure happens
**Then** I'm shown a clear error message + a "Start blank" fallback CTA + the prompt is preserved in input so I can retry

---

**Given** AI uses an LLM call
**When** generated
**Then** the cost is logged via `logAIUsage({ feature: 'study_builder', ... })` and counted against quotas (Epic 8)

### Story 14.2: Per-block AI regeneration

As a Member who likes most of the AI-generated session but wants to tweak one block,
I want to right-click any block and "Regenerate this block",
So that I can iterate quickly without rebuilding the whole session.

**Acceptance Criteria:**

**Given** I have a session with at least one block
**When** I click "Regenerate" on a specific block (button in the BlockCard menu)
**Then** AI receives the session's overall goal + the current block's context (type, neighbors) and proposes a replacement block of the same type with refined wording

---

**Given** the regenerated block is proposed
**When** I see it
**Then** I get a side-by-side preview (current vs proposed) with "Apply" / "Discard" buttons, and the proposed block doesn't overwrite my current one until I confirm

### Story 14.3: Template starter library

As a Member who doesn't want to write a goal from scratch,
I want a library of pre-built research goals with one-click generation,
So that I can start from common use-cases (NPS, onboarding feedback, churn analysis, etc.).

**Acceptance Criteria:**

**Given** I'm on the "Start with AI" screen
**When** I scroll below the goal input
**Then** I see at least 5 template goals: "NPS + open feedback", "Onboarding feedback", "Churn analysis", "Feature prioritization", "Prototype usability"

---

**Given** I click a template
**When** the template loads
**Then** the goal input pre-fills with a polished prompt, and I can click "Generate" without typing anything

### Story 14.4: Cost preview before generation

As a Pro user mindful of AI costs,
I want to see an estimated token cost before triggering an AI generation,
So that I can decide whether to proceed or refine the prompt first.

**Acceptance Criteria:**

**Given** I have a prompt in the input box
**When** I focus the "Generate" button
**Then** a small tooltip shows "Estimated cost: ~$0.03 (input ~500 tok, output ~1500 tok)"

---

**Given** my Free quota is low (<10% remaining of monthly AI findings/studies)
**When** I attempt to generate
**Then** an UpgradePrompt appears warning me before the call

### Story 14.5: Multi-step refinement (AI propose → user adjust → AI refine)

As a Member who wants to iterate on the generated session conversationally,
I want a chat-like refinement panel where I can ask AI to adjust the session,
So that I get to my ideal session without rebuilding it manually.

**Acceptance Criteria:**

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

### Story 14.6: Feature flag `NEXT_PUBLIC_AI_STUDY_BUILDER`

As the team controlling rollout,
I want a feature flag to gate AI Study Builder visibility,
So that we can ship it dark and enable per-environment.

**Acceptance Criteria:**

**Given** `NEXT_PUBLIC_AI_STUDY_BUILDER=false` (default)
**When** I navigate to create a new session
**Then** the "Start with AI" option is hidden, only "Start blank" + "From template" remain

---

**Given** flag is `true`
**When** I navigate to create
**Then** "Start with AI" appears as primary CTA

═══════════════════════════════════════════════════════════════════════════════

## Epic 15: Question Quality & Bias Coaching

**Goal**: Real-time AI feedback on questions being written in the builder. Detects leading questions, biases, confusing wording, suggests rephrasings.

**FRs covered**: FR15.1-15.4 (bias detection, rephrasing, health score, flag).

### Story 15.1: Real-time bias detection on questions

As a Member writing questions in the builder,
I want AI to flag biased / leading questions as I type,
So that I avoid skewing my research before I even publish.

**Acceptance Criteria:**

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

### Story 15.2: Inline rephrasing suggestions

As a Member who got a bias warning,
I want one-click access to AI-suggested rephrasings,
So that I can fix the question without leaving the panel.

**Acceptance Criteria:**

**Given** a bias warning is displayed
**When** I click "See suggestions"
**Then** AI proposes 2-3 alternative phrasings of the question (neutral, unambiguous), with reasoning ("Removes assumption", "Opens to negative experiences")

---

**Given** I see suggestions
**When** I click "Apply" on one
**Then** the question field updates with the chosen rephrasing, the warning disappears, and an action is undoable via Cmd+Z

### Story 15.3: Question health score per block

As a Member configuring a question,
I want a small visible indicator of the question's "health" (0-100),
So that I see at a glance which blocks need attention.

**Acceptance Criteria:**

**Given** a question has been analyzed
**When** the BlockCard renders in the canvas
**Then** a small badge shows the health score color-coded (green ≥80, amber 60-79, red <60) — only displayed if the flag is on

---

**Given** a block has score <60
**When** I hover the badge
**Then** a tooltip lists the issues found ("Bias detected", "Ambiguous wording", "Too long: 24 words")

### Story 15.4: Feature flag `NEXT_PUBLIC_AI_QUESTION_COACH`

As the team,
I want to gate this feature behind a flag,
So that it can be rolled out progressively.

**Acceptance Criteria:**

**Given** the flag is OFF (default)
**When** I edit questions in the builder
**Then** no AI analysis is performed, no warnings shown, health badges hidden

---

**Given** the flag is ON
**When** I edit questions
**Then** all coaching features (15.1-15.3) are active

═══════════════════════════════════════════════════════════════════════════════

## Epic 16: Insight Mining (Themes + Sentiment + Quality)

**Goal**: Cross-response pattern mining. Beyond per-response tagging (Story 5.3), the system identifies recurring themes across all responses to a question, classifies sentiment, and filters low-quality responses.

**FRs covered**: FR16.1-16.5 (themes, sentiment, quality, filtering, flag).

### Story 16.1: Automated themes per question

As a Member with 50+ open-text responses,
I want AI to extract 3-7 recurring themes from all responses to a single question,
So that I understand patterns in 30s instead of 30min of reading.

**Acceptance Criteria:**

**Given** I'm viewing a question's response summary in the dashboard
**When** I click "Extract themes"
**Then** AI returns 3-7 themes with: theme name (1-3 words), description, % of responses matching, 2-3 representative quotes

---

**Given** themes are extracted
**When** I see them
**Then** each theme card has a "Show all matching responses" link that filters the response list to that theme

---

**Given** the question type doesn't support themes (e.g. likert, rating)
**When** I view the summary
**Then** the "Extract themes" option is hidden

### Story 16.2: Sentiment classification per response

As a Member,
I want each open-text response automatically classified as positive / negative / neutral / mixed,
So that I can filter and prioritize my analysis.

**Acceptance Criteria:**

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

### Story 16.3: Quality metrics on responses

As a Member who wants to clean my dataset,
I want AI to flag low-effort / spam / AI-generated responses,
So that I can exclude them from my findings.

**Acceptance Criteria:**

**Given** a new text response is saved
**When** processed
**Then** a `quality_score` (0-100) and `quality_flags` (e.g. ["too_short", "repetitive", "likely_ai"]) are set on the response

---

**Given** I'm reviewing responses
**When** quality_score < 40
**Then** the response card shows a warning "Low quality — possible reasons: too short, repetitive" and the response is excluded by default from theme extraction (toggleable)

### Story 16.4: Theme + sentiment filtering in dashboard

As a Member exploring my data,
I want to filter the response list by theme AND/OR sentiment AND/OR quality,
So that I drill into specific subsets.

**Acceptance Criteria:**

**Given** themes and sentiment exist on responses
**When** I open the response list filter
**Then** I see filter chips for: themes (multi-select), sentiment (multi-select), quality (≥X threshold), tags (existing)

---

**Given** filters are applied
**When** the list renders
**Then** the response count updates live, and filters can be combined (AND semantics)

### Story 16.5: Feature flag `NEXT_PUBLIC_AI_INSIGHT_MINING`

As the team,
I want a single flag to gate themes + sentiment + quality features,
So that we can roll out progressively.

**Acceptance Criteria:**

**Given** flag is OFF (default)
**When** I view a question summary or response list
**Then** "Extract themes", sentiment indicators, and quality flags are all hidden; no background AI runs

---

**Given** flag is ON
**When** I view
**Then** all insight mining features (16.1-16.4) are active

═══════════════════════════════════════════════════════════════════════════════

## Epic 17: Advanced Research Methods

**Goal**: Add Tree Testing + Copy Testing + Mobile-first testing — methods Maze supports and Soleo doesn't yet.

**FRs covered**: FR17.1-17.7 (tree test block + analytics, copy test block + analytics, mobile mode + replay, flags).

### Story 17.1: Tree Testing block

As a Member doing IA research,
I want a Tree Testing block where I define a hierarchy and ask participants to find specific items,
So that I can validate my information architecture.

**Acceptance Criteria:**

**Given** I add a Tree Testing block in the builder
**When** I open the ConfigPanel
**Then** I see fields: task prompt ("Find where to update your email"), hierarchical tree editor (drag-drop or text outline), expected correct path

---

**Given** I publish the session
**When** a participant reaches this block
**Then** they see the task prompt + an interactive tree (clickable nodes); their path is recorded

### Story 17.2: Tree Testing analytics

As a Member reviewing tree test results,
I want analytics specific to IA testing,
So that I know what % found the right item, how long it took, and which wrong paths were taken.

**Acceptance Criteria:**

**Given** participants have completed a tree test
**When** I view the block summary
**Then** I see: success rate (% on correct path), median time to find, most common wrong paths (top 5), abandon rate

---

**Given** a wrong path was taken N times
**When** I click it
**Then** I see the participants who took it + drill into their full session

### Story 17.3: Copy Testing block

As a Member testing copy variants,
I want a Copy Testing block where I define multiple text variants and participants vote / rate,
So that I can A/B test microcopy.

**Acceptance Criteria:**

**Given** I add a Copy Testing block
**When** I open the ConfigPanel
**Then** I can define a question + 2-5 text variants (e.g. button labels, headlines); choose mode = "Preference" (pick 1) or "Rating" (rate each on 1-5)

---

**Given** the session runs
**When** a participant reaches the block
**Then** they see the variants and select / rate per the configured mode

### Story 17.4: Copy Testing analytics

As a Member reviewing copy test results,
I want to see the winning variant + confidence interval,
So that I know if the winner is statistically significant.

**Acceptance Criteria:**

**Given** N participants have responded
**When** I view results
**Then** I see: % votes per variant (Preference mode) or mean rating per variant (Rating mode), Wilson confidence interval, and a "Winner" indicator only if margin is statistically significant (p<0.05 with N≥30)

### Story 17.5: Mobile-first testing dedicated mode

As a Member testing mobile prototypes,
I want a "Mobile" mode in `live_site_task` and `prototype_task` that forces vertical orientation + simulated mobile chrome,
So that I get accurate mobile UX data even when participants are on desktop.

**Acceptance Criteria:**

**Given** I configure a prototype block with mode=mobile
**When** the participant reaches it
**Then** the iframe is constrained to 375×667 (or selectable common sizes), shown with a phone chrome decoration, in vertical orientation

---

**Given** the participant is on a real mobile device
**When** the block renders
**Then** the chrome decoration is hidden; the iframe takes full screen

### Story 17.6: Mobile replay viewer

As a Member reviewing mobile prototype sessions,
I want the rrweb replay to respect portrait orientation,
So that the replay matches what the participant actually saw.

**Acceptance Criteria:**

**Given** a session was recorded in mobile mode
**When** I open the replay viewer in the dashboard
**Then** the player canvas is sized to mobile (375×667 or recorded viewport), with optional zoom controls

### Story 17.7: Feature flags `NEXT_PUBLIC_TREE_TESTING` + `NEXT_PUBLIC_COPY_TESTING`

As the team,
I want independent flags for tree and copy testing,
So that we can ship them separately.

**Acceptance Criteria:**

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

═══════════════════════════════════════════════════════════════════════════════

## Story 10.6: Trust & AI Transparency Page (extension Epic 10)

As a potential customer evaluating Soleo,
I want a dedicated `/trust` page explaining what AI sees, what's stored, where data lives, and how privacy is enforced,
So that I can validate Soleo's posture before signing up — especially for enterprise / GDPR-sensitive use cases.

**Acceptance Criteria:**

**Given** I visit `/trust` (or `/fr/trust` / `/en/trust`)
**When** the page renders
**Then** I see sections: "AI Providers" (OpenAI, optional Anthropic, optional Gemini), "What we don't do" (no model training on your data, no cross-account data sharing), "Where your data lives" (EU Supabase, encrypted at rest), "Your AI cost" (link to /dashboard/general usage UI), "Compliance" (RGPD posture, retention, deletion rights)

---

**Given** I'm on /trust
**When** I look for a link from the landing page
**Then** the footer links to /trust under "Sécurité" or "Trust"

---

**Given** /trust is requested
**When** rendered
**Then** SEO metadata is present (title, OG, description), Lighthouse SEO score ≥95

═══════════════════════════════════════════════════════════════════════════════

## Epic 18: Integrations (Innovations — Future)

**Status**: All stories tagged `Innovation` in Notion (not in MVP roadmap). Picked when user demand surfaces post-launch.

**Goal**: Connect Soleo to the rest of a researcher's stack (Slack, Notion, Zoom, API).

### Story 18.1: Slack integration — notifications + share findings

As a Member with a team in Slack,
I want Soleo to notify a configured channel when key events happen + allow sharing findings to Slack,
So that my team stays in the loop without manual cross-posting.

**Acceptance Criteria:**

**Given** I configure a Slack workspace + channel in Settings → Integrations
**When** a session is published, a participant completes a session, or a finding is published
**Then** a Slack message is sent to the channel with a link to the relevant Soleo page

---

**Given** I click "Share to Slack" on a published finding
**When** I pick a channel
**Then** the finding's preview (title + first paragraph + link) is posted to Slack

### Story 18.2: Notion export — findings → Notion page

As a Member who uses Notion for docs,
I want a one-click export of a published finding to a Notion page,
So that the finding lives natively in my team's knowledge base.

**Acceptance Criteria:**

**Given** I connect my Notion workspace via OAuth (Settings → Integrations)
**When** I click "Export to Notion" on a finding
**Then** I pick a parent page, and a new Notion page is created with the full finding content (citations remain as Notion mentions/blocks)

### Story 18.3: Zoom integration — synchronous moderated interviews

As a Member who wants to combine async Soleo studies with live interviews,
I want to schedule a Zoom call from inside Soleo and link the recording to a participant's session,
So that I keep all my research data in one place.

**Acceptance Criteria:**

**Given** I connect my Zoom account via OAuth
**When** I schedule a "Live interview" from a participant's profile
**Then** a Zoom meeting is created, link saved on the participant session, and recording (if enabled) is auto-attached to the finding

### Story 18.4: Public API + Webhooks

As a developer or power-user,
I want a public REST API + webhook events,
So that I can build Zapier integrations, custom dashboards, etc.

**Acceptance Criteria:**

**Given** I generate an API key in Settings
**When** I call `GET /api/v1/projects` with the key
**Then** I receive a JSON list of my projects, rate-limited per plan

---

**Given** I configure a webhook URL for `finding.published` event
**When** a finding is published
**Then** my webhook receives a POST with the finding payload (signed with HMAC)

═══════════════════════════════════════════════════════════════════════════════

## Summary

- **10 Epics** formally backlogged + Epic 9 rolling (total 11)
- **67 Stories** total (Epic 11: 6, Epic 10: 5+1, Epic 8: 8, Epic 12: 9, Epic 13: 11, Epic 14: 6, Epic 15: 4, Epic 16: 5, Epic 17: 7, Epic 18: 4) + Epic 9 rolling (~9 stories done/backlog)
- **Maze AI parity** : Soleo's roadmap now covers all major Maze AI 2026 features + retains its own differentiators (public findings, AI usage transparency, EU-first)
- **Differentiators** : EU privacy, transparent AI usage tracking, public shareable findings with citations, single-tier Pro pricing simplicity
- **Effort estimate** : Solo dev pace, ~6-8 months to ship the full MVP-beta track (Epics 11→17), then beta validation, then Pro launch (Epic 10+8), then Innovations (Epic 18 on demand)
