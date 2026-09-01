import { cn } from '@/lib/utils';
import { swatchClass, toneClass, type StatusVisual } from '@/lib/status';

export function StatusBadge({ tone, label }: StatusVisual) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.04em]',
        toneClass(tone),
      )}
    >
      <span className={cn('size-1.5 shrink-0', swatchClass(tone))} />
      {label}
    </span>
  );
}
