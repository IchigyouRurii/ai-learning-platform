import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Users } from "lucide-react";
import type { Classroom, CourseAssignment } from "@/shared/contracts";
import { Badge, EmptyState } from "@/shared/ui/primitives";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import styles from "./classes.module.css";
export function classDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    timeZone: "Asia/Hong_Kong",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
export function ClassLoadError({ error }: { error: string }) {
  return (
    <section className="panel">
      <h2>Unable to load classrooms</h2>
      <p className="error-text" role="alert">
        {error}
      </p>
      <a href="" className="text-link">
        Reload this page →
      </a>
    </section>
  );
}
export function ClassCards({
  items,
  role,
}: {
  items: Classroom[];
  role: "teacher" | "student";
}) {
  if (!items.length)
    return (
      <EmptyState
        title={
          role === "teacher"
            ? "Your first class starts here"
            : "You haven’t joined a class yet"
        }
      >
        {role === "teacher"
          ? "Create a class, bring your students together, and assign a course when you’re ready."
          : "Ask your teacher for a join code. Your class courses will appear here."}
      </EmptyState>
    );
  return (
    <div className={styles.grid}>
      {items.map((item) => (
        <article key={item.id} className={`panel ${styles.card}`}>
          <div className={styles.icon}>
            <Users size={23} strokeWidth={1.6} />
          </div>
          {item.status === "archived" && <Badge tone="amber">Archived</Badge>}
          <h2>
            <Link href={`/${role}/classes/${item.id}`}>{item.name}</Link>
          </h2>
          <p>
            {item.description || "A shared space for courses and learning."}
          </p>
          <div className={styles.meta}>
            <span>
              <Users size={14} />
              {item.memberCount}{" "}
              {item.memberCount === 1 ? "student" : "students"}
            </span>
            <span>
              <BookOpen size={14} />
              {item.assignmentCount}{" "}
              {item.assignmentCount === 1 ? "assignment" : "assignments"}
            </span>
          </div>
          <div className={styles.footer}>
            <small className={styles.hint}>
              {role === "teacher"
                ? `Created ${classDate(item.createdAt)}`
                : `Teacher · ${item.teacherName}`}
            </small>
            <Link href={`/${role}/classes/${item.id}`} className="text-link">
              Open class <ArrowRight size={15} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
export function ClassPagination({
  base,
  cursor,
  nextCursor,
  label = "classes",
}: {
  base: string;
  cursor?: string;
  nextCursor: string | null;
  label?: string;
}) {
  return (
    <nav className={styles.pagination} aria-label={`${label} pagination`}>
      <span className={styles.hint}>Newest first</span>
      <div className={styles.actions}>
        {cursor && (
          <Link href={base} className="text-link">
            First page
          </Link>
        )}
        {nextCursor && (
          <Link
            className="button secondary"
            href={`${base}?cursor=${encodeURIComponent(nextCursor)}`}
          >
            Next page <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </nav>
  );
}
export function AssignmentTable({
  assignments,
  teacherAction,
}: {
  assignments: CourseAssignment[];
  teacherAction?: (item: CourseAssignment) => React.ReactNode;
}) {
  if (!assignments.length)
    return (
      <EmptyState title="No courses assigned yet">
        Assigned courses will appear here with their learning version and due
        date.
      </EmptyState>
    );
  return (
    <Table className={styles.table}>
      <TableHeader>
        <TableRow>
          <TableHead>Course</TableHead>
          <TableHead>Due date</TableHead>
          <TableHead>Availability</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assignments.map((item) => (
          <TableRow key={item.id}>
            <TableCell className={styles.title}>
              {item.title}
              <span className={styles.secondary}>
                Version {item.courseVersion} · Assigned{" "}
                {classDate(item.assignedAt)}
              </span>
            </TableCell>
            <TableCell>
              <span className={styles.meta}>
                <CalendarDays size={14} />
                {item.dueAt ? classDate(item.dueAt) : "No due date"}
              </span>
            </TableCell>
            <TableCell>
              <Badge tone={item.available ? "green" : "amber"}>
                {item.available
                  ? "Available"
                  : item.classArchived
                    ? "Class archived"
                    : "Withdrawn"}
              </Badge>
            </TableCell>
            <TableCell>
              {teacherAction ? (
                teacherAction(item)
              ) : item.available ? (
                <Link
                  href={`/student/courses/${item.courseId}?version=${item.courseVersion}`}
                  className="button secondary"
                >
                  Start learning <ArrowRight size={14} />
                </Link>
              ) : (
                <span className={styles.hint}>Learning unavailable</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
