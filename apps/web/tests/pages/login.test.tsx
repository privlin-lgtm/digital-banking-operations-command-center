import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/(auth)/login/page';

// vi.hoisted runs before vi.mock's factory ever does, so `push`/`refresh`
// are guaranteed to exist by the time next/navigation is first imported
// (a plain top-level const here would risk a "used before initialization"
// error, since vi.mock itself is hoisted above every import in this file).
const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh, replace: vi.fn() }),
  usePathname: () => '/login',
}));

describe('LoginPage', () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pre-fills the email field and starts with no error', () => {
    render(<LoginPage />);
    expect(screen.getByLabelText('Email')).toHaveValue('oscar.d@example.net');
    expect(screen.queryByText(/REQUEST_FAILED|UNAUTHORIZED/)).not.toBeInTheDocument();
  });

  it('redirects to /overview on a successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve({ data: {} }) }),
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe!Admin1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/overview'));
    expect(refresh).toHaveBeenCalled();
  });

  it('shows the server error and does not navigate on failed login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: () =>
          Promise.resolve({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } }),
      }),
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByText(/UNAUTHORIZED/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('disables the submit button and shows a pending label while the request is in flight', async () => {
    let resolveFetch!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      ),
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ChangeMe!Admin1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    const button = await screen.findByRole('button', { name: /authenticating/i });
    expect(button).toBeDisabled();

    resolveFetch({ status: 200, ok: true, json: () => Promise.resolve({ data: {} }) });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });
});
