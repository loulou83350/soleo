# Epic 11 — Internationalization (FR + EN) Backlog

Soleo users can use the application in either French or English. Locale is auto-detected, persisted, and respected across navigation, metadata, currency, and emails.

Source de vérité : Notion `Soleo — Project Tracker` → database "Stories" → Epic 11 — Internationalization. BMAD canonical doc : `_bmad-output/planning-artifacts/epics.md`.

| ID   | Titre                                                              | Priority | Statut    |
|------|--------------------------------------------------------------------|----------|-----------|
| 11.1 | Setup next-intl + locale URL prefix routing                        | High     | ⏳ To Do  |
| 11.2 | Locale detection middleware (cookie > header > default)            | High     | ⏳ To Do  |
| 11.3 | Extract FR translations into messages/fr/*.json                    | High     | ⏳ To Do  |
| 11.4 | Refactor all components to use t() + getTranslations()             | High     | ⏳ To Do  |
| 11.5 | Generate EN translations + manual review                           | Medium   | ⏳ To Do  |
| 11.6 | Language switcher + locale-aware currency                          | Medium   | ⏳ To Do  |

**Stack** : `next-intl` (App Router compatible). URL prefix `/fr/...` `/en/...` pour SEO.

**Order** : 11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.6 (séquentiel, chaque story enrichit la précédente).

---

## Story 11.1 — Setup next-intl + locale URL prefix routing

> As a developer, I want next-intl installed and configured with URL prefix routing, so that pages can be served at `/fr/...` or `/en/...` per locale, and SEO benefits from per-locale URLs.

### Acceptance Criteria

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

### Implementation notes
- `pnpm add next-intl`
- Create `i18n/request.ts` config + middleware in project root
- Update `app/layout.tsx` to use `[locale]` segment
- Define `locales = ['fr', 'en']` and `defaultLocale = 'fr'`
- Document the routing exemption pattern for participant routes

---

## Story 11.2 — Locale detection middleware (cookie > header > default)

> As a user, I want the app to remember my preferred language across sessions, so that I don't have to choose it every time I visit.

### Acceptance Criteria

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

---

## Story 11.3 — Extract FR translations into messages/fr/*.json

> As a developer, I want all existing hardcoded FR strings extracted into namespaced JSON files, so that they can be translated and maintained as data instead of inlined in components.

### Acceptance Criteria

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

### Implementation notes
- 8 namespaces minimum (one per feature area)
- Audit script optionnel pour détecter strings hardcodées (regex sur `>[A-Za-zÀ-ÿ]`)

---

## Story 11.4 — Refactor all components to use t() + getTranslations()

> As a developer, I want every user-facing string in components and server actions to come from translation files, so that the codebase has zero hardcoded user-facing strings outside of the messages/ folder.

### Acceptance Criteria

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

### Implementation notes
- Pour les server components : `getTranslations(locale)` (next-intl async)
- Pour les client components : `useTranslations(namespace)` (hook)
- Toast errors (`sonner`) doivent aussi être traduits — wrapper si besoin

---

## Story 11.5 — Generate EN translations + manual review

> As a Pro user who speaks English, I want to use Soleo in English with translations of equivalent quality to the FR version, so that I'm not locked into a French-only product.

### Acceptance Criteria

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

---

## Story 11.6 — Language switcher + locale-aware currency

> As a user, I want to switch language from any page via a visible header control, with prices automatically adapted to my locale, so that I can change locale without finding hidden settings, and I see prices in a relevant currency.

### Acceptance Criteria

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

### Implementation notes
- `<LanguageSwitcher/>` component dans le header `(dashboard)/layout.tsx` + landing footer
- Currency helper : `formatPrice(amount, locale)` — `Intl.NumberFormat`
