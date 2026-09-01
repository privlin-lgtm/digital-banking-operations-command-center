import type { ReactNode } from 'react';
import { Topbar } from '@/components/layout/Topbar';

export function PageShell({
  title,
  subtitle,
  actions,
  toolbar,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} actions={actions} />
      {toolbar}
      <section className="flex-1 overflow-auto p-4">{children}</section>
    </>
  );
}
