"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { buildTxtReport, reportFilename } from "@/lib/txtExport";
import type { Profile } from "@/lib/profileCopy";
import type { ClauseEvent, SummaryEvent } from "@/lib/catalog/types";

interface ShareDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly summary: SummaryEvent | null;
  readonly clauses: readonly ClauseEvent[];
  readonly profile: Profile;
}

// Local-download share. Server-side share links are out of scope
// without persistence; everything here is generated in the browser.
export function ShareDialog({ open, onOpenChange, summary, clauses, profile }: ShareDialogProps) {
  const handleDownloadTxt = () => {
    const generatedAt = new Date();
    const body = buildTxtReport({ summary, clauses, profile, generatedAt });
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportFilename(generatedAt);
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Defer the revoke so Firefox/Safari have time to start the download
    // before the URL becomes invalid. 60s is generous; the browser stops
    // needing the URL the moment the network request fires.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    onOpenChange(false);
  };

  const illegal = summary?.illegalCount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Share or download"
        description="The simplified report is generated in your browser. Nothing leaves this device until you share the file you save."
      >
        <div className="flex flex-col gap-3">
          <Button data-testid="download-txt" onClick={handleDownloadTxt} className="self-start">
            <Download aria-hidden className="size-4" />
            Download contract + notes (TXT)
          </Button>
          {illegal > 0 && (
            <p className="bg-critical-soft text-critical border-critical rounded-md border px-3 py-2 text-xs">
              ⚠ This contract has {illegal} critical {illegal === 1 ? "finding" : "findings"}.
              Anyone you share the file with will see them.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
