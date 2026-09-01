import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricCard } from '@/components/ui/MetricCard';

describe('MetricCard', () => {
  it('renders label, value, and hint', () => {
    render(<MetricCard label="Availability" value="99.94%" hint="Tier-1, 30d" />);
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('99.94%')).toBeInTheDocument();
    expect(screen.getByText('Tier-1, 30d')).toBeInTheDocument();
  });

  it('uses the neutral text color when no tone is given', () => {
    render(<MetricCard label="Open P1s" value={0} hint="right now" />);
    expect(screen.getByText('0')).toHaveClass('text-bright');
  });

  it('applies the tone color when one is given', () => {
    render(<MetricCard label="Open P1s" value={2} hint="right now" tone="critical" />);
    expect(screen.getByText('2')).toHaveClass('text-status-critical');
  });
});
