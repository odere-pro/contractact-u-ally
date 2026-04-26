"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: (error: Error, reset: () => void) => ReactNode;
  readonly onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

// React 19 still ships the class-based componentDidCatch contract; there
// is no functional equivalent. Wrap any subtree where a thrown render
// error should be contained instead of unmounting the whole document
// (the page-level <ResultsLayout>, in our case, so a crash in the
// results pane does not lose the user's upload state).
//
// Always logs to console.error so devtools still surface the original
// stack trace — fallback UI is for the user, not a substitute for
// observability.

// React's lifecycle types accept `unknown` because user code can `throw`
// any value. Normalize once here so every consumer of `fallback` and
// `onError` always sees a real Error with a usable .message.
function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  try {
    return new Error(typeof value === "string" ? value : JSON.stringify(value));
  } catch {
    return new Error("Unknown error");
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const normalized = toError(error);
    console.error("ErrorBoundary caught:", normalized, info.componentStack);
    this.props.onError?.(normalized, info);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error !== null) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
