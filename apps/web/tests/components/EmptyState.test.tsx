import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '@/components/ui/EmptyState';

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="No incidents" description="Nothing open right now." />);
    expect(screen.getByText('No incidents')).toBeInTheDocument();
    expect(screen.getByText('Nothing open right now.')).toBeInTheDocument();
  });

  it('omits the hint line when none is given', () => {
    render(<EmptyState title="No incidents" description="Nothing open right now." />);
    expect(screen.queryByText(/hint/i)).not.toBeInTheDocument();
  });

  it('renders the hint when given', () => {
    render(
      <EmptyState title="No incidents" description="Nothing open." hint="Try clearing filters" />,
    );
    expect(screen.getByText('Try clearing filters')).toBeInTheDocument();
  });
});
