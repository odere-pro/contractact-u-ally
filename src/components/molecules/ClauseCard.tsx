"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { SectionRef } from "@/components/atoms/SectionRef";
import { SeverityBadge } from "@/components/molecules/SeverityBadge";
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

const MAX_ORIGINAL_TEXT_RENDER = 600;
function truncate(text: string): string {
  return text.length > MAX_ORIGINAL_TEXT_RENDER
    ? `${text.slice(0, MAX_ORIGINAL_TEXT_RENDER)}…`
    : text;
}

// Single clause card in the simplified pane. Featured cards are
// pre-expanded with prominent visual weight — used for the active
// finding. Non-featured cards are collapsible. Clicking the header
// also notifies the parent so the contract pane can scroll the
// matching highlight into view.
export function ClauseCard({ clause, featured = false, onSelect, onShowWhy }: ClauseCardProps) {
  const [open, setOpen] = useState(featured);
  // React-during-render pattern: when `featured` flips on (e.g. user
  // clicks a row in the left rail), expand. Tracking `prevFeatured`
  // means we only set on transition, not on every render. We don't
  // auto-collapse on `featured = false` so the user can browse
  // multiple cards without losing context.
  const [prevFeatured, setPrevFeatured] = useState(featured);
  if (featured !== prevFeatured) {
    setPrevFeatured(featured);
    if (featured) setOpen(true);
  }

  const severity = severityOf(clause);
  return (
    <Card
      data-testid={`clause-card-${clause.id}`}
      data-severity={severity}
      style={{ transition: "border-color var(--duration-fast) var(--ease-out-expo)" }}
      className={cn(featured && "border-foreground/40 border-2 shadow-sm")}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          onSelect?.(clause.id);
        }}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <SeverityBadge severity={severity} compact={!featured} />
        <div className="flex grow flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <SectionRef id={clause.id} />
            <span className="font-medium">{clause.title}</span>
          </div>
          {!open && (
            <span className="text-muted-foreground line-clamp-1 text-xs">{clause.explanation}</span>
          )}
        </div>
        <ChevronDown
          aria-hidden
          className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <CardContent className="flex flex-col gap-3 pt-0">
          {clause.originalText && (
            <blockquote className="border-border text-muted-foreground border-l-2 pl-3 text-sm italic">
              {truncate(clause.originalText)}
            </blockquote>
          )}
          <p className="text-sm">{clause.explanation}</p>
          {clause.action && (
            <p className="text-sm">
              <strong>What to do:</strong> {clause.action}
            </p>
          )}
          {(clause.citation || onShowWhy) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {onShowWhy && (
                <Button size="sm" variant="outline" onClick={() => onShowWhy(clause)}>
                  Why is this a risk?
                </Button>
              )}
              {clause.citation && (
                <Button size="sm" variant="ghost" disabled>
                  {clause.citation.article}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
