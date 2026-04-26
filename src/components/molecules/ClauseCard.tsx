"use client";

import { useState, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";

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

// Per-severity visual treatment. The bar runs the full height of the
// card so the severity is readable from across the screen; the soft tint
// runs across the header so users can scan severity without reading the
// label. Border color also shifts so the whole card carries the signal.
const SEVERITY_BAR: Record<Severity, string> = {
  critical: "bg-[var(--color-critical)]",
  medium: "bg-[var(--color-medium)]",
  low: "bg-[var(--color-low)]",
  ok: "bg-[var(--color-ok)]",
};

const SEVERITY_HEADER_TINT: Record<Severity, string> = {
  critical: "bg-[var(--color-critical-soft)]/60",
  medium: "bg-[var(--color-medium-soft)]/60",
  low: "bg-[var(--color-low-soft)]/60",
  ok: "bg-[var(--color-ok-soft)]/60",
};

const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-[var(--color-critical)]/35",
  medium: "border-[var(--color-medium)]/40",
  low: "border-[var(--color-low)]/45",
  ok: "border-[var(--color-ok)]/40",
};

const SEVERITY_FEATURED_BORDER: Record<Severity, string> = {
  critical: "border-[var(--color-critical)]",
  medium: "border-[var(--color-medium)]",
  low: "border-[var(--color-low)]",
  ok: "border-[var(--color-ok)]",
};

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-[var(--color-critical)] text-white",
  medium: "bg-[var(--color-medium)] text-white",
  low: "bg-[var(--color-low)] text-[var(--color-foreground)]",
  ok: "bg-[var(--color-ok)] text-white",
};

// Each card owns its own expand/collapse state so toggling one never
// affects siblings. The whole card is the click / keyboard target so
// users don't have to aim at a small chevron; the chevron + soft tint
// are the visual affordances.
export function ClauseCard({ clause, featured = false, onSelect, onShowWhy }: ClauseCardProps) {
  const severity = severityOf(clause);
  const [expanded, setExpanded] = useState(false);
  const bodyId = `clause-card-body-${clause.id}`;

  const handleToggle = () => {
    setExpanded((v) => !v);
    onSelect?.(clause.id);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleToggle();
    }
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
          "border-color var(--duration-fast) var(--ease-out-expo), box-shadow var(--duration-fast) var(--ease-out-expo)",
      }}
      className={cn(
        "focus-visible:ring-ring/60 relative cursor-pointer overflow-hidden border-2 pl-1.5 outline-none focus-visible:ring-2",
        featured ? SEVERITY_FEATURED_BORDER[severity] : SEVERITY_BORDER[severity],
        featured && "shadow-md",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5", SEVERITY_BAR[severity])} />
      <div
        style={{ transition: "background-color var(--duration-fast) var(--ease-out-expo)" }}
        className={cn("flex w-full items-start gap-3 px-4 py-4", SEVERITY_HEADER_TINT[severity])}
      >
        <SeverityIcon severity={severity} className="mt-0.5 size-6 shrink-0" />
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
          <h3 className="text-foreground mt-1.5 text-lg leading-snug font-semibold tracking-tight">
            {clause.title}
          </h3>
        </div>
        <ChevronDown
          aria-hidden
          className={cn("text-foreground/70 mt-1.5 size-5 shrink-0", expanded && "rotate-180")}
          style={{ transition: "transform var(--duration-fast) var(--ease-out-expo)" }}
        />
      </div>
      {expanded && (
        <CardContent id={bodyId} className="flex flex-col gap-5 px-4 pt-4 pb-4">
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
          {(clause.citation || onShowWhy) && (
            <div className="flex flex-wrap items-center gap-2">
              {onShowWhy && (
                <Button
                  size="default"
                  variant="outline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onShowWhy(clause);
                  }}
                >
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
