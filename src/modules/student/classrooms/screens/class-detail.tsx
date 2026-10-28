import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import {
  getCurrentUser,
  getWorkspace,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { calculateQuizProgress } from "@/shared/contracts";
import { Button } from "@/shared/ui/components/button";
import { Badge, PageHeading, ProgressBar } from "@/shared/ui/primitives";

export async function StudentClassDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const [classroomResult, workspace] = await Promise.all([
    platformExtensions.classrooms.get(user, { classId: id }),
    getWorkspace(user),
  ]);
  if (!classroomResult.ok) {
    if (classroomResult.code === "NOT_FOUND") notFound();
    return (
      <>
        <PageHeading
          eyebrow="MY CLASS"
          title="Class unavailable"
          description="The class could not be loaded."
        />
        <p className="error-text" role="alert">
          {classroomResult.error}
        </p>
      </>
    );
  }
  const classroom = classroomResult.data;
  const course = workspace.courses.find(
    (item) => item.id === classroom.courseId,
  );
  const quiz = course
    ? calculateQuizProgress(course, workspace.submissions, user.id)
    : null;
  return (
    <>
      <Link href="/student/classes" className="back-link">
        <ArrowLeft size={15} />
        Back to My Classes
      </Link>
      <PageHeading
        eyebrow="MY CLASS"
        title={classroom.name}
        description={
          classroom.description || "Your class details and progress."
        }
        action={
          <Badge>
            {classroom.memberCount}{" "}
            {classroom.memberCount === 1 ? "student" : "students"}
          </Badge>
        }
      />
      <p className="form-hint">
        Course:{" "}
        <Link href={`/student/courses/${classroom.courseId}`}>
          {classroom.courseTitle}
        </Link>
      </p>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Quiz progress</h2>
              <p className="muted">
                Class progress uses quizzes. A chapter is complete when you pass
                every quiz in it with at least 60%; your best attempt counts.
              </p>
            </div>
            {quiz && quiz.lessonsWithQuizzes > 0 && (
              <Badge tone={quiz.completed ? "green" : "amber"}>
                {quiz.completed ? "Completed" : "In progress"}
              </Badge>
            )}
          </div>
          {quiz ? (
            quiz.lessonsWithQuizzes > 0 ? (
              <>
                <ProgressBar
                  percent={
                    quiz.lessonsWithQuizzes
                      ? Math.round(
                          (quiz.passedLessons / quiz.lessonsWithQuizzes) * 100,
                        )
                      : 0
                  }
                />
                <p className="muted">
                  {quiz.passedLessons} / {quiz.lessonsWithQuizzes} chapters
                  passed · {quiz.passedQuizzes} / {quiz.totalQuizzes} quizzes
                  passed
                </p>
                <div className="mt-4 grid gap-3">
                  {quiz.lessons
                    .filter((lesson) => lesson.hasQuiz)
                    .map((lesson) => (
                      <div
                        key={lesson.lessonId}
                        className="rounded-[var(--ui-control-radius)] border border-border p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong>{lesson.lessonTitle}</strong>
                          <Badge tone={lesson.passed ? "green" : "amber"}>
                            {lesson.passed ? "Passed" : "Not yet"}
                          </Badge>
                        </div>
                        <p className="muted text-sm">
                          {lesson.passedQuizzes} / {lesson.quizCount} quizzes
                          passed
                          {lesson.bestScorePercent !== null
                            ? ` · best ${lesson.bestScorePercent}%`
                            : ""}
                        </p>
                      </div>
                    ))}
                </div>
                <p className="form-hint">
                  Lesson completion in the course page is your personal
                  bookmark; it does not affect class progress.
                </p>
              </>
            ) : (
              <p className="muted">This course has no quizzes yet.</p>
            )
          ) : (
            <p className="muted">
              The course for this class is not available to your account yet.
              Ask your teacher to check the class.
            </p>
          )}
        </section>
        <aside className="panel">
          <h2>Class details</h2>
          <div className="grid gap-3">
            <div>
              <p className="form-hint">Course</p>
              <p className="inline-flex items-center gap-1">
                <BookOpen size={14} />
                {classroom.courseTitle}
              </p>
            </div>
            <div>
              <p className="form-hint">Class created</p>
              <p>
                {new Date(classroom.createdAt).toLocaleDateString("en-US", {
                  timeZone: "Asia/Shanghai",
                })}
              </p>
            </div>
            <div>
              <p className="form-hint">Class size</p>
              <p>
                {classroom.memberCount}{" "}
                {classroom.memberCount === 1 ? "student" : "students"}
              </p>
            </div>
          </div>
          {course && (
            <Button asChild>
              <Link href={`/student/courses/${classroom.courseId}`}>
                Open course
              </Link>
            </Button>
          )}
        </aside>
      </div>
    </>
  );
}
