import type { ReactNode } from 'react';
import { Topbar } from '@/components/layout/Topbar';

export function PageShell({
  title,
  subtitle,
  actions,
  toolbar,
  children,
  flush = false,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} actions={actions} />
      {toolbar}
      <section className={flush ? 'min-h-0 flex-1 overflow-auto' : 'flex-1 overflow-auto p-3'}>
        {children}
      </section>
    </>
  );
}
