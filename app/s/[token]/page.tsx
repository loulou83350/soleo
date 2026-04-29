import { notFound } from 'next/navigation';
import { getSessionByToken } from '@/lib/repositories/sessions';

interface ParticipantPageProps {
  params: Promise<{ token: string }>;
}

/**
 * Public participant page — no authentication required.
 * Accessible at /s/[token].
 *
 * Full participant flow (consent screen, question blocks, completion)
 * will be implemented in Story 4.x.
 * This page acts as the public entry point and confirms the token is valid.
 */
export default async function ParticipantPage({ params }: ParticipantPageProps) {
  const { token } = await params;
  const session = await getSessionByToken(token);

  if (!session) {
    notFound();
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">{session.title}</h1>
        <p className="text-muted-foreground text-sm">
          La session de recherche est prête. Le flow complet sera disponible dans une prochaine version.
        </p>
        <p className="text-xs text-muted-foreground/60 font-mono">{token}</p>
      </div>
    </div>
  );
}

export async function generateMetadata({ params }: ParticipantPageProps) {
  const { token } = await params;
  const session = await getSessionByToken(token);
  if (!session) return { title: 'Session introuvable' };
  return { title: session.title };
}
