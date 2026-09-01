import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import type { ApiError } from '@/lib/api';

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading,
  error,
  errorTitle,
  emptyTitle,
  emptyDescription,
  emptyHint,
  onRetry,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  loading: boolean;
  error: ApiError | Error | null;
  errorTitle: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyHint?: string;
  onRetry: () => void;
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
    <div className="overflow-x-auto border border-line">
      {error ? (
        <div className="border-b border-line">
          <ErrorState title={errorTitle} error={error} onRetry={onRetry} />
        </div>
      ) : null}
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className="sticky top-0 bg-raised">
          <tr className="border-b border-line">
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  'h-8 px-3 text-2xs font-medium uppercase tracking-[0.12em] text-muted',
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="h-9 border-b border-line last:border-b-0 hover:bg-raised/80"
            >
              {columns.map((column) => (
                <td key={column.key} className={cn('px-3 text-xs text-ink', column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
