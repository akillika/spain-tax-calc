"use client";

/**
 * Root-level error boundary. Catches errors thrown in the root layout
 * (where the segment-level error.tsx can't help). Must include its own
 * <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif',
          background: "#fbfbfd",
          color: "#1d1d1f",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            width: "100%",
            background: "#ffffff",
            border: "1px solid #d2d2d7",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 10px 28px -16px rgba(0,0,0,0.14)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "#b3261e",
            }}
          >
            Critical error
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginTop: 4, letterSpacing: "-0.01em" }}>
            The application could not load.
          </h1>
          <p style={{ marginTop: 12, fontSize: 13, color: "#6e6e73" }}>
            {error.message || "Unknown error."}
          </p>
          {error.digest ? (
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                fontFamily: '"SF Mono", ui-monospace, Menlo, monospace',
                color: "#86868b",
              }}
            >
              digest {error.digest}
            </div>
          ) : null}
          <button
            onClick={() => reset()}
            style={{
              marginTop: 20,
              height: 32,
              padding: "0 14px",
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              border: "1px solid #1d1d1f",
              background: "#1d1d1f",
              color: "#fbfbfd",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
