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
  readonly onShowWhy?: (clause: ClauseEvent) => void;
}

const MAX_ORIGINAL_TEXT_RENDER = 600;
function truncate(text: string): string {
  return text.length > MAX_ORIGINAL_TEXT_RENDER
    ? `${text.slice(0, MAX_ORIGINAL_TEXT_RENDER)}…`
    : text;
}

// Single clause card in the simplified pane. Featured cards are
// pre-expanded with prominent visual weight — used for the highest-
// severity finding. Non-featured cards are collapsible.
export function ClauseCard({ clause, featured = false, onShowWhy }: ClauseCardProps) {
  const [open, setOpen] = useState(featured);
  const severity = severityOf(clause);
  return (
    <Card
      id={`clause-${encodeURIComponent(clause.id)}`}
      data-testid={`clause-card-${clause.id}`}
      data-severity={severity}
      className={cn(featured && "border-2")}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
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
