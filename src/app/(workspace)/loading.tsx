/** Keep the workspace shell visible and show a content skeleton, not a full-page spinner. */
export default function WorkspaceLoading() {
  return (
    <section
      className="workspace-loading"
      role="status"
      aria-label="Loading page"
    >
      <span className="sr-only">Loading page…</span>
      <div aria-hidden="true">
        <div className="mb-4 h-8 w-56 rounded-lg bg-muted" />
        <div className="mb-8 h-4 w-72 max-w-full rounded bg-muted" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-64 rounded-2xl border border-border bg-white/60"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
