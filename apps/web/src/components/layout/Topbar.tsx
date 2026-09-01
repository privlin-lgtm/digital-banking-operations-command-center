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
    <header className="flex h-10 shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate text-xs font-medium text-bright">{title}</h1>
        <span className="hidden truncate text-2xs text-muted lg:inline">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <div className="hidden items-center gap-2 font-mono text-2xs tabular-nums text-muted md:flex">
          <span className="inline-flex items-center gap-1 text-status-healthy">
            <span className="size-1.5 bg-status-healthy" />
            LIVE
          </span>
          <span className="text-line-strong">|</span>
          <span>PROD</span>
          <span className="text-line-strong">|</span>
          <time dateTime={now}>{formatDateTime(now)}</time>
          {user ? (
            <>
              <span className="text-line-strong">|</span>
              <span className="max-w-[160px] truncate" title={user.email}>
                {user.role} · {user.name}
              </span>
            </>
          ) : null}
        </div>
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
