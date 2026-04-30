'use client';

import posthog from 'posthog-js';

/**
 * Centralized client-side analytics helper. All custom event captures should
 * go through this function so we have a single place to add guards (opt-out,
 * env presence, error swallowing) and a typed event registry.
 *
 * NEVER pass PII (email, name, free-text answers) — only IDs and enums.
 */
export type AnalyticsEvent =
  | 'signup_completed'
  | 'project_created'
  | 'session_created'
  | 'session_published'
  | 'findings_ai_generated'
  | 'findings_published'
  | 'tag_created'
  | 'tag_attached';

export function track(
  event: AnalyticsEvent,
  props?: Record<string, unknown>
) {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  try {
    posthog.capture(event, props ?? {});
  } catch {
    // Never break a user flow because of analytics
  }
}
