'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';

export interface ResourceState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

export function useResource<T>(path: string | null): ResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  // eslint-plugin-react-hooks 7 (pulled in by eslint-config-next 16) adds
  // set-state-in-effect, which flags the synchronous resets below. They are
  // kept as they were so the Next 16 upgrade changes no fetch behaviour;
  // moving this hook to derived state is a separate, reviewable change.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!path) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void apiFetch<T>(path, { signal: controller.signal })
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setData(null);
        setError(
          err instanceof ApiError ? err : new ApiError(0, 'REQUEST_FAILED', 'Request failed'),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [path, nonce]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { data, error, loading, reload };
}
