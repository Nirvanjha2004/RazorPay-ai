"use client";

import { useEffect, useState } from "react";

/**
 * Lightweight JSON polling hook — keeps the last good snapshot on network
 * hiccups so the terminal never flashes empty.
 */
export function usePolling<T>(url: string, intervalMs: number): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;

    const tick = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok && active) setData((await res.json()) as T);
      } catch {
        // keep previous snapshot
      }
    };

    void tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [url, intervalMs]);

  return data;
}
