'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { Suspense, useEffect, type ReactNode } from 'react';
import { PostHogPageView } from './PostHogPageView';
import { PostHogIdentify } from './PostHogIdentify';

const PUBLIC_PATH_PREFIXES = ['/s/', '/findings/'];

/**
 * Returns true for any URL we never want to track:
 *  - /s/[token]   — public participant flow (anonymous, sensitive answers)
 *  - /findings/[token] — public report viewer (we don't track readers)
 */
export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

let initialized = false;

function ensureInit() {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    // Only build a person profile once we identify the user (avoids
    // creating anonymous profiles for every visitor)
    person_profiles: 'identified_only',
    // Manual page views — Next.js App Router doesn't fire navigation events
    // that posthog-js's auto-pageview can hook into reliably
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: {
      // Only autocapture clicks/changes inside /dashboard/*
      url_allowlist: [/\/dashboard/],
    },
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: 'input, textarea, [data-ph-mask]',
    },
    before_send: (event) => {
      const path =
        (event?.properties?.$pathname as string | undefined) ??
        (typeof window !== 'undefined' ? window.location.pathname : '');
      if (isPublicRoute(path)) return null; // hard-block any event from public routes
      return event;
    },
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') ph.debug(false);
    },
  });
  initialized = true;
}

interface Props {
  children: ReactNode;
  /** Server-rendered user props passed at mount (id, email, team_id…) */
  user?: {
    id: number;
    email: string | null;
    teamId?: number | null;
  } | null;
}

export function PostHogProvider({ children, user }: Props) {
  useEffect(() => {
    ensureInit();
  }, []);

  // Skip the entire wrapper if no key — keeps the app working without PostHog
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      <PostHogIdentify user={user ?? null} />
      {children}
    </PHProvider>
  );
}
