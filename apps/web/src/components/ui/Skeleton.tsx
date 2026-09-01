import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function TableSkeleton({ rows = 10, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-line bg-panel">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="grid h-8 grid-cols-12 items-center gap-2 px-2.5">
          {Array.from({ length: cols }, (_, col) => (
            <Skeleton
              key={col}
              className={cn(
                'h-2',
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
    <div className="bg-panel px-3 py-2.5">
      <Skeleton className="h-2 w-16" />
      <Skeleton className="mt-2 h-5 w-12" />
      <Skeleton className="mt-2 h-2 w-24" />
    </div>
  );
}
