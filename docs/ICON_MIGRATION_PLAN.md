# Icon Migration Plan — `lucide-react` → Solar Icons (Linear variant)

Décision utilisateur (2026-05-19) : remplacer **toutes** les icônes lucide actuelles par **Solar Icons en variant Linear (outlined)**. Le kit Obra fournit ses propres icônes lucide-style mais on les écarte au profit de Solar pour une identité visuelle plus distinctive.

---

## 1. Pourquoi Solar Icons

- **Open source** : licence CC BY 4.0 (libre, attribution requise dans `app/about` ou footer)
- ~1200 icônes, 6 variants : Linear / Outline / Bold / Bold Duotone / Broken / Line Duotone
- **Variant choisi : Linear** (stroke 1.5px, optical balance optimisé pour 24×24)
- Excellent rendu à 16/20/24px (les tailles Soleo)
- Pack React tree-shakable disponible

Sources :
- https://solar-icons.com/
- https://github.com/480design/solar-icon-set (React pack)
- https://icon-sets.iconify.design/solar/ (Iconify mirror, 7100+ icônes Solar)

---

## 2. Package choice

### Option A — `solar-icon-set` (recommended)

```bash
pnpm add solar-icon-set
```

```tsx
import { Trash, Pen, Plus, MagniferLinear } from 'solar-icon-set';

<Trash autoSize iconStyle="Linear" />
```

✅ Tree-shakable (seules les icônes importées sont bundlées)
✅ Variant API directe (`iconStyle="Linear"`)
✅ TypeScript types fournis
🟡 Naming différent de Solar Figma (kebab-case vs PascalCase)

### Option B — `@iconify-icons/solar` via `@iconify/react`

```bash
pnpm add @iconify/react @iconify-icons/solar
```

```tsx
import { Icon } from '@iconify/react';
import trashLinear from '@iconify-icons/solar/trash-bin-trash-linear';

<Icon icon={trashLinear} width={24} />
```

✅ Couverture exhaustive (toutes les variants Solar)
🟡 Bundle un poil plus gros par icône
🟡 API plus verbose

**Décision : Option A `solar-icon-set`.** Mieux pour DX + tree-shaking. Si une icône manque (rare), fallback Option B ponctuel.

---

## 3. Audit lucide-react usage actuel

**Scope** : 47 fichiers `.ts*` importent `lucide-react`, 51 icônes uniques utilisées.

### Top usage (fréquence ≥ 4 fichiers)

| lucide-react        | Fréquence | Contexte usuel                              |
|---------------------|-----------|---------------------------------------------|
| `Loader2`           | 13×       | Spinners, états loading                     |
| `X` / `XIcon`       | 8×        | Fermeture modals, dialogs, drawer           |
| `Sparkles`          | 7×        | Boutons IA, badges "AI feature"             |
| `ChevronLeft`       | 7×        | Boutons retour, navigation                  |
| `Check` / `CheckIcon` | 8×      | États validés, checkboxes, success          |
| `Trash2`            | 4×        | Suppression                                 |
| `Copy`              | 4×        | Copier-coller                                |
| `Clock`             | 4×        | Temps, durée                                 |

### Moyenne (3 fichiers)

`Shield`, `Plus`, `Eye`, `ExternalLink`, `CircleIcon`, `ChevronRight`

### Faible (1-2 fichiers)

`Users`, `User`, `TrendingUp`, `Star`, `Settings`, `Lock`, `Lightbulb`, `GripVertical`, `FolderOpen`, `EyeOff`, `ChevronsUpDown`, `CheckCircle2`, `ArrowRight`, `AlertCircle`, `UserPlus`, `Share2`, `Search`, `Quote`, `Percent`, `Pencil`, `MoreHorizontal`, `Menu`, `LogOut`, `Layers`, `Globe`, `Flag`, `FileText`, `Download`, `ChevronUpIcon`, `ChevronRightIcon`, `ChevronDownIcon`, `ChevronDown`, `BookmarkCheck`, `Bookmark`, `BookOpen`

---

## 4. Mapping table — `lucide` → `solar-icon-set` (Linear)

| lucide-react        | solar-icon-set (Linear)           | Notes |
|---------------------|-----------------------------------|-------|
| `Loader2`           | `LoadingMinimalistic` (spin via CSS) | rotation animation manuelle (Solar n'anime pas) |
| `X`, `XIcon`        | `CloseCircle` ou `Close` (variant Outline) | `Close` plat, `CloseCircle` plus visible |
| `Sparkles`          | `Magic` (`MagicStick` ou `Stars`) | Garder le sens "magique IA" |
| `ChevronLeft`       | `AltArrowLeft`                    | |
| `ChevronRight`      | `AltArrowRight`                   | |
| `ChevronDown`, `ChevronDownIcon` | `AltArrowDown`         | |
| `ChevronUpIcon`     | `AltArrowUp`                      | |
| `ChevronsUpDown`    | `AltArrowsUpAndDown` (custom combo) | si pas dispo : combiner AltArrowUp+AltArrowDown |
| `Check`, `CheckIcon` | `CheckRead` ou `Check`           | Simple checkmark |
| `CheckCircle2`      | `CheckCircle`                     | |
| `Trash2`            | `TrashBinTrash` ou `TrashBinMinimalistic` | |
| `Copy`              | `Copy`                            | |
| `Clock`             | `Clock` ou `ClockCircle`          | |
| `Shield`            | `ShieldCheck` (`Shield`)          | |
| `Plus`              | `AddCircle` ou `Add`              | |
| `Eye`               | `Eye`                             | |
| `EyeOff`            | `EyeClosed`                       | |
| `ExternalLink`      | `Link` ou `RoundArrowRightUp`     | |
| `CircleIcon`        | `Circle`                          | |
| `Users`             | `UsersGroupTwoRounded`            | |
| `User`              | `User`                            | |
| `UserPlus`          | `UserPlus` ou `AddUser`           | |
| `TrendingUp`        | `GraphUp` ou `ChartSquare`        | |
| `Star`              | `Star`                            | |
| `Settings`          | `Settings`                        | |
| `Lock`              | `Lock`                            | |
| `Lightbulb`         | `Lightbulb`                       | |
| `GripVertical`      | `Menu` ou `HamburgerMenu`         | drag-handle, ou custom dots |
| `FolderOpen`        | `FolderOpen` ou `Folder2`         | |
| `MoreHorizontal`    | `MenuDots`                        | |
| `Menu`              | `HamburgerMenu`                   | |
| `LogOut`            | `Logout3` ou `Logout`             | |
| `Layers`            | `Layers`                          | |
| `Globe`             | `Globe` ou `Planet`               | |
| `Flag`              | `Flag` ou `FlagWavy`              | |
| `FileText`          | `DocumentText`                    | |
| `Download`          | `Download` ou `DownloadMinimalistic` | |
| `Bookmark`          | `Bookmark`                        | |
| `BookmarkCheck`     | `BookmarkCircle` (custom)         | vérifier dispo, sinon Bookmark + Check overlay |
| `BookOpen`          | `BookOpen` ou `Book2`             | |
| `Share2`            | `ShareCircle` ou `Forward`        | |
| `Search`            | `Magnifer`                        | |
| `Quote`             | `QuoteUp`                         | |
| `Percent`           | `Tag` ou `BillList`               | vérifier ; sinon icon custom |
| `Pencil`            | `Pen` ou `PenNewSquare`           | |
| `ArrowRight`        | `ArrowRight`                      | |
| `AlertCircle`       | `DangerCircle` ou `InfoCircle`    | selon sémantique (warning vs info) |

**Note** : les noms exacts sont à vérifier via le browser https://solar-icons.com/ (recherche live). Le mapping ci-dessus suit la convention de naming `solar-icon-set` mais le package évolue — `pnpm view solar-icon-set` pour la dernière liste.

---

## 5. Plan d'exécution (1 story Polish)

**Story 9.X — Migrate icon library to Solar Icons Linear** (à créer dans Epic 9 rolling)

### Acceptance Criteria

**Given** the codebase uses `lucide-react` for icons
**When** the migration completes
**Then** zero `from 'lucide-react'` imports remain (`grep -r "lucide-react" --include="*.tsx" --include="*.ts"` = 0 matches)

---

**Given** the new icon system is in place
**When** any icon renders in the UI
**Then** it's a Solar Icons Linear variant, rendered at the same visual weight as the previous lucide (stroke ~1.5-2px)

---

**Given** `Loader2` was used for spinners
**When** the spinner renders
**Then** it spins (CSS animation `animate-spin` on the Solar `LoadingMinimalistic` icon)

---

**Given** an icon mapping has no exact Solar equivalent
**When** I encounter the gap
**Then** I document the substitution in this doc (section 4) and pick the closest Solar icon, or fallback to `@iconify-icons/solar` for that specific icon

### Implementation steps

1. `pnpm add solar-icon-set`
2. `pnpm remove lucide-react`
3. Pour chaque fichier (47 au total) :
   - Replace `import { X, Loader2, ... } from 'lucide-react'` → `import { Close, LoadingMinimalistic, ... } from 'solar-icon-set'`
   - Adjust JSX props si nécessaire (`<X className="size-4"/>` → `<Close iconStyle="Linear" size={16}/>` ou wrapper)
4. **Créer un wrapper `<Icon/>`** dans `components/ui/icon.tsx` qui standardise l'API :

```tsx
import * as Solar from 'solar-icon-set';

type SoleoIconName = 'close' | 'check' | 'loader' | ...; // type alias mappé

const ICON_MAP: Record<SoleoIconName, React.ComponentType<any>> = {
  close: Solar.Close,
  check: Solar.CheckRead,
  loader: Solar.LoadingMinimalistic,
  // ...
};

export function Icon({ name, size = 16, className }: { name: SoleoIconName; size?: number; className?: string }) {
  const Cmp = ICON_MAP[name];
  return <Cmp iconStyle="Linear" size={size} className={className} />;
}
```

Avantage : si demain on change de pack icônes, **un seul fichier à modifier**.

5. Refactor tous les usages : `<X/>` → `<Icon name="close"/>`
6. Smoke test : `pnpm dev` + click around (dashboard, builder, findings)
7. Run `pnpm test` (vitest) — aucun test ne teste les icônes spécifiquement, devrait rester vert
8. Update attribution Solar dans `app/(dashboard)/.../trust/page.mdx` (Story 10.6) ou footer landing

### Estimation effort

- Setup wrapper + mapping : 1h
- 47 fichiers × ~2 min refactor automatisable par regex : ~1h30
- Smoke test + ajustements visuels : 1h
- **Total : ~3-4h** (1 demi-journée)

### Risques

1. **Gap icon** : ~5-10 icônes lucide n'auront pas d'équivalent Solar parfait. Mitigation : fallback Iconify ponctuel OU custom SVG inline (rare).
2. **Visual drift** : Solar Linear est légèrement plus aérée que lucide. Smoke test obligatoire sur les écrans denses (BuilderHeader, ConfigPanel).
3. **Bundle size** : `solar-icon-set` ~50 KB après tree-shaking pour 50 icônes. Légèrement plus lourd que lucide (~30 KB pour 50 icônes), mais négligeable.

---

## 6. Hors-scope

- Migration en plusieurs passes (file-by-file) — on fait tout d'un coup pour éviter les états mixtes
- Custom icon set Soleo (logo, brand-specific) — déjà géré séparément
- Icônes dans les emails Resend (sont des images PNG, pas des composants React)
- Animation custom des icônes (Solar est statique, animation = CSS)

---

## 7. Attribution

License Solar Icons : **CC BY 4.0** — attribution requise.

À ajouter :
- Footer du `/trust` page (Story 10.6)
- Ou : section "Crédits" dans `/about` (à créer)

Format suggéré :

> Icons by [Solar Icons](https://solar-icons.com/) — CC BY 4.0
