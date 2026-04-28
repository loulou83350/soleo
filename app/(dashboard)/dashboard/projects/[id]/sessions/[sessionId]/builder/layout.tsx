/**
 * Builder layout — full viewport, no sidebar.
 * This layout is nested inside (dashboard)/layout.tsx (global header)
 * but sits OUTSIDE dashboard/layout.tsx (sidebar), so the sidebar is absent.
 *
 * Note: Next.js App Router allows overriding nested layout structure.
 * The builder gets the global auth header but manages its own full-screen UI.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
