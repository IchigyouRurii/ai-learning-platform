"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/shared/ui/components/dialog";
import { catalogPreview } from "./catalog-preview";
import Link from "next/link";
import { ArrowRight, BookOpen, Search } from "lucide-react";
import type { Course, User } from "@/shared/contracts";
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
  query = "",
  subject = "All",
  creations = false,
}: {
  courses: Course[];
  author: User;
  query?: string;
  subject?: string;
  creations?: boolean;
}) {
  const base = creations ? "/teacher/creations" : "/teacher";
  type Entry = Pick<
    Course,
    "id" | "title" | "description" | "subject" | "status" | "lessons"
  > & {
    preview?: boolean;
    author?: string;
    moderationStatus?: "active" | "withdrawn";
  };
  const [selection, setSelection] = useState<{
    course: Entry;
    level: string;
  } | null>(null);
  // Public discovery is still reserved; keep the Figma catalog display-only.
  // Real drafts and published courses remain available under My Creations.
  const preview = !creations;
  const available: Entry[] = preview ? catalogPreview : courses;
  const subjects = [
    "All",
    "Computer Science",
    "Mathematics",
    "English",
    "Business",
    ...new Set(available.map((course) => subjectLabel(course.subject))),
  ].filter((value, index, array) => array.indexOf(value) === index);
  const filtered = filterCatalog(available, author.name, query, subject);
  return (
    <div className="catalog">
      <div className="catalog-heading">
        <div>
          <h1>{creations ? "My Creations" : "Course Marketplace"}</h1>
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
        <p className="catalog-scope">
          {preview
            ? "Prototype preview · Sample courses"
            : "Workspace catalog · Shared discovery is not connected yet"}
        </p>
      )}
      <nav className="subject-tabs" aria-label="Filter courses by subject">
        {subjects.map((item) => {
          const params = new URLSearchParams();
          if (item !== "All") params.set("subject", item);
          if (query) params.set("q", query);
          return (
            <Link
              key={item}
              href={`${base}${params.size ? `?${params}` : ""}`}
              className={`subject-tab${subject === item ? " selected" : ""}`}
              aria-current={subject === item ? "true" : undefined}
            >
              {item}
            </Link>
          );
        })}
      </nav>
      {query && (
        <p className="catalog-search-summary">
          Results for “{query}”{" "}
          <Link className="text-link" href={base}>
            Clear search
          </Link>
        </p>
      )}
      {filtered.length ? (
        <section className="course-grid marketplace-grid" aria-label="Courses">
          {filtered.map((course) => {
            const href = `/teacher/courses/${course.id}`;
            return (
              <article className="course-card marketplace-card" key={course.id}>
                {course.preview ? (
                  <button
                    type="button"
                    onClick={() => setSelection({ course, level: "Overview" })}
                    className="marketplace-cover"
                    style={{
                      backgroundImage: `url("${covers[available.findIndex((item) => item.id === course.id) % covers.length]}")`,
                    }}
                    aria-label={`View ${course.title}`}
                  >
                    <span className="sr-only">{course.title}</span>
                  </button>
                ) : (
                  <Link
                    href={href}
                    className="marketplace-cover"
                    style={{
                      backgroundImage: `url("${covers[available.findIndex((item) => item.id === course.id) % covers.length]}")`,
                    }}
                    aria-label={`View ${course.title}`}
                  >
                    <span className="sr-only">{course.title}</span>
                  </Link>
                )}
                <div className="marketplace-card-body">
                  <div className="marketplace-meta">
                    <span className="subject-label">
                      {subjectLabel(course.subject)}
                    </span>
                    {creations && (
                      <Badge
                        tone={
                          course.moderationStatus === "withdrawn"
                            ? "amber"
                            : course.status === "published"
                              ? "green"
                              : "amber"
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
                    {course.preview ? (
                      <button
                        className="course-title-button"
                        type="button"
                        onClick={() =>
                          setSelection({ course, level: "Overview" })
                        }
                      >
                        {course.title}
                      </button>
                    ) : (
                      <Link href={href}>{course.title}</Link>
                    )}
                  </h2>
                  <p>{course.description}</p>
                  <div className="course-author">
                    <span className="avatar" aria-hidden="true">
                      {(course.author ?? author.name).slice(0, 1)}
                    </span>
                    <span>{course.author ?? author.name}</span>
                  </div>
                </div>
                {!creations ? (
                  <div className="marketplace-levels">
                    {["Beginner", "Advanced", "Expert"].map((level) => (
                      <button
                        type="button"
                        key={level}
                        onClick={() => setSelection({ course, level })}
                        aria-label={`${course.title}: ${level}`}
                      >
                        {level}
                        <ArrowRight size={15} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Link className="marketplace-card-action" href={href}>
                    <span>
                      <BookOpen size={15} />
                      {course.lessons.length}{" "}
                      {course.lessons.length === 1 ? "lesson" : "lessons"}
                    </span>
                    <span>
                      View course <ArrowRight size={16} />
                    </span>
                  </Link>
                )}
              </article>
            );
          })}
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
              : "Create a course draft and publish it when it is ready."}
          </p>
          <Link
            className="button secondary"
            href={query || subject !== "All" ? base : "/teacher/courses/new"}
          >
            {query || subject !== "All" ? "Reset filters" : "Create Course"}
          </Link>
        </div>
      )}
      <Dialog
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open) setSelection(null);
        }}
      >
        <DialogContent>
          <DialogTitle>{selection?.course.title}</DialogTitle>
          <DialogDescription>
            {selection?.level} · {selection?.course.description}
          </DialogDescription>
          <p className="text-sm text-muted-foreground">
            {selection?.course.preview
              ? "This is a prototype preview. Course details and enrollment are not connected yet."
              : "Difficulty-specific content and teacher enrollment are not connected yet. You can preview the existing course below."}
          </p>
          <div className="flex justify-end gap-3">
            <DialogClose className="button secondary">Close</DialogClose>
            {selection && !selection.course.preview && (
              <Link
                className="button primary"
                href={`/teacher/courses/${selection.course.id}`}
              >
                Preview course
              </Link>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <p className="catalog-cover-note">
        Illustrative covers · Course content is provided by its author.
      </p>
    </div>
  );
}
