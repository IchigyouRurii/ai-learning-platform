"use client";

import { type MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import { IntentLink as Link } from "@/shared/ui/components/intent-link";
import { ArrowRight, Search } from "lucide-react";
import {
  COURSE_SUBJECTS,
  type CatalogCourse,
  type User,
} from "@/shared/contracts";
import { filterCatalog, subjectLabel } from "@/shared/ui/course-catalog";
import { Badge } from "@/shared/ui/primitives";

const covers = [
  "https://images.unsplash.com/photo-1549791084-5f78368b208b?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1632667680404-572c57873c21?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1520529890308-f503006340b4?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1522743791393-522312deeebf?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1521194263619-39ecc5b55c61?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1614595737476-42487331b8a1?auto=format&fit=crop&w=1200&q=85",
];

export function CourseCatalog({
  courses,
  author,
  creations = false,
}: {
  courses: CatalogCourse[];
  author: User;
  creations?: boolean;
}) {
  const student = author.role === "student";
  const base = student
    ? "/student"
    : creations
      ? "/teacher/creations"
      : "/teacher";
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  // Old bookmarked subject parameters must not hide courses in My Creation.
  const subject = creations ? "All" : (params.get("subject") ?? "All");
  function changeFilter(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    window.history.pushState(null, "", event.currentTarget.href);
  }
  const subjects = ["All", ...COURSE_SUBJECTS];
  const filtered = filterCatalog(courses, author.name, query, subject);
  const courseHref = (id: string) =>
    student
      ? `/student/courses/${id}`
      : creations
        ? `/teacher/courses/${id}`
        : `/teacher/marketplace/${id}`;
  return (
    <div className="catalog">
      <div className="catalog-heading">
        <div>
          <h1>{creations ? "My Creation" : "Course Marketplace"}</h1>
          <p className="muted">
            {creations
              ? "Manage your drafts and published courses."
              : "Explore new fields and deepen your knowledge."}
          </p>
        </div>
        <span className="catalog-count" role="status">
          {filtered.length} {filtered.length === 1 ? "course" : "courses"}
        </span>
      </div>
      {!creations && (
        <nav className="subject-tabs" aria-label="Filter courses by subject">
          {subjects.map((item) => {
            const search = new URLSearchParams();
            if (item !== "All") search.set("subject", item);
            if (query) search.set("q", query);
            return (
              <a
                onClick={changeFilter}
                key={item}
                href={`${base}${search.size ? `?${search}` : ""}`}
                className={`subject-tab${subject === item ? " selected" : ""}`}
                aria-current={subject === item ? "true" : undefined}
              >
                {item}
              </a>
            );
          })}
        </nav>
      )}
      {query && (
        <p className="catalog-search-summary">
          Results for “{query}”{" "}
          <a className="text-link" href={base} onClick={changeFilter}>
            Clear search
          </a>
        </p>
      )}
      {filtered.length ? (
        <section className="course-grid marketplace-grid" aria-label="Courses">
          {filtered.map((course) => (
            <article className="course-card marketplace-card" key={course.id}>
              <Link
                href={courseHref(course.id)}
                className="marketplace-cover"
                style={{
                  backgroundImage: `url("${covers[courses.findIndex((item) => item.id === course.id) % covers.length]}")`,
                }}
                aria-label={`View ${course.title}`}
              >
                <span className="sr-only">{course.title}</span>
              </Link>
              <div className="marketplace-card-body">
                <div className="marketplace-meta">
                  <span className="subject-label">
                    {subjectLabel(course.subject, course.title)}
                  </span>
                  {creations && (
                    <Badge
                      tone={
                        course.moderationStatus === "withdrawn" ||
                        course.status === "draft"
                          ? "amber"
                          : "green"
                      }
                    >
                      {course.moderationStatus === "withdrawn"
                        ? "Withdrawn"
                        : course.status === "published"
                          ? "Published"
                          : "Draft"}
                    </Badge>
                  )}
                </div>
                <h2>
                  <Link href={courseHref(course.id)}>{course.title}</Link>
                </h2>
                <p>{course.description}</p>
                <div className="course-author">
                  <span className="avatar" aria-hidden="true">
                    {course.author.slice(0, 1)}
                  </span>
                  <span>{course.author}</span>
                </div>
              </div>
              <div className="marketplace-levels">
                {["beginner", "advanced", "expert"].map((level) => (
                  <Link
                    key={level}
                    href={`${courseHref(course.id)}?level=${level}`}
                    aria-label={`${course.title}: ${level}`}
                  >
                    {level[0].toUpperCase() + level.slice(1)}
                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="catalog-empty">
          <Search size={28} />
          <h2>
            {query || subject !== "All"
              ? "No courses found"
              : creations
                ? "No courses yet"
                : "No published courses yet"}
          </h2>
          <p>
            {query || subject !== "All"
              ? "Try a different search or subject."
              : creations
                ? "Create a draft, review it, then publish it to the marketplace."
                : "Published courses will appear here after their authors review and publish them."}
          </p>
          {query || subject !== "All" ? (
            <a className="button secondary" href={base} onClick={changeFilter}>
              Reset filters
            </a>
          ) : (
            <Link
              className="button secondary"
              href={student ? "/student/studio" : "/teacher/courses/new"}
            >
              Create Course
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
