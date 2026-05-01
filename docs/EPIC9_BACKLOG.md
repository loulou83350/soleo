# Epic 9 — Polish & UX Backlog

Stories qui améliorent l'expérience visuelle ou le confort d'usage de features existantes, **sans changement fonctionnel**. Le user partagera des designs Figma au cas par cas pour le rendu visuel — le comportement reste celui décrit dans les ACs.

Source de vérité : Notion `Soleo — Project Tracker` → database "Stories" → Epic 9 — Polish & UX.

| ID  | Titre                                                            | Priority | Statut    | Lié à        |
|-----|------------------------------------------------------------------|----------|-----------|--------------|
| 9.1 | Figma frame thumbnails in the Builder picker                     | Medium   | ⏳ To Do  | Story 3.1    |
| 9.2 | Visual prototype timeline in the response detail                 | Medium   | ⏳ To Do  | Story 5.2    |
| 9.3 | Unit tests for AI helpers (followup, usage, repos)               | Low      | ⏳ To Do  | Epic 7       |

---

## Story 9.1 — Aperçus Figma dans le picker du Builder

### User story
> As a Member, when I configure a "tâche prototype" block with a goal frame, I want to see a **visual preview** of each frame in the picker, so that I can identify the right end-screen at a glance instead of relying on its name only.

### Contexte
Aujourd'hui (`PrototypeTaskForm` dans `components/builder/ConfigPanel.tsx` lignes 537+) :
- Le picker de frames affiche **uniquement le nom** de chaque frame (texte)
- La frame sélectionnée affiche le **nom + node ID brut** (`123:456`) — peu parlant pour un designer

Soleo a déjà l'infrastructure : `fetchFrameThumbnails(fileKey, frameIds)` dans `lib/figma/api.ts` (ligne 169) appelle l'endpoint Figma `/v1/images` et retourne un map `nodeId → thumbnailUrl`. Le type `FigmaFrame` a déjà un champ optionnel `thumbnailUrl?`.

### Acceptance Criteria

**Given** a Member opens the frame picker on a `prototype_task` block
**When** the frames list loads
**Then** each frame row shows a small thumbnail (≈40×30 px) on the left of the name; thumbnails load progressively (no blocking)

---

**Given** a Member selects a frame
**When** the picker closes
**Then** the "Selected screen" card shows the thumbnail + frame name (the raw node ID is hidden or shown only on hover)

---

**Given** the Figma `/images` endpoint fails or rate-limits
**When** thumbnails can't be fetched
**Then** the picker still shows the names (graceful degradation), no error blocks the UI

### Implémentation
1. Après `fetchFigmaFramesAction` succès → batch-call `fetchFrameThumbnails(fileKey, frameIds)` (server action wrapper si besoin)
2. Stocker le map dans le state `frames` (enrichir avec `thumbnailUrl`)
3. UI : ajouter `<img>` ou `<div style={{ backgroundImage }}>` dans le rendu du picker + dans la card "Selected"
4. Loader skeleton (gris) pendant que les thumbnails chargent
5. Cache mémoire au niveau du composant — pas de re-fetch si le picker est rouvert dans la même session

### Hors-scope
- Pas de cache disque/DB des thumbnails (les URLs Figma expirent après ~1h, c'est par design)
- Pas de zoom/preview plein écran au hover (V2)

---

## Story 9.2 — Timeline visuelle du prototype dans le détail réponse

### User story
> As a Member, when I review a participant's prototype task answer, I want to see **a thumbnail of each screen they navigated through**, not just node IDs, so that I can understand their journey without opening Figma.

### Contexte
Aujourd'hui (`PrototypeTaskResponse` dans `app/(dashboard)/.../participants/[token]/ResponseRenderer.tsx` lignes 175+) :
- La timeline montre `+12s · 123:456` — du texte brut
- Pour un designer, le node ID Figma n'est pas lisible (Figma ne l'expose pas dans son UI)
- Pas de moyen de comprendre quels écrans le participant a vraiment vus

### Acceptance Criteria

**Given** a Member views a participant's prototype task response
**When** the timeline renders
**Then** each step shows: thumbnail (≈80×60 px) + frame name + elapsed time; the raw node ID is hidden (or shown in a `title` tooltip for debug)

---

**Given** a frame's thumbnail can't be fetched (Figma file deleted, frame removed, API error)
**When** the timeline renders
**Then** the row shows a placeholder ("⊟ Écran indisponible") + the frame name if known + the time

---

**Given** the same nodeId appears multiple times in the timeline
**When** thumbnails are fetched
**Then** the API call deduplicates IDs — one fetch per unique frame, not per occurrence

---

**Given** the participant detail page renders
**When** Figma fetch is in progress
**Then** node IDs show as text first, thumbnails fade in as they arrive (no blocking on Figma latency)

### Implémentation
1. Côté server (page detail) : extraire `unique(navigations.map(n => n.nodeId))`
2. Récupérer le `fileKey` depuis le `block.config.url` du bloc prototype
3. Appel batch `fetchFrameThumbnails(fileKey, uniqueIds)` + récupération des noms via `fetchFrames` (pour cross-référence nodeId → name)
4. Construire un map `{ nodeId: { name, thumbnailUrl } }` passé à `PrototypeTaskResponse`
5. Render : remplacer `{nav.nodeId}` par card horizontale avec image + name + temps écoulé
6. Fallback gracieux par nodeId

### Notes techniques
- Cache 1h max (URLs thumbnails Figma expirent)
- Si le block n'a pas d'URL Figma valide → fallback sur l'affichage actuel (texte brut)
- Performance : pour les sessions à beaucoup de navigations (>50), parallélise les fetchs et limite à 100 thumbnails

---

## Story 9.3 — Tests unitaires des helpers IA (Epic 7)

### Contexte
Les 4 fichiers nouveaux d'Epic 7 n'ont **pas de tests automatisés** :
- `lib/ai/followup.ts` (prompt + streaming SSE)
- `lib/ai/usage.ts` (déjà existant, étendu)
- `lib/repositories/ai-followup.ts` (insert + read)
- `lib/repositories/ai-usage.ts` (déjà existant)

À ce stade le runner vitest passe (58/58 tests verts), mais on étend la couverture pour rester confiant lors des refactors futurs.

### Acceptance Criteria
- Tests pour `buildUserPrompt` (helper exporté à des fins de test) : couverture des 3 cas (turnNumber=1 sans history, =2 avec 1 turn précédent, =3 avec 2 turns)
- Tests SSE parsing (mock `fetch`) : décomposition des events `token`, `meta`, `done`, `error`
- Tests `insertTurn` + `getTurnsForResponse` (avec DB de test ou mock Drizzle, comme les autres repos `*.test.ts`)
- Tests `computeCostMicros` : prix corrects pour chaque modèle hard-codé, fallback à 0 pour modèle inconnu
- Le total `vitest run` passe sous 5s

### Hors-scope
- Tests E2E du flow participant complet (Playwright/Cypress) — chantier dédié
- Tests de l'intégration OpenAI réelle (mock seulement)
