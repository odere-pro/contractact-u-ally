"use client";

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

export function ClauseCard({ clause, featured = false, onSelect, onShowWhy }: ClauseCardProps) {
  const severity = severityOf(clause);
  return (
    <Card
      data-testid={`clause-card-${clause.id}`}
      data-severity={severity}
      style={{ transition: "border-color var(--duration-fast) var(--ease-out-expo)" }}
      className={cn(featured && "border-foreground/40 border-2 shadow-sm")}
      onClick={() => onSelect?.(clause.id)}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <SeverityBadge severity={severity} compact={!featured} />
          <div className="flex items-center gap-2">
            <SectionRef id={clause.id} />
            <span className="font-medium">{clause.title}</span>
          </div>
        </div>
        <p className="text-sm">{clause.explanation}</p>
        {onShowWhy && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onShowWhy(clause);
              }}
            >
              Explain why
            </Button>
            {clause.citation && (
              <Button size="sm" variant="ghost" disabled>
                {clause.citation.article}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
