import { Topbar } from '@/components/layout/Topbar';

export default function CustomersPage() {
  return (
    <>
      <Topbar title="Customers" subtitle="Customer master data and KYC posture." />
      <section className="p-8">
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-16 text-center text-muted">
          Customers will load from <code className="text-accent">GET /api/v1/customers</code>
        </div>
      </section>
    </>
  );
}
