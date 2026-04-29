/**
 * Types et interfaces métier de Soleo.
 * Ce fichier ne contient que des types — aucune logique.
 */

// ─── Résultat d'une Server Action ──────────────────────────────────────────
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Résultat de publication d'une session ──────────────────────────────────
export type ValidationIssue = {
  pageTitle: string;
  blockLabel: string;
  issue: string;
};

export type PublishResult =
  | { ok: true; token: string; url: string }
  | { ok: false; error: string }
  | { ok: false; validationIssues: ValidationIssue[] };

// ─── Rôles utilisateurs ────────────────────────────────────────────────────
export type UserRole = 'admin' | 'member' | 'viewer';

// ─── Statuts de session ────────────────────────────────────────────────────
export type SessionStatus = 'draft' | 'published' | 'archived';

// ─── Types de blocs ────────────────────────────────────────────────────────
export type SurveyBlockType =
  | 'mcq'
  | 'likert'
  | 'open_text'
  | 'rating'
  | 'nps'
  | 'ranking'
  | 'matrix';

export type BlockType = SurveyBlockType | 'prototype_task' | 'intro' | 'end';

// ─── Tags d'insights ───────────────────────────────────────────────────────
export type InsightTag =
  | 'pain_point'
  | 'feature_request'
  | 'positive_signal'
  | 'off_the_record';

// ─── Restriction de device ─────────────────────────────────────────────────
export type DeviceRestriction = 'any' | 'desktop_only' | 'mobile_only';

// ─── Logique conditionnelle des blocs ─────────────────────────────────────
/**
 * Opérateurs supportés :
 *   answered        — le participant a répondu à ce bloc (toute valeur)
 *   not_answered    — le participant n'a pas encore répondu
 *   eq              — la réponse est exactement `value`
 *   neq             — la réponse est différente de `value`
 */
export type ConditionOperator = 'answered' | 'not_answered' | 'eq' | 'neq';

export type BlockCondition = {
  sourceBlockId: number;    // ID du bloc source dont on lit la réponse
  operator: ConditionOperator;
  value?: string;           // Valeur de comparaison (ignorée pour answered/not_answered)
};

/**
 * Règle de visibilité d'un bloc.
 * null = toujours affiché (pas de condition).
 */
export type BlockVisibilityRule = {
  match: 'all' | 'any';    // AND / OR entre les conditions
  conditions: BlockCondition[];
} | null;
