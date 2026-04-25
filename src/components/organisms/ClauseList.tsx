"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { ClauseEvent, ClauseStatus } from "@/lib/catalog/types";

interface ClauseListProps {
  readonly clauses: readonly ClauseEvent[];
}

const STATUS_VARIANT: Record<
  ClauseStatus,
  "destructive" | "secondary" | "default" | "outline" | "ghost"
> = {
  illegal: "destructive",
  exploitative: "default",
  permit_conflict: "destructive",
  compliant: "secondary",
  unchecked: "outline",
};

const STATUS_LABEL: Record<ClauseStatus, string> = {
  illegal: "Illegal",
  exploitative: "Exploitative",
  permit_conflict: "Permit conflict",
  compliant: "Compliant",
  unchecked: "Unchecked",
};

export function ClauseList({ clauses }: ClauseListProps) {
  if (clauses.length === 0) {
    return (
      <p data-testid="clause-list-empty" className="text-muted-foreground text-sm">
        No clauses analyzed yet.
      </p>
    );
  }

  return (
    <Accordion data-testid="clause-list" multiple className="w-full">
      {clauses.map((c) => {
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
                    {c.originalText}
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
