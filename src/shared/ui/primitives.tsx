import type { ReactNode } from "react";
import { ArrowUpRight, BookOpen, Layers3 } from "lucide-react";
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
      aria-label="活动完成进度"
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
  return (
    <article className="course-card">
      <Link
        href={href}
        className={`course-art art-${index % 3}`}
        aria-label={`打开课程：${course.title}`}
      >
        <div className="art-grid" />
        <span className="course-art-label">{course.subject}</span>
        <span className="art-symbol">{["↗", "{ }", "✳"][index % 3]}</span>
        <span className="art-number">
          MINI COURSE · {String(index + 1).padStart(2, "0")}
        </span>
      </Link>
      <div className="course-card-body">
        <div className="course-meta">
          <span>
            <Layers3 size={13} />
            {course.lessons.length} 节短课
          </span>
          <Badge tone={course.status === "published" ? "green" : "amber"}>
            {course.status === "published" ? "已发布" : "草稿"}
          </Badge>
        </div>
        <h3>
          <Link href={href}>{course.title}</Link>
        </h3>
        <p>{course.description}</p>
        <div className="course-footer">
          {footer ?? <span>{getActivities(course).length} 个互动任务</span>}
          <Link
            href={href}
            className="icon-link"
            aria-label={`进入${course.title}`}
          >
            <ArrowUpRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}
