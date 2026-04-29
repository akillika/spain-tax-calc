"use client";

import { useEffect } from "react";

/**
 * App-router segment error boundary. Caught by Next.js when a client
 * component throws below this segment. Layout chrome remains intact.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[spain-tax] segment error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-6 max-w-lg w-full">
        <div className="section-title" style={{ color: "var(--color-danger)" }}>
          Something went wrong
        </div>
        <h1 className="text-[18px] font-semibold tracking-tight mt-1">
          The calculator hit an unexpected error.
        </h1>
        <p className="mt-3 text-[13px]" style={{ color: "var(--color-fg-secondary)" }}>
          {error.message || "Unknown error."}
        </p>
        {error.digest && (
          <div className="mt-2 text-[11px] num" style={{ color: "var(--color-fg-tertiary)" }}>
            digest {error.digest}
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button className="btn btn-primary" type="button" onClick={() => reset()}>
            Try again
          </button>
          <a className="btn" href="/">
            Reload calculator
          </a>
        </div>
      </div>
    </div>
  );
}
