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
    <div className="border border-status-critical/30 bg-status-critical/5 px-4 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.16em] text-status-critical">
            Error
          </p>
          <h3 className="mt-1 text-sm font-medium text-bright">{title}</h3>
          <p className="mt-1 text-xs text-muted">{message}</p>
        </div>
        {onRetry ? (
          <button type="button" className="ops-btn-ghost" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-line pt-3 font-mono text-2xs text-muted sm:grid-cols-3">
        <div>
          <dt className="uppercase tracking-[0.12em]">Code</dt>
          <dd className="mt-0.5 text-ink">{code}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em]">HTTP</dt>
          <dd className="mt-0.5 text-ink">{status}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.12em]">Action</dt>
          <dd className="mt-0.5 text-ink">Check API health / session</dd>
        </div>
      </dl>
    </div>
  );
}
