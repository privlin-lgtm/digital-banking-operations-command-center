'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('oscar.d@example.net');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-2xl border border-line bg-panel p-8 shadow-panel"
    >
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent lg:hidden">BankOps</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h2>
      <p className="mt-2 text-sm text-muted">Use your operations credentials to continue.</p>

      <label className="mt-8 block text-sm text-muted">
        Email
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-ink outline-none ring-accent focus:ring-2"
        />
      </label>

      <label className="mt-4 block text-sm text-muted">
        Password
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-ink outline-none ring-accent focus:ring-2"
        />
      </label>

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-canvas disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
