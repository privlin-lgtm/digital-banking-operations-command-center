import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between border-r border-line bg-panel px-12 py-12 lg:flex">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-accent">BankOps</p>
          <h1 className="mt-6 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Control Center for digital banking operations
          </h1>
          <p className="mt-4 max-w-md text-muted">
            Monitor alerts, investigate cases, and review payment activity from a single operations
            desk.
          </p>
        </div>
        <p className="font-mono text-xs text-muted">Restricted access · audit logged</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">{children}</section>
    </div>
  );
}
