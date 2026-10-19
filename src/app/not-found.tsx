import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p className="muted">
        The course may be unpublished or the link may have changed.
      </p>
      <Link className="button primary" href="/">
        Back to workspace
      </Link>
    </div>
  );
}
