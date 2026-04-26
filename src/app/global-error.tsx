"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

// Next.js root boundary — this fires when the root layout itself throws
// (or anything above the route-segment error.tsx). It replaces the entire
// document, so it must include its own <html> and <body>. Styles live in
// inline CSS variables only: globals.css may not have loaded if the
// crash happened that early.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0b0b0d",
          color: "#f7f7f8",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            The app failed to load.
          </h1>
          <p style={{ marginBottom: "1.5rem", lineHeight: 1.5 }}>
            Something went wrong before we could render the page. Your contract was never sent
            anywhere. Try again — if it keeps failing, please refresh the browser.
            {error.digest ? ` Reference: ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #f7f7f8",
              background: "transparent",
              color: "#f7f7f8",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
