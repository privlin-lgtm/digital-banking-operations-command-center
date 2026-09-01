import { cn } from '@/lib/utils';
import type { StatusTone } from '@/lib/status';

const BAR: Record<StatusTone, string> = {
  critical: 'bg-status-critical',
  high: 'bg-status-high',
  medium: 'bg-status-medium',
  low: 'bg-status-low',
  healthy: 'bg-status-healthy',
  degraded: 'bg-status-degraded',
  unknown: 'bg-status-unknown',
  info: 'bg-status-info',
  neutral: 'bg-line-strong',
};

export function MetricCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: StatusTone;
}) {
  return (
    <article className="relative border border-line bg-panel px-3 py-3">
      <span className={cn('absolute inset-y-0 left-0 w-0.5', BAR[tone])} />
      <p className="pl-1.5 text-2xs font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 pl-1.5 font-mono text-2xl font-medium tabular-nums leading-none text-bright">
        {value}
      </p>
      <p className="mt-2 pl-1.5 text-2xs text-muted">{hint}</p>
    </article>
  );
}
