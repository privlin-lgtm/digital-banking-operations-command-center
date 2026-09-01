'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const SECTIONS = [
  {
    label: 'Command',
    items: [
      { href: '/overview', label: 'Overview' },
      { href: '/incidents', label: 'Incidents' },
    ],
  },
  {
    label: 'Observe',
    items: [
      { href: '/alerts', label: 'Alerts' },
      { href: '/services', label: 'Services' },
    ],
  },
  {
    label: 'Operate',
    items: [
      { href: '/runbooks', label: 'Runbooks' },
      { href: '/sla', label: 'SLA' },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-10 items-center border-b border-line px-3">
        <div className="min-w-0 leading-tight">
          <p className="font-mono text-3xs uppercase tracking-[0.12em] text-muted">BankOps</p>
          <p className="truncate text-xs font-medium text-bright">Control Center</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto px-1.5 py-2">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2 pb-0.5 font-mono text-3xs uppercase tracking-[0.1em] text-muted">
              {section.label}
            </p>
            <div className="flex flex-col">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex h-7 items-center border-l-2 px-2 text-xs',
                      active
                        ? 'border-accent bg-raised text-bright'
                        : 'border-transparent text-muted hover:bg-raised/80 hover:text-ink',
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
      <div className="border-t border-line px-3 py-2 font-mono text-3xs leading-4 text-muted">
        <p>PROD · v0.1.0</p>
        <p>restricted</p>
      </div>
    </aside>
  );
}
