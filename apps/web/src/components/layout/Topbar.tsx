'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useSession } from '@/components/layout/SessionProvider';

export function Topbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [now, setNow] = useState(() => new Date().toISOString());
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Session is cleared client-side regardless of API reachability.
    }
    router.replace('/login');
  }

  return (
    <header className="flex min-h-12 items-center justify-between gap-4 border-b border-line bg-panel px-4">
      <div className="min-w-0 py-2">
        <h1 className="truncate text-sm font-semibold tracking-tight text-bright">{title}</h1>
        <p className="truncate text-2xs text-muted">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <span className="hidden items-center gap-1.5 border border-status-healthy/30 bg-status-healthy/10 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.12em] text-status-healthy sm:inline-flex">
          <span className="live-dot size-1.5 bg-status-healthy" />
          Live
        </span>
        <span className="hidden border border-line px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.12em] text-muted md:inline">
          Prod
        </span>
        <time
          dateTime={now}
          className="hidden font-mono text-2xs tabular-nums text-muted lg:inline"
          title="Operator local time"
        >
          {formatDateTime(now)}
        </time>
        {user ? (
          <span
            className="hidden max-w-[180px] truncate font-mono text-2xs text-muted xl:inline"
            title={user.email}
          >
            {user.role} · {user.name}
          </span>
        ) : null}
        <button
          type="button"
          className="ops-btn-ghost"
          disabled={signingOut}
          onClick={() => void signOut()}
        >
          {signingOut ? 'Signing out' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}
