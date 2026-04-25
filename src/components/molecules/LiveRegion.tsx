"use client";

import { useEffect, useRef, useState } from "react";

interface LiveRegionProps {
  /** The current message to announce. Empty/null clears the region. */
  readonly message: string | null;
  /** "polite" (default) waits for AT idle; "assertive" interrupts. */
  readonly tone?: "polite" | "assertive";
  /**
   * Minimum time in ms between back-to-back announcements. Stage / clause
   * arrivals can fire dozens per second; the region throttles to avoid
   * flooding the screen-reader buffer.
   */
  readonly throttleMs?: number;
}

/**
 * Visually-hidden ARIA live region. Renders nothing visually; updates
 * its text content (after throttling) so AT announces `message`. Per
 * WCAG 4.1.3 — used for stage transitions, clause arrival summaries,
 * and final analysis completion.
 */
export function LiveRegion({ message, tone = "polite", throttleMs = 600 }: LiveRegionProps) {
  const [announced, setAnnounced] = useState<string>("");
  const lastFiredRef = useRef<number>(0);

  useEffect(() => {
    // Schedule the next announcement so the AT buffer has time to drain
    // between bursts. Clear with empty input.
    if (message === null) return;
    const elapsed = Date.now() - lastFiredRef.current;
    const delay = Math.max(0, throttleMs - elapsed);
    const handle = window.setTimeout(() => {
      lastFiredRef.current = Date.now();
      setAnnounced(message);
    }, delay);
    return () => window.clearTimeout(handle);
  }, [message, throttleMs]);

  return (
    <div
      role="status"
      aria-live={tone}
      aria-atomic="true"
      className="sr-only"
      data-testid="live-region"
    >
      {announced}
    </div>
  );
}
