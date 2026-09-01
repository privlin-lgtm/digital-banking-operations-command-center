import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line border border-line bg-panel">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="grid h-9 grid-cols-12 items-center gap-3 px-3">
          {Array.from({ length: cols }, (_, col) => (
            <Skeleton
              key={col}
              className={cn(
                'h-2.5',
                col === 0 ? 'col-span-3' : 'col-span-2',
                col === cols - 1 && 'col-span-1',
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MetricSkeleton() {
  return (
    <div className="border border-line bg-panel px-3 py-3">
      <Skeleton className="h-2 w-20" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-2 h-2 w-28" />
    </div>
  );
}
