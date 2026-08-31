import { Topbar } from '@/components/layout/Topbar';

const CARDS = [
  { label: 'Open alerts', value: '—', hint: 'Connect API to populate' },
  { label: 'Active cases', value: '—', hint: 'Investigations in flight' },
  { label: 'Flagged payments', value: '—', hint: 'Last 24 hours' },
  { label: 'API health', value: 'STANDBY', hint: 'Awaiting first scrape' },
];

export default function OverviewPage() {
  return (
    <>
      <Topbar
        title="Operations overview"
        subtitle="Command-center snapshot for the current desk shift."
      />
      <section className="grid gap-4 p-8 md:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card) => (
          <article key={card.label} className="rounded-xl border border-line bg-panel p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{card.label}</p>
            <p className="mt-3 font-mono text-3xl text-accent">{card.value}</p>
            <p className="mt-2 text-sm text-muted">{card.hint}</p>
          </article>
        ))}
      </section>
    </>
  );
}
