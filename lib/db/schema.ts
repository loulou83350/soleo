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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Session Pages ──────────────────────────────────────────────────────────

export const sessionPages = pgTable('session_pages', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  // 'intro' | 'question' | 'end'
  pageType: varchar('page_type', { length: 20 }).notNull().default('question'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Session Blocks ─────────────────────────────────────────────────────────

export const sessionBlocks = pgTable('session_blocks', {
  id: serial('id').primaryKey(),
  sessionPageId: integer('session_page_id')
    .notNull()
    .references(() => sessionPages.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  // 'short_text' | 'long_text' | 'mcq' | 'likert' | 'rating' | 'nps' | 'card_sort' | 'matrix' | 'first_impression' | 'prototype_task'
  blockType: varchar('block_type', { length: 30 }).notNull(),
  config: jsonb('config').notNull().default({}),
  required: boolean('required').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// ─── Session Relations ──────────────────────────────────────────────────────

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  team: one(teams, { fields: [sessions.teamId], references: [teams.id] }),
  project: one(projects, { fields: [sessions.projectId], references: [projects.id] }),
  pages: many(sessionPages),
}));

export const sessionPagesRelations = relations(sessionPages, ({ one, many }) => ({
  session: one(sessions, { fields: [sessionPages.sessionId], references: [sessions.id] }),
  blocks: many(sessionBlocks),
}));

export const sessionBlocksRelations = relations(sessionBlocks, ({ one }) => ({
  page: one(sessionPages, { fields: [sessionBlocks.sessionPageId], references: [sessionPages.id] }),
}));

// ─── Session Types ──────────────────────────────────────────────────────────

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionPage = typeof sessionPages.$inferSelect;
export type NewSessionPage = typeof sessionPages.$inferInsert;
export type SessionBlock = typeof sessionBlocks.$inferSelect;
export type NewSessionBlock = typeof sessionBlocks.$inferInsert;

export type SessionStatus = 'draft' | 'published' | 'archived';
export type PageType = 'intro' | 'question' | 'end';
export type BlockType =
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
  | 'prototype_task';

export type BlockConfig = Record<string, unknown>;

export type SessionPageWithBlocks = SessionPage & {
  blocks: SessionBlock[];
};

export type SessionWithPages = Session & {
  pages: SessionPageWithBlocks[];
};
