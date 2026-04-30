export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { getSessionByToken } from '@/lib/repositories/sessions';
import { SessionClient } from './SessionClient';

interface ParticipantPageProps {
  params: Promise<{ token: string }>;
}

/**
 * Public participant page — no authentication required.
 * Accessible at /s/[token].
 */
export default async function ParticipantPage({ params }: ParticipantPageProps) {
  const { token } = await params;
  const session = await getSessionByToken(token);

  if (!session || session.status !== 'published') {
    notFound();
  }

  return (
    <SessionClient
      sessionToken={token}
      session={session}
      gateConfig={{
        passwordRequired: !!session.passwordHash,
        deviceRestriction: session.deviceRestriction ?? 'any',
        gdprEnabled: session.gdprEnabled ?? false,
        gdprMessage: session.gdprMessage ?? undefined,
      }}
    />
  );
}

export async function generateMetadata({ params }: ParticipantPageProps) {
  const { token } = await params;
  const session = await getSessionByToken(token);
  if (!session) return { title: 'Session introuvable' };
  return { title: session.title };
}
