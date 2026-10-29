import { Users } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import {
  Badge,
  EmptyState,
  PageHeading,
  ProgressBar,
} from "@/shared/ui/primitives";
import { ContentQuestions } from "@/modules/teacher/annotations/components/content-questions";
import { FeedbackForm } from "../components/feedback-form";
import type { Course } from "@/shared/contracts";

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

export async function TeacherStudents({ courseId }: { courseId?: string } = {}) {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return <RoleGate expected="teacher" />;
  const [workspace, annotationPage] = await Promise.all([
    getWorkspace(actor),
    platformExtensions.annotations.listForTeacher(actor, { limit: 100, courseId }),
  ]);
  const annotations = annotationPage.ok ? annotationPage.data.items : [];
  return (
    <>
      <PageHeading
        eyebrow="PARTICIPATION & FEEDBACK"
        title="Teaching Management"
        description="Review course participation and submissions, and guide each learner."
      />
      <div id="private-notes" className="inline-note scroll-mt-6">
        <Users size={17} />
        <span>
          Participation appears here after enrollment. Progress is based on
          submitted activities.
        </span>
      </div>
      {!workspace.enrollments.length ? (
        <EmptyState title="No students enrolled yet">
          Publish a course to start receiving enrollments and activity
          submissions.
        </EmptyState>
      ) : (
        workspace.enrollments.filter((enrollment) => !courseId || enrollment.courseId === courseId).map((enrollment) => {
          const course = workspace.courses.find(
            (item) => item.id === enrollment.courseId,
          );
          if (!course) return null;
          const progress = calculateProgress(
            course,
            workspace.submissions,
            enrollment.studentId,
          );
          const submissions = workspace.submissions
            .filter(
              (item) =>
                item.courseId === course.id &&
                item.studentId === enrollment.studentId &&
                item.courseVersion === course.version,
            )
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const studentAnnotations = annotations.filter(
            (annotation) =>
              annotation.courseId === course.id &&
              annotation.student.id === enrollment.studentId,
          );
          const annotationContext = Object.fromEntries(
            course.lessons.flatMap((lesson) =>
              lesson.blocks.map((block) => [
                block.id,
                {
                  lessonTitle: lesson.title,
                  label:
                    block.type === "text"
                      ? block.body.replace(/\s+/g, " ").slice(0, 80)
                      : block.type === "activity"
                        ? block.activity.title
                        : block.type,
                },
              ]),
            ),
          );
          return (
            <section
              className="panel learner-panel"
              key={`${course.id}-${enrollment.studentId}`}
            >
              <div className="learner-header">
                <div className="learner-name">
                  <span className="avatar">S</span>
                  <div>
                    <h3>
                      {workspace.members.find(
                        (member) => member.id === enrollment.studentId,
                      )?.name ?? "Student"}
                    </h3>
                    <p className="muted">{course.title}</p>
                  </div>
                </div>
                <Badge tone={progress.percent === 100 ? "green" : "neutral"}>
                  {progress.percent === 100
                    ? "Activities submitted"
                    : "In progress"}
                </Badge>
              </div>
              <div className="learner-progress">
                <ProgressBar percent={progress.percent} />
                <span>
                  {progress.done} / {progress.total} activities
                </span>
              </div>
              {submissions.length ? (
                submissions.map((submission) => (
                  <details className="submission-detail" key={submission.id}>
                    <summary>
                      {activityTitle(course, submission.activityId)} ·{" "}
                      {new Date(submission.createdAt).toLocaleString("en-US", {
                        timeZone: "Asia/Shanghai",
                      })}
                    </summary>
                    <h4>Student answer</h4>
                    <p className="prose-text">
                      {readableAnswer(
                        course,
                        submission.activityId,
                        submission.answer,
                      )}
                    </p>
                    <h4>Learning feedback</h4>
                    <p className="prose-text muted">{submission.aiFeedback}</p>
                  </details>
                ))
              ) : (
                <p className="muted">Enrolled; no activities submitted yet.</p>
              )}
              <FeedbackForm
                courseId={course.id}
                studentId={enrollment.studentId}
              />
              <ContentQuestions
                courseId={course.id}
                annotations={studentAnnotations}
                context={annotationContext}
              />
            </section>
          );
        })
      )}
    </>
  );
}
