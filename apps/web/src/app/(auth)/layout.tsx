import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_400px]">
      <section className="hidden flex-col justify-between border-r border-line bg-panel px-8 py-6 lg:flex">
        <div>
          <p className="font-mono text-3xs uppercase tracking-[0.12em] text-muted">
            BankOps · Control Center
          </p>
          <h1 className="mt-4 max-w-lg text-xl font-medium leading-snug text-bright">
            Production operations desk
          </h1>
          <p className="mt-2 max-w-md text-xs leading-5 text-muted">
            Incident command, alert triage, service health, runbooks, and SLA — authenticated and
            audit-logged.
          </p>
          <dl className="mt-6 max-w-sm border border-line">
            <AuthMeta label="Environment" value="PROD" />
            <AuthMeta label="Access" value="Restricted" />
            <AuthMeta label="Session" value="httpOnly cookie" />
            <AuthMeta label="Audit" value="LOGIN / LOGOUT" />
          </dl>
        </div>
        <p className="font-mono text-3xs text-muted">Unauthorized access is logged.</p>
      </section>
      <section className="flex items-center justify-center bg-canvas px-6 py-10">
        {children}
      </section>
    </div>
  );
}

function AuthMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-3 py-1.5 last:border-b-0">
      <dt className="text-3xs uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="font-mono text-2xs text-ink">{value}</dd>
    </div>
  );
}
