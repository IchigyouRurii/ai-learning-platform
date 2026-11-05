import Link from "next/link";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import type { TeachingFilters } from "../teaching-filters";

type CourseOption = { id: string; title: string };
type ClassOption = {
  id: string;
  name: string;
  courseId: string;
  courseTitle: string;
};

export function TeachingFilterForm({
  courseOptions,
  classOptions,
  filters,
  matchingCount,
}: {
  courseOptions: CourseOption[];
  classOptions: ClassOption[];
  filters: TeachingFilters;
  matchingCount: number;
}) {
  const selectedCourses = new Set(filters.courseIds);
  const selectedClasses = new Set(filters.classIds);
  const classGroups = new Map<string, ClassOption[]>();
  for (const option of classOptions) {
    const group = classGroups.get(option.courseTitle) ?? [];
    group.push(option);
    classGroups.set(option.courseTitle, group);
  }

  return (
    <form method="get" action="/teacher/students" className="panel">
      <input type="hidden" name="view" value="students" />
      <div className="grid gap-4 md:grid-cols-3">
        <details className="rounded-[var(--ui-control-radius)] border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Courses
            {filters.courseIds.length
              ? ` (${filters.courseIds.length} selected)`
              : ""}
          </summary>
          <div className="mt-3 grid max-h-56 gap-2 overflow-auto pr-1">
            {courseOptions.length ? (
              courseOptions.map((course) => (
                <label
                  key={course.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    name="course"
                    value={course.id}
                    defaultChecked={selectedCourses.has(course.id)}
                    className="mt-0.5 accent-primary"
                  />
                  <span>{course.title}</span>
                </label>
              ))
            ) : (
              <p className="muted text-sm">No courses with students yet.</p>
            )}
          </div>
        </details>

        <details className="rounded-[var(--ui-control-radius)] border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Classes
            {filters.classIds.length
              ? ` (${filters.classIds.length} selected)`
              : ""}
          </summary>
          <div className="mt-3 grid max-h-56 gap-3 overflow-auto pr-1">
            {classOptions.length ? (
              [...classGroups.entries()].map(([courseTitle, options]) => (
                <div key={courseTitle}>
                  <p className="form-hint font-medium">{courseTitle}</p>
                  <div className="mt-1 grid gap-2">
                    {options.map((option) => (
                      <label
                        key={option.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          name="class"
                          value={option.id}
                          defaultChecked={selectedClasses.has(option.id)}
                          className="mt-0.5 accent-primary"
                        />
                        <span>{option.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="muted text-sm">No classes with members yet.</p>
            )}
          </div>
        </details>

        <div className="grid content-start gap-2">
          <Label htmlFor="student-filter">Student name</Label>
          <Input
            id="student-filter"
            name="student"
            defaultValue={filters.studentQuery}
            placeholder="Search by name"
            maxLength={100}
          />
          <p className="form-hint">
            Filters are optional and combine together. Class options are grouped
            by course.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit">Apply filters</Button>
        <Link href="/teacher/students" className="text-link text-sm">
          Reset filters
        </Link>
        <span className="muted text-sm">
          {matchingCount} {matchingCount === 1 ? "student" : "students"} match
        </span>
      </div>
    </form>
  );
}
