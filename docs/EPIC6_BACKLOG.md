# Epic 6 — Findings Sharing Backlog

| ID    | Titre                                              | Statut       | Commit     |
|-------|----------------------------------------------------|--------------|------------|
| 6.1   | AI-assisted findings with sourced citations        | ✅ Done      | feat 6.1   |
| 6.2   | Pin / highlight quotes manually                    | À faire      | —          |
| 6.3   | Upgrade prompt at scroll depth                     | À faire      | —          |

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
