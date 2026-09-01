'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import type { SessionUser } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';

interface SessionContextValue {
  user: SessionUser | null;
  refresh: () => void;
}

const SessionContext = createContext<SessionContextValue>({ user: null, refresh: () => undefined });

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void apiFetch<{ user: SessionUser }>('/auth/me')
      .then((body) => {
        if (!cancelled) {
          setUser(body.user);
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          router.replace('/login');
          return;
        }
        setUser(null);
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [router, tick, pathname]);

  const value = useMemo(
    () => ({
      user,
      refresh: () => setTick((current) => current + 1),
    }),
    [user],
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen">
        <aside className="w-56 shrink-0 border-r border-line bg-panel" />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 items-center border-b border-line px-4">
            <Skeleton className="h-3 w-40" />
          </header>
          <div className="grid gap-2 p-4 md:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </div>
    );
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
