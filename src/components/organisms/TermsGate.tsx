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
          description="Review the terms below. Accept to continue using contractact-u-ally."
          hideCloseButton
          className="sm:w-[min(560px,92%)]"
        >
          {/* -mx-6/px-6 deliberately mirrors DialogContent's p-6 (see ui/dialog.tsx)
              so the divider reaches the popup's edges. tabIndex + role expose the
              region to keyboard-only users so the scrollbar is reachable. */}
          <div
            tabIndex={0}
            role="region"
            aria-label="Terms and conditions content"
            className="border-border -mx-6 max-h-[55vh] overflow-y-auto border-y px-6 py-5 focus-visible:outline-2"
          >
            <dl className="flex flex-col gap-5 text-sm">
              <div className="flex flex-col gap-1.5">
                <dt className="text-foreground font-semibold">1. Service overview</dt>
                <dd className="text-muted-foreground leading-relaxed">
                  contractact-u-ally analyzes employment contracts to flag clauses that may conflict
                  with applicable labour law and to surface their practical impact.
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="text-foreground font-semibold">2. Data privacy</dt>
                <dd className="text-muted-foreground leading-relaxed">
                  Your document is processed in memory only — never persisted to disk and never
                  shared with third parties beyond the LLM provider that performs the analysis.
                </dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <dt className="text-foreground font-semibold">3. Limitation of liability</dt>
                <dd className="text-muted-foreground leading-relaxed">
                  Results are informational and do not constitute legal advice. Consult qualified
                  legal counsel before signing or rejecting any contract.
                </dd>
              </div>
            </dl>
            <p className="text-muted-foreground mt-5 text-xs">
              Read our{" "}
              <a
                href="/privacy"
                className="text-primary underline underline-offset-2 hover:no-underline"
              >
                Privacy Policy
              </a>
              .
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleDecline}>
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
