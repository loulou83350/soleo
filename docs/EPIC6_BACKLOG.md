# Epic 6 — Findings Sharing Backlog

| ID    | Titre                                              | Statut       | Commit     |
|-------|----------------------------------------------------|--------------|------------|
| 6.1   | AI-assisted findings with sourced citations (markdown editor) | ✅ Done | feat 6.1 |
| 6.2   | Pin / highlight quotes manually                    | À faire      | —          |
| 6.3   | Upgrade prompt at scroll depth                     | À faire      | —          |
| **6.4** | **Notion-style block editor with slash commands** | **À faire (NEW)** | — |

---

## Story 6.2 — Pin / highlight quotes manually

Le researcher peut "épingler" une réponse spécifique pour qu'elle apparaisse comme **highlight visuel** dans le rapport (au-delà des citations inline qu'on a déjà).

### Scope proposé
- Bouton "✦ Épingler dans le rapport" sous chaque réponse texte sur la fiche participant (Story 5.2)
- Une section "Quotes marquantes" sur la page findings avec les épinglées en cards
- Drag & drop pour réordonner

### Schéma
- Table `finding_highlights` (findingId, responseId, customNote, position)

---

## Story 6.3 — Upgrade prompt

Sur la page publique `/findings/[token]`, un CTA "Vous voulez créer le vôtre ? Soleo →" qui apparaît au scroll. Tracking simple en DB pour mesurer le funnel.

À faire après Epic 8 (Stripe billing).

---

## Story 6.4 — Notion-style block editor with slash commands

### Pourquoi

L'éditeur actuel (textarea markdown) a deux limitations :
1. Pas de **rendu inline** des citations pendant l'écriture — le researcher voit `{r:42}` au lieu de `[#3]` jusqu'à la publication
2. Pas de **commandes rapides** pour insérer un titre, une liste, un tableau, ou une citation depuis la base de réponses

L'objectif est un éditeur **WYSIWYG par blocs** type Notion :
- Tu tapes `/` n'importe où → menu de commandes apparaît
- Tu choisis "Heading 1" → la ligne devient un H1
- Tu choisis "Insight / Quote" → un picker s'ouvre, tu cherches une réponse, elle est insérée comme **bloc citation rendu inline** (pas un token brut)
- Tu vois exactement ce que verra le stakeholder pendant que tu écris

### Scope

#### A. Choix de la stack

**Option recommandée — Tiptap v2** (basé sur ProseMirror)
- Maturité éprouvée (Notion-like editors comme Linear, Cal.com l'utilisent)
- Headless → on contrôle 100% du rendu visuel
- Extensions custom propres (Citation node, Slash command)
- React bindings natifs

**Alternatives :**
- **Plate (slate-based)** — plus modulaire, mais courbe d'apprentissage plus raide
- **BlockNote** — wrapper Notion-like sur Tiptap, plus rapide à démarrer mais moins flexible
- **Custom from scratch** — pas réaliste, des centaines d'heures

**Décision pressentie : Tiptap.** BlockNote en plan B si on veut accélérer.

#### B. Blocs natifs à supporter

Standards (extensions Tiptap "starter kit") :
- Paragraph, Heading 1/2/3, Bullet list, Ordered list, Blockquote
- Bold, italic, underline, strike, code inline, link
- Code block (avec syntax highlight optionnel)
- Horizontal rule
- Table (extension officielle Tiptap)
- Image upload (réutilise Supabase Storage déjà branché pour Story 2.3)

Custom :
- **Citation block** (inline node) — affiche une `<CitationPill>` en plein milieu d'un paragraphe. Stocke `{ responseId, participantNumber }` dans son attribute. Sérialisable.
- **Insight callout block** (block node) — encart visuel avec une icône + texte court + références multiples. Pour épingler un constat majeur.
- **Metric block** (block node) — affiche un nombre + label depuis les stats de la session (ex: "Score NPS +12"). Auto-mis-à-jour à l'ouverture.

#### C. Slash command menu

Trigger : taper `/` au début ou n'importe où dans une ligne vide.

Menu avec :
- Recherche par mot-clé en haut (Notion-style)
- Sections groupées :
  - **Texte** : Titre 1, Titre 2, Titre 3, Paragraphe
  - **Listes** : Liste à puces, Liste numérotée, Liste de tâches
  - **Médias** : Image, Code, Tableau, Diviseur
  - **Soleo** : ✨ Citer une réponse, 🎯 Insight callout, 📊 Métrique
- Navigation clavier (↑/↓/Enter/Esc)
- Mouse hover preview à droite (optionnel)

#### D. Citation picker (le plus délicat)

Quand le researcher tape `/citer` ou clique "Citer une réponse" :
1. Une **modale ou dropdown** s'ouvre par-dessus l'éditeur
2. Affiche les blocs de questions de la session
3. Sous chaque bloc, la **liste des réponses** (text-like seulement par défaut, filtrable)
4. Champ de recherche en haut pour filtrer par mot-clé dans les textes
5. Filtres : par tag (multi-select des insight tags), par participant
6. Click sur une réponse → insertion d'un **CitationNode** dans l'éditeur à la position du curseur
7. Échap pour fermer

Réutilise :
- `getAllResponsesForSession` pour la donnée
- `listTagsForResponses` pour le filtre tags

#### E. Sérialisation / persistence

L'éditeur stocke en JSON Tiptap (ProseMirror doc). Stockage en DB :
- Soit nouveau champ `bodyJson` (JSONB) dans `session_findings`
- Soit on garde `bodyMarkdown` mais avec un converter Tiptap → markdown (avec tokens `{r:ID}`) pour rester compatible avec l'éditeur actuel et le viewer public

**Décision pressentie** : ajouter `bodyJson` (JSONB nullable). Migration progressive — si `bodyJson` existe, l'éditeur Notion-style l'utilise ; sinon il parse le markdown en JSON Tiptap au chargement (one-shot).

#### F. Rendu côté public viewer

Le `MarkdownWithCitations` actuel devient `FindingsRenderer` qui :
- Lit `bodyJson` si dispo, sinon parse `bodyMarkdown`
- Render via `generateHTML` de Tiptap avec les mêmes extensions (mais en read-only)
- Citations restent cliquables (popover)
- Insight/Metric blocks rendus en cards stylisées

#### G. Migration de l'existant

- Les findings markdown actuels continuent de marcher → on les charge via le converter markdown → JSON ProseMirror au premier passage en édition Notion-style
- Le viewer public auto-détecte le format (Json vs markdown) et render en conséquence
- Pas de breaking change

### Fichiers (estimation)

| Fichier | Action |
|---|---|
| `lib/db/schema.ts` | + colonne `bodyJson` (JSONB nullable) |
| (migration Supabase) | ALTER TABLE session_findings ADD body_json JSONB |
| `components/findings/editor/Editor.tsx` | **NEW** — wrapper Tiptap avec extensions |
| `components/findings/editor/extensions/CitationNode.tsx` | **NEW** — node Tiptap inline |
| `components/findings/editor/extensions/InsightCallout.tsx` | **NEW** — node block |
| `components/findings/editor/extensions/MetricBlock.tsx` | **NEW** — node block |
| `components/findings/editor/extensions/SlashCommand.tsx` | **NEW** — menu déclenché par `/` |
| `components/findings/editor/CitationPicker.tsx` | **NEW** — modale de sélection de réponse |
| `components/findings/editor/markdown-bridge.ts` | **NEW** — converter markdown ↔ JSON ProseMirror |
| `components/findings/FindingsRenderer.tsx` | **NEW** — rendu unifié pour le viewer public (remplace MarkdownWithCitations) |
| `app/(dashboard)/.../findings/FindingsEditor.tsx` | refactor — utilise le nouveau Editor au lieu d'une textarea |
| `app/findings/[token]/page.tsx` | utilise FindingsRenderer |
| `package.json` | + `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `@tiptap/extension-image`, `@tiptap/suggestion` |

### Effort estimé

- **2-3 jours de focus** (vs 2-3h pour Story 6.1)
- Risques : bug du Tiptap suggestion plugin, sérialisation JSON ↔ markdown, accessibility du slash menu
- Plan B si Tiptap est trop lourd : utiliser BlockNote qui réduit l'effort à ~1 jour mais limite la personnalisation

### Critères d'acceptation

1. Taper `/` dans une ligne vide ouvre le menu de commandes
2. Naviguer au clavier dans le menu fonctionne
3. Insérer un H1 / H2 / liste / tableau via le menu produit le bon bloc visuel
4. Insérer une citation via "/citer" ouvre le picker, recherche et insère un `CitationPill` rendu inline
5. Le bouton "✨ Suggérer un brouillon IA" fonctionne toujours et remplit l'éditeur (avec conversion markdown → JSON ProseMirror automatique)
6. Le viewer public affiche le même rendu visuel que l'éditeur (sans la chrome d'édition)
7. Les findings créés en Story 6.1 (markdown brut) continuent de s'ouvrir et s'éditer sans perte
8. Auto-save fonctionne sur le JSON
9. Publication / dépublication fonctionnent comme avant

