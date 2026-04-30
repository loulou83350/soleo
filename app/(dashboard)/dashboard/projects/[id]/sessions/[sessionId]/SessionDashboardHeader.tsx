'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Download, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionDashboardHeaderProps {
  title: string;
  status: string;
  sessionToken: string | null;
  sessionId: number;
  projectId: number;
}

export function SessionDashboardHeader({
  title,
  status,
  sessionToken,
  sessionId,
  projectId,
}: SessionDashboardHeaderProps) {
  const [copied, setCopied] = useState(false);

  const statusLabel: Record<string, string> = {
    draft: 'Brouillon',
    published: 'Publiée',
    archived: 'Archivée',
  };

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const publicUrl = sessionToken ? `${baseUrl}/s/${sessionToken}` : null;

  async function handleCopy() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-xl font-semibold text-foreground truncate">{title}</h1>
          <span
            className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
              status === 'published'
                ? 'bg-success/15 text-success'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {statusLabel[status] ?? status}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            {/* Native browser download — no JS state, just a link */}
            <a
              href={`/dashboard/projects/${projectId}/sessions/${sessionId}/export`}
              download
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exporter CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/dashboard/projects/${projectId}/sessions/${sessionId}/builder`}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Builder
            </Link>
          </Button>
        </div>
      </div>

      {/* Public link */}
      {publicUrl && (
        <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-muted/30">
          <span className="text-xs text-muted-foreground shrink-0">Lien public :</span>
          <code className="text-xs text-foreground truncate flex-1 font-mono">
            {publicUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Copier le lien"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copié
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copier
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
