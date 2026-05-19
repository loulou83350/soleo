# Soleo — Progress Report

*Generated 2026-05-07 — branch `ai-ui` · 168 commits · 102 tests*

## 1. Executive Summary

Soleo est une plateforme de recherche utilisateur **AI-led** pour designers et équipes UX, positionnée comme alternative française à Maze / UserTesting / Hotjar. Elle combine builder de sessions sans-code, AI Interviewer (relances contextuelles), recording style PostHog des prototypes (Epic 13 backlog), findings IA avec citations sourcées, et tracking transparent des coûts IA.

**État au 2026-05-07** :

| Métrique | Valeur |
|---|---|
| Epics livrées | **1-7** + items Epic 9 (~9 stories Polish déjà livrées) |
| Epics backlogées formellement | **8, 10, 11, 12, 13, 14, 15, 16, 17, 18** (10 Epics) |
| Stories backlogées totales | **76** (49 + 27 ajoutées en post-analyse Maze) |
| Tests verts | **102/102** (vitest) |
| Commits | **168** sur branche `ai-ui` |
| Cost IA mensuel estimé | **<$1** (dev) |
| Stack | Next.js 15 · Drizzle · Supabase · OpenAI · PostHog · Vercel · Stripe (stub) |

**Roadmap immédiate** : Epic 11 (i18n foundation) → Epic 9 design pass → Epic 12 (Onboarding) → Epic 13 (Live Site Testing) → Epic 14 (AI Study Builder) → Epic 15-17 → Beta soft launch → Epic 10 + 8 (Landing + Billing) → Epic 18 (Innovations sur demande).

---

## 2. Epics livrées (1-7)

### Epic 1 — Foundation (4 stories)

> Setup projet Soleo from Vercel SaaS Starter + auth + workspaces.

| Story | Commit |
|---|---|
| 1.1 Initialisation du projet Soleo | `4062f18` |
| 1.2 Pages auth stylisées (sign-in, sign-up) | `0e3c0c0` |
| 1.3 Gestion des projets (workspaces) | `b38adf3` |
| 1.4 Invitation membres & rôles (Owner/Member) | `0dce186` |

### Epic 2 — Session Builder Core (4 stories)

> Builder de sessions : 3 panneaux (palette, canvas, config), auto-save, blocs CRUD, publication.

| Story | Commit |
|---|---|
| 2.1 Builder 3 panneaux + auto-save | `1c80db0` |
| 2.2 Add/reorder pages avec @dnd-kit | `ec6e780` |
| 2.3 Types de blocs + ConfigPanel + image upload | `0e3845e` |
| 2.4 Publication + lien participant CUID2 | `53c4aa5` |

### Epic 3 — Session Builder Advanced (5 stories)

> Blocs spécialisés + conditional logic + preview + templates + gate.

| Story | Commit |
|---|---|
| 3.1 Bloc tâche prototype (Figma) | `854761f` |
| 3.2 Logique conditionnelle sur blocs | `46c0cd6` |
| 3.3 Mode prévisualisation session | `4fc445b` |
| 3.4 5 templates de recherche prédéfinis | `b0f9a58` |
| 3.5 Gate de session (consentement, password, device) | `d5fe6ff` |

### Epic 4 — Participant Experience (5 stories)

> Flow participant : start, navigate, conditional, completion, notifications.

| Story | Commit |
|---|---|
| 4.1-4.4 Flow complet (anonymes, save responses, prototype track) | livré avec 3.5 (`d5fe6ff`) |
| 4.5 Email notification au researcher (Resend) | `a7aef0c` |
| Figma OAuth + Embed API + screen picker | `97077b1` |

### Epic 5 — Results & Analysis (6 stories) — voir `docs/EPIC5_BACKLOG.md`

| Story | Commit |
|---|---|
| 5.1 Response dashboard (overview + métriques) | `eccaed4` |
| 5.2 Détail réponse individuelle | `3b6b24d` |
| 5.3 Insight tags (manuel + IA) | `48ba557` |
| 5.4 Export CSV des réponses | `663c69e` |
| 5.5 Email notifications via Cron + Resend | partiel (`a7aef0c`) — Cron périodique à faire |
| 5.6 Récap agrégé par question | `b343ccc` |

### Epic 6 — Findings Sharing (5 stories) — voir `docs/EPIC6_BACKLOG.md`

| Story | Commit |
|---|---|
| 6.1 AI-assisted findings avec citations sourcées | `cfad768` |
| 6.2 Pin/highlight quotes | `11fdc80` |
| 6.3 Upgrade prompt at scroll depth | `11fdc80` |
| 6.4 Notion-style block editor (Tiptap + slash) | `3d92b96` |
| 6.4.1 Tables, images, custom blocks (Insight, Stat) | `6ff38e0` |

### Epic 7 — AI Interviewer (3 stories) — voir `docs/EPIC7_BACKLOG.md`

> Sur les blocs Open text, l'IA pose une question de relance contextuelle. Jusqu'à 3 turns. Différenciant #1 vs Maze (et premier livré).

| Story | Commit |
|---|---|
| 7.1 AI Follow-Up Configuration in Builder | `fb775d3` |
| 7.2 AI Follow-Up Generation During Session (streaming SSE) | `20b6725` |
| 7.3 AI Follow-Up Display in Dashboard (thread + badge) | `5412933` |

---

## 3. Hors-Epic livré

### PostHog Analytics + Session Recording (2 phases)

- Phase 1 : provider + privacy guards (hard-bloqué sur `/s/*` et `/findings/*`) — `b6e00e5`
- Phase 2 : 8 custom events + opt-out toggle in Settings + signup_completed via redirect query — `b6e00e5`

### AI Usage Tracking + Cost

- Table `ai_usage_logs` avec coût en micro-USD par feature/team/user — `d9511e0`
- UI "Utilisation IA" dans `dashboard/general` (gated par flag) — `d9511e0`
- Fix client/server boundary du formatter — `9f18170`

### AI Feature Flags (4 flags)

- `lib/ai/flags.ts` + `flags-client.ts` (server + client mirrors)
- Wired into 7 call sites + 4 flags : tag_suggest, findings, followup, auto_tag — `bd037a8`

### Story 9.1 — Figma frame thumbnails in Builder picker (Epic 9 Polish)

- `bd037a8`

### Story 9.2 — Visual prototype timeline with thumbnails (Epic 9)

- `b55286c`

### Story 9.3 — Unit tests for AI helpers (Epic 9)

- 44 tests ajoutés, total 102/102 verts — `2e5ff6b`

### UX micro-improvements

- Enter / Cmd+Enter to submit text answers — `91c7f61`
- Bubble menu in editor (5 fixes) — `e591e68`, `a984555`, `3ca53ab`, `d94ef86`, `43bbf60`
- Typography plugin install — `09091c4`
- Findings : single-pane editor refactor + demote AI gen to secondary action — `27e58a3`, `baad179`

---

## 4. Backlog formalisé — Epics 8, 10-17 (formal BMAD)

Chaque Epic suit le format BMAD : User story + Given/When/Then ACs. Triple mirror : `_bmad-output/planning-artifacts/epics.md` (canonical) + `docs/EPIC*_BACKLOG.md` (project) + Notion database "Stories" (source de vérité user).

### Epic 8 — Billing & Paywall (8 stories) — `docs/EPIC8_BACKLOG.md`

Plan-based quota foundation, Stripe Checkout, Customer Portal, UpgradePrompt UX (Tooltip + Modal + Banner), Free plan enforcement, AI follow-up Free tier cap, Read-only mode for expired subs.

- Pricing : Pro 24€/mois ou 228€/an (~20% off annual). EUR uniquement MVP.
- 2 feature flags : `NEXT_PUBLIC_AI_TAG_SUGGEST` (etc.) déjà wired
- 2 Stripe products à créer
- Migration 0007 idempotent webhook events table

### Epic 9 — Polish & UX (Rolling) — `docs/EPIC9_BACKLOG.md`

Backlog continu de petites améliorations UX cross-cutting. Pris au coup-par-coup.

- ✅ 9.1 Figma frame thumbnails in Builder picker — DONE
- ✅ 9.2 Visual prototype timeline in response detail — DONE
- ✅ 9.3 Unit tests for AI helpers — DONE
- 🟡 9.4 Graceful fallback if Figma iframe fails to load — backlog (Arc bug resolved naturally)

### Epic 10 — Public Landing Page (6 stories) — `docs/EPIC10_BACKLOG.md`

Hero, features, use-cases, pricing summary, FAQ accordion, footer, SEO. + **Story 10.6 Trust & AI Transparency page** ajoutée post-analyse Maze.

### Epic 11 — Internationalization (FR + EN) (6 stories) — `docs/EPIC11_BACKLOG.md`

`next-intl` setup + locale routing (URL prefix `/fr/...` `/en/...`) + middleware (cookie > Accept-Language > default) + extract FR + refactor `t()` + EN generation + language switcher.

### Epic 12 — Onboarding & Activation (9 stories) — `docs/EPIC12_BACKLOG.md`

Wizard post-signup, activation checklist, empty states, welcome email, drip D+3/D+7, contextual tooltips, activation funnel PostHog, in-app help drawer, quota approach email.

### Epic 13 — Live Site Testing (11 stories) ⭐ — `docs/EPIC13_BACKLOG.md`

Différenciant #2 vs Maze : test prototype HTML upload OU URL publique avec recording style PostHog (rrweb DOM snapshots + clicks + nav + idle), heatmap clics, navigation flow, replay viewer dashboard, per-participant timeline.

- 2 feature flags : `NEXT_PUBLIC_LIVE_SITE_TASK` + `NEXT_PUBLIC_LIVE_SITE_HTML_UPLOAD`
- 4 nouvelles tables DB (migration 0006)
- rrweb (BSD-3) injecté dans le HTML servi
- Supabase Storage pour les protos HTML

### Epic 14 — AI Study Builder (6 stories) ⭐ — `docs/EPIC14_BACKLOG.md`

**Maze parity** : "Décris ton objectif → IA génère la session". Reduction friction massive pour non-researchers. Maze le pousse comme leur USP n°1 2026.

### Epic 15 — Question Quality & Bias Coaching (4 stories) — `docs/EPIC15_BACKLOG.md`

**Maze parity** : "Crafted Curiosity". Bias detection temps réel + rephrasing suggestions + health score per question block.

### Epic 16 — Insight Mining (5 stories) — `docs/EPIC16_BACKLOG.md`

**Maze parity** : Automated themes + 25 quality metrics. Cross-response pattern mining + sentiment + quality flags + filters dashboard.

### Epic 17 — Advanced Research Methods (7 stories) — `docs/EPIC17_BACKLOG.md`

**Maze parity** : Tree Testing + Copy Testing + Mobile-first testing mode. Nouvelles méthodes que Soleo n'a pas encore.

---

## 5. Backlog Innovations — Epic 18 (4 stories) — `docs/EPIC18_BACKLOG.md`

**Status Notion : "Innovation"** (nouveau Status, couleur bleu). Parking lot pour intégrations. Pas dans le MVP, pris quand un user le demande explicitement.

- 18.1 Slack integration (notifications + share)
- 18.2 Notion export (findings → page)
- 18.3 Zoom integration (synchronous interviews)
- 18.4 Public REST API + webhooks

---

## 6. Stack technique

### Framework + infra

- **Next.js 15** App Router, React 19
- **TypeScript** strict
- **Tailwind 4** + shadcn/ui (Radix primitives)
- **Vercel** hosting (Production + Preview + Development env scopes)

### Database

- **Postgres** via Supabase (région `eu-west-3`)
- **Drizzle ORM** + `drizzle-kit` (avec drift connu sur snapshot — migrations appliquées via psql direct)
- Migrations principales : `0000` (initial) → `0006` (live site testing à venir avec Epic 13)
- Tables core : `users`, `teams`, `team_members`, `projects`, `sessions`, `session_blocks`, `participant_sessions`, `block_responses`, `session_findings`, `finding_highlights`, `consent_records`, `insight_tags`, `tag_attachments`, `ai_usage_logs`, `ai_followup_turns`

### AI

- **Provider abstraction** dans `lib/ai/providers.ts` — Anthropic / OpenAI / Gemini routables
- **Default** : OpenAI `gpt-4o-mini` (cheap + bon enough)
- **Feature flags** par feature IA (4 actuels + 4 à venir avec Epic 14-16)
- **Usage tracking** : table `ai_usage_logs` avec coût micro-USD

### Auth

- Cookie-based sessions (pas Clerk, pas Supabase Auth) — AUTH_SECRET signing
- Roles : Owner / Member par team

### Payments

- **Stripe** Checkout + Customer Portal (stubbed via `BILLING_ENABLED=false` — Epic 8 activera)
- Stripe Tax pour TVA EU (mandatory FR market)

### Email

- **Resend** (`RESEND_API_KEY`) — transactional + drip (Epic 12)

### Analytics

- **PostHog Cloud EU** (RGPD-friendly)
- Hard-bloqué sur `/s/*` et `/findings/*` (no participant tracking)
- Session recording avec masking inputs

### Storage

- Supabase Storage : bucket `block-assets` (images uploadées dans builder) + futur bucket `prototypes` (Epic 13)

### File watching / observability

- PostHog session replays côté researcher uniquement
- AI cost tracking visible (gated par flag) dans `/dashboard/general`

---

## 7. Décisions structurantes

### BMAD method adoption

Workflow `bmad-create-epics-and-stories` adopté pour formaliser les Epics. Triple mirror systématique :
1. `_bmad-output/planning-artifacts/epics.md` (canonical BMAD output)
2. `docs/EPIC*_BACKLOG.md` (project markdown, version-controlled)
3. Notion database "Stories" (source de vérité user)

### Privacy by default

- PostHog config explicite **bloque** tout tracking sur `/s/*` et `/findings/*`
- Tous les `<input>` text masqués dans session recordings
- Aucune donnée participant envoyée vers AI providers en clair (juste contenu textuel scope-strict pour relances)
- EU region first (Supabase eu-west-3, PostHog EU, Stripe Tax FR)

### AI feature flags pattern

Chaque feature IA est gated par un flag env (`NEXT_PUBLIC_AI_*` ou `AI_*` server-only). Pattern repris pour Epic 13 (`NEXT_PUBLIC_LIVE_SITE_*`), Epic 14-17 (`NEXT_PUBLIC_AI_STUDY_BUILDER`, `_QUESTION_COACH`, `_INSIGHT_MINING`, `TREE_TESTING`, `COPY_TESTING`).

Logique : `feature_available = adminFlag && planAllows && quotaNotExceeded`.

### AI provider abstraction

Tous les appels IA passent par `lib/ai/providers.ts` → `getActiveProvider()`. Bascule transparente OpenAI ↔ Anthropic ↔ Gemini selon les clés env présentes. Cost tracking unifié via `logAIUsage`.

### Drizzle drift (dette technique)

Le snapshot Drizzle est désynchronisé du schéma actuel depuis migration 0003. Workaround : nouvelles migrations écrites à la main + appliquées via `psql $POSTGRES_URL -f migration.sql`. À corriger dans une session dédiée (Epic 9 Polish ou dette tech standalone).

### Stripe + EUR-first

Pricing en EUR uniquement pour MVP (cible FR). USD viendra avec Epic 11 i18n + Epic 17 stories de devise. Stripe Tax activé pour TVA.

---

## 8. Métriques projet

| Métrique | Valeur | Source |
|---|---|---|
| Fichiers code (.ts, .tsx, .sql) | 144 | `find soleo -name "*.ts*"` |
| Fichiers docs (.md) | 25+ | `docs/`, `_bmad-output/` |
| Lignes de code (estimation) | ~25K | LOC code only |
| Tests verts | 102/102 | `pnpm test` |
| Commits sur `ai-ui` | 168 | `git log --oneline \| wc -l` |
| Coût IA mensuel (dev) | <$1 | OpenAI usage logs |
| Coût IA estimé Pro user/mois | ~$0.15 | calcul Epic 8 grid |
| Performance test suite | 1.6-2s | `vitest run` |

---

## 9. Roadmap actuelle

```
═══ Done ═══
Epics 1-7 (28 stories)
Hors-Epic : PostHog + AI Usage Tracking + AI Flags + Enter-to-submit + Bubble fixes
Stories 9.1, 9.2, 9.3 (Polish déjà livré)

═══ Backlog formalisé — MVP-Beta Track ═══
1. Epic 11 (i18n) — 6 stories ← NEXT
2. Epic 9 design pass — 1 story restante (9.4) + nouveau design tokens migration
3. Epic 12 (Onboarding) — 9 stories
4. Epic 13 (Live Site Testing) ⭐ — 11 stories
5. Epic 14 (AI Study Builder) ⭐⭐ — 6 stories
6. Epic 15 (Question Quality) — 4 stories
7. Epic 16 (Insight Mining) — 5 stories
8. Epic 17 (Advanced Methods) — 7 stories
─── Beta soft launch ───
9. Epic 10 (Landing + Trust page) — 6 stories
10. Epic 8 (Billing & Paywall) — 8 stories
─── Pro launch ───
11. Epic 18 (Integrations Innovation) — 4 stories, sur demande
```

**Effort estimé total** : ~6-8 mois de dev solo à pace soutenu pour la track MVP-Beta complète (Epics 11→17). Epic 8+10 = +1 mois. Epic 18 = à la demande, optionnel.

---

## 10. Risques + Next Steps

### Risques identifiés

1. **Drizzle drift** — non-bloquant mais fait grossir la dette à chaque migration. À fixer avant Epic 11 OU à accepter et continuer en psql manuel.

2. **AI costs scaling** — actuellement <$1/mois en dev. Si Pro users explosent, lourdement gated par quotas Epic 8 + monitoring `ai_usage_logs`. Caps OpenAI à $30/mois recommandés.

3. **Roadmap density** — 76 stories backlogées = 6-8 mois solo. Risque de pivot beta : on découvre via Epic 12 (onboarding tests réels) que certaines Epics 14-17 ne sont pas prioritaires.

4. **Maze release velocity** — Maze release des features AI à un rythme rapide. Soleo se positionne sur la **qualité posture privacy + EU + transparence des coûts IA** plutôt que de courir après les features.

5. **Figma OAuth validation** — Soleo n'est pas encore validé par Figma. Le PAT (Personal Access Token) reste la voie. Story 4.x différée jusqu'à validation.

6. **Drift Notion vs git** — les statuts dans Notion (To Do, In Progress, Done) peuvent diverger de git. À mettre à jour à chaque ship d'une story (manual).

### Next Steps (immediate)

1. **Phase design** — Louis fait sa passe design (tokens + écrans clés). Output : design tokens + atoms + clés pages à appliquer à Epic 9 rolling.
2. **Epic 11 i18n** — kickoff après design.
3. **Suivi backlog** — Notion reste source de vérité, on update à chaque ship.

---

*Ce document est généré automatiquement et mis à jour à chaque livraison majeure. Source de vérité Epics : Notion. Source de vérité code : Git branch `ai-ui` (à merger sur `main` lors du soft launch beta).*
