import Link from "next/link";
import { ChevronDown } from "lucide-react";
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

const selectLikeClass =
  "flex h-10 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-[var(--ui-control-radius)] border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden";
const dropdownClass =
  "absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-auto rounded-[var(--ui-card-radius)] border border-border bg-background p-3 shadow-lg";
const checkboxClass = "mt-0.5 size-4 shrink-0 accent-primary";
const optionClass = "mb-0 flex items-start gap-2 text-sm font-normal";

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
        <div className="grid content-start gap-2">
          <span className="text-sm font-medium text-foreground">Courses</span>
          <details className="relative">
            <summary className={selectLikeClass}>
              <span className="truncate">
                {filters.courseIds.length
                  ? `${filters.courseIds.length} selected`
                  : "All courses"}
              </span>
              <ChevronDown
                size={16}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </summary>
            <div className={dropdownClass}>
              {courseOptions.length ? (
                <div className="grid gap-2">
                  {courseOptions.map((course) => (
                    <label key={course.id} className={optionClass}>
                      <input
                        data-slot="checkbox"
                        type="checkbox"
                        name="course"
                        value={course.id}
                        defaultChecked={selectedCourses.has(course.id)}
                        className={checkboxClass}
                      />
                      <span>{course.title}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="muted text-sm">No courses with students yet.</p>
              )}
            </div>
          </details>
        </div>

        <div className="grid content-start gap-2">
          <span className="text-sm font-medium text-foreground">Classes</span>
          <details className="relative">
            <summary className={selectLikeClass}>
              <span className="truncate">
                {filters.classIds.length
                  ? `${filters.classIds.length} selected`
                  : "All classes"}
              </span>
              <ChevronDown
                size={16}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </summary>
            <div className={dropdownClass}>
              {classOptions.length ? (
                <div className="grid gap-3">
                  {[...classGroups.entries()].map(([courseTitle, options]) => (
                    <div key={courseTitle}>
                      <p className="text-xs font-medium text-muted-foreground">
                        {courseTitle}
                      </p>
                      <div className="mt-1.5 grid gap-2">
                        {options.map((option) => (
                          <label key={option.id} className={optionClass}>
                            <input
                              data-slot="checkbox"
                              type="checkbox"
                              name="class"
                              value={option.id}
                              defaultChecked={selectedClasses.has(option.id)}
                              className={checkboxClass}
                            />
                            <span>{option.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted text-sm">No classes with members yet.</p>
              )}
            </div>
          </details>
        </div>

        <div className="grid content-start gap-2">
          <Label
            htmlFor="student-filter"
            className="text-sm font-medium text-foreground"
          >
            Student name
          </Label>
          <Input
            id="student-filter"
            name="student"
            defaultValue={filters.studentQuery}
            placeholder="Search by name"
            maxLength={100}
            className="h-10"
          />
        </div>
      </div>
      <p className="form-hint mt-3">
        Filters are optional and combine together. Class options are grouped by
        course.
      </p>
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
