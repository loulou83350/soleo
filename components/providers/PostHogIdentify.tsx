'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

interface Props {
  user: {
    id: number;
    email: string | null;
    teamId?: number | null;
  } | null;
}

/**
 * Calls posthog.identify(...) when a server-side authenticated user is
 * known. Calls posthog.reset() when the user logs out (the prop becomes
 * null between renders).
 */
export function PostHogIdentify({ user }: Props) {
  useEffect(() => {
    if (!user) {
      // Only reset if we previously identified — cheap to call repeatedly
      if (posthog.get_distinct_id() && !posthog.get_distinct_id()?.startsWith('phc_')) {
        posthog.reset();
      }
      return;
    }
    posthog.identify(String(user.id), {
      email: user.email,
      team_id: user.teamId ?? null,
    });
  }, [user]);

  return null;
}
