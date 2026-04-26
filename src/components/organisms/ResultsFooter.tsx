"use client";

import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ResultsFooterProps {
  readonly onShare: () => void;
}

export function ResultsFooter({ onShare }: ResultsFooterProps) {
  return (
    <footer className="border-border bg-card/40 sticky bottom-0 flex flex-wrap items-center gap-2 border-t p-3">
      <span className="text-muted-foreground text-xs">
        Document and analysis stay in this browser.
      </span>
      <span className="grow" />
      <Button data-testid="open-share" onClick={onShare}>
        <Share2 aria-hidden className="size-4" />
        Share or download
      </Button>
    </footer>
  );
}
