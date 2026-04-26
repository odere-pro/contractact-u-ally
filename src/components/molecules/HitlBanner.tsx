"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface HitlBannerProps {
  readonly illegalCount: number;
  readonly onConnectLegalAid?: () => void;
}

// Page-top "STOP" strip rendered when one or more clauses are illegal.
// Severity is expressed via icon + heading + color (defence in depth).
// Critical bg + critical-soft fg satisfy WCAG contrast in both themes.
export function HitlBanner({ illegalCount, onConnectLegalAid }: HitlBannerProps) {
  if (illegalCount === 0) return null;
  const findingWord = illegalCount === 1 ? "finding" : "findings";
  return (
    <div
      role="alert"
      data-testid="hitl-banner"
      className="bg-critical text-critical-soft flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
    >
      <AlertTriangle aria-hidden className="size-4" />
      <strong className="font-mono uppercase">Stop</strong>
      <span className="grow">
        {illegalCount} critical {findingWord} violate the law. A human review is recommended before
        you sign.
      </span>
      {onConnectLegalAid && (
        <Button
          size="sm"
          variant="outline"
          className="border-critical-soft bg-transparent"
          onClick={onConnectLegalAid}
        >
          Connect me to legal aid →
        </Button>
      )}
    </div>
  );
}
