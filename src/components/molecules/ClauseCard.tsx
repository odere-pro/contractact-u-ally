"use client";

import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ClauseEvent } from "@/lib/catalog/types";
import { severityOf } from "@/lib/severity";
import { cn } from "@/lib/utils";

interface ClauseCardProps {
  readonly clause: ClauseEvent;
  readonly featured?: boolean;
  readonly onSelect?: (id: string) => void;
  readonly onShowWhy?: (clause: ClauseEvent) => void;
}

// Single clause card in the simplified pane. Always fully expanded so the
// user reads the original quote, the plain-language explanation, the
// suggested next step, and the citation in one consistent block. Clicking
// the header notifies the parent so the contract pane can scroll the
// matching highlight into view; the featured card keeps a heavier border
// so the active selection stays obvious.
export function ClauseCard({ clause, featured = false, onSelect, onShowWhy }: ClauseCardProps) {
  const severity = severityOf(clause);
  return (
    <Card
      data-testid={`clause-card-${clause.id}`}
      data-severity={severity}
      style={{ transition: "border-color var(--duration-fast) var(--ease-out-expo)" }}
      className={cn("overflow-hidden", featured && "border-foreground/40 border-2 shadow-sm")}
    >
      <button
        type="button"
        onClick={() => onSelect?.(clause.id)}
        aria-pressed={featured}
        style={{ transition: "background-color var(--duration-fast) var(--ease-out-expo)" }}
        className="hover:bg-secondary/40 focus-visible:bg-secondary/40 flex w-full cursor-pointer items-start gap-3 px-4 pt-4 text-left outline-none"
      >
        <SeverityIcon severity={severity} className="mt-1 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-base leading-snug font-semibold tracking-tight">
            {clause.title}
          </h3>
          <div className="text-muted-foreground/70 mt-0.5 font-mono text-xs leading-tight tracking-wide uppercase">
            {clause.id}
          </div>
        </div>
      </button>
      <CardContent className="flex flex-col gap-5 px-4 pt-3 pb-4">
        {clause.originalText && (
          <figure className="bg-muted/40 border-border rounded-md border border-l-2 px-3 py-2.5">
            <figcaption className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-widest uppercase">
              Original clause
            </figcaption>
            <blockquote className="text-foreground/80 text-[0.9375rem] leading-relaxed">
              {clause.originalText}
            </blockquote>
          </figure>
        )}
        <section className="flex flex-col gap-2">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            Plain-language explanation
          </h4>
          <p className="text-foreground text-[0.9375rem] leading-relaxed">{clause.explanation}</p>
        </section>
        {clause.action && (
          <section className="border-foreground/15 bg-foreground/[0.03] flex flex-col gap-2 rounded-md border-l-2 px-3 py-2.5">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              What to do
            </h4>
            <p className="text-foreground text-[0.9375rem] leading-relaxed">{clause.action}</p>
          </section>
        )}
        {(clause.citation || onShowWhy) && (
          <div className="flex flex-wrap items-center gap-2">
            {onShowWhy && (
              <Button size="default" variant="outline" onClick={() => onShowWhy(clause)}>
                Why is this a risk?
              </Button>
            )}
            {clause.citation && (
              <span
                aria-label={`Reference: ${clause.citation.article}`}
                className="border-border text-muted-foreground inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-xs"
              >
                {clause.citation.article}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
