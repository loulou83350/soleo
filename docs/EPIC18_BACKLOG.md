# Epic 18 — Integrations (Innovations / Future) Backlog

**Statut Notion : Innovation** — pas dans le MVP roadmap. Pris quand la demande user surface post-launch.

Source de vérité : Notion → Epic 18 — Integrations (Status="Innovation"). BMAD doc : `_bmad-output/planning-artifacts/epics.md`.

| ID    | Titre                                                 | Priority | Statut          |
|-------|-------------------------------------------------------|----------|-----------------|
| 18.1  | Slack integration (notifications + share findings)    | High     | 💡 Innovation   |
| 18.2  | Notion export (findings → Notion page)                | Medium   | 💡 Innovation   |
| 18.3  | Zoom integration (synchronous moderated interviews)   | Low      | 💡 Innovation   |
| 18.4  | Public REST API + Webhooks (Zapier-friendly)          | Low      | 💡 Innovation   |

Innovation = parking lot. Ces stories sont visibles dans Notion avec un Status dédié "Innovation" (bleu) pour les distinguer du MVP backlog. On les active quand un user demande explicitement OU qu'on a un signal commercial fort.

---

## Story 18.1 — Slack integration

> As a Member with a team in Slack, I want Soleo to notify a configured channel when key events happen + allow sharing findings to Slack, so that my team stays in the loop without manual cross-posting.

### Acceptance Criteria

**Given** I configure a Slack workspace + channel in Settings → Integrations
**When** a session is published, a participant completes a session, or a finding is published
**Then** a Slack message is sent to the channel with a link to the relevant Soleo page

---

**Given** I click "Share to Slack" on a published finding
**When** I pick a channel
**Then** the finding's preview (title + first paragraph + link) is posted to Slack

### Implementation notes
- Slack OAuth app + Incoming Webhooks
- New table `team_integrations` (teamId, type, config jsonb, created_at)
- Events trigger : extend existing PostHog events (session_published, etc.) to also notify Slack

---

## Story 18.2 — Notion export

> As a Member who uses Notion for docs, I want a one-click export of a published finding to a Notion page, so that the finding lives natively in my team's knowledge base.

### Acceptance Criteria

**Given** I connect my Notion workspace via OAuth (Settings → Integrations)
**When** I click "Export to Notion" on a finding
**Then** I pick a parent page, and a new Notion page is created with the full finding content (citations remain as Notion mentions/blocks)

### Implementation notes
- Notion OAuth (public integration)
- Use Notion MCP-like API (`notion-create-pages`)
- Markdown → Notion blocks converter

---

## Story 18.3 — Zoom integration

> As a Member who wants to combine async Soleo studies with live interviews, I want to schedule a Zoom call from inside Soleo and link the recording to a participant's session, so that I keep all my research data in one place.

### Acceptance Criteria

**Given** I connect my Zoom account via OAuth
**When** I schedule a "Live interview" from a participant's profile
**Then** a Zoom meeting is created, link saved on the participant session, and recording (if enabled) is auto-attached to the finding

### Implementation notes
- Zoom OAuth + Marketplace app
- New block type? Or just a "Add live interview" button on existing participant?
- Recording fetched via Zoom API after the meeting

---

## Story 18.4 — Public REST API + Webhooks

> As a developer or power-user, I want a public REST API + webhook events, so that I can build Zapier integrations, custom dashboards, etc.

### Acceptance Criteria

**Given** I generate an API key in Settings
**When** I call `GET /api/v1/projects` with the key
**Then** I receive a JSON list of my projects, rate-limited per plan

---

**Given** I configure a webhook URL for `finding.published` event
**When** a finding is published
**Then** my webhook receives a POST with the finding payload (signed with HMAC)

### Implementation notes
- API key generation via Settings page
- Rate limiting via Upstash or Vercel KV
- Webhook signing via HMAC-SHA256
- OpenAPI spec auto-generated for clients
