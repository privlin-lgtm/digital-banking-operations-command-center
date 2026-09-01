import { cn } from '@/lib/utils';
import { dotClass, toneClass, type StatusVisual } from '@/lib/status';

export function StatusBadge({ tone, label, pulse }: StatusVisual) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 border px-1.5 font-mono text-2xs font-medium uppercase tracking-[0.06em]',
        toneClass(tone),
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0',
          dotClass(tone),
          pulse && (tone === 'critical' ? 'fire-dot' : 'live-dot'),
        )}
      />
      {label}
    </span>
  );
}
