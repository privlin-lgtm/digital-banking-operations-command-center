import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_420px]">
      <section className="hidden flex-col justify-between border-r border-line bg-panel px-10 py-8 lg:flex">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.22em] text-accent">
            BankOps · Control Center
          </p>
          <h1 className="mt-5 max-w-lg text-2xl font-semibold leading-snug tracking-tight text-bright">
            Operations desk for digital banking production
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            Incident command, alert triage, service health, runbooks, and SLA posture — one
            authenticated console, fully audit-logged.
          </p>
          <dl className="mt-8 grid max-w-md gap-px border border-line bg-line">
            <AuthMeta label="Environment" value="PROD" />
            <AuthMeta label="Access" value="Restricted" />
            <AuthMeta label="Session" value="Cookie · httpOnly" />
            <AuthMeta label="Audit" value="LOGIN / LOGOUT recorded" />
          </dl>
        </div>
        <p className="font-mono text-2xs text-muted">Unauthorized access is logged and reviewed.</p>
      </section>
      <section className="flex items-center justify-center bg-canvas px-6 py-12">
        {children}
      </section>
    </div>
  );
}

function AuthMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-panel px-3 py-2">
      <dt className="text-2xs uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="font-mono text-2xs text-ink">{value}</dd>
    </div>
  );
}
