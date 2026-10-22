import { Users } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import {
  Badge,
  EmptyState,
  PageHeading,
  ProgressBar,
} from "@/shared/ui/primitives";
import { FeedbackForm } from "../components/feedback-form";
import type { Course } from "@/shared/contracts";

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

export async function TeacherStudents() {
  const actor = await getCurrentUser();
  if (actor.role !== "teacher") return <RoleGate expected="teacher" />;
  const workspace = await getWorkspace(actor);
  return (
    <>
      <PageHeading
        eyebrow="PARTICIPATION & FEEDBACK"
        title="Teaching Management"
        description="Review course participation and submissions, and guide each learner."
      />
      <div className="inline-note">
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
        workspace.enrollments.map((enrollment) => {
          const course = workspace.courses.find(
            (item) => item.id === enrollment.courseId,
          );
          if (!course) return null;
          const progress = calculateProgress(
            course,
            workspace.submissions,
            enrollment.studentId,
          );
          const submissions = workspace.submissions.filter(
            (item) =>
              item.courseId === course.id &&
              item.studentId === enrollment.studentId &&
              item.courseVersion === course.version,
          );
          const latestByActivity = [
            ...new Map(
              submissions.map((item) => [item.activityId, item]),
            ).values(),
          ];
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
              {latestByActivity.length ? (
                latestByActivity.map((submission) => (
                  <details className="submission-detail" key={submission.id}>
                    <summary>View latest answers and feedback</summary>
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
            </section>
          );
        })
      )}
    </>
  );
}
