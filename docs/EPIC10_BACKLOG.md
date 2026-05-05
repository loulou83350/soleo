# Epic 10 — Public Landing Page Backlog

Visitors discover Soleo via a public landing page that explains the product, presents the pricing, and converts them into signups.

Source de vérité : Notion → Epic 10 — Public Landing Page. BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID   | Titre                                                  | Priority | Statut    |
|------|--------------------------------------------------------|----------|-----------|
| 10.1 | Public landing route + auth-aware redirect             | High     | ⏳ To Do  |
| 10.2 | Hero section + Features section                        | High     | ⏳ To Do  |
| 10.3 | Use-cases section + inline pricing summary             | Medium   | ⏳ To Do  |
| 10.4 | FAQ accordion + Footer                                 | Medium   | ⏳ To Do  |
| 10.5 | SEO metadata + sitemap + OG image                      | Medium   | ⏳ To Do  |

**Order** : 10.1 (route foundation) → 10.2 → 10.3 → 10.4 → 10.5 (SEO en dernier après tout le contenu).

**Dépendances soft** :
- Sur Epic 11 : SEO multilingue (per-locale URLs + hreflang) — landing peut shipper FR-only et ajouter EN après
- Sur Epic 8 : pricing summary détaillé — landing peut afficher "Pro coming soon" sans Epic 8

---

## Story 10.1 — Public landing route + auth-aware redirect

> As a visitor, I want to land on a marketing page when I visit the root URL, so that I can understand the product before deciding to sign up.

### Acceptance Criteria

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

### Implementation notes
- Convert `app/page.tsx` from current redirect-only to a real landing page
- Auth check : reuse `getUser()` from `lib/db/queries.ts`
- If logged in → `redirect('/dashboard')` ; sinon render

---

## Story 10.2 — Hero section + Features section

> As a visitor, I want to immediately understand what Soleo does and what features it offers, so that I can decide if it's relevant to me within ~10 seconds.

### Acceptance Criteria

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

### Implementation notes
- Composants `<LandingHero/>` + `<LandingFeatures/>` (réutilisables)
- Icons : `lucide-react` déjà installé
- Mobile-first via Tailwind responsive prefixes

---

## Story 10.3 — Use-cases section + inline pricing summary

> As a visitor unsure if I'm the target persona, I want to see use-cases that match my profession + a glimpse of pricing, so that I feel "this is for me" and I'm not surprised by the cost on a separate page.

### Acceptance Criteria

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

### Implementation notes
- `<LandingPricingSummary/>` partage des composants avec la page `/pricing` (Story 8.2) — extract un atom commun

---

## Story 10.4 — FAQ accordion + Footer

> As a visitor with specific objections (security, refund, beta status), I want my common questions answered before signup, so that I don't bounce due to uncertainty.

### Acceptance Criteria

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

### Implementation notes
- Réutiliser `@radix-ui/react-accordion` (déjà installé via shadcn)
- Footer is shared with sign-in/sign-up pages (small reuse)

---

## Story 10.5 — SEO metadata + sitemap + OG image

> As a marketer, I want the landing page properly indexed by search engines and rich on social shares, so that organic traffic finds Soleo and previews look professional when shared.

### Acceptance Criteria

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

### Implementation notes
- Next.js `metadata` API + `generateMetadata` per page
- `app/sitemap.ts` + `app/robots.ts` (Next.js conventions)
- OG image : statique en `public/og.png` ou dynamique via `next/og`
