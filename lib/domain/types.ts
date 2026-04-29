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
