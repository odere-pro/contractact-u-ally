"use client";

import { useCallback, useMemo, useState } from "react";

import { ContractPreview } from "@/components/organisms/ContractPreview";
import { ResultsFooter } from "@/components/organisms/ResultsFooter";
import { RiskRail } from "@/components/organisms/RiskRail";
import { ShareDialog } from "@/components/organisms/ShareDialog";
import { SimplifiedPane } from "@/components/organisms/SimplifiedPane";
import { WhyDrawer } from "@/components/organisms/WhyDrawer";
import { HitlBanner } from "@/components/molecules/HitlBanner";
import { DEFAULT_FILTER, type SeverityFilter } from "@/lib/clauseFilters";
import { severityOf } from "@/lib/severity";
import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";

interface ResultsLayoutProps {
  readonly ocrText: string;
  readonly clauses: readonly ClauseEvent[];
  readonly summary: SummaryEvent | null;
}

// 3-pane results surface. Owns transient UI state — active clause,
// severity filter, drawer + share dialog visibility — but stays
// stateless about analysis data, which flows in via props.
//
// Layout: fills the parent's height (the page wraps it in a flex
// container that owns viewport height). The grid lays out three
// independent scroll regions side-by-side; the center column has a
// generous minmax floor so the contract text never collapses to a
// word-per-line wrap. Below ~1024px we fall back to a stacked layout
// so each pane is still individually readable.
export function ResultsLayout({ ocrText, clauses, summary }: ResultsLayoutProps) {
  // Compliant clauses are dropped from every display surface — they're
  // noise in a "what to fix" UI. Counts in `summary` and `illegalCount`
  // still reflect the full set, so the HITL banner and share report stay
  // accurate.
  const displayClauses = useMemo(() => clauses.filter((c) => severityOf(c) !== "ok"), [clauses]);
  const [activeId, setActiveId] = useState<string | null>(displayClauses[0]?.id ?? null);
  const [selectionNonce, setSelectionNonce] = useState(0);
  const [filter, setFilter] = useState<SeverityFilter>(DEFAULT_FILTER);
  const [whyClause, setWhyClause] = useState<ClauseEvent | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const illegalCount = summary?.illegalCount ?? 0;

  const handleSelectClause = useCallback((id: string): void => {
    // Toggle expansion: clicking the active card collapses it.
    // Otherwise expand the clicked card and bump the nonce so the
    // scroll effects in ContractPreview / SimplifiedPane re-run even
    // when the user re-expands a clause they had just collapsed.
    setActiveId((prev) => (prev === id ? null : id));
    setSelectionNonce((n) => n + 1);
  }, []);

  const handleToggleSeverity = useCallback((sev: keyof SeverityFilter): void => {
    setFilter((prev) => ({ ...prev, [sev]: !prev[sev] }));
  }, []);

  const handleShowWhy = useCallback((c: ClauseEvent): void => {
    setWhyClause(c);
    setWhyOpen(true);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="results-layout">
      <HitlBanner illegalCount={illegalCount} onConnectLegalAid={() => setShareOpen(true)} />

      <div className="mx-auto grid min-h-0 w-full max-w-[1480px] flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(520px,820px)_400px]">
        <div className="border-border min-h-0 overflow-y-auto border-b lg:border-r lg:border-b-0">
          <RiskRail filter={filter} onToggleSeverity={handleToggleSeverity} />
        </div>
        <div className="bg-secondary/30 min-h-0">
          <ContractPreview
            ocrText={ocrText}
            clauses={displayClauses}
            activeId={activeId}
            selectionNonce={selectionNonce}
          />
        </div>
        <div className="border-border min-h-0 overflow-y-auto border-t lg:border-t-0 lg:border-l">
          <SimplifiedPane
            clauses={displayClauses}
            summary={summary}
            filter={filter}
            activeId={activeId}
            selectionNonce={selectionNonce}
            onSelectClause={handleSelectClause}
            onShowWhy={handleShowWhy}
          />
        </div>
      </div>

      <ResultsFooter onShare={() => setShareOpen(true)} />

      <WhyDrawer clause={whyClause} open={whyOpen} onOpenChange={setWhyOpen} />
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        summary={summary}
        clauses={clauses}
      />
    </div>
  );
}
