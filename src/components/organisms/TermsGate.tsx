"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTerms } from "@/hooks/useTerms";

interface TermsGateProps {
  readonly children: ReactNode;
}

// Blocks first-load with a one-time T&C dialog. Once accepted, never
// re-shown unless the user clears storage. The body still renders
// behind the modal so post-acceptance there's no extra paint.
export function TermsGate({ children }: TermsGateProps) {
  const { accepted, hydrated, accept } = useTerms();
  // Derive open state directly — no effect needed. `dismissed` lets
  // the user close the gate locally without revoking the persisted
  // acceptance.
  const [dismissed, setDismissed] = useState(false);
  const open = hydrated && !accepted && !dismissed;

  return (
    <>
      {children}
      <Dialog open={open}>
        <DialogContent
          title="Terms & Conditions"
          description="contractact-u-ally analyzes employment contracts to identify risks. Your document is processed in memory only — never persisted to disk or shared with third parties."
          hideCloseButton
        >
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
            <li>
              The analysis is informational. Consult legal counsel before signing or rejecting any
              contract.
            </li>
            <li>We do not store your contract content. Your browser holds the result in memory.</li>
            <li>Document text is sent to a third-party LLM for clause analysis.</li>
          </ul>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                window.location.href = "https://en.wikipedia.org/wiki/Employment_contract";
              }}
            >
              Decline
            </Button>
            <Button
              data-testid="terms-accept"
              onClick={() => {
                accept();
                setDismissed(true);
              }}
            >
              Accept
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
