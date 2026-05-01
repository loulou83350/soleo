import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  figmaAccessToken: text('figma_access_token'),
  figmaRefreshToken: text('figma_refresh_token'),
  figmaTokenExpiresAt: timestamp('figma_token_expires_at'),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

// ─── Projets Soleo ─────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id),
  title: varchar('title', { length: 200 }).notNull().default('Nouvelle session'),
  // 'draft' | 'published' | 'archived'
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  // CUID2 token for the public participant URL (/s/[token]) — null until published
  sessionToken: varchar('session_token', { length: 128 }).unique(),
  // ─── Gate configuration (Story 3.5) ───────────────────────────────────────
  // Password gate: bcrypt hash, null = no password required
  passwordHash: text('password_hash'),
  // Device restriction: 'any' | 'desktop' | 'mobile'
  deviceRestriction: varchar('device_restriction', { length: 20 }).notNull().default('any'),
  // GDPR consent: if true, participant must accept before proceeding
  gdprEnabled: boolean('gdpr_enabled').notNull().default(false),
  gdprMessage: text('gdpr_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Session Blocks ─────────────────────────────────────────────────────────
// Flat model: each block is one participant screen. No intermediate pages table.
// Special block types: 'welcome' (always pos 1) and 'thank_you' (always last).

export const sessionBlocks = pgTable('session_blocks', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  // 'welcome' | 'thank_you' | 'content' | 'short_text' | 'long_text' | 'mcq' |
  // 'likert' | 'rating' | 'nps' | 'card_sort' | 'matrix' | 'first_impression' | 'prototype_task'
  blockType: varchar('block_type', { length: 30 }).notNull(),
  config: jsonb('config').notNull().default({}),
  required: boolean('required').notNull().default(false),
  conditions: jsonb('conditions').default(null),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Session Relations ──────────────────────────────────────────────────────

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  team: one(teams, { fields: [sessions.teamId], references: [teams.id] }),
  project: one(projects, { fields: [sessions.projectId], references: [projects.id] }),
  blocks: many(sessionBlocks),
}));

export const sessionBlocksRelations = relations(sessionBlocks, ({ one }) => ({
  session: one(sessions, { fields: [sessionBlocks.sessionId], references: [sessions.id] }),
}));

// ─── Session Types ──────────────────────────────────────────────────────────

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionBlock = typeof sessionBlocks.$inferSelect;
export type NewSessionBlock = typeof sessionBlocks.$inferInsert;

export type SessionStatus = 'draft' | 'published' | 'archived';

export type BlockType =
  | 'welcome'
  | 'content'
  | 'short_text'
  | 'long_text'
  | 'mcq'
  | 'likert'
  | 'rating'
  | 'nps'
  | 'card_sort'
  | 'matrix'
  | 'first_impression'
  | 'prototype_task'
  | 'thank_you';

export type BlockConfig = Record<string, unknown>;

export type SessionWithBlocks = Session & {
  blocks: SessionBlock[];
};

// ─── Participant Sessions ────────────────────────────────────────────────────

export const participantSessions = pgTable('participant_sessions', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  participantToken: varchar('participant_token', { length: 64 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('in_progress'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// ─── Block Responses ─────────────────────────────────────────────────────────

export const blockResponses = pgTable('block_responses', {
  id: serial('id').primaryKey(),
  participantSessionId: integer('participant_session_id')
    .notNull()
    .references(() => participantSessions.id, { onDelete: 'cascade' }),
  blockId: integer('block_id')
    .notNull()
    .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
  value: jsonb('value'),
  answeredAt: timestamp('answered_at').notNull().defaultNow(),
});

// ─── Consent Records ─────────────────────────────────────────────────────────
// Immutable record created when a participant accepts GDPR consent.

export const consentRecords = pgTable('consent_records', {
  id: serial('id').primaryKey(),
  participantSessionId: integer('participant_session_id')
    .notNull()
    .references(() => participantSessions.id, { onDelete: 'cascade' }),
  consentedAt: timestamp('consented_at').notNull().defaultNow(),
  ipHash: text('ip_hash'),
});

// ─── Participant Relations ───────────────────────────────────────────────────

export const participantSessionsRelations = relations(participantSessions, ({ one, many }) => ({
  session: one(sessions, { fields: [participantSessions.sessionId], references: [sessions.id] }),
  responses: many(blockResponses),
  consentRecords: many(consentRecords),
}));

export const blockResponsesRelations = relations(blockResponses, ({ one }) => ({
  participantSession: one(participantSessions, {
    fields: [blockResponses.participantSessionId],
    references: [participantSessions.id],
  }),
  block: one(sessionBlocks, {
    fields: [blockResponses.blockId],
    references: [sessionBlocks.id],
  }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  participantSession: one(participantSessions, {
    fields: [consentRecords.participantSessionId],
    references: [participantSessions.id],
  }),
}));

// ─── Participant Types ───────────────────────────────────────────────────────

export type ParticipantSession = typeof participantSessions.$inferSelect;
export type NewParticipantSession = typeof participantSessions.$inferInsert;
export type BlockResponse = typeof blockResponses.$inferSelect;
export type NewBlockResponse = typeof blockResponses.$inferInsert;
export type ConsentRecord = typeof consentRecords.$inferSelect;
export type NewConsentRecord = typeof consentRecords.$inferInsert;

// ─── Insight Tags (Story 5.3) ────────────────────────────────────────────────

export const insightTags = pgTable('insight_tags', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 100 }).notNull(),
  // Token color name from a curated palette: gray, red, orange, yellow,
  // green, teal, blue, indigo, purple, pink. Mapped to Tailwind classes
  // in the chip component.
  color: varchar('color', { length: 20 }).notNull().default('gray'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const blockResponseTags = pgTable('block_response_tags', {
  id: serial('id').primaryKey(),
  responseId: integer('response_id')
    .notNull()
    .references(() => blockResponses.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id')
    .notNull()
    .references(() => insightTags.id, { onDelete: 'cascade' }),
  // 'manual' = researcher attached, 'ai_auto' = added on response save,
  // 'ai_suggested' = AI suggestion accepted by researcher
  source: varchar('source', { length: 20 }).notNull().default('manual'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const insightTagsRelations = relations(insightTags, ({ one, many }) => ({
  team: one(teams, { fields: [insightTags.teamId], references: [teams.id] }),
  responseTags: many(blockResponseTags),
}));

export const blockResponseTagsRelations = relations(blockResponseTags, ({ one }) => ({
  response: one(blockResponses, {
    fields: [blockResponseTags.responseId],
    references: [blockResponses.id],
  }),
  tag: one(insightTags, {
    fields: [blockResponseTags.tagId],
    references: [insightTags.id],
  }),
}));

export type InsightTag = typeof insightTags.$inferSelect;
export type NewInsightTag = typeof insightTags.$inferInsert;
export type BlockResponseTag = typeof blockResponseTags.$inferSelect;
export type NewBlockResponseTag = typeof blockResponseTags.$inferInsert;
export type TagSource = 'manual' | 'ai_auto' | 'ai_suggested';

// ─── Session Findings (Story 6.1) ────────────────────────────────────────────

export const sessionFindings = pgTable('session_findings', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .unique()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull().default(''),
  // Markdown with inline citation tokens like {r:42} pointing to block_responses.id
  bodyMarkdown: text('body_markdown').notNull().default(''),
  aiGenerated: boolean('ai_generated').notNull().default(false),
  isPublished: boolean('is_published').notNull().default(false),
  publicToken: varchar('public_token', { length: 128 }).unique(),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessionFindingsRelations = relations(sessionFindings, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionFindings.sessionId],
    references: [sessions.id],
  }),
}));

export type SessionFinding = typeof sessionFindings.$inferSelect;
export type NewSessionFinding = typeof sessionFindings.$inferInsert;

// ─── Finding Highlights (Story 6.2) ──────────────────────────────────────────

export const findingHighlights = pgTable('finding_highlights', {
  id: serial('id').primaryKey(),
  findingId: integer('finding_id')
    .notNull()
    .references(() => sessionFindings.id, { onDelete: 'cascade' }),
  responseId: integer('response_id')
    .notNull()
    .references(() => blockResponses.id, { onDelete: 'cascade' }),
  /** Researcher's optional comment on this highlight (e.g. why it matters) */
  customNote: text('custom_note'),
  /** Display order, lower = top */
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const findingHighlightsRelations = relations(findingHighlights, ({ one }) => ({
  finding: one(sessionFindings, {
    fields: [findingHighlights.findingId],
    references: [sessionFindings.id],
  }),
  response: one(blockResponses, {
    fields: [findingHighlights.responseId],
    references: [blockResponses.id],
  }),
}));

export type FindingHighlight = typeof findingHighlights.$inferSelect;
export type NewFindingHighlight = typeof findingHighlights.$inferInsert;

// ─── AI Usage Logs (cost + token tracking) ───────────────────────────────────
//
// Logged after every successful or failed AI provider call. Cost is stored
// in micro-USD (1 USD = 1_000_000 micros) to avoid floating-point math.
// Aggregations query by (teamId, createdAt) — see lib/repositories/ai-usage.ts.

export const aiUsageLogs = pgTable('ai_usage_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id').references(() => teams.id, {
    onDelete: 'cascade',
  }),
  userId: integer('user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  /** Soleo feature: 'tag_suggest' | 'findings_generate' | 'auto_tag' */
  feature: varchar('feature', { length: 32 }).notNull(),
  /** Provider name: 'anthropic' | 'gemini' | 'openai' */
  provider: varchar('provider', { length: 16 }).notNull(),
  /** Concrete model used, e.g. 'claude-haiku-4-5' */
  model: varchar('model', { length: 64 }).notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  /** Cost in micro-USD (integer): 1_000_000 = 1 USD */
  costUsdMicros: integer('cost_usd_micros').notNull().default(0),
  /** 'ok' | 'error' */
  status: varchar('status', { length: 16 }).notNull().default('ok'),
  errorMessage: text('error_message'),
  /** Optional: which session this call was for (debug / per-session aggregations) */
  sessionId: integer('session_id'),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const aiUsageLogsRelations = relations(aiUsageLogs, ({ one }) => ({
  team: one(teams, {
    fields: [aiUsageLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [aiUsageLogs.userId],
    references: [users.id],
  }),
}));

export type AIUsageLog = typeof aiUsageLogs.$inferSelect;
export type NewAIUsageLog = typeof aiUsageLogs.$inferInsert;

// ─── AI Follow-up Turns (Epic 7 — AI Interviewer) ────────────────────────────
//
// Each row = one AI-generated follow-up question + its (optional) answer.
// Multiple rows per parent response when max_follow_up_turns > 1.

export const aiFollowupTurns = pgTable('ai_followup_turns', {
  id: serial('id').primaryKey(),
  /** The original short_text/long_text block that triggered the follow-up */
  blockId: integer('block_id')
    .notNull()
    .references(() => sessionBlocks.id, { onDelete: 'cascade' }),
  /** The original block_response we're deepening */
  parentResponseId: integer('parent_response_id')
    .notNull()
    .references(() => blockResponses.id, { onDelete: 'cascade' }),
  participantSessionId: integer('participant_session_id')
    .notNull()
    .references(() => participantSessions.id, { onDelete: 'cascade' }),
  /** 1 = first follow-up, 2 = second, etc. */
  turnNumber: integer('turn_number').notNull(),
  aiQuestion: text('ai_question').notNull(),
  /** null when status != 'answered' */
  participantAnswer: text('participant_answer'),
  /** 'answered' | 'skipped' | 'timeout' | 'error' */
  status: varchar('status', { length: 16 }).notNull().default('answered'),
  /** Provider/model that generated this turn (debug + audit) */
  provider: varchar('provider', { length: 16 }),
  model: varchar('model', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const aiFollowupTurnsRelations = relations(
  aiFollowupTurns,
  ({ one }) => ({
    block: one(sessionBlocks, {
      fields: [aiFollowupTurns.blockId],
      references: [sessionBlocks.id],
    }),
    parentResponse: one(blockResponses, {
      fields: [aiFollowupTurns.parentResponseId],
      references: [blockResponses.id],
    }),
    participantSession: one(participantSessions, {
      fields: [aiFollowupTurns.participantSessionId],
      references: [participantSessions.id],
    }),
  })
);

export type AIFollowupTurn = typeof aiFollowupTurns.$inferSelect;
export type NewAIFollowupTurn = typeof aiFollowupTurns.$inferInsert;
