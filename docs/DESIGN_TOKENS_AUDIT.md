# Design Tokens Audit — Soleo current → Obra shadcn-ui-kit (1.6.0)

Source Figma : [Obra shadcn-ui-kit community edition 1.6.0](https://www.figma.com/design/Y1dUk1xiaLlyqh3RwLGsyn/Obra-shadcn-ui-kit-community-edition--1.6.0---Community-) (file key `Y1dUk1xiaLlyqh3RwLGsyn`).

Source Soleo : `app/globals.css` (canonical `:root` block lines 171-227).

Extraction date : 2026-05-19, via Figma MCP + Desktop (`get_variable_defs` sur pages Colors / Typography / Shadows / Icons).

---

## 1. Colors — Foundation

### 1.1 Core surface & text

| Token              | Soleo actuel | Obra target | Δ | Décision |
|--------------------|--------------|-------------|---|----------|
| `--background`     | `#FAFAFA`    | `#FFFFFF` (body bg) | 🟡 | **Garder #FAFAFA** — donne plus de respiration sur les écrans dashboard, l'Obra `card` blanc ressort mieux dessus |
| `--foreground`     | `#171717` (neutral-900) | `#0A0A0A` (neutral-950) | 🟡 | **Migrer vers #0A0A0A** — meilleur contraste WCAG, aligne avec Primary actuel |
| `--card`           | `#FFFFFF`    | `#FFFFFF`   | ✅ | Pas de changement |
| `--card-foreground`| `#171717`    | `#0A0A0A`   | 🟡 | Migrer en même temps que `--foreground` |
| `--popover`        | `#FFFFFF`    | `#FFFFFF`   | ✅ | Pas de changement |
| `--primary`        | `#0A0A0A`    | `#0A0A0A` (neutral-950) | ✅ | Pas de changement |
| `--primary-foreground` | `#FAFAFA` | `#FAFAFA` (neutral-50) | ✅ | Pas de changement |
| `--secondary`      | `#F5F5F5`    | `#F5F5F5` (neutral-100) | ✅ | Pas de changement |
| `--muted`          | `#F5F5F5`    | `#F5F5F5`   | ✅ | Pas de changement |
| `--muted-foreground` | `#737373` (neutral-500) | `#737373` | ✅ | Pas de changement |
| `--border`         | `#E5E5E5` (neutral-200) | `#E5E5E5` | ✅ | Pas de changement |
| `--input`          | `#E5E5E5`    | `#E5E5E5`   | ✅ | Pas de changement |
| `--ring`           | `#0A0A0A`    | `#0A0A0A`   | ✅ | Pas de changement |

**Convergence : ~85 %.** Soleo et Obra partagent la même base neutre grayscale Tailwind. Les seuls écarts : `--foreground` (#171717 → #0A0A0A) et `--background` (à arbitrer).

### 1.2 Accent — LA grosse différence

| Token              | Soleo actuel | Obra target | Δ |
|--------------------|--------------|-------------|---|
| `--accent`         | `#F5F5F5` (gray neutre) | **`#D5E1FF`** (blue-100) | 🔴 |
| `--accent-foreground` | `#171717` | `#0A0A0A` ou `#1E3A8A` (blue-900) | 🔴 |

**Décision** : **adopter `#D5E1FF` comme accent** pour donner à Soleo une identité visuelle vs "shadcn générique gris". Cohérent avec le brand `blue/200` du kit Obra. À tester sur :
- Boutons secondaires (ghost / outline avec hover)
- Tag chip "feature" actuel (#DBEAFE → #D5E1FF, très proche, à harmoniser)
- États focus/selection dans listes

### 1.3 Semantic colors

| Token             | Soleo actuel | Obra équivalent (Tailwind) | Δ |
|-------------------|--------------|------------------------------|---|
| `--destructive`   | `#EF4444`    | `red/500` = `#EF4444`        | ✅ |
| `--success`       | `#22C55E`    | `green/500` = `#22C55E`      | ✅ |
| `--warning`       | `#F59E0B`    | `amber/500` = `#F59E0B`      | ✅ |
| `--info`          | `#3B82F6`    | (pas exposé) — Obra utilise `blue/500` `#2F41ff` | 🟡 |

**Décision** : garder les sémantiques Soleo telles quelles. L'`--info` actuel (#3B82F6 = tailwind blue-500 standard) est plus accessible que le `blue/500` Obra (#2F41ff trop saturé). Pas de changement.

### 1.4 Neutrals — full scale (à ajouter)

Soleo utilise actuellement seulement neutral-50 / 100 / 200 / 500 / 700 / 900 / 950. Obra expose la **full neutral scale Tailwind**, identique :

```
50  → #fafafa     500 → #737373
100 → #f5f5f5     600 → #525252
200 → #e5e5e5     700 → #404040
300 → #d4d4d4     800 → #262626
400 → #a3a3a3     900 → #171717
                  950 → #0a0a0a
```

**Décision** : exposer les 11 stops comme variables CSS optionnelles `--neutral-50` … `--neutral-950` pour cohérence avec Obra et pour permettre l'usage dans les composants custom. À faire en option, pas critique (Tailwind utility classes `neutral-300` etc. fonctionnent déjà).

### 1.5 Full Tailwind palette (Obra expose, Soleo n'expose pas)

Obra fournit toutes les couleurs Tailwind avec 11 stops chacune : red, blue, slate, zinc, stone, sky, orange, lime, yellow, indigo, amber, emerald, teal, cyan, violet, purple, pink, rose, green.

**Décision** : **ne PAS exposer** ces palettes comme variables CSS dans Soleo. Tailwind utility classes (`bg-red-500`, etc.) sont déjà dispos. Les variables CSS doivent rester sémantiques (destructive, success...), pas chromatiques. Évite la prolifération de tokens.

### 1.6 Tag chip colors (Soleo-specific, pas dans Obra)

| Tag        | Soleo bg / text                      | Δ |
|------------|--------------------------------------|---|
| pain       | `#FEE2E2` / `#991B1B` (red-100/800)  | ✅ Aligné Tailwind red |
| feature    | `#DBEAFE` / `#1E40AF` (blue-100/800) | 🟡 → migrer vers `#D5E1FF` / `#10149F` (Obra blue) pour cohérence avec accent |
| positive   | `#DCFCE7` / `#166534` (green-100/800)| ✅ Aligné Tailwind green |
| off-record | `#F5F5F5` / `#525252` (neutral-100/600)| ✅ Aligné |

**Décision** : aligner `tag-feature` sur l'accent Obra (`#D5E1FF` / `#10149F`) pour cohérence visuelle quand le tag apparaît dans une liste à côté d'éléments accent.

---

## 2. Typography

### 2.1 Font family — changement majeur

| Slot   | Soleo actuel | Obra target | Décision |
|--------|--------------|-------------|----------|
| sans   | Inter        | **Satoshi Variable** | 🟡 **Adopter Satoshi** sous condition de licence |
| mono   | (default)    | **Geist Mono** | 🟢 Adopter |

**Licence** :
- **Satoshi** est distribué par [Fontshare](https://www.fontshare.com/fonts/satoshi) gratuitement pour usage personnel et commercial (ITC est propriétaire mais Fontshare a la licence de distribution). Vérifier avant de ship en production.
- **Geist Mono** par Vercel, license OFL (libre).

**Pattern d'intégration** :
- Fontshare CDN ou self-host via `next/font/local`
- Fallback stack : `'Satoshi Variable', 'Inter', system-ui, sans-serif`
- Body class à mettre à jour : `app/globals.css` ligne 81 `font-family: "Inter"...` → Satoshi

### 2.2 Type scale Obra

| Variant Obra        | Font size | Line-height | Weight | Letter-spacing | Soleo équivalent actuel |
|---------------------|-----------|-------------|--------|-----------------|-------------------------|
| heading 1           | 48px      | 48px        | Medium (500) | -1.5 | tw `text-5xl font-bold` |
| heading 2           | 30px      | 30px        | Medium (500) | -1   | tw `text-3xl font-bold` |
| heading 3           | 24px      | 28.8px      | Medium (500) | -1   | tw `text-2xl font-semibold` |
| heading 4           | 20px      | 24px        | Medium (500) | 0    | tw `text-xl font-semibold` |
| paragraph large     | 18px      | 27px        | 400/500/700 | 0 | tw `text-lg` |
| paragraph regular   | 16px      | 24px        | 400/500/700 | 0 | tw `text-base` |
| paragraph small     | 14px      | 20px        | 400/500/700 | 0 | tw `text-sm` |
| paragraph mini      | 12px      | 16px        | 400/500/700 | 0 | tw `text-xs` |
| caption             | 14px      | 21px        | 400 | +1.5 (uppercase tracking) | (pas d'équivalent) |
| monospaced          | 16px      | 24px        | 400 (Geist Mono) | 0 | tw `font-mono` |

**Note Obra** : tous les headings sont en **weight Medium (500)**, pas Bold (700). Soleo utilise actuellement `font-bold` (700) sur les titres → **à migrer vers `font-medium` (500)** pour matcher l'esthétique Obra (plus aérée, moins visuellement lourde).

**Décision** : créer dans `app/globals.css` une couche `@layer components` avec des classes utility custom `.text-heading-1` ... `.text-paragraph-small-bold` qui appliquent les bons triplets (size + line-height + weight + tracking). Évite de répéter `text-5xl font-medium tracking-[-0.015em]` partout.

### 2.3 Caption — variant à ajouter

Le variant `caption` (14px, weight 400, tracking +1.5) n'a pas d'équivalent direct côté Soleo. Utile pour : labels uppercase, eyebrow text, métadonnées discrètes. À ajouter comme classe `.text-caption`.

---

## 3. Shadows

### 3.1 Scale Obra (Tailwind defaults)

| Token        | Specs                                                           | Soleo actuel |
|--------------|-----------------------------------------------------------------|--------------|
| shadow-2xs   | `0 1px 0 0 rgba(0,0,0,0.05)`                                    | ❌ Absent    |
| shadow-xs    | `0 1px 2px 0 rgba(0,0,0,0.05)`                                  | ❌           |
| shadow-sm    | `0 1px 3px 0 rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10)` | tw default OK |
| shadow-md    | `0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)` | tw default OK |
| shadow-lg    | `0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10)` | tw default OK |
| shadow-xl    | `0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)` | tw default OK |
| shadow-2xl   | `0 25px 50px -12px rgba(0,0,0,0.10)`                            | tw default OK |

**Décision** : **rien à faire** côté Soleo. Tailwind expose déjà `shadow-sm`...`shadow-2xl` avec ces valeurs par défaut. Les `2xs` et `xs` Obra peuvent être ajoutés si besoin (rare).

---

## 4. Spacing

Obra expose :

```
2xs → 4px      md → 16px
xs  → 8px      2xl → 32px
                5xl → 64px
```

C'est un sous-ensemble de l'échelle Tailwind standard (`0.5` = 2px, `1` = 4px, `2` = 8px, `4` = 16px, `8` = 32px, `16` = 64px).

**Décision** : **rien à faire**. Tailwind utility classes (`p-1`, `p-2`, `p-4`, `p-8`, `p-16`) couvrent tout.

---

## 5. Border radius

| Token Obra     | Valeur | Soleo équivalent | Décision |
|----------------|--------|-------------------|----------|
| `rounded-sm`   | 4px    | `--radius - 4px` = 4px (`var(--radius)` = 8px) | ✅ Match |
| `rounded-md`   | (implicite ~6px) | `--radius - 2px` = 6px | ✅ Match |
| `rounded-lg`   | 8px    | `--radius` = 8px (0.5rem) | ✅ Match |
| `rounded-xl`   | (implicite ~12px) | `--radius + 4px` = 12px | ✅ Match |

**Convergence parfaite.** Aucun changement.

---

## 6. Components — high-level diff

À auditer composant par composant via `get_design_context` sur les pages Obra correspondantes. Niveau initial :

| Composant   | Obra page node    | Soleo actuel                | Niveau de diff attendu |
|-------------|--------------------|-----------------------------|------------------------|
| Button      | `842:44442`        | `components/ui/button.tsx` (shadcn) | 🟢 Faible — variants similaires (default/secondary/ghost/outline/destructive/link) |
| Card        | `842:49175`        | `components/ui/card.tsx`    | 🟢 Faible |
| Input       | `842:49172`        | `components/ui/input.tsx`   | 🟢 Faible |
| Badge       | `842:44441`        | `components/ui/badge.tsx`   | 🟡 Moyen — Obra ajoute size variants |
| Empty state | `842:44451`        | (pattern ad-hoc dans Soleo) | 🔴 Fort — pas de composant Empty unifié, à créer (Story 12.3 du backlog Onboarding) |
| Sidebar     | `842:51929`        | `components/ui/sidebar.tsx` | 🟡 Moyen — déjà via shadcn |
| Sonner      | `842:51943`        | `sonner` package monté      | 🟢 Faible |
| Dialog      | `842:51941`        | `components/ui/dialog.tsx`  | 🟢 Faible |
| Sheet/Drawer| `842:52049/52050`  | présent                     | 🟢 Faible |
| Field/Form  | `842:49181`        | RHF + `Label` shadcn        | 🟡 Moyen |
| Item        | `885:3081`         | (pattern ad-hoc)            | 🟡 Moyen — utile pour listes de projets/sessions |

Audit composant-par-composant à faire dans une session dédiée. Pour l'instant, **focus tokens + icons** suffit pour démarrer la migration visuelle globale.

---

## 7. Plan de migration synthétique

### Phase 1 — Foundation (1 story Polish, ~2-3h)

1. Swap font Inter → Satoshi Variable (`next/font/local` ou Fontshare CDN) + Geist Mono pour `font-mono`
2. Update `--foreground` : `#171717` → `#0A0A0A`
3. Update `--accent` : `#F5F5F5` → `#D5E1FF` + `--accent-foreground` adapté
4. Update `tag-feature` : `#DBEAFE` / `#1E40AF` → `#D5E1FF` / `#10149F`
5. Ajouter classes typo custom dans `@layer components` : `.text-heading-1` à `.text-heading-4`, `.text-paragraph-*`, `.text-caption`
6. Smoke test visuel sur les 5 écrans principaux (dashboard, project, session builder, findings, participant)

### Phase 2 — Components polish (rolling, 1 story par composant complexe)

Pour chaque composant marqué 🟡 / 🔴 ci-dessus : audit visuel par-screen + ajustement props/variants.

### Phase 3 — Icons (séparée, voir `ICON_MIGRATION_PLAN.md`)

Migration `lucide-react` → Solar Icons Linear. ~50 icônes à mapper, ~47 fichiers à mettre à jour.

---

## 8. Hors-scope de cet audit

- Animations / transitions (non-exposés comme tokens Obra)
- Variants dark mode (Soleo affiche light only, dark défini mais pas activé)
- Composants Pro Obra (pages `Pro blocks` du fichier, non incluses dans community 1.6.0)
- Charts colors (Soleo a 5 HSL, à ré-évaluer quand on aura un vrai use-case dataviz)

---

## 9. Risques

1. **Licence Satoshi** : Fontshare distribue gratuitement, mais double-check les conditions avant publication ([fontshare.com/fonts/satoshi](https://www.fontshare.com/fonts/satoshi))
2. **Régression visuelle** : changer `--foreground` et la font impacte tous les écrans. Smoke test obligatoire.
3. **Bundle size** : Satoshi Variable + Geist Mono ≈ +50 KB woff2. Acceptable mais à monitorer.
4. **Accent #D5E1FF trop pâle sur fond #FAFAFA** : contraste à vérifier (peut-être passer à blue/200 `#B3C7FF` pour les zones interactives).
