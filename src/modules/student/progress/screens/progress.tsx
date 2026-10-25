import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { EmptyState, PageHeading, ProgressBar } from "@/shared/ui/primitives";

export async function StudentProgress() {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const workspace = await getWorkspace(user);
  const courses = workspace.courses.filter((course) =>
    workspace.enrollments.some((item) => item.courseId === course.id),
  );
  const submissions = workspace.submissions
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <PageHeading
        eyebrow="MY LEARNING"
        title="Every step counts."
        description="Review your progress and feedback from your teachers."
      />
      <section className="panel">
        <h2>In progress</h2>
        {!courses.length ? (
          <EmptyState title="No enrolled courses yet">
            Visit the marketplace to find a topic that interests you.
          </EmptyState>
        ) : (
          courses.map((course) => {
            const progress = calculateProgress(
              course,
              workspace.submissions,
              user.id,
            );
            return (
              <div className="progress-row" key={course.id}>
                <div>
                  <Link href={`/student/courses/${course.id}`}>
                    <h3>{course.title}</h3>
                  </Link>
                  <p className="muted">
                    {progress.done} / {progress.total} activities submitted
                  </p>
                </div>
                <div className="progress-cell">
                  <strong>{progress.percent}%</strong>
                  <ProgressBar percent={progress.percent} />
                </div>
                <Link
                  href={`/student/courses/${course.id}`}
                  className="button secondary"
                >
                  Continue learning
                </Link>
              </div>
            );
          })
        )}
      </section>
      <section className="panel feedback-section">
        <div className="section-heading">
          <h2>
            <MessageSquareText size={20} />
            Teacher feedback
          </h2>
        </div>
        {!workspace.feedback.length ? (
          <p className="muted">Feedback from your teachers will appear here.</p>
        ) : (
          workspace.feedback.toReversed().map((feedback) => (
            <article className="feedback-note" key={feedback.id}>
              <strong>
                {workspace.courses.find(
                  (course) => course.id === feedback.courseId,
                )?.title ?? "Course feedback"}
              </strong>
              <p className="prose-text">{feedback.message}</p>
              <small>
                {new Date(feedback.createdAt).toLocaleDateString("en-US", {
                  timeZone: "Asia/Shanghai",
                })}
              </small>
            </article>
          ))
        )}
      </section>
      <section className="panel feedback-section">
        <div className="section-heading">
          <h2>
            <MessageSquareText size={20} />
            Answer and AI feedback history
          </h2>
        </div>
        {!submissions.length ? (
          <p className="muted">
            Your quiz and reflection attempts will appear here with the AI
            feedback for each attempt.
          </p>
        ) : (
          submissions.map((submission) => {
            const course = workspace.courses.find(
              (item) => item.id === submission.courseId,
            );
            const activity = course?.lessons
              .flatMap((lesson) => lesson.blocks)
              .find(
                (block) =>
                  block.type === "activity" &&
                  block.activity.id === submission.activityId,
              );
            return (
              <article className="feedback-note" key={submission.id}>
                <strong>
                  {course?.title ?? "Course"} ·{" "}
                  {activity?.type === "activity"
                    ? activity.activity.title
                    : submission.activityId}
                </strong>
                <small>
                  Version {submission.courseVersion} ·{" "}
                  {new Date(submission.createdAt).toLocaleString("en-US", {
                    timeZone: "Asia/Shanghai",
                  })}
                </small>
                <p className="prose-text muted">{submission.aiFeedback}</p>
              </article>
            );
          })
        )}
      </section>
    </>
  );
}
