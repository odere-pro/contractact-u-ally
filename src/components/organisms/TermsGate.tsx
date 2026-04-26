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
  const [declined, setDeclined] = useState(false);
  // Derive open state directly — no effect needed. We deliberately
  // never auto-show before hydration to avoid a flash-of-modal on the
  // first paint; once the storage read resolves the gate either is or
  // isn't shown.
  const open = hydrated && !accepted && !declined;

  function handleDecline(): void {
    // No external redirect — the user explicitly declined the terms.
    // We hide the modal and surface a small notice via the declined
    // branch below; the rest of the app remains visually present but
    // every action that uploads a document will re-trigger the gate.
    setDeclined(true);
  }

  return (
    <>
      {/* When the storage read is in flight, blank the body so we
          neither flash an unblocked app (declined-but-not-yet-shown)
          nor flash an open modal that immediately closes for a
          previously-accepted user. */}
      <div aria-hidden={!hydrated} className={hydrated ? undefined : "opacity-0"}>
        {children}
      </div>
      {hydrated && declined && !accepted && (
        <div role="status" className="bg-secondary text-foreground p-3 text-center text-sm">
          You declined the terms. Uploads are disabled until you accept them.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setDeclined(false)}
            data-testid="terms-reopen"
          >
            Re-open terms
          </button>
        </div>
      )}
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
            <Button variant="ghost" onClick={handleDecline}>
              Decline
            </Button>
            <Button
              data-testid="terms-accept"
              onClick={() => {
                accept();
                setDeclined(false);
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
