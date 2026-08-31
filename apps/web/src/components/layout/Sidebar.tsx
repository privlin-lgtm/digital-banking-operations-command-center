'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/overview', label: 'Overview' },
  { href: '/alerts', label: 'Alerts' },
  { href: '/cases', label: 'Cases' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/customers', label: 'Customers' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-panel">
      <div className="border-b border-line px-5 py-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">BankOps</p>
        <p className="mt-1 text-lg font-semibold tracking-tight">Control Center</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-white/5 hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="border-t border-line px-5 py-4 font-mono text-[11px] text-muted">
        v0.1.0 · restricted
      </p>
    </aside>
  );
}
