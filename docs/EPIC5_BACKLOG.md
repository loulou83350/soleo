# Epic 5 — Results Backlog

Statut des stories de l'Epic 5 (Results & Analysis).

| ID    | Titre                                          | Statut       | Commit        |
|-------|------------------------------------------------|--------------|---------------|
| 5.1   | Response dashboard (overview + métriques)      | ✅ Done      | feat 5.1      |
| 5.2   | Détail d'une réponse individuelle              | ✅ Done      | feat 5.2      |
| 5.3   | Insight tags (annoter les réponses, manuel + IA) | ✅ Done    | feat 5.3      |
| 5.4   | Export CSV des réponses                        | À faire      | —             |
| 5.5   | Email notifications via Cron + Resend          | Partiel*     | feat 4.5      |
| 5.6   | Récap agrégé par question (cross-participants) | ✅ Done      | feat 5.6      |

> *5.5 partiel : la notification immédiate est faite (Story 4.5 — sendSessionCompletionEmail). Le Cron pour des digests périodiques reste à faire.*

---

## Story 5.6 — Récap agrégé par question

### Contexte
Le dashboard de session (5.1) montre les métriques globales et la liste des participants.
Le détail individuel (5.2) montre les réponses d'UN participant.
Il manque la vue **synthèse cross-participants** : pour chaque question de la session, voir comment l'ensemble des participants y ont répondu.

C'est la vue principale qu'un researcher consulte pour analyser ses résultats sans devoir cliquer chaque participant.

### Scope proposé

Nouvel onglet ou section dans le dashboard de session (à côté de la liste participants), qui affiche pour chaque bloc de question :

- **short_text / long_text** : liste des réponses avec un compteur "X réponses". Pour long_text, peut-être un mode "card" pour parcourir.
- **mcq** : graphique en barres horizontales des options choisies (% + count par option, gestion `allowMultiple` et `allowOther`)
- **likert / rating / nps** :
  - distribution (histogramme)
  - moyenne, médiane
  - pour NPS spécifiquement : score NPS calculé (% promoteurs - % détracteurs)
- **card_sort** : ranking moyen par item (ordre médian)
- **matrix** : pour chaque ligne, distribution des colonnes choisies
- **first_impression** : juste un compteur "X participants ont vu le stimulus"
- **prototype_task** : taux de completion (auto vs manuel vs abandonné), durée moyenne, frame de fin la plus atteinte si goal-based

### Implémentation pressentie

- **Route** : ajouter un onglet sur le dashboard existant (ex : `/sessions/[id]?view=summary`) ou page séparée `/sessions/[id]/summary`
- **Repo** : nouvelle fonction `getSessionResponseSummaries(sessionId)` qui retourne `Record<blockId, AggregateData>` selon le type
- **Composants** : `BlockSummaryRenderer` avec un switch par type comme `ResponseRenderer`, mais qui prend `responses[]` au lieu d'une seule
- **Lib agrégation** : helpers purs `lib/analytics/` pour calcul moyenne/distribution/NPS/etc. Testables.

### Priorité

Haute — c'est la vraie valeur pour le researcher post-collecte.
À faire après 5.3 (insight tags) ou avant, selon l'usage. Probablement **avant** parce que ça débloque l'analyse.
