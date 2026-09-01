import { cn } from '@/lib/utils';
import { fillClass, type StatusTone } from '@/lib/status';

export interface ChartSegment {
  label: string;
  value: number;
  tone: StatusTone;
}

export function StackedBar({
  segments,
  ariaLabel,
}: {
  segments: ChartSegment[];
  ariaLabel: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div>
      <div className="flex h-1.5 w-full bg-raised" role="img" aria-label={ariaLabel}>
        {total === 0 ? (
          <div className="h-full w-full bg-line" />
        ) : (
          segments.map((segment) =>
            segment.value <= 0 ? null : (
              <div
                key={segment.label}
                className={cn('h-full min-w-0', fillClass(segment.tone))}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ),
          )
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className="inline-flex items-center gap-1.5 font-mono text-2xs tabular-nums text-muted"
          >
            <span className={cn('size-1.5 shrink-0', fillClass(segment.tone))} />
            {segment.label}
            <span className="text-bright">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarList({ items }: { items: ChartSegment[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item.label}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_1.75rem] items-center gap-2"
        >
          <span className="truncate font-mono text-2xs uppercase tracking-[0.04em] text-muted">
            {item.label}
          </span>
          <div className="h-1.5 bg-raised">
            <div
              className={cn('h-full', fillClass(item.tone))}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-right font-mono text-2xs tabular-nums text-bright">
            {item.value}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BarGauge({
  actual,
  target,
  breached,
}: {
  actual: number;
  target: number;
  breached: boolean;
}) {
  const scale = Math.max(100, actual, target);
  const actualPct = Math.min(100, (actual / scale) * 100);
  const targetPct = Math.min(100, (target / scale) * 100);

  return (
    <div
      className="relative h-1.5 w-28 bg-raised"
      role="img"
      aria-label={`Actual ${actual.toFixed(3)} against target ${target.toFixed(3)}`}
      title={`Actual ${actual.toFixed(3)}% · target ${target.toFixed(3)}%`}
    >
      <div
        className={cn('h-full', breached ? 'bg-status-critical' : 'bg-status-healthy')}
        style={{ width: `${actualPct}%` }}
      />
      <span
        className="absolute top-[-2px] h-2.5 w-px bg-bright"
        style={{ left: `${targetPct}%` }}
      />
    </div>
  );
}
