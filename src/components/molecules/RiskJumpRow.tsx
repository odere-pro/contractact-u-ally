"use client";

import { SectionRef } from "@/components/atoms/SectionRef";
import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/severity";

interface RiskJumpRowProps {
  readonly clauseId: string;
  readonly title: string;
  readonly severity: Severity;
  readonly active: boolean;
  readonly onSelect: (clauseId: string) => void;
}

// Single row in the risk rail's "Jump to" list. Real <a href> so the
// page is navigable without JS and screen readers can list landmarks.
export function RiskJumpRow({ clauseId, title, severity, active, onSelect }: RiskJumpRowProps) {
  return (
    <a
      href={`#clause-${encodeURIComponent(clauseId)}`}
      aria-current={active ? "true" : undefined}
      onClick={(e) => {
        // Let cmd/ctrl-click open in a new tab as usual; otherwise
        // intercept and run the controller's scroll handler.
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onSelect(clauseId);
      }}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <SeverityIcon severity={severity} className="size-3.5" />
      <SectionRef id={clauseId} />
      <span className="truncate">{title}</span>
    </a>
  );
}
