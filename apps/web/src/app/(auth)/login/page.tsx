'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('oscar.d@example.net');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.push('/overview');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError(0, 'REQUEST_FAILED', 'Unable to sign in'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm border border-line bg-panel p-6">
      <p className="font-mono text-2xs uppercase tracking-[0.18em] text-accent lg:hidden">
        BankOps
      </p>
      <h2 className="mt-1 text-lg font-semibold tracking-tight text-bright">Sign in</h2>
      <p className="mt-1 text-xs text-muted">Operator credentials. Sessions are audit-logged.</p>

      <label className="mt-6 block">
        <span className="field-label">Email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="field-control"
        />
      </label>

      <label className="mt-3 block">
        <span className="field-label">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="field-control"
        />
      </label>

      {error ? (
        <div className="mt-4 border border-status-critical/30 bg-status-critical/10 px-3 py-2">
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-status-critical">
            {error.code}
            {error.status ? ` · ${error.status}` : ''}
          </p>
          <p className="mt-1 text-xs text-ink">{error.message}</p>
        </div>
      ) : null}

      <button type="submit" disabled={pending} className="ops-btn-primary mt-5 h-8 w-full">
        {pending ? 'Authenticating…' : 'Sign in'}
      </button>

      <p className="mt-4 font-mono text-2xs leading-4 text-muted">
        Rate-limited · 10 attempts / 15 min
      </p>
    </form>
  );
}
