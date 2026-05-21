// @vitest-environment node
//
// Smoke test for the Next.js dashboard page. After the Supabase migration we
// added `export const dynamic = 'force-dynamic'` to bust the RSC payload cache
// that was serving stale project lists between client-side navigations. This
// test ensures the export stays in place — a stray refactor that removes it
// would silently reintroduce the navigation bug.

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('dashboard page (app/(dashboard)/dashboard/page.tsx)', () => {
  let source = '';

  // Read inside beforeAll so a missing file produces a clean failure rather
  // than a module-load crash that masks the cause.
  beforeAll(() => {
    source = readFileSync(resolve(__dirname, 'page.tsx'), 'utf-8');
  });

  it('exports `dynamic = "force-dynamic"` so RSC re-runs on every nav', () => {
    // Tolerant of formatting: single or double quotes, optional const.
    const pattern = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/;
    expect(source).toMatch(pattern);
  });

  it('still imports listProjectsAction (server-side data fetch)', () => {
    // Anchor on import statement to avoid matching mere comment mentions.
    const importPattern = /import\s+\{[^}]*\blistProjectsAction\b[^}]*\}\s+from/;
    expect(source).toMatch(importPattern);
  });
});
