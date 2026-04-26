"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { SectionRef } from "@/components/atoms/SectionRef";
import { SeverityBadge } from "@/components/molecules/SeverityBadge";
import { Card, CardContent } from "@/components/ui/card";
import { MIGRANT_WORKER_LABEL } from "@/lib/profileCopy";
import { severityOf } from "@/lib/severity";
import type { ClauseEvent } from "@/lib/catalog/types";

interface WhyDrawerProps {
  readonly clause: ClauseEvent | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

// Side drawer that explains a single clause: severity, plain-language
// rationale, and the rule citation. Title matches the only entrypoint
// label in ClauseCard ("Ask a question") so the heading doesn't read
// as a different question than the button the user just clicked.
export function WhyDrawer({ clause, open, onOpenChange }: WhyDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {clause && (
        <SheetContent
          title="About this clause"
          description={
            <span>
              <SectionRef id={clause.id} /> · {clause.title}
            </span>
          }
        >
          <div className="flex items-center gap-2">
            <SeverityBadge severity={severityOf(clause)} />
          </div>
          <p className="text-sm">{clause.explanation}</p>
          {clause.action && (
            <p className="text-sm">
              <strong>What to do:</strong> {clause.action}
            </p>
          )}
          {clause.citation && (
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <span className="text-muted-foreground text-xs tracking-wide uppercase">
                  Source
                </span>
                <span className="font-semibold">{clause.citation.label}</span>
                <span className="text-muted-foreground text-xs">{clause.citation.article}</span>
                <span className="text-muted-foreground text-[11px]">
                  Supplied by {clause.citation.source}
                </span>
              </CardContent>
            </Card>
          )}
          <div className="bg-secondary/40 mt-auto flex items-center gap-2 rounded-md p-2 text-xs">
            <span className="font-semibold">Reading level:</span>
            <span>{MIGRANT_WORKER_LABEL}</span>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
