"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface HitlBannerProps {
  readonly illegalCount: number;
  readonly onConnectLegalAid?: () => void;
}

// Page-top "STOP" strip rendered when one or more clauses are illegal.
// Severity is expressed via icon + heading + color (defence in depth).
// Uses the same critical-soft background + critical foreground pairing
// as the Badge `critical` variant — that pairing is the contrast
// reference used everywhere else, so a mode that meets contrast for
// the badge meets it here too. A `border-l-4` solid critical bar gives
// the strip extra visual weight without relying on color contrast.
export function HitlBanner({ illegalCount, onConnectLegalAid }: HitlBannerProps) {
  if (illegalCount === 0) return null;
  const findingWord = illegalCount === 1 ? "finding" : "findings";
  return (
    <div
      role="alert"
      data-testid="hitl-banner"
      className="bg-critical-soft text-critical border-critical flex flex-wrap items-center gap-3 border-l-4 px-4 py-2 text-sm"
    >
      <AlertTriangle aria-hidden className="size-4" />
      <strong className="font-mono uppercase">Stop</strong>
      <span className="grow">
        {illegalCount} critical {findingWord} violate the law. A human review is recommended before
        you sign.
      </span>
      {onConnectLegalAid && (
        <Button size="sm" variant="outline" onClick={onConnectLegalAid}>
          Connect me to legal aid →
        </Button>
      )}
    </div>
  );
}
