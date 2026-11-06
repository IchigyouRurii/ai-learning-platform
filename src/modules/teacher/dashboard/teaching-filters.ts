export const STUDENTS_PAGE_SIZE = 25;

export type TeachingFilters = {
  courseIds: string[];
  classIds: string[];
  studentQuery: string;
};

export type StudentCourseInput = {
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  classIds: string[];
  classNames: string[];
  done: number;
  total: number;
  percent: number;
  lastActivityAt: string | null;
  sentFeedbackCount: number;
  openNoteCount: number;
};

export type StudentCourseSummary = Omit<
  StudentCourseInput,
  "studentId" | "studentName"
>;

export type StudentSummary = {
  id: string;
  name: string;
  courses: StudentCourseSummary[];
  openNoteCount: number;
  sentFeedbackCount: number;
  lastActivityAt: string | null;
};

export type StudentFilterOption = {
  id: string;
  name: string;
  courseIds: string[];
  classIds: string[];
};

export type PageSlice<T> = {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
};

export function toParamArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => item.trim()).filter(Boolean);
}

export function parsePageNumber(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function buildStudentsHref(filters: TeachingFilters, page = 1): string {
  const params = new URLSearchParams();
  for (const courseId of filters.courseIds) params.append("course", courseId);
  for (const classId of filters.classIds) params.append("class", classId);
  const studentQuery = filters.studentQuery.trim();
  if (studentQuery) params.set("student", studentQuery);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/teacher/students?${query}` : "/teacher/students";
}

export function safeReturnTo(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/teacher/students") || raw.startsWith("//")) {
    return null;
  }
  return raw;
}

export function studentFilterOptions(
  pairs: StudentCourseInput[],
): StudentFilterOption[] {
  const students = new Map<
    string,
    { id: string; name: string; courseIds: Set<string>; classIds: Set<string> }
  >();
  for (const pair of pairs) {
    const existing = students.get(pair.studentId) ?? {
      id: pair.studentId,
      name: pair.studentName,
      courseIds: new Set<string>(),
      classIds: new Set<string>(),
    };
    existing.courseIds.add(pair.courseId);
    for (const classId of pair.classIds) existing.classIds.add(classId);
    students.set(pair.studentId, existing);
  }
  return [...students.values()]
    .map((student) => ({
      id: student.id,
      name: student.name,
      courseIds: [...student.courseIds],
      classIds: [...student.classIds],
    }))
    .toSorted(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
}

export function filterStudentOptions(
  options: StudentFilterOption[],
  filters: { courseIds: string[]; classIds: string[]; query: string },
): StudentFilterOption[] {
  const courseIds = new Set(filters.courseIds);
  const classIds = new Set(filters.classIds);
  const query = filters.query.trim().toLowerCase();
  return options.filter((option) => {
    if (
      courseIds.size &&
      !option.courseIds.some((courseId) => courseIds.has(courseId))
    ) {
      return false;
    }
    if (
      classIds.size &&
      !option.classIds.some((classId) => classIds.has(classId))
    ) {
      return false;
    }
    return !query || option.name.toLowerCase().includes(query);
  });
}

export function groupStudentCourses(
  pairs: StudentCourseInput[],
  filters: TeachingFilters,
): StudentSummary[] {
  const courseIds = new Set(filters.courseIds);
  const classIds = new Set(filters.classIds);
  const query = filters.studentQuery.trim().toLowerCase();

  const students = new Map<string, StudentSummary>();
  for (const pair of pairs) {
    if (courseIds.size && !courseIds.has(pair.courseId)) continue;
    if (classIds.size && !pair.classIds.some((id) => classIds.has(id))) {
      continue;
    }
    if (query && !pair.studentName.toLowerCase().includes(query)) continue;

    const course: StudentCourseSummary = {
      courseId: pair.courseId,
      courseTitle: pair.courseTitle,
      classIds: pair.classIds,
      classNames: pair.classNames,
      done: pair.done,
      total: pair.total,
      percent: pair.percent,
      lastActivityAt: pair.lastActivityAt,
      sentFeedbackCount: pair.sentFeedbackCount,
      openNoteCount: pair.openNoteCount,
    };
    const existing = students.get(pair.studentId);
    if (!existing) {
      students.set(pair.studentId, {
        id: pair.studentId,
        name: pair.studentName,
        courses: [course],
        openNoteCount: course.openNoteCount,
        sentFeedbackCount: course.sentFeedbackCount,
        lastActivityAt: course.lastActivityAt,
      });
      continue;
    }
    existing.courses.push(course);
    existing.openNoteCount += course.openNoteCount;
    existing.sentFeedbackCount += course.sentFeedbackCount;
    if (
      course.lastActivityAt &&
      (!existing.lastActivityAt ||
        course.lastActivityAt > existing.lastActivityAt)
    ) {
      existing.lastActivityAt = course.lastActivityAt;
    }
  }

  return [...students.values()]
    .map((student) => ({
      ...student,
      courses: student.courses.toSorted((a, b) =>
        a.courseTitle.localeCompare(b.courseTitle),
      ),
    }))
    .toSorted(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
}

export function paginate<T>(
  items: T[],
  requestedPage: number,
  pageSize = STUDENTS_PAGE_SIZE,
): PageSlice<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page,
    totalPages,
    totalItems,
    pageSize,
  };
}
