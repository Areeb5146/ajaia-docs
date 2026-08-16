"use client";

import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

/**
 * Debounced autosave with last-write-wins semantics.
 *
 * Deliberately simple: there is no operational transform or CRDT here, so two
 * people typing in the same document at the same time will clobber each other.
 * That is a documented scope cut — see ARCHITECTURE.md. Within a single editing
 * session this gives Google-Docs-like "you never press save" behaviour.
 *
 * No manual useCallback/useMemo: the React Compiler memoizes this, and hand-rolled
 * memoization on the self-recursive `flush` defeats it.
 */
export function useAutosave<T>(
  save: (value: T) => Promise<void>,
  { delay = 900 }: { delay?: number } = {},
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<T | null>(null);
  const inFlight = useRef(false);

  // `save` is usually an inline arrow, so it is a new function every render.
  // Reading it through a ref (synced in an effect, never during render) keeps
  // the debounce timer from being re-armed on every keystroke.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  async function flush(): Promise<void> {
    // A save is already in flight; whatever is pending will be picked up by the
    // trailing call in the `finally` below.
    if (inFlight.current || pending.current === null) return;

    const value = pending.current;
    pending.current = null;
    inFlight.current = true;
    setStatus("saving");
    try {
      await saveRef.current(value);
      setError(null);
      // Another edit landed while we were in flight — stay dirty.
      setStatus(pending.current === null ? "saved" : "unsaved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setStatus("error");
    } finally {
      inFlight.current = false;
      if (pending.current !== null) void flush();
    }
  }

  function schedule(value: T) {
    pending.current = value;
    setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }

  /** Save immediately, skipping the debounce. Used before imports and retries. */
  function saveNow() {
    if (timer.current) clearTimeout(timer.current);
    return flush();
  }

  // Warn before losing work that has not reached the server yet.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (pending.current !== null || inFlight.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { status, error, schedule, saveNow };
}
