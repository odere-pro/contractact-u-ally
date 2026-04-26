"use client";

import { ChevronDown } from "lucide-react";

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

// Single clause card in the simplified pane. Collapsed by default; clicking
// the header expands the body and notifies the parent so the contract pane
// can scroll the matching highlight into view. All cards share the same
// border colour — the rotating chevron is the active indicator.
export function ClauseCard({ clause, featured = false, onSelect, onShowWhy }: ClauseCardProps) {
  const severity = severityOf(clause);
  const expanded = featured;
  return (
    <Card
      data-testid={`clause-card-${clause.id}`}
      data-severity={severity}
      className="border-border overflow-hidden"
    >
      <button
        type="button"
        onClick={() => onSelect?.(clause.id)}
        aria-expanded={expanded}
        aria-controls={`clause-body-${clause.id}`}
        style={{ transition: "background-color var(--duration-fast) var(--ease-out-expo)" }}
        className="hover:bg-secondary/40 focus-visible:bg-secondary/40 flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left outline-none"
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
        <ChevronDown
          aria-hidden
          style={{ transition: "transform var(--duration-fast) var(--ease-out-expo)" }}
          className={cn("text-muted-foreground mt-1 size-5 shrink-0", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <CardContent id={`clause-body-${clause.id}`} className="flex flex-col gap-5 px-4 pt-0 pb-4">
          {clause.originalText && (
            <figure className="bg-muted/40 border-border rounded-md border px-3 py-2.5">
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
            <section className="border-info/40 bg-info-soft flex flex-col gap-2 rounded-md border px-3 py-2.5">
              <h4 className="text-info text-xs font-semibold tracking-widest uppercase">
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
      )}
    </Card>
  );
}
