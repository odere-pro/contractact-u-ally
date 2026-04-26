"use client";

import { useState } from "react";
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

const MAX_ORIGINAL_TEXT_RENDER = 600;
function truncate(text: string): string {
  return text.length > MAX_ORIGINAL_TEXT_RENDER
    ? `${text.slice(0, MAX_ORIGINAL_TEXT_RENDER)}…`
    : text;
}

// Single clause card in the simplified pane. All cards start collapsed —
// the user opens the explanations they want to read. Featured cards keep
// a heavier border so the active selection stays obvious. Clicking the
// header notifies the parent so the contract pane can scroll the matching
// highlight into view.
//
// Layout: icon (fixed-width, top-aligned) | [title / slug / preview]
// so all titles start at the same horizontal offset regardless of slug length.
export function ClauseCard({ clause, featured = false, onSelect, onShowWhy }: ClauseCardProps) {
  const [open, setOpen] = useState(false);

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
          // Fire onSelect only on the closed→open transition so a user
          // collapsing an already-active card does not retrigger
          // scroll-into-view in the contract pane.
          if (!open) onSelect?.(clause.id);
          setOpen((v) => !v);
        }}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <SeverityIcon severity={severity} className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm leading-snug font-semibold">{clause.title}</div>
          <div className="font-mono text-[10px] leading-tight opacity-50">{clause.id}</div>
          {!open && (
            <div className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
              {clause.explanation}
            </div>
          )}
        </div>
        <ChevronDown
          aria-hidden
          className={cn(
            "text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <CardContent className="flex flex-col gap-3 pt-0">
          {clause.originalText && (
            <blockquote className="border-border text-muted-foreground border-l-2 pl-3 text-sm italic">
              {truncate(clause.originalText)}
            </blockquote>
          )}
          <p className="text-sm leading-relaxed">{clause.explanation}</p>
          {clause.action && (
            <p className="text-sm leading-relaxed">
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
