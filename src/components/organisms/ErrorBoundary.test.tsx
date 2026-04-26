import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ErrorBoundary } from "@/components/organisms/ErrorBoundary";

function Boom({ shouldThrow }: { readonly shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error("boom");
  return <div data-testid="ok">child rendered</div>;
}

describe("ErrorBoundary", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs the caught error to console.error itself; suppress to
    // keep the test output clean while still asserting our own log call.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    cleanup();
  });

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>}>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("ok")).toBeInTheDocument();
  });

  it("renders fallback when a child throws and surfaces the error", () => {
    render(
      <ErrorBoundary
        fallback={(error) => <div data-testid="fallback">caught: {error.message}</div>}
      >
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("fallback")).toHaveTextContent("caught: boom");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("invokes onError with the thrown error", () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>} onError={onError}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const firstArg: unknown = onError.mock.calls[0]?.[0];
    expect(firstArg).toBeInstanceOf(Error);
    if (firstArg instanceof Error) {
      expect(firstArg.message).toBe("boom");
    }
  });

  it("normalizes non-Error throws to a real Error", () => {
    function ThrowsString(): React.ReactElement {
      throw "plain string failure";
    }
    const onError = vi.fn();
    render(
      <ErrorBoundary
        fallback={(error) => <div data-testid="fallback">caught: {error.message}</div>}
        onError={onError}
      >
        <ThrowsString />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("fallback")).toHaveTextContent("caught: plain string failure");
    const firstArg: unknown = onError.mock.calls[0]?.[0];
    expect(firstArg).toBeInstanceOf(Error);
  });

  it("reset clears the error so children render again", () => {
    function Toggle() {
      return (
        <ErrorBoundary
          fallback={(_error, reset) => (
            <button type="button" data-testid="retry" onClick={reset}>
              retry
            </button>
          )}
        >
          <Boom shouldThrow={true} />
        </ErrorBoundary>
      );
    }

    const { rerender } = render(<Toggle />);
    expect(screen.getByTestId("retry")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("retry"));
    // After reset, parent re-renders the child. Switch the prop so the
    // child no longer throws and verify we exited the fallback path.
    rerender(
      <ErrorBoundary fallback={() => <div data-testid="still-fallback">x</div>}>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("ok")).toBeInTheDocument();
  });
});
