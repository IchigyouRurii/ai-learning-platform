import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { ContentQuestions } from "@/modules/teacher/annotations/components/content-questions";
import type { ContentAnnotation, Course } from "@/shared/contracts";
import { PageHeading, ProgressBar } from "@/shared/ui/primitives";
import { annotationContext } from "../annotation-context";
import { FeedbackForm } from "../components/feedback-form";
import { safeReturnTo, toParamArray } from "../teaching-filters";

function activityTitle(course: Course, activityId: string) {
  const block = course.lessons
    .flatMap((lesson) => lesson.blocks)
    .find(
      (item) => item.type === "activity" && item.activity.id === activityId,
    );
  return block?.type === "activity" ? block.activity.title : activityId;
}

function readableAnswer(course: Course, activityId: string, answer: string) {
  try {
    const parsed = JSON.parse(answer) as unknown;
    if (!Array.isArray(parsed)) return answer;
    const activity = course.lessons
      .flatMap((lesson) => lesson.blocks)
      .find(
        (block) =>
          block.type === "activity" && block.activity.id === activityId,
      );
    if (!activity || activity.type !== "activity") return answer;
    const questions = activity.activity.questions;
    if (!questions?.length) return answer;
    return parsed
      .map((item, index) => {
        const entry = item as {
          questionId?: string;
          selectedOptionIds?: string[];
        };
        const question = questions.find(
          (candidate) => candidate.id === entry.questionId,
        );
        if (!question) return `Q${index + 1}: ${JSON.stringify(item)}`;
        const selected = (entry.selectedOptionIds ?? [])
          .map(
            (id) =>
              question.options.find((option) => option.id === id)?.text ?? id,
          )
          .join(", ");
        return `Q${index + 1}: ${selected || "(no answer)"}`;
      })
      .join("\n");
  } catch {
    return answer;
  }
}

const dateTimeLabel = (value: string) =>
  new Date(value).toLocaleString("en-US", { timeZone: "Asia/Shanghai" });

export async function TeacherStudentDetail({
  studentId,
  searchParams,
}: {
  studentId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return <RoleGate expected="teacher" />;

  const workspace = await getWorkspace(actor);
  const enrollments = workspace.enrollments.filter(
    (enrollment) => enrollment.studentId === studentId,
  );
  const coursesById = new Map(
    workspace.courses.map((course) => [course.id, course]),
  );
  const studentCourses = enrollments
    .map((enrollment) => coursesById.get(enrollment.courseId))
    .filter((course): course is Course => Boolean(course))
    .toSorted((a, b) => a.title.localeCompare(b.title));
  if (!studentCourses.length) notFound();

  const requestedCourse = toParamArray(searchParams.course)[0];
  const activeCourse =
    studentCourses.find((course) => course.id === requestedCourse) ??
    studentCourses[0];
  const activeEnrollment = enrollments.find(
    (enrollment) => enrollment.courseId === activeCourse.id,
  );
  const studentName =
    workspace.members.find((member) => member.id === studentId)?.name ??
    "Student";

  const [classPage, noteResults] = await Promise.all([
    platformExtensions.classrooms.listMine(actor, { limit: 100 }),
    Promise.all(
      studentCourses.map((course) =>
        platformExtensions.annotations.listForTeacher(actor, {
          courseId: course.id,
          studentId,
          limit: 100,
        }),
      ),
    ),
  ]);
  const classes = (classPage.ok ? classPage.data.items : []).filter(
    (classroom) =>
      studentCourses.some((course) => course.id === classroom.courseId),
  );
  const memberResults = await Promise.all(
    classes.map((classroom) =>
      platformExtensions.classrooms.listMembers(actor, {
        classId: classroom.id,
      }),
    ),
  );
  const classMemberships = classes.flatMap((classroom, index) => {
    const result = memberResults[index];
    if (!result.ok) return [];
    const member = result.data.find(
      (candidate) => candidate.student.id === studentId,
    );
    if (!member) return [];
    return [
      {
        classId: classroom.id,
        courseId: classroom.courseId,
        name: classroom.name,
        email: member.student.email,
      },
    ];
  });
  const email = classMemberships[0]?.email ?? null;
  const classNamesFor = (courseId: string) =>
    classMemberships
      .filter((membership) => membership.courseId === courseId)
      .map((membership) => membership.name);

  const notesByCourse = new Map<string, ContentAnnotation[]>();
  let notesUnavailable = false;
  studentCourses.forEach((course, index) => {
    const result = noteResults[index];
    if (!result.ok) notesUnavailable = true;
    notesByCourse.set(course.id, result.ok ? result.data.items : []);
  });
  const activeNotes = notesByCourse.get(activeCourse.id) ?? [];

  const submissions = workspace.submissions
    .filter(
      (submission) =>
        submission.courseId === activeCourse.id &&
        submission.studentId === studentId &&
        submission.courseVersion === activeCourse.version,
    )
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sentFeedback = workspace.feedback
    .filter(
      (feedback) =>
        feedback.courseId === activeCourse.id &&
        feedback.studentId === studentId &&
        feedback.teacherId === actor.id,
    )
    .toReversed();
  const progress = calculateProgress(
    activeCourse,
    workspace.submissions,
    studentId,
    activeEnrollment?.difficulty,
  );
  const openNotes = activeNotes.filter((note) => note.status === "open").length;

  const returnTo = safeReturnTo(searchParams.return);
  const backHref = returnTo ?? "/teacher/students";
  const tabHref = (courseId: string) => {
    const params = new URLSearchParams({ course: courseId });
    if (returnTo) params.set("return", returnTo);
    return `/teacher/students/${encodeURIComponent(studentId)}?${params.toString()}`;
  };
  const tabClass = "border-b-2 px-3 py-2 text-sm font-medium transition-colors";
  const activeTab = "border-primary text-foreground";
  const inactiveTab =
    "border-transparent text-muted-foreground hover:text-foreground";

  return (
    <>
      <Link href={backHref} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to students
      </Link>
      <PageHeading
        eyebrow="STUDENT DETAIL"
        title={studentName}
        description={`${email ?? "Email not available"} · ${studentCourses.length} ${
          studentCourses.length === 1 ? "course" : "courses"
        } with you`}
      />
      {!classPage.ok && (
        <p className="form-hint" role="status">
          Class information is temporarily unavailable.
        </p>
      )}
      <nav
        aria-label="Student courses"
        className="mb-4 flex flex-wrap gap-1 border-b border-border"
      >
        {studentCourses.map((course) => (
          <Link
            key={course.id}
            href={tabHref(course.id)}
            className={`${tabClass} ${
              course.id === activeCourse.id ? activeTab : inactiveTab
            }`}
            aria-current={course.id === activeCourse.id ? "page" : undefined}
          >
            {course.title}
          </Link>
        ))}
      </nav>

      <section className="panel">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="muted text-sm">Course progress</p>
            <div className="mt-2">
              <ProgressBar percent={progress.percent} />
            </div>
            <p className="mt-1 text-sm">
              {progress.done} / {progress.total} activities submitted
            </p>
          </div>
          <div>
            <p className="muted text-sm">Class</p>
            <p className="mt-1 text-sm">
              {classNamesFor(activeCourse.id).join(", ") || "No class"}
            </p>
          </div>
          <div>
            <p className="muted text-sm">Open items</p>
            <p className="mt-1 text-sm">
              {openNotes} private {openNotes === 1 ? "note" : "notes"} ·{" "}
              {sentFeedback.length} feedback sent
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Submissions & AI feedback</h2>
            <p className="muted">
              Activities submitted for the current published version, newest
              first.
            </p>
          </div>
        </div>
        {submissions.length ? (
          submissions.map((submission) => (
            <details className="submission-detail" key={submission.id}>
              <summary>
                {activityTitle(activeCourse, submission.activityId)} ·{" "}
                {dateTimeLabel(submission.createdAt)}
              </summary>
              <h4>Student answer</h4>
              <p className="prose-text">
                {readableAnswer(
                  activeCourse,
                  submission.activityId,
                  submission.answer,
                )}
              </p>
              <h4>Learning feedback</h4>
              <p className="prose-text muted">{submission.aiFeedback}</p>
              {submission.score != null && submission.maxScore ? (
                <p className="form-hint">
                  Score: {submission.score} / {submission.maxScore}
                </p>
              ) : null}
            </details>
          ))
        ) : (
          <p className="muted">
            No activities submitted for this course version yet.
          </p>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Feedback</h2>
            <p className="muted">
              Messages you sent to this student about {activeCourse.title}.
            </p>
          </div>
        </div>
        <FeedbackForm courseId={activeCourse.id} studentId={studentId} />
        <details className="submission-detail">
          <summary>Sent feedback ({sentFeedback.length})</summary>
          {sentFeedback.length ? (
            <div className="mt-3">
              {sentFeedback.map((item) => (
                <article className="feedback-note" key={item.id}>
                  <p className="prose-text">{item.message}</p>
                  <small>{dateTimeLabel(item.createdAt)}</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">No feedback sent to this student yet.</p>
          )}
        </details>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Private notes</h2>
            <p className="muted">
              Only this student and you can see these notes.
            </p>
          </div>
          <Link
            href={`/teacher/courses/${activeCourse.id}#course-qa`}
            className="text-link text-sm inline-flex items-center gap-1"
          >
            <MessageSquareText size={14} aria-hidden="true" />
            Open course Q&A
          </Link>
        </div>
        {notesUnavailable && (
          <p className="form-hint" role="status">
            Some note groups could not be loaded.
          </p>
        )}
        {activeNotes.length ? (
          <ContentQuestions
            courseId={activeCourse.id}
            annotations={activeNotes}
            context={annotationContext(activeCourse)}
          />
        ) : (
          <p className="muted">No private notes for this course.</p>
        )}
      </section>
    </>
  );
}
