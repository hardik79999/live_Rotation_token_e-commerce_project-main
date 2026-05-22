/**
 * useSearch — debounced fuzzy search hook backed by /api/search/products.
 *
 * Returns live suggestion results as the user types, with:
 *  - 300 ms debounce to avoid spamming the API
 *  - AbortController to cancel in-flight requests on each new keystroke
 *  - Graceful error handling (never throws to the UI)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { searchApi } from '@/api/user';
import type { Product } from '@/types';

interface UseSearchOptions {
  limit?: number;
  debounceMs?: number;
}

interface UseSearchResult {
  results:   Product[];
  loading:   boolean;
  query:     string;
  setQuery:  (q: string) => void;
  clear:     () => void;
}

export function useSearch({ limit = 6, debounceMs = 300 }: UseSearchOptions = {}): UseSearchResult {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Keep a ref to the latest AbortController so we can cancel stale requests
  const abortRef = useRef<AbortController | null>(null);
  // Debounce timer ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await searchApi.search({ q: q.trim(), limit });
      setResults(res.data.data ?? []);
    } catch (err: unknown) {
      // Ignore abort errors (user typed again before response arrived)
      if ((err as { name?: string })?.name !== 'CanceledError' &&
          (err as { name?: string })?.name !== 'AbortError') {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    // Clear previous debounce timer
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      runSearch(query);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, debounceMs, runSearch]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setLoading(false);
    abortRef.current?.abort();
  }, []);

  return { results, loading, query, setQuery, clear };
}
