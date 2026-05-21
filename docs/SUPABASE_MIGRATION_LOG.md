# Supabase Migration Log — 2026-05-21

Trace complète de la migration du compte Supabase A (ancien) vers le compte
Supabase B (LB3 Studion). Document destiné aux sessions futures pour
contexte + leçons apprises + dette technique à résorber.

---

## 1. Pourquoi cette migration

Le user (Louis) a déconnecté son ancien compte Supabase et reconnecté le
MCP sur un nouveau compte (`LB3 Studion`, id `awxfqxpwthgarbzqfapj`).
Volonté de partir sur une base propre, en région eu-west-3 Paris pour
posture RGPD stricte (full EU).

Aucune donnée à migrer (Louis était le seul user, pas d'impact business).

## 2. Nouveau projet Supabase

| Param | Valeur |
|---|---|
| Project ref | `wbjjxnqrfwzrorrlijku` |
| Région | `eu-west-3` (Paris) |
| Organisation | `awxfqxpwthgarbzqfapj` (LB3 Studion) |
| URL API | `https://wbjjxnqrfwzrorrlijku.supabase.co` |
| Anon key | `sb_publishable_laGDg9eZIsaR-tO1wl4jLw_AIxesdk2` (modern publishable, pas legacy JWT) |
| Pooler hostname | `aws-0-eu-west-3.pooler.supabase.com` (confirmé fonctionnel) |
| Coût | 0 €/mois (Free tier) |

**⚠️ Password DB** : initialement set à `112358Loulou**` (identique à
l'ancien projet pour simplicité). **À reset** par Louis (a circulé en
clair dans le chat de la session du 2026-05-21).

## 3. Env vars Vercel mises à jour

Toutes en scope Production + Preview (branche `ai-ui`) :
- `NEXT_PUBLIC_SUPABASE_URL` → nouvelle URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → nouvelle clé publishable
- `POSTGRES_URL` → nouveau pooler eu-west-3 avec password URL-encodé
  (`112358Loulou%2A%2A` pour les `**`)

`.env.local` mis à jour avec les 3 mêmes valeurs.

## 4. Migrations DB appliquées (chronologie)

Le projet a un drift Drizzle connu : `pnpm db:generate` est cassé,
`drizzle-kit push` crashe (bug 0.31.1 sur replace de checkValue). Les
fichiers `lib/db/migrations/0000..0005` ne reflètent PAS l'état réel
attendu par le code (qui suit `lib/db/schema.ts` comme source de vérité).

Migrations effectivement appliquées sur le nouveau projet via MCP
`apply_migration` :

| # | Nom | Effet | Source |
|---|---|---|---|
| 0000 | `soft_the_anarchist` | users, teams, team_members, activity_logs, invitations | fichier SQL |
| 0001 | `warm_captain_midlands` | projects | fichier SQL |
| 0002 | `loving_micromacro` (obsolète) | sessions, session_pages, session_blocks (anciens schéma) | fichier SQL — **rolled back** |
| 0003 | `lowly_xavin` | `conditions` col on session_blocks | fichier SQL — **rolled back** |
| 0006 | `drop_legacy_sessions_pages` | DROP sessions, session_pages, session_blocks | reconstruct |
| 0007 | `sessions_full_schema` | Toutes les tables manquantes : sessions (with gate cols), session_blocks (with sessionId FK direct vers sessions), participant_sessions, block_responses, consent_records, insight_tags, block_response_tags, session_findings, finding_highlights, ai_usage_logs, ai_followup_turns | depuis `schema.ts` |
| 0008 | `enable_rls_all_tables` | RLS enabled sur 17 tables (sécurité critique — bloque l'accès via anon key publique) | advisor recommendation |
| 0009 | `teams_figma_columns` | + figma_access_token, figma_refresh_token, figma_token_expires_at sur teams | drift discovery |
| 0010 | `missing_unique_constraints` | UNIQUE(participant_session_id, block_id) sur block_responses + UNIQUE(response_id, tag_id) sur block_response_tags | drift discovery — required for ON CONFLICT upserts in lib/repositories |
| 0011 | `revoke_anon_authenticated` | REVOKE ALL on tables/sequences/functions du schéma public from anon + authenticated. ALTER DEFAULT PRIVILEGES pour les futures tables. Defense in depth : Soleo n'utilise pas Supabase Auth donc ces rôles n'ont aucune utilité applicative. Aucun impact app (passe par POSTGRES_URL/postgres role). | hardening pré-beta |

État final : 17 tables alignées avec `schema.ts`. RLS activé partout,
aucun ERROR dans les advisors. INFOs "RLS enabled no policy" attendus :
les requêtes app passent par Drizzle/POSTGRES_URL (role postgres bypass
RLS), donc OK.

## 5. Drifts identifiés vs `lib/db/schema.ts`

Découverts pendant cette migration. Le code app suit `schema.ts`, les
fichiers SQL en `lib/db/migrations/` sont obsolètes.

| Drift | Détail |
|---|---|
| `session_pages` supprimée | N'existe plus dans schema.ts. Tables blocs directement liées à `sessions`. |
| `session_blocks.session_page_id` → `session_id` | FK directe vers sessions |
| `sessions` enrichi de 5 colonnes | session_token (unique), password_hash, device_restriction, gdpr_enabled, gdpr_message |
| `teams` enrichi de 3 colonnes Figma OAuth | figma_access_token, figma_refresh_token, figma_token_expires_at |
| 7 tables non capturées dans les migrations SQL | participant_sessions, block_responses, consent_records, insight_tags, block_response_tags, session_findings, finding_highlights |

## 6. Bugs rencontrés + résolutions

### Bug 1 — Home page + signin returnaient 500

**Symptôme** : "Application error: server-side exception" sur soleo-sandy.vercel.app,
"Failed to create user" sur /sign-up.

**Cause** : missing column `teams.figma_access_token` (le code prod
sélectionne toutes les colonnes via Drizzle).

**Fix** : migration 0009 — ajout des 3 colonnes Figma OAuth.

### Hardening — REVOKE anon + authenticated GRANTs (migration 0011)

**Contexte** : audit sécurité post-beta launch. Soleo n'utilise PAS Supabase
Auth (système maison bcrypt+JWT). Les rôles `anon` (clé publique exposée
dans `NEXT_PUBLIC_SUPABASE_ANON_KEY`) et `authenticated` ont des GRANT par
défaut SELECT/INSERT/UPDATE/DELETE sur les 17 tables `public.*`.

**Risque résiduel évité** : RLS bloque tout pour anon aujourd'hui, mais
si quelqu'un désactive RLS sur une table (debug, refactor, migration auto),
la clé anon publique permet immédiatement un CRUD complet via l'API REST
PostgREST. Defense-in-depth fragile.

**Fix** : migration 0011 — REVOKE ALL sur les 17 tables existantes pour
anon + authenticated + ALTER DEFAULT PRIVILEGES pour que toute table créée
future inherit la posture (e.g. Epic 13 `live_site_*` tables).

**Vérification post-fix** :
- `service_role` garde 119 grants (7 privs × 17 tables) — utilisé par
  `lib/supabase/storage.ts` pour les futurs buckets
- `postgres` role intact — utilisé via POSTGRES_URL par Drizzle ORM
- anon : 0 grants
- authenticated : 0 grants
- `get_advisors security` : 0 ERROR, INFO "rls_enabled_no_policy" only

**Impact app** : zéro. Soleo connecte à la DB via POSTGRES_URL avec le
rôle `postgres` (full superuser-équivalent) qui n'est jamais affecté par
les GRANTs anon/authenticated.

**Rollback (jamais nécessaire en pratique)** :
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
```

### Bug 4 — Réponses participants jamais sauvegardées

**Symptôme** : participants remplissent les questions sans erreur visible,
mais le dashboard affiche zéro réponse. `block_responses` vide alors que
`participant_sessions` a 2 lignes.

**Cause** : `lib/repositories/participant-sessions.ts:upsertBlockResponse`
fait `INSERT ... ON CONFLICT (participant_session_id, block_id) DO UPDATE`,
qui nécessite une UNIQUE constraint sur ces 2 colonnes. La contrainte
existait en prod (appliquée ad-hoc via psql) mais ne figure ni dans
schema.ts ni dans les fichiers de migration. Même problème sur
`block_response_tags.unique(response_id, tag_id)`.

Postgres logs : "there is no unique or exclusion constraint matching the
ON CONFLICT specification".

**Fix** : migration 0010 — ajout des 2 UNIQUE constraints manquantes.

**Fix permanent suggéré** : ajouter `.unique()` au niveau Drizzle dans
schema.ts (ligne ~284 pour block_responses, ligne ~361 pour
block_response_tags). Sinon le drift se reproduira au prochain reset.

### Bug 2 — Utilisateur orphelin sans team

**Symptôme** : après signup, l'user était créé mais "Mes workspaces"
vide, impossible de créer un projet.

**Cause** : pendant la fenêtre où les colonnes Figma manquaient, le flow
signup a inséré le user (succès), puis a planté sur l'insert team
(missing columns), laissant l'user sans team_member associé. Le flow
n'a pas de transaction enveloppante.

**Fix manuel** : SQL direct
```sql
WITH new_team AS (INSERT INTO teams (name) VALUES (...) RETURNING id)
INSERT INTO team_members (user_id, team_id, role) SELECT 1, id, 'owner' FROM new_team;
```

**Fix permanent suggéré (Polish story future)** : envelopper le signup
flow dans une transaction Postgres (`db.transaction(...)`) pour qu'un
échec en milieu de chaîne rollback l'user créé. Empêche les orphelins.

### Bug 3 — `drizzle-kit push` crashe

**Symptôme** : `TypeError: Cannot read properties of undefined (reading 'replace')`
dans `drizzle-kit@0.31.1/bin.cjs:19501`.

**Cause** : bug de drizzle-kit sur la diff de CHECK constraints absents.

**Workaround** : migrations manuelles via Supabase MCP. Pas de fix
upstream connu.

**Action suggérée** : tester upgrade `drizzle-kit` (>= 0.32 ?) dans une
story Polish.

## 7. Dette technique à résorber (stories à créer)

### Story Polish — Régénérer un set de migrations Drizzle propre

État actuel : les fichiers `lib/db/migrations/0000..0005` ne reflètent
pas le schéma réel. Si un dev refait `pnpm db:migrate` sur une base
vierge, ça échouera (0005 référence des tables qui n'existent pas dans
les autres files).

Options :
- (a) **Snapshot reset** : supprimer tout `lib/db/migrations/`, regénérer
  un seul fichier `0000_baseline.sql` qui matche schema.ts exactement
  (via export du nouveau projet Supabase ou écriture manuelle)
- (b) **Catch-up migrations** : créer les fichiers SQL manquants
  (0006_drop_pages.sql, 0007_full_schema.sql, 0008_rls.sql,
  0009_figma_cols.sql) basés sur ce qu'on a appliqué via MCP

Recommandation : (a). Plus propre, et tant qu'on a pas de prod live avec
des données précieuses, c'est sans risque.

### Story Polish — Wrap signup flow in DB transaction

Le bug 2 ne devrait pas être possible. Solution :

```ts
// app/(login)/actions.ts
const result = await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values(...).returning();
  const [team] = await tx.insert(teams).values(...).returning();
  await tx.insert(teamMembers).values({ userId: user.id, teamId: team.id, ... });
  return { user, team };
});
```

Tout ou rien. Plus d'orphelin possible.

### Story Polish — Upgrade drizzle-kit (workaround bug push)

Vérifier si une version récente fix le bug + tester `db:push` une fois
le schéma synchro.

### Story Polish — Reset password DB Supabase

Le password actuel a circulé en clair. À reset par Louis dès qu'il
ouvre les variables (déjà sur sa todo).

## 8. Action items immédiats (Louis, hors session)

- [ ] Reset password DB Supabase → mettre à jour POSTGRES_URL sur Vercel + .env.local
- [ ] Tester création de projet sur soleo-sandy.vercel.app
- [ ] Tester création de session
- [ ] Vérifier `git log --all -- .env.local` ne retourne rien (jamais commit)
- [ ] Promouvoir en production si test OK (`npx vercel deploy --prod`)

## 9. Action items session future

- [ ] Créer 3 stories Polish (drift cleanup, transaction signup, drizzle-kit upgrade)
- [ ] Continuer l'audit EU (migration OpenAI → Mistral, Resend → Brevo, ajout région Vercel cdg1)
- [ ] Setup Pattern A staging/prod (domaine custom, env per-branch)
- [ ] Audit composants Figma Obra (passe design)

---

*Trace générée par Claude lors de la session 2026-05-21.*
