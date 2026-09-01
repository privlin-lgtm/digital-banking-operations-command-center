import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '@/components/ui/StatusBadge';

describe('StatusBadge', () => {
  it('renders the given label', () => {
    render(<StatusBadge tone="critical" label="SEV1" />);
    expect(screen.getByText('SEV1')).toBeInTheDocument();
  });

  it('applies the tone-specific text color class', () => {
    render(<StatusBadge tone="healthy" label="RESOLVED" />);
    expect(screen.getByText('RESOLVED')).toHaveClass('text-status-healthy');
  });
});
