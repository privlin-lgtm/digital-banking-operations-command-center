'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const SECTIONS = [
  {
    label: 'Monitor',
    items: [
      { href: '/overview', label: 'Overview' },
      { href: '/services', label: 'Services' },
      { href: '/alerts', label: 'Alerts' },
    ],
  },
  {
    label: 'Respond',
    items: [
      { href: '/incidents', label: 'Incidents' },
      { href: '/runbooks', label: 'Runbooks' },
    ],
  },
  {
    label: 'Govern',
    items: [{ href: '/sla', label: 'SLA' }],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-12 items-center border-b border-line px-3">
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-[0.18em] text-accent">BankOps</p>
          <p className="truncate text-xs font-medium text-bright">Control Center</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-1 font-mono text-2xs uppercase tracking-[0.16em] text-muted">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex h-8 items-center border-l-2 px-2 text-xs',
                      active
                        ? 'border-accent bg-accent/10 text-bright'
                        : 'border-transparent text-muted hover:bg-raised hover:text-ink',
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-3 py-2.5 font-mono text-2xs leading-4 text-muted">
        <p>v0.1.0</p>
        <p>restricted · audited</p>
      </div>
    </aside>
  );
}
