"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state">
      <h1>Unable to load this page</h1>
      <p className="muted">
        Please try again. If you changed configuration, check the server
        terminal for details.
      </p>
      <button className="button primary" onClick={reset}>
        Reload
      </button>
    </div>
  );
}
