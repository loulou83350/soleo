import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
}

export function MetricCard({ label, value, subtitle, icon }: MetricCardProps) {
  return (
    <div className="border border-border rounded-lg p-5 bg-background">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
