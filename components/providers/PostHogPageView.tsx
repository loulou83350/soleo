'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { isPublicRoute } from './PostHogProvider';

/**
 * Manually capture $pageview on every Next.js App Router navigation.
 * The router doesn't fire window 'navigation' events that posthog-js
 * auto-listens to, so we hook into the path/search-param hooks.
 *
 * Public routes (/s/*, /findings/*) are dropped both here AND in the
 * provider's before_send — defense in depth.
 */
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    if (isPublicRoute(pathname)) return;
    posthog.capture('$pageview', {
      $pathname: pathname,
      $current_url:
        typeof window !== 'undefined' ? window.location.href : pathname,
    });
  }, [pathname, searchParams]);

  return null;
}
