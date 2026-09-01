export function EmptyState({
  title,
  description,
  hint,
}: {
  title: string;
  description: string;
  hint?: string;
}) {
  return (
    <div className="flex min-h-[160px] flex-col justify-center bg-panel px-4 py-8">
      <p className="font-mono text-3xs uppercase tracking-[0.08em] text-muted">Empty</p>
      <h3 className="mt-1 text-xs font-medium text-bright">{title}</h3>
      <p className="mt-1 max-w-lg text-2xs leading-4 text-muted">{description}</p>
      {hint ? <p className="mt-2 font-mono text-3xs text-muted">{hint}</p> : null}
    </div>
  );
}
