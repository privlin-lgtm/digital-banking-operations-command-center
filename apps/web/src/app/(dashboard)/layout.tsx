import type { ReactNode } from 'react';
import { SessionProvider } from '@/components/layout/SessionProvider';
import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col bg-canvas">{children}</main>
      </div>
    </SessionProvider>
  );
}
