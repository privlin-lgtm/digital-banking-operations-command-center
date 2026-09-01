import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({
  title,
  actions,
  children,
  padded = false,
  className,
}: {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}) {
  return (
    <section className={cn('bg-panel', className)}>
      {title ? (
        <header className="flex h-8 items-center justify-between border-b border-line px-3">
          <h2 className="text-3xs font-medium uppercase tracking-[0.08em] text-muted">{title}</h2>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn(padded && 'p-3')}>{children}</div>
    </section>
  );
}
