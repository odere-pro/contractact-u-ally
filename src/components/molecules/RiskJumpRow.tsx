"use client";

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

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-[var(--color-critical)]",
  medium: "border-l-[var(--color-medium)]",
  low: "border-l-[var(--color-low)]",
  ok: "border-l-[var(--color-ok)]",
};

// Single row in the risk rail's "Jump to" list. Two-line layout: title
// on the primary line (all titles align at the same x-offset after the
// fixed icon), clause slug on the secondary line. Real <a href> so the
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
        "flex items-center gap-3 rounded-r-md border-l-2 px-3 py-2.5 transition-colors",
        active
          ? cn("bg-secondary text-foreground", SEVERITY_BORDER[severity])
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-transparent",
      )}
    >
      <SeverityIcon severity={severity} className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.9375rem] leading-snug font-medium">{title}</div>
        <div className="text-muted-foreground/70 mt-0.5 truncate font-mono text-[11px] leading-tight tracking-wide uppercase">
          {clauseId}
        </div>
      </div>
    </a>
  );
}
