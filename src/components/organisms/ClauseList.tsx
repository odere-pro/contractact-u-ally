"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";
import type { ComponentType } from "react";
import type { VariantProps } from "class-variance-authority";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge, badgeVariants } from "@/components/ui/badge";
import type { ClauseEvent, ClauseStatus } from "@/lib/catalog/types";

interface ClauseListProps {
  readonly clauses: readonly ClauseEvent[];
}

// Bind the status→variant map to the actual Badge cva schema so a
// future rename or removal of a variant becomes a compile error here,
// not a silent visual regression.
type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Map domain status → semantic severity variant. Severity tokens are
// declared in src/app/globals.css; keep this map in sync with the
// `critical|medium|low|ok` cva variants on Badge so a rename surfaces
// as a compile error rather than a silent visual regression.
const STATUS_VARIANT: Record<ClauseStatus, BadgeVariant> = {
  illegal: "critical",
  permit_conflict: "critical",
  exploitative: "medium",
  unchecked: "low",
  compliant: "ok",
};

const STATUS_LABEL: Record<ClauseStatus, string> = {
  illegal: "Illegal",
  exploitative: "Exploitative",
  permit_conflict: "Permit conflict",
  compliant: "Compliant",
  unchecked: "Unchecked",
};

// Severity must be distinguishable without color (color-blind users,
// grayscale, low-contrast displays). Pair every badge with a glyph
// that maps 1:1 to status.
const STATUS_ICON: Record<ClauseStatus, ComponentType<{ className?: string }>> = {
  illegal: AlertTriangle,
  exploitative: AlertCircle,
  permit_conflict: AlertTriangle,
  compliant: CheckCircle2,
  unchecked: HelpCircle,
};

// Defence-in-depth: BE prompt caps originalText at 300 chars, but we
// never trust the network. The render cap is intentionally 2× the
// backend cap — keeps a comfortable safety margin so legitimate edge
// cases (slightly-over-cap prompts) still render cleanly while still
// bounding the layout against an oversized/malformed payload. Do NOT
// halve this without raising the backend cap first.
const MAX_ORIGINAL_TEXT_RENDER = 600;
function truncate(text: string): string {
  return text.length > MAX_ORIGINAL_TEXT_RENDER
    ? `${text.slice(0, MAX_ORIGINAL_TEXT_RENDER)}…`
    : text;
}

export function ClauseList({ clauses }: ClauseListProps) {
  if (clauses.length === 0) {
    return (
      <p data-testid="clause-list-empty" className="text-muted-foreground text-sm">
        No clauses analyzed yet.
      </p>
    );
  }

  return (
    // aria-live="off" prevents AT from spontaneously announcing each
    // appended clause as the NDJSON stream flows in. The page-level
    // <LiveRegion> already announces stage transitions and the final
    // summary; per-clause announcements would flood NVDA/JAWS users.
    <Accordion data-testid="clause-list" multiple aria-live="off" className="w-full">
      {clauses.map((c) => {
        const Icon = STATUS_ICON[c.status];
        // Compose an explicit accessible name so AT announces severity +
        // title + citation regardless of how @base-ui flattens the nested
        // markup. Without this, screen readers may read only the first
        // text node and drop the severity badge or citation line.
        const ariaLabel = c.citation
          ? `${STATUS_LABEL[c.status]}: ${c.title} (${c.citation.article}, ${c.citation.label})`
          : `${STATUS_LABEL[c.status]}: ${c.title}`;
        return (
          <AccordionItem key={c.id} value={c.id} data-clause-status={c.status}>
            <AccordionTrigger aria-label={ariaLabel}>
              <div className="flex flex-col items-start gap-1 pr-2">
                <div className="flex items-center gap-2">
                  <Badge aria-hidden variant={STATUS_VARIANT[c.status]}>
                    <Icon className="size-3" aria-hidden />
                    {STATUS_LABEL[c.status]}
                  </Badge>
                  <span className="font-medium">{c.title}</span>
                </div>
                {c.citation && (
                  <span aria-hidden className="text-muted-foreground text-xs">
                    {c.citation.article} · {c.citation.label}
                  </span>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-3">
                {c.originalText && (
                  <blockquote className="border-border text-muted-foreground border-l-2 pl-3 text-sm italic">
                    {truncate(c.originalText)}
                  </blockquote>
                )}
                <p>{c.explanation}</p>
                {c.action && (
                  <p className="text-sm">
                    <strong>What to do:</strong> {c.action}
                  </p>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
