import { Topbar } from '@/components/layout/Topbar';

export default function AlertsPage() {
  return (
    <>
      <Topbar
        title="Alerts"
        subtitle="Triage monitoring signals across payments, KYC, and fraud."
      />
      <section className="p-8">
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-16 text-center text-muted">
          Alert queue will load from <code className="text-accent">GET /api/v1/alerts</code>
        </div>
      </section>
    </>
  );
}
