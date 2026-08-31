import { Topbar } from '@/components/layout/Topbar';

export default function TransactionsPage() {
  return (
    <>
      <Topbar title="Transactions" subtitle="Payment activity with status and exception flags." />
      <section className="p-8">
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-16 text-center text-muted">
          Transactions will load from <code className="text-accent">GET /api/v1/transactions</code>
        </div>
      </section>
    </>
  );
}
