import type {
  BlockSummary,
  TextSummary,
  McqSummary,
  ScaleSummary,
  NpsSummary,
  CardSortSummary,
  MatrixSummary,
  PrototypeTaskSummary,
} from '@/lib/analytics/summaries';
import { formatDuration, formatPercent } from '@/lib/utils';

interface Props {
  summary: BlockSummary | null;
}

export function BlockSummaryRenderer({ summary }: Props) {
  if (!summary) return null;
  if (summary.count === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">Aucune réponse</p>
    );
  }

  switch (summary.kind) {
    case 'text':              return <TextSummaryView s={summary} />;
    case 'mcq':               return <McqSummaryView s={summary} />;
    case 'scale':             return <ScaleSummaryView s={summary} />;
    case 'nps':               return <NpsSummaryView s={summary} />;
    case 'card_sort':         return <CardSortSummaryView s={summary} />;
    case 'matrix':            return <MatrixSummaryView s={summary} />;
    case 'first_impression':  return <FirstImpressionSummaryView count={summary.count} />;
    case 'prototype_task':    return <PrototypeTaskSummaryView s={summary} />;
  }
}

// ─── Reusable bar ────────────────────────────────────────────────────────────

function Bar({
  label,
  count,
  total,
  highlight = false,
}: {
  label: string;
  count: number;
  total: number;
  highlight?: boolean;
}) {
  const ratio = total === 0 ? 0 : count / total;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-foreground truncate">{label}</span>
        <span className="text-muted-foreground tabular-nums shrink-0">
          {count} · {formatPercent(ratio)}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${highlight ? 'bg-foreground' : 'bg-foreground/70'} rounded-full transition-all`}
          style={{ width: `${Math.max(ratio * 100, 1)}%` }}
        />
      </div>
    </div>
  );
}

// ─── Per-kind views ──────────────────────────────────────────────────────────

function TextSummaryView({ s }: { s: TextSummary }) {
  // Show up to 5 sample answers; collapsible for the rest
  const head = s.samples.slice(0, 5);
  const rest = s.samples.length - head.length;
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {head.map((txt, idx) => (
          <li
            key={idx}
            className="border-l-2 border-border pl-3 py-0.5 text-sm text-foreground whitespace-pre-wrap"
          >
            {txt}
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            + {rest} autre{rest > 1 ? 's' : ''} réponse{rest > 1 ? 's' : ''}
          </summary>
          <ul className="mt-2 space-y-2">
            {s.samples.slice(5).map((txt, idx) => (
              <li
                key={idx}
                className="border-l-2 border-border pl-3 py-0.5 text-sm text-foreground whitespace-pre-wrap"
              >
                {txt}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function McqSummaryView({ s }: { s: McqSummary }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {s.count} {s.count > 1 ? 'participants' : 'participant'}
      </p>
      <div className="space-y-2">
        {s.ranked.map(({ option, count }, idx) => (
          <Bar
            key={option}
            label={option}
            count={count}
            total={s.count}
            highlight={idx === 0}
          />
        ))}
      </div>
    </div>
  );
}

function ScaleSummaryView({ s }: { s: ScaleSummary }) {
  const scale = Array.from({ length: s.max - s.min + 1 }, (_, i) => i + s.min);
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-4 text-sm">
        <Stat label="Moyenne" value={s.average?.toFixed(2) ?? '—'} />
        <Stat label="Médiane" value={s.median?.toString() ?? '—'} />
        <Stat label="Réponses" value={s.count} />
      </div>
      <div className="space-y-1.5">
        {scale.map((n) => (
          <Bar
            key={n}
            label={String(n)}
            count={s.distribution[n] ?? 0}
            total={s.count}
          />
        ))}
      </div>
    </div>
  );
}

function NpsSummaryView({ s }: { s: NpsSummary }) {
  const scoreClass =
    s.score == null
      ? 'text-muted-foreground'
      : s.score >= 50
        ? 'text-success'
        : s.score >= 0
          ? 'text-foreground'
          : 'text-destructive';
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-6">
        <div>
          <p className="text-xs text-muted-foreground">Score NPS</p>
          <p className={`text-3xl font-semibold tabular-nums ${scoreClass}`}>
            {s.score ?? '—'}
          </p>
        </div>
        <div className="flex items-baseline gap-4 text-sm">
          <Stat label="Promoteurs" value={s.promoters} />
          <Stat label="Passifs" value={s.passives} />
          <Stat label="Détracteurs" value={s.detractors} />
        </div>
      </div>
      <div className="space-y-1">
        {Array.from({ length: 11 }, (_, n) => (
          <Bar
            key={n}
            label={String(n)}
            count={s.distribution[n] ?? 0}
            total={s.count}
          />
        ))}
      </div>
    </div>
  );
}

function CardSortSummaryView({ s }: { s: CardSortSummary }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Classement moyen sur {s.count} {s.count > 1 ? 'participants' : 'participant'}
      </p>
      <ol className="space-y-1.5">
        {s.ranked.map(({ label, averagePosition }, idx) => (
          <li
            key={label}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="text-foreground">
              <span className="text-muted-foreground tabular-nums mr-2">
                #{idx + 1}
              </span>
              {label}
            </span>
            <span className="text-muted-foreground tabular-nums text-xs">
              pos. moy. {averagePosition.toFixed(2)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MatrixSummaryView({ s }: { s: MatrixSummary }) {
  const rowLabels = Object.keys(s.perRow);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {s.count} {s.count > 1 ? 'participants' : 'participant'}
      </p>
      <div className="space-y-3">
        {rowLabels.map((row) => {
          const cols = s.perRow[row];
          const rowTotal = Object.values(cols).reduce((a, b) => a + b, 0);
          return (
            <div key={row} className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">{row}</p>
              {Object.entries(cols)
                .sort(([, a], [, b]) => b - a)
                .map(([col, count]) => (
                  <Bar
                    key={col}
                    label={col}
                    count={count}
                    total={rowTotal}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FirstImpressionSummaryView({ count }: { count: number }) {
  return (
    <p className="text-sm text-muted-foreground">
      {count} {count > 1 ? 'participants ont vu le stimulus' : 'participant a vu le stimulus'}
    </p>
  );
}

function PrototypeTaskSummaryView({ s }: { s: PrototypeTaskSummary }) {
  const completionRate = s.count === 0 ? 0 : s.completed / s.count;
  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-5 flex-wrap text-sm">
        <Stat label="Tentatives" value={s.count} />
        <Stat label="Complétées" value={`${s.completed} (${formatPercent(completionRate)})`} />
        <Stat label="Abandonnées" value={s.skipped} />
        {s.avgDurationSec != null && (
          <Stat label="Durée moy." value={formatDuration(s.avgDurationSec)} />
        )}
      </div>
      {(s.goalReached > 0 || s.manualCompletion > 0) && (
        <div className="flex items-baseline gap-4 text-xs text-muted-foreground">
          {s.goalReached > 0 && (
            <span>
              <span className="text-success font-medium">{s.goalReached}</span> ont atteint l&apos;objectif
            </span>
          )}
          {s.manualCompletion > 0 && (
            <span>
              <span className="text-blue-700 font-medium">{s.manualCompletion}</span> ont marqué terminé
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
