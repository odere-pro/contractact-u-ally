"use client";

import { type KeyboardEvent, type MouseEvent } from "react";
import { ArrowLeftToLine, ChevronDown } from "lucide-react";

import { SeverityIcon } from "@/components/atoms/SeverityIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ClauseEvent } from "@/lib/catalog/types";
import { SEVERITY_LABEL, severityOf, type Severity } from "@/lib/severity";
import { cn } from "@/lib/utils";

interface ClauseCardProps {
  readonly clause: ClauseEvent;
  readonly featured?: boolean;
  readonly onSelect?: (id: string) => void;
  readonly onShowWhy?: (clause: ClauseEvent) => void;
}

// Per-severity treatment. The whole card carries a soft tint so collapsed
// cards read at a glance; a 4px solid bar on the left edge gives the
// severity the same prominence the HitlBanner uses, keeping the visual
// language consistent across surfaces.
const SEVERITY_TINT: Record<Severity, string> = {
  critical: "bg-[var(--color-critical-soft)]/55",
  medium: "bg-[var(--color-medium-soft)]/55",
  low: "bg-[var(--color-low-soft)]/55",
  ok: "bg-[var(--color-ok-soft)]/55",
};

const SEVERITY_LEFT_BAR: Record<Severity, string> = {
  critical: "border-l-[var(--color-critical)]",
  medium: "border-l-[var(--color-medium)]",
  low: "border-l-[var(--color-low)]",
  ok: "border-l-[var(--color-ok)]",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-[var(--color-critical)] text-white",
  medium: "bg-[var(--color-medium)] text-white",
  low: "bg-[var(--color-low)] text-[var(--color-foreground)]",
  ok: "bg-[var(--color-ok)] text-white",
};

// Expansion is driven by `featured` — the parent owns which card is
// active so selecting one collapses the others. The whole card and the
// "Show in contract" button both call onSelect, so a click anywhere on
// the row both expands the card and anchors the contract pane to the
// matching highlight.
export function ClauseCard({ clause, featured = false, onSelect, onShowWhy }: ClauseCardProps) {
  const severity = severityOf(clause);
  const expanded = featured;
  const bodyId = `clause-card-body-${clause.id}`;
  const tinted = expanded || featured;

  const handleToggle = () => {
    onSelect?.(clause.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
    }
  };

  const handleGoToClause = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onSelect?.(clause.id);
  };

  return (
    <Card
      data-testid={`clause-card-${clause.id}`}
      data-severity={severity}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-controls={bodyId}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      style={{
        transition:
          "box-shadow var(--duration-normal) var(--ease-out-expo), background-color var(--duration-normal) var(--ease-out-expo)",
      }}
      className={cn(
        // Override Card's default `gap-4 py-4` so the tint reaches the
        // top and bottom edges instead of leaving a white strip.
        "relative cursor-pointer gap-0 overflow-hidden py-0 outline-none",
        "border border-l-4 border-[color:var(--color-border)]",
        SEVERITY_LEFT_BAR[severity],
        // Default bg matches the surrounding pane, so collapsed cards
        // read as a clean stack. Severity tint reveals on expand or
        // when the parent flags this card as featured (e.g. matches the
        // active selection in the contract pane).
        tinted ? SEVERITY_TINT[severity] : "bg-card",
        "focus-visible:ring-ring/60 focus-visible:ring-2",
        featured && "shadow-md",
      )}
    >
      <div className="flex w-full items-start gap-3 px-4 py-3.5">
        <SeverityIcon severity={severity} className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase",
                SEVERITY_BADGE[severity],
              )}
            >
              {SEVERITY_LABEL[severity]}
            </span>
            <span className="text-muted-foreground/80 font-mono text-[10px] tracking-wide uppercase">
              {clause.id}
            </span>
          </div>
          <h3 className="text-foreground mt-1 text-base leading-snug font-semibold tracking-tight">
            {clause.title}
          </h3>
        </div>
        {onSelect && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid={`clause-card-goto-${clause.id}`}
            aria-label={`Show clause ${clause.id} in the contract`}
            onClick={handleGoToClause}
            className="mt-0.5 h-8 shrink-0 gap-1.5 px-2.5 text-xs"
          >
            <ArrowLeftToLine aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">Show in contract</span>
          </Button>
        )}
        <ChevronDown
          aria-hidden
          className={cn("text-foreground/60 mt-1 size-5 shrink-0", expanded && "rotate-180")}
          style={{ transition: "transform var(--duration-fast) var(--ease-out-expo)" }}
        />
      </div>
      {expanded && (
        <CardContent
          id={bodyId}
          className="border-border/60 flex flex-col gap-4 border-t px-4 pt-4 pb-4"
        >
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
            <section className="border-info/40 bg-info-soft flex flex-col gap-2 rounded-md border px-3 py-2.5">
              <h4 className="text-info text-xs font-semibold tracking-widest uppercase">
                What to do
              </h4>
              <p className="text-foreground text-[0.9375rem] leading-relaxed">{clause.action}</p>
            </section>
          )}
          {onShowWhy && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="default"
                variant="outline"
                data-testid={`clause-card-ask-${clause.id}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onShowWhy(clause);
                }}
              >
                Ask a question
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
