import Link from "next/link";
import { ArrowUpRight, BookOpen, Users } from "lucide-react";
import {
  getCurrentUser,
  getWorkspace,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { AnnotationItem } from "@/modules/teacher/annotations/components/content-questions";
import {
  calculateQuizProgress,
  type ContentAnnotation,
  type Course,
} from "@/shared/contracts";
import { Pagination } from "@/shared/ui/components/pagination";
import { Badge, EmptyState, PageHeading } from "@/shared/ui/primitives";
import { NotesFilterForm } from "../components/notes-filter-form";
import { TeachingFilterForm } from "../components/teaching-filter-form";
import { annotationContext } from "../annotation-context";
import {
  buildStudentsHref,
  groupStudentCourses,
  paginate,
  parsePageNumber,
  studentFilterOptions,
  toParamArray,
  type StudentCourseInput,
  type TeachingFilters,
} from "../teaching-filters";

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    timeZone: "Asia/Shanghai",
  });

export async function TeacherTeachingManagement({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return <RoleGate expected="teacher" />;

  const viewParam = firstParam(searchParams.view);
  const legacyCourseId = firstParam(searchParams.courseId)?.trim() ?? "";
  const view =
    viewParam === "notes" || (!viewParam && legacyCourseId)
      ? "notes"
      : "students";
  const rawStatus = firstParam(searchParams.status) ?? "all";
  const notesStatus = ["open", "replied", "resolved"].includes(rawStatus)
    ? rawStatus
    : "all";
  const notesCourseId =
    firstParam(searchParams.course)?.trim() || legacyCourseId;

  const [workspace, classPage, countsResult, notesResult] = await Promise.all([
    getWorkspace(actor),
    platformExtensions.classrooms.listMine(actor, { limit: 100 }),
    platformExtensions.annotations.openCounts(actor, {}),
    view === "notes"
      ? platformExtensions.annotations.listForTeacher(actor, {
          courseId: notesCourseId || undefined,
          limit: 100,
        })
      : Promise.resolve(null),
  ]);

  const classes = classPage.ok ? classPage.data.items : [];
  const memberResults = await Promise.all(
    classes.map((classroom) =>
      platformExtensions.classrooms.listMembers(actor, {
        classId: classroom.id,
      }),
    ),
  );
  const memberships = classes.flatMap((classroom, index) => {
    const result = memberResults[index];
    if (!result.ok) return [];
    return [
      {
        id: classroom.id,
        name: classroom.name,
        courseId: classroom.courseId,
        studentIds: result.data.map((member) => member.student.id),
      },
    ];
  });

  const coursesById = new Map(
    workspace.courses.map((course) => [course.id, course]),
  );
  const memberNames = new Map(
    workspace.members.map((member) => [member.id, member.name]),
  );
  const openCountsAvailable = countsResult.ok;
  const openCounts = new Map(
    (countsResult.ok ? countsResult.data : []).map((item) => [
      `${item.courseId}:${item.studentId}`,
      item.count,
    ]),
  );
  const feedbackCounts = new Map<string, number>();
  for (const feedback of workspace.feedback) {
    if (feedback.teacherId !== actor.id) continue;
    const key = `${feedback.courseId}:${feedback.studentId}`;
    feedbackCounts.set(key, (feedbackCounts.get(key) ?? 0) + 1);
  }
  const lastActivities = new Map<string, string>();
  for (const submission of workspace.submissions) {
    const key = `${submission.courseId}:${submission.studentId}`;
    const previous = lastActivities.get(key);
    if (!previous || submission.createdAt > previous) {
      lastActivities.set(key, submission.createdAt);
    }
  }

  const classIdsFor = (courseId: string, studentId: string) =>
    memberships
      .filter(
        (membership) =>
          membership.courseId === courseId &&
          membership.studentIds.includes(studentId),
      )
      .map((membership) => membership.id);
  const classNamesFor = (courseId: string, studentId: string) =>
    memberships
      .filter(
        (membership) =>
          membership.courseId === courseId &&
          membership.studentIds.includes(studentId),
      )
      .map((membership) => membership.name);

  const pairs: StudentCourseInput[] = [];
  for (const enrollment of workspace.enrollments) {
    const course = coursesById.get(enrollment.courseId);
    if (!course) continue;
    const key = `${course.id}:${enrollment.studentId}`;
    const quiz = calculateQuizProgress(
      course,
      workspace.submissions,
      enrollment.studentId,
      "advanced",
    );
    pairs.push({
      studentId: enrollment.studentId,
      studentName: memberNames.get(enrollment.studentId) ?? "Student",
      courseId: course.id,
      courseTitle: course.title,
      classIds: classIdsFor(course.id, enrollment.studentId),
      classNames: classNamesFor(course.id, enrollment.studentId),
      done: quiz.passedQuizzes,
      total: quiz.totalQuizzes,
      percent: quiz.totalQuizzes
        ? Math.round((quiz.passedQuizzes / quiz.totalQuizzes) * 100)
        : 0,
      lastActivityAt: lastActivities.get(key) ?? null,
      sentFeedbackCount: feedbackCounts.get(key) ?? 0,
      openNoteCount: openCounts.get(key) ?? 0,
    });
  }

  const filters: TeachingFilters = {
    courseIds: toParamArray(searchParams.course),
    classIds: toParamArray(searchParams.class),
    studentQuery: firstParam(searchParams.student)?.trim() ?? "",
  };
  if (!filters.courseIds.length && legacyCourseId) {
    filters.courseIds = [legacyCourseId];
  }
  const students = groupStudentCourses(pairs, filters);
  const studentOptions = studentFilterOptions(pairs);
  const pageData = paginate(students, parsePageNumber(searchParams.page));
  const returnTo = buildStudentsHref(filters, pageData.page);
  const enrolledCourseIds = new Set(
    workspace.enrollments.map((enrollment) => enrollment.courseId),
  );
  const courseOptions = workspace.courses
    .filter((course) => enrolledCourseIds.has(course.id))
    .map((course) => ({ id: course.id, title: course.title }))
    .toSorted((a, b) => a.title.localeCompare(b.title));
  const classOptions = memberships
    .filter(
      (membership) =>
        enrolledCourseIds.has(membership.courseId) &&
        membership.studentIds.some((studentId) =>
          workspace.enrollments.some(
            (enrollment) =>
              enrollment.courseId === membership.courseId &&
              enrollment.studentId === studentId,
          ),
        ),
    )
    .map((membership) => ({
      id: membership.id,
      name: membership.name,
      courseId: membership.courseId,
      courseTitle:
        coursesById.get(membership.courseId)?.title ?? "Unknown course",
    }))
    .toSorted(
      (a, b) =>
        a.courseTitle.localeCompare(b.courseTitle) ||
        a.name.localeCompare(b.name),
    );

  const allNotes = notesResult?.ok ? notesResult.data.items : [];
  const notes =
    notesStatus === "all"
      ? allNotes
      : allNotes.filter((note) => note.status === notesStatus);
  const notesByCourse = new Map<string, ContentAnnotation[]>();
  for (const note of notes) {
    const group = notesByCourse.get(note.courseId) ?? [];
    group.push(note);
    notesByCourse.set(note.courseId, group);
  }
  const noteCourses = [...notesByCourse.keys()]
    .map((courseId) => coursesById.get(courseId))
    .filter((course): course is Course => Boolean(course))
    .toSorted((a, b) => a.title.localeCompare(b.title));
  const notesHref = notesCourseId
    ? `/teacher/students?view=notes&course=${encodeURIComponent(notesCourseId)}`
    : "/teacher/students?view=notes";
  const tabClass = "border-b-2 px-3 py-2 text-sm font-medium transition-colors";
  const activeTab = "border-primary text-foreground";
  const inactiveTab =
    "border-transparent text-muted-foreground hover:text-foreground";
  const filtersActive =
    filters.courseIds.length > 0 ||
    filters.classIds.length > 0 ||
    filters.studentQuery.length > 0;

  return (
    <>
      <PageHeading
        eyebrow="PARTICIPATION & FEEDBACK"
        title="Teaching Management"
        description="Filter students by course, class or name, then open one student to review submissions, feedback and private notes."
      />
      {!classPage.ok && (
        <p className="error-text" role="alert">
          Class list unavailable: {classPage.error}
        </p>
      )}
      {!openCountsAvailable && (
        <p className="form-hint">
          Private-note counts are temporarily unavailable. Open a student to
          read their notes.
        </p>
      )}

      <div className="mb-4 flex gap-1 border-b border-border">
        <Link
          href={buildStudentsHref(filters, 1)}
          className={`${tabClass} ${view === "students" ? activeTab : inactiveTab}`}
          aria-current={view === "students" ? "page" : undefined}
        >
          Students
        </Link>
        <Link
          href={notesHref}
          className={`${tabClass} ${view === "notes" ? activeTab : inactiveTab}`}
          aria-current={view === "notes" ? "page" : undefined}
        >
          Private notes
        </Link>
      </div>

      {view === "students" ? (
        <>
          <TeachingFilterForm
            key={`${filters.courseIds.join(",")}|${filters.classIds.join(",")}|${filters.studentQuery}`}
            courseOptions={courseOptions}
            classOptions={classOptions}
            studentOptions={studentOptions}
            filters={filters}
            matchingCount={students.length}
          />
          {pageData.items.length ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Students</h2>
                  <p className="muted">
                    Sorted by name. Open a student to see every course they take
                    with you.
                  </p>
                </div>
                <span className="muted text-sm">
                  Showing {(pageData.page - 1) * pageData.pageSize + 1}–
                  {Math.min(
                    pageData.page * pageData.pageSize,
                    pageData.totalItems,
                  )}{" "}
                  of {pageData.totalItems}
                </span>
              </div>
              <div className="grid gap-3">
                {pageData.items.map((student) => (
                  <Link
                    key={student.id}
                    href={`/teacher/students/${encodeURIComponent(student.id)}?course=${encodeURIComponent(student.courses[0].courseId)}&return=${encodeURIComponent(returnTo)}`}
                    className="block rounded-[var(--ui-card-radius)] border border-border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold">
                          {student.name}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {student.courses.map((course) => (
                            <span
                              key={course.courseId}
                              className="inline-flex flex-wrap items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs"
                            >
                              <BookOpen size={12} aria-hidden="true" />
                              {course.courseTitle}
                              <span className="text-muted-foreground">
                                ·{" "}
                                {course.classNames.length
                                  ? course.classNames.join(", ")
                                  : "No class"}
                              </span>
                              <span className="text-muted-foreground">
                                · {course.percent}%
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1 text-right text-sm">
                        <Badge
                          tone={student.openNoteCount ? "amber" : "neutral"}
                        >
                          {openCountsAvailable
                            ? `${student.openNoteCount} open notes`
                            : "Notes unavailable"}
                        </Badge>
                        <span className="muted">
                          {student.sentFeedbackCount} feedback sent
                        </span>
                        <span className="muted">
                          {student.lastActivityAt
                            ? `Last activity ${dateLabel(student.lastActivityAt)}`
                            : "No activity yet"}
                        </span>
                      </div>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm text-primary">
                      Open student
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </span>
                  </Link>
                ))}
              </div>
              <Pagination
                page={pageData.page}
                totalPages={pageData.totalPages}
                hrefForPage={(page) => buildStudentsHref(filters, page)}
              />
            </section>
          ) : (
            <EmptyState
              title={
                filtersActive
                  ? "No students match these filters"
                  : "No students enrolled yet"
              }
            >
              {filtersActive
                ? "Adjust or reset the filters to see enrolled students."
                : "Publish a course or add students to a class to start tracking participation."}
            </EmptyState>
          )}
        </>
      ) : (
        <section id="private-notes" className="scroll-mt-6">
          <NotesFilterForm
            courseOptions={courseOptions}
            selectedCourseId={notesCourseId}
            status={notesStatus}
            noteCount={notes.length}
          />
          {notesResult && !notesResult.ok ? (
            <p className="error-text" role="alert">
              Private notes unavailable: {notesResult.error}
            </p>
          ) : !notes.length ? (
            <EmptyState title="No private notes match these filters">
              Notes appear here when students ask about a specific content
              block, and only you and that student can read them.
            </EmptyState>
          ) : (
            <div className="grid gap-4">
              {noteCourses.map((course) => {
                const context = annotationContext(course);
                const courseNotes = notesByCourse.get(course.id) ?? [];
                const byStudent = new Map<string, ContentAnnotation[]>();
                for (const note of courseNotes) {
                  const group = byStudent.get(note.student.id) ?? [];
                  group.push(note);
                  byStudent.set(note.student.id, group);
                }
                return (
                  <section className="panel" key={course.id}>
                    <div className="panel-heading">
                      <div>
                        <h2>{course.title}</h2>
                        <p className="muted">
                          {courseNotes.length}{" "}
                          {courseNotes.length === 1 ? "note" : "notes"}
                        </p>
                      </div>
                      <Link
                        href={`/teacher/courses/${course.id}#course-qa`}
                        className="text-link text-sm"
                      >
                        Open course Q&A
                      </Link>
                    </div>
                    <div className="grid gap-4">
                      {[...byStudent.values()]
                        .toSorted((a, b) =>
                          a[0].student.name.localeCompare(b[0].student.name),
                        )
                        .map((studentNotes) => (
                          <div key={studentNotes[0].student.id}>
                            <h3 className="flex items-center gap-2 text-sm font-semibold">
                              <Users size={14} aria-hidden="true" />
                              {studentNotes[0].student.name}
                            </h3>
                            <div className="mt-2 grid gap-3">
                              {studentNotes.map((note) => (
                                <AnnotationItem
                                  key={note.id}
                                  courseId={course.id}
                                  annotation={note}
                                  context={context}
                                  showCourseLink={false}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
