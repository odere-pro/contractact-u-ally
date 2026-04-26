"use client";

import { useCallback, useState } from "react";

import { ContractPreview } from "@/components/organisms/ContractPreview";
import { ResultsFooter } from "@/components/organisms/ResultsFooter";
import { RiskRail } from "@/components/organisms/RiskRail";
import { ShareDialog } from "@/components/organisms/ShareDialog";
import { SimplifiedPane } from "@/components/organisms/SimplifiedPane";
import { WhyDrawer } from "@/components/organisms/WhyDrawer";
import { HitlBanner } from "@/components/molecules/HitlBanner";
import { ALL_SEVERITIES_SHOWN, type SeverityFilter } from "@/lib/clauseFilters";
import { showsLegalAidEscalation, type Profile } from "@/lib/profileCopy";
import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";

interface ResultsLayoutProps {
  readonly ocrText: string;
  readonly clauses: readonly ClauseEvent[];
  readonly summary: SummaryEvent | null;
  readonly profile: Profile;
}

// 3-pane results surface. Owns transient UI state — active clause,
// severity filter, drawer + share dialog visibility — but stays
// stateless about analysis data, which flows in via props.
export function ResultsLayout({ ocrText, clauses, summary, profile }: ResultsLayoutProps) {
  const [activeId, setActiveId] = useState<string | null>(clauses[0]?.id ?? null);
  const [filter, setFilter] = useState<SeverityFilter>(ALL_SEVERITIES_SHOWN);
  const [whyClause, setWhyClause] = useState<ClauseEvent | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const illegalCount = summary?.illegalCount ?? 0;

  const handleSelectClause = useCallback((id: string): void => {
    setActiveId(id);
    if (typeof document !== "undefined") {
      const el = document.getElementById(`clause-${encodeURIComponent(id)}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleToggleSeverity = useCallback((sev: keyof SeverityFilter): void => {
    setFilter((prev) => ({ ...prev, [sev]: !prev[sev] }));
  }, []);

  const handleShowWhy = useCallback((c: ClauseEvent): void => {
    setWhyClause(c);
    setWhyOpen(true);
  }, []);

  return (
    <div className="flex flex-col gap-0" data-testid="results-layout">
      {showsLegalAidEscalation(profile) && (
        <HitlBanner illegalCount={illegalCount} onConnectLegalAid={() => setShareOpen(true)} />
      )}

      <div className="border-border grid border-y md:grid-cols-[240px_minmax(0,1fr)_360px]">
        <RiskRail
          clauses={clauses}
          activeId={activeId}
          filter={filter}
          onSelectClause={handleSelectClause}
          onToggleSeverity={handleToggleSeverity}
        />
        <ContractPreview ocrText={ocrText} clauses={clauses} activeId={activeId} />
        <SimplifiedPane
          clauses={clauses}
          summary={summary}
          profile={profile}
          filter={filter}
          onShowWhy={handleShowWhy}
        />
      </div>

      <ResultsFooter onShare={() => setShareOpen(true)} />

      <WhyDrawer clause={whyClause} profile={profile} open={whyOpen} onOpenChange={setWhyOpen} />
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        summary={summary}
        clauses={clauses}
        profile={profile}
      />
    </div>
  );
}
