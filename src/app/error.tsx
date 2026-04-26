"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

// Next.js route-segment error boundary. Renders when a render error
// escapes a Server Component or any client component below this segment.
// `reset()` re-mounts the segment, so the user can retry without losing
// the rest of the app shell (header, terms-gate state).
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Mirrors the in-tree ErrorBoundary so devtools always surface the
    // original stack, even when the segment-level boundary catches it.
    console.error("App route boundary caught:", error);
  }, [error]);

  return (
    <section
      className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-6 overflow-y-auto px-6 py-12"
      data-testid="route-error-fallback"
    >
      <Alert variant="destructive">
        <AlertTitle>Something went wrong loading this page.</AlertTitle>
        <AlertDescription>
          We&apos;ve logged the issue. Try reloading — if the same error keeps appearing, your
          contract did not leave your browser, so it&apos;s safe to start over with a fresh upload.
          {error.digest ? ` Reference: ${error.digest}.` : ""}
        </AlertDescription>
      </Alert>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </section>
  );
}
