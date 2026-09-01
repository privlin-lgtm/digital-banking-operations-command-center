import { ApiError } from '@/lib/api';

export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: ApiError | Error | null;
  onRetry?: () => void;
}) {
  const code = error instanceof ApiError ? error.code : 'REQUEST_FAILED';
  const status = error instanceof ApiError && error.status ? String(error.status) : '—';
  const message = error?.message ?? 'Request failed';

  return (
    <div className="border-l-2 border-status-critical bg-status-critical/5 px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-3xs uppercase tracking-[0.08em] text-status-critical">
            {code} · {status}
          </p>
          <h3 className="mt-0.5 text-xs font-medium text-bright">{title}</h3>
          <p className="mt-0.5 text-2xs text-muted">{message}</p>
        </div>
        {onRetry ? (
          <button type="button" className="ops-btn-ghost" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
