import { Topbar } from '@/components/layout/Topbar';

export default function CasesPage() {
  return (
    <>
      <Topbar title="Cases" subtitle="Investigations and compliance workflows." />
      <section className="p-8">
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-16 text-center text-muted">
          Case list will load from <code className="text-accent">GET /api/v1/cases</code>
        </div>
      </section>
    </>
  );
}
