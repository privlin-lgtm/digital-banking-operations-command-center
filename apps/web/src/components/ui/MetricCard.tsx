import { cn } from '@/lib/utils';
import { toneClass, type StatusTone } from '@/lib/status';

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
    <article className="bg-panel px-3 py-2.5">
      <p className="text-3xs font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <p
        className={cn(
          'mt-1.5 font-mono text-xl font-medium tabular-nums leading-none',
          tone === 'neutral' ? 'text-bright' : toneClass(tone),
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-2xs text-muted">{hint}</p>
    </article>
  );
}
