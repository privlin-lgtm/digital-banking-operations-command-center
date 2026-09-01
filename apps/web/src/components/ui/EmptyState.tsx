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
    <div className="flex min-h-[220px] flex-col items-center justify-center border border-dashed border-line bg-panel px-6 py-12 text-center">
      <p className="font-mono text-2xs uppercase tracking-[0.16em] text-muted">No data</p>
      <h3 className="mt-2 text-sm font-medium text-bright">{title}</h3>
      <p className="mt-1.5 max-w-md text-xs leading-5 text-muted">{description}</p>
      {hint ? <p className="mt-3 font-mono text-2xs text-muted/80">{hint}</p> : null}
    </div>
  );
}
