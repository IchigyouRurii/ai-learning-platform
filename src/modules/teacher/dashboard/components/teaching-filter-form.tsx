"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import {
  filterStudentOptions,
  type StudentFilterOption,
  type TeachingFilters,
} from "../teaching-filters";

type CourseOption = { id: string; title: string };
type ClassOption = {
  id: string;
  name: string;
  courseId: string;
  courseTitle: string;
};

const selectLikeClass =
  "flex h-10 w-full items-center justify-between gap-2 rounded-[var(--ui-control-radius)] border border-input bg-transparent px-3 text-left text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
const dropdownClass =
  "absolute top-full right-0 left-0 z-30 mt-1 max-h-64 overflow-auto rounded-[var(--ui-card-radius)] border border-border bg-background p-3 shadow-lg";
const checkboxClass = "mt-0.5 size-4 shrink-0 accent-primary";
const optionClass = "mb-0 flex items-start gap-2 text-sm font-normal";
const studentOptionClass =
  "flex w-full items-center rounded-[var(--ui-control-radius)] px-2 py-1.5 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TeachingFilterForm({
  courseOptions,
  classOptions,
  studentOptions,
  filters,
  matchingCount,
}: {
  courseOptions: CourseOption[];
  classOptions: ClassOption[];
  studentOptions: StudentFilterOption[];
  filters: TeachingFilters;
  matchingCount: number;
}) {
  const [selectedCourses, setSelectedCourses] = useState(filters.courseIds);
  const [selectedClasses, setSelectedClasses] = useState(filters.classIds);
  const [openMenu, setOpenMenu] = useState<"courses" | "classes" | null>(null);
  const [studentQuery, setStudentQuery] = useState(filters.studentQuery);
  const [studentOpen, setStudentOpen] = useState(false);
  const [activeStudentIndex, setActiveStudentIndex] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const studentWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = formRef.current;
    const handleMouseLeave = () => setOpenMenu(null);
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !formRef.current?.contains(event.target)
      ) {
        setOpenMenu(null);
        setStudentOpen(false);
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setStudentOpen(false);
      }
    };
    form?.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      form?.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const visibleStudents = useMemo(
    () =>
      filterStudentOptions(studentOptions, {
        courseIds: selectedCourses,
        classIds: selectedClasses,
        query: studentQuery,
      }).slice(0, 8),
    [studentOptions, selectedCourses, selectedClasses, studentQuery],
  );
  const activeStudent =
    activeStudentIndex >= 0 ? visibleStudents[activeStudentIndex] : undefined;

  const classGroups = new Map<string, ClassOption[]>();
  for (const option of classOptions) {
    const group = classGroups.get(option.courseTitle) ?? [];
    group.push(option);
    classGroups.set(option.courseTitle, group);
  }

  function chooseStudent(option: StudentFilterOption) {
    setStudentQuery(option.name);
    setStudentOpen(false);
    setActiveStudentIndex(-1);
  }

  function handleStudentKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setStudentOpen(true);
      setActiveStudentIndex((index) =>
        Math.min(index + 1, visibleStudents.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveStudentIndex((index) => Math.max(index - 1, 0));
    } else if (
      event.key === "Enter" &&
      studentOpen &&
      activeStudentIndex >= 0
    ) {
      const option = visibleStudents[activeStudentIndex];
      if (option) {
        event.preventDefault();
        chooseStudent(option);
      }
    } else if (event.key === "Escape") {
      setStudentOpen(false);
    }
  }

  return (
    <form
      ref={formRef}
      method="get"
      action="/teacher/students"
      className="panel"
    >
      <input type="hidden" name="view" value="students" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="grid content-start gap-2">
          <span className="text-sm font-medium text-foreground">Courses</span>
          <div className="relative">
            <button
              type="button"
              className={selectLikeClass}
              aria-expanded={openMenu === "courses"}
              aria-controls="course-filter-options"
              onMouseEnter={() => {
                setOpenMenu("courses");
                setStudentOpen(false);
              }}
              onClick={() =>
                setOpenMenu((current) =>
                  current === "courses" ? null : "courses",
                )
              }
            >
              <span className="truncate">
                {selectedCourses.length
                  ? `${selectedCourses.length} selected`
                  : "All courses"}
              </span>
              <ChevronDown
                size={16}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
            {openMenu === "courses" && (
              <div
                id="course-filter-options"
                className={dropdownClass}
                role="group"
                aria-label="Course filters"
              >
                {courseOptions.length ? (
                  <div className="grid gap-2">
                    {courseOptions.map((course) => (
                      <label key={course.id} className={optionClass}>
                        <input
                          data-slot="checkbox"
                          type="checkbox"
                          name="course"
                          value={course.id}
                          checked={selectedCourses.includes(course.id)}
                          onChange={(event) =>
                            setSelectedCourses((current) =>
                              event.target.checked
                                ? [...current, course.id]
                                : current.filter((id) => id !== course.id),
                            )
                          }
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
            )}
          </div>
        </div>

        <div className="grid content-start gap-2">
          <span className="text-sm font-medium text-foreground">Classes</span>
          <div className="relative">
            <button
              type="button"
              className={selectLikeClass}
              aria-expanded={openMenu === "classes"}
              aria-controls="class-filter-options"
              onMouseEnter={() => {
                setOpenMenu("classes");
                setStudentOpen(false);
              }}
              onClick={() =>
                setOpenMenu((current) =>
                  current === "classes" ? null : "classes",
                )
              }
            >
              <span className="truncate">
                {selectedClasses.length
                  ? `${selectedClasses.length} selected`
                  : "All classes"}
              </span>
              <ChevronDown
                size={16}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
            {openMenu === "classes" && (
              <div
                id="class-filter-options"
                className={dropdownClass}
                role="group"
                aria-label="Class filters"
              >
                {classOptions.length ? (
                  <div className="grid gap-3">
                    {[...classGroups.entries()].map(
                      ([courseTitle, options]) => (
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
                                  checked={selectedClasses.includes(option.id)}
                                  onChange={(event) =>
                                    setSelectedClasses((current) =>
                                      event.target.checked
                                        ? [...current, option.id]
                                        : current.filter(
                                            (id) => id !== option.id,
                                          ),
                                    )
                                  }
                                  className={checkboxClass}
                                />
                                <span>{option.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="muted text-sm">No classes with members yet.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div
          ref={studentWrapperRef}
          className="relative grid content-start gap-2"
          onMouseEnter={() => setOpenMenu(null)}
        >
          <Label
            htmlFor="student-filter"
            className="text-sm font-medium text-foreground"
          >
            Student name
          </Label>
          <Input
            id="student-filter"
            name="student"
            value={studentQuery}
            placeholder="Search by name"
            maxLength={100}
            autoComplete="off"
            className="h-10"
            role="combobox"
            aria-expanded={studentOpen}
            aria-controls="student-filter-options"
            aria-autocomplete="list"
            aria-activedescendant={
              activeStudent ? `student-option-${activeStudent.id}` : undefined
            }
            onFocus={() => {
              setStudentOpen(true);
              setOpenMenu(null);
            }}
            onChange={(event) => {
              setStudentQuery(event.target.value);
              setStudentOpen(true);
              setActiveStudentIndex(-1);
              setOpenMenu(null);
            }}
            onBlur={(event) => {
              if (
                !studentWrapperRef.current?.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                setStudentOpen(false);
              }
            }}
            onKeyDown={handleStudentKeyDown}
          />
          {studentOpen && (
            <div
              id="student-filter-options"
              role="listbox"
              aria-label="Student suggestions"
              className={`${dropdownClass} max-h-56`}
            >
              {visibleStudents.length ? (
                visibleStudents.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    id={`student-option-${option.id}`}
                    aria-selected={index === activeStudentIndex}
                    className={`${studentOptionClass} ${
                      index === activeStudentIndex ? "bg-muted" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      chooseStudent(option);
                    }}
                    onMouseEnter={() => setActiveStudentIndex(index)}
                  >
                    {option.name}
                  </button>
                ))
              ) : (
                <p className="muted px-2 py-1.5 text-sm">
                  No matching students.
                </p>
              )}
            </div>
          )}
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
