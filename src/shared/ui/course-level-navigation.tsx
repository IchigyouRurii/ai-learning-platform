import Link from "next/link";
import { COURSE_LEVELS, type CourseLevel } from "@/shared/contracts";
export function CourseLevelNavigation({
  value,
  href,
}: {
  value: CourseLevel;
  href: string;
}) {
  return (
    <nav
      className="subject-tabs course-level-tabs"
      aria-label="Course difficulty"
    >
      {COURSE_LEVELS.map((level) => (
        <Link
          key={level}
          href={`${href}?level=${level}`}
          scroll={false}
          className={`subject-tab${value === level ? " selected" : ""}`}
          aria-current={value === level ? "page" : undefined}
        >
          {level[0].toUpperCase() + level.slice(1)}
        </Link>
      ))}
    </nav>
  );
}
