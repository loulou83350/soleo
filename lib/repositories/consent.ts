import { db } from '@/lib/db/drizzle';
import { consentRecords } from '@/lib/db/schema';
import type { ConsentRecord } from '@/lib/db/schema';

/**
 * Records an immutable consent acceptance for a participant session.
 * Called when the participant clicks "Accept" on the GDPR consent screen.
 */
export async function recordConsent(
  participantSessionId: number,
  ipHash: string | null
): Promise<ConsentRecord> {
  const [row] = await db
    .insert(consentRecords)
    .values({ participantSessionId, ipHash })
    .returning();

  return row;
}
