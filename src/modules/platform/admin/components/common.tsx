import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/shared/ui/components/button";
import { pageLink } from "../query";
import styles from "../admin.module.css";

export function AdminTabs({
  current,
}: {
  current: "overview" | "users" | "courses" | "classrooms";
}) {
  return (
    <nav className={styles.tabs} aria-label="Administration sections">
      {(
        [
          ["overview", "/admin", "Overview"],
          ["users", "/admin/users", "Users"],
          ["courses", "/admin/courses", "Courses"],
          ["classrooms", "/admin/classes", "Classes"],
        ] as const
      ).map(([key, href, label]) => (
        <Link
          key={key}
          href={href}
          className={`${styles.tab}${current === key ? ` ${styles.active}` : ""}`}
          aria-current={current === key ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
export function AdminPagination({
  base,
  filters,
  cursor,
  nextCursor,
  count,
}: {
  base: string;
  filters: Record<string, string>;
  cursor: string;
  nextCursor: string | null;
  count: number;
}) {
  return (
    <div className={styles.pagination}>
      <small>
        {count} {count === 1 ? "result" : "results"} on this page · Newest first
      </small>
      <div className={styles.paginationLinks}>
        {cursor && (
          <Button variant="outline" asChild>
            <Link href={pageLink(base, filters)}>First page</Link>
          </Button>
        )}
        {nextCursor && (
          <Button variant="outline" asChild>
            <Link href={pageLink(base, filters, nextCursor)}>Next page →</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
export function AdminNote({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <div className={styles.note}>
      {icon}
      <span>{children}</span>
    </div>
  );
}
