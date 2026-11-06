import { describe, expect, it } from "vitest";
import {
  buildStudentsHref,
  filterStudentOptions,
  groupStudentCourses,
  paginate,
  parsePageNumber,
  safeReturnTo,
  studentFilterOptions,
  toParamArray,
  type StudentCourseInput,
} from "@/modules/teacher/dashboard/teaching-filters";
import { paginationItems } from "@/shared/ui/pagination";

const pairs: StudentCourseInput[] = [
  {
    studentId: "alice",
    studentName: "Alice Chen",
    courseId: "ai",
    courseTitle: "Intro to AI",
    classIds: ["class-a"],
    classNames: ["Class A"],
    done: 7,
    total: 10,
    percent: 70,
    lastActivityAt: "2026-11-01T00:00:00.000Z",
    sentFeedbackCount: 2,
    openNoteCount: 1,
  },
  {
    studentId: "alice",
    studentName: "Alice Chen",
    courseId: "web",
    courseTitle: "Web Basics",
    classIds: ["class-b"],
    classNames: ["Class B"],
    done: 2,
    total: 10,
    percent: 20,
    lastActivityAt: "2026-11-03T00:00:00.000Z",
    sentFeedbackCount: 1,
    openNoteCount: 3,
  },
  {
    studentId: "bob",
    studentName: "Bob Li",
    courseId: "ai",
    courseTitle: "Intro to AI",
    classIds: [],
    classNames: [],
    done: 4,
    total: 10,
    percent: 40,
    lastActivityAt: "2026-10-30T00:00:00.000Z",
    sentFeedbackCount: 0,
    openNoteCount: 0,
  },
];

const noFilters = { courseIds: [], classIds: [], studentQuery: "" };

describe("teaching management filters", () => {
  it("groups course rows by student and aggregates visible counts", () => {
    const students = groupStudentCourses(pairs, noFilters);
    expect(students.map((student) => student.name)).toEqual([
      "Alice Chen",
      "Bob Li",
    ]);
    expect(students[0].courses.map((course) => course.courseId)).toEqual([
      "ai",
      "web",
    ]);
    expect(students[0]).toMatchObject({
      openNoteCount: 4,
      sentFeedbackCount: 3,
      lastActivityAt: "2026-11-03T00:00:00.000Z",
    });
  });

  it("combines course, class and name filters with AND across dimensions", () => {
    expect(
      groupStudentCourses(pairs, {
        ...noFilters,
        courseIds: ["ai", "web"],
      }),
    ).toHaveLength(2);
    expect(
      groupStudentCourses(pairs, {
        ...noFilters,
        classIds: ["class-b"],
      }).map((student) => ({
        name: student.name,
        courses: student.courses.map((course) => course.courseId),
      })),
    ).toEqual([{ name: "Alice Chen", courses: ["web"] }]);
    expect(
      groupStudentCourses(pairs, {
        ...noFilters,
        courseIds: ["ai"],
        studentQuery: "ali",
      }).map((student) => student.name),
    ).toEqual(["Alice Chen"]);
    expect(
      groupStudentCourses(pairs, {
        ...noFilters,
        courseIds: ["web"],
        classIds: ["class-a"],
      }),
    ).toEqual([]);
  });

  it("paginates and clamps out-of-range pages", () => {
    const items = Array.from({ length: 60 }, (_, index) => index + 1);
    const first = paginate(items, 1);
    expect(first).toMatchObject({ totalItems: 60, totalPages: 3, page: 1 });
    expect(first.items).toHaveLength(25);
    expect(paginate(items, 3).items).toHaveLength(10);
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, -4).page).toBe(1);
  });

  it("builds numbered pagination windows", () => {
    expect(paginationItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(paginationItems(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(paginationItems(5, 10)).toEqual([
      1,
      "ellipsis",
      4,
      5,
      6,
      "ellipsis",
      10,
    ]);
    expect(paginationItems(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });

  it("parses repeated params and builds filter-preserving links", () => {
    expect(toParamArray(["a", " b ", ""])).toEqual(["a", "b"]);
    expect(toParamArray(undefined)).toEqual([]);
    expect(parsePageNumber("3")).toBe(3);
    expect(parsePageNumber("nope")).toBe(1);
    expect(
      buildStudentsHref(
        { courseIds: ["ai"], classIds: ["class-a"], studentQuery: "Ali" },
        2,
      ),
    ).toBe("/teacher/students?course=ai&class=class-a&student=Ali&page=2");
    expect(buildStudentsHref(noFilters)).toBe("/teacher/students");
  });

  it("only accepts internal teaching-management return links", () => {
    expect(safeReturnTo("/teacher/students?page=2")).toBe(
      "/teacher/students?page=2",
    );
    expect(safeReturnTo("https://example.com")).toBeNull();
    expect(safeReturnTo("//evil.example/teacher/students")).toBeNull();
    expect(safeReturnTo("/student/progress")).toBeNull();
  });

  it("builds and narrows student suggestions by course, class and name", () => {
    const options = studentFilterOptions(pairs);
    expect(options).toEqual([
      {
        id: "alice",
        name: "Alice Chen",
        courseIds: ["ai", "web"],
        classIds: ["class-a", "class-b"],
      },
      { id: "bob", name: "Bob Li", courseIds: ["ai"], classIds: [] },
    ]);
    expect(
      filterStudentOptions(options, {
        courseIds: ["web"],
        classIds: [],
        query: "",
      }).map((option) => option.name),
    ).toEqual(["Alice Chen"]);
    expect(
      filterStudentOptions(options, {
        courseIds: [],
        classIds: ["class-b"],
        query: "",
      }).map((option) => option.name),
    ).toEqual(["Alice Chen"]);
    expect(
      filterStudentOptions(options, {
        courseIds: [],
        classIds: [],
        query: "ali",
      }).map((option) => option.name),
    ).toEqual(["Alice Chen"]);

    const directory = [
      {
        id: "aa",
        name: "student-aa",
        courseIds: ["ai"],
        classIds: ["class-a"],
      },
      {
        id: "bb",
        name: "student-bb",
        courseIds: ["ai"],
        classIds: ["class-a"],
      },
    ];
    expect(
      filterStudentOptions(directory, {
        courseIds: [],
        classIds: ["class-a"],
        query: "stu",
      }).map((option) => option.name),
    ).toEqual(["student-aa", "student-bb"]);
    expect(
      filterStudentOptions(directory, {
        courseIds: [],
        classIds: ["class-a"],
        query: "student-a",
      }).map((option) => option.name),
    ).toEqual(["student-aa"]);
  });
});
