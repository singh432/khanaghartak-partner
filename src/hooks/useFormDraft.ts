import { useEffect, useRef } from "react";

/**
 * Persists form state to localStorage as the user types, so details are never
 * lost when they navigate away, refresh, or close a sheet by accident.
 *
 * - Restores the saved draft once on mount (only when `enabled`).
 * - Saves on every change (debounced) while `enabled`.
 * - Call `clearDraft()` after a successful save/submit.
 */
export function useFormDraft<T>(
  key: string | null,
  value: T,
  restore: (draft: T) => void,
  enabled = true,
) {
  const restoredRef = useRef(false);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    restoredRef.current = false;
  }, [key]);

  // Restore once
  useEffect(() => {
    if (!enabled || !key || restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) restoreRef.current(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt drafts */
    }
  }, [key, enabled]);

  // Save on change
  useEffect(() => {
    if (!enabled || !key || !restoredRef.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* storage full / unavailable */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [key, value, enabled]);

  const clearDraft = () => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  return clearDraft;
}

export function clearFormDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
