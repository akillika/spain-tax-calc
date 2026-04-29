/**
 * App-shell suspense fallback while the calculator hydrates.
 * Matches the two-pane layout to avoid layout shift.
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col">
      <header
        style={{
          height: 49,
          borderBottom: "1px solid var(--color-separator-soft)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div className="skeleton" style={{ width: 90, height: 16 }} />
        <div className="skeleton" style={{ width: 110, height: 12 }} />
        <div style={{ flex: 1 }} />
        <div className="skeleton" style={{ width: 240, height: 28, borderRadius: 6 }} />
      </header>
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,460px)_1fr]">
        <section
          style={{
            borderRight: "1px solid var(--color-separator-soft)",
            padding: 24,
          }}
          className="space-y-6"
        >
          <div className="skeleton" style={{ width: 80, height: 12 }} />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton" style={{ height: 36 }} />
            <div className="skeleton" style={{ height: 36 }} />
            <div className="skeleton" style={{ height: 36 }} />
            <div className="skeleton" style={{ height: 36 }} />
          </div>
          <div className="skeleton" style={{ width: 80, height: 12 }} />
          <div className="grid grid-cols-2 gap-3">
            <div className="skeleton" style={{ height: 36 }} />
            <div className="skeleton" style={{ height: 36 }} />
          </div>
        </section>
        <section style={{ padding: 24 }} className="space-y-6">
          <div className="skeleton" style={{ width: 200, height: 22 }} />
          <div className="skeleton" style={{ height: 96, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 12 }} />
        </section>
      </main>
    </div>
  );
}
