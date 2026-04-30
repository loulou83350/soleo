import Link from 'next/link';
import type { ParticipantSummary } from '@/lib/repositories/participant-sessions';
import { formatDuration, formatRelativeDate } from '@/lib/utils';

interface ParticipantTableProps {
  rows: ParticipantSummary[];
  projectId: number;
  sessionId: number;
}

export function ParticipantTable({ rows, projectId, sessionId }: ParticipantTableProps) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
            <th className="px-4 py-2.5 w-12">#</th>
            <th className="px-4 py-2.5">Statut</th>
            <th className="px-4 py-2.5">Démarré</th>
            <th className="px-4 py-2.5 text-right">Durée</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, idx) => {
            const isCompleted = row.status === 'completed';
            return (
              <tr
                key={row.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/projects/${projectId}/sessions/${sessionId}/participants/${row.participantToken}`}
                    className="text-muted-foreground hover:text-foreground tabular-nums"
                  >
                    {rows.length - idx}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                      isCompleted
                        ? 'bg-success/15 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? 'Complété' : 'En cours'}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatRelativeDate(row.startedAt)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                  {formatDuration(row.durationSec)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
