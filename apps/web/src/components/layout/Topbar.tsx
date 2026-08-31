export function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex items-center justify-between border-b border-line px-8 py-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-line bg-canvas px-3 py-1 font-mono text-xs text-accent">
          LIVE
        </span>
        <span className="text-sm text-muted">Operations desk</span>
      </div>
    </header>
  );
}
