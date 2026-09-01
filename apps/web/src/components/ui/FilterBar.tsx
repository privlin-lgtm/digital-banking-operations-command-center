import type { ReactNode } from 'react';

export function FilterBar({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-4">
      <div className="flex flex-wrap items-center gap-2 py-1.5">{children}</div>
      {trailing ? <div className="flex items-center gap-2 py-1.5">{trailing}</div> : null}
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-2xs uppercase tracking-[0.12em] text-muted">{label}</span>
      <select
        className="filter-control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value || 'all'} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterSearch({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-2xs uppercase tracking-[0.12em] text-muted">{label}</span>
      <input
        className="filter-control w-52"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
