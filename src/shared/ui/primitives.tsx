import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Braces,
  Layers3,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { Course } from "@/shared/contracts";
import { getActivities } from "@/shared/contracts";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function ProgressBar({ percent }: { percent: number }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Activity completion"
    >
      <div style={{ width: `${percent}%` }} />
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <BookOpen size={28} />
      <h3>{title}</h3>
      <p className="muted">{children}</p>
    </div>
  );
}
export function CourseCard({
  course,
  href,
  index = 0,
  footer,
}: {
  course: Course;
  href: string;
  index?: number;
  footer?: ReactNode;
}) {
  const CoverIcon = [Workflow, Braces, BookOpen][index % 3];
  return (
    <article className="course-card">
      <Link
        href={href}
        className={`course-art art-${index % 3}`}
        aria-label={`Open course: ${course.title}`}
      >
        <div className="art-grid" aria-hidden="true" />
        <span className="course-art-label">{course.subject}</span>
        <CoverIcon className="art-symbol" aria-hidden="true" strokeWidth={1} />
        <span className="art-number">
          MINI COURSE · {String(index + 1).padStart(2, "0")}
        </span>
      </Link>
      <div className="course-card-body">
        <div className="course-meta">
          <span>
            <Layers3 size={13} />
            {course.lessons.length} lessons
          </span>
          <Badge tone={course.status === "published" ? "green" : "amber"}>
            {course.status === "published" ? "Published" : "Draft"}
          </Badge>
        </div>
        <h3>
          <Link href={href}>{course.title}</Link>
        </h3>
        <p>{course.description}</p>
        <div className="course-footer">
          {footer ?? <span>{getActivities(course).length} activities</span>}
          <Link
            href={href}
            className="icon-link"
            aria-label={`Open ${course.title}`}
          >
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}
