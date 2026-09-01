import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import type { ApiError } from '@/lib/api';
import { accentBorderClass, type StatusTone } from '@/lib/status';

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  align?: 'left' | 'right';
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  getRowAccent,
  loading,
  error,
  errorTitle,
  emptyTitle,
  emptyDescription,
  emptyHint,
  onRetry,
  frameless = false,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowAccent?: (row: T) => StatusTone | undefined;
  loading: boolean;
  error: ApiError | Error | null;
  errorTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyHint?: string;
  onRetry: () => void;
  frameless?: boolean;
}) {
  if (loading && rows.length === 0) {
    return <TableSkeleton cols={Math.min(columns.length, 6)} />;
  }

  if (error && rows.length === 0) {
    return <ErrorState title={errorTitle} error={error} onRetry={onRetry} />;
  }

  if (!loading && rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} hint={emptyHint} />;
  }

  return (
    <div className={cn('overflow-x-auto', !frameless && 'border border-line')}>
      {error ? (
        <div className="border-b border-line">
          <ErrorState title={errorTitle} error={error} onRetry={onRetry} />
        </div>
      ) : null}
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-raised">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'h-7 px-2.5 text-3xs font-medium uppercase tracking-[0.08em] text-muted',
                  column.align === 'right' && 'text-right',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const accent = getRowAccent?.(row);
            return (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'h-8 border-b border-line border-l-2 last:border-b-0 hover:bg-raised/70',
                  accent ? accentBorderClass(accent) : 'border-l-transparent',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-2.5 text-xs leading-4 text-ink',
                      column.align === 'right' && 'text-right',
                      column.className,
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
