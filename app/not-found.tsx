/**
 * 404 fallback. Replaces Next.js's default to keep design language consistent.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-6 max-w-md w-full text-center">
        <div className="section-title">404</div>
        <h1 className="text-[18px] font-semibold tracking-tight mt-1">
          Page not found
        </h1>
        <p className="mt-3 text-[13px]" style={{ color: "var(--color-fg-secondary)" }}>
          The route you requested does not exist.
        </p>
        <div className="mt-5">
          <a className="btn btn-primary" href="/">
            Back to calculator
          </a>
        </div>
      </div>
    </div>
  );
}
