// Pure formatting helpers — safe to import from client OR server.
// Keep this file free of DB imports so it can be used in client components
// (the rest of lib/ai/usage.ts pulls in postgres / drizzle and is server-only).

export function formatUsd(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}
