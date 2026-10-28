import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Target } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { toSafeActivity } from "@/shared/contracts";
import { Badge, PageHeading, ProgressBar } from "@/shared/ui/primitives";
import { StudentCourseDiscussion } from "@/modules/student/discussions/screens/course-discussion";
import { ActivityForm } from "../../activities/components/activity-form";
import { EnrollButton } from "../../activities/components/enroll-button";
import { QuizForm } from "../../activities/components/quiz-form";

export async function StudentCourseDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const workspace = await getWorkspace(user);
  const course = workspace.courses.find((item) => item.id === id);
  if (!course) notFound();
  const enrolled = workspace.enrollments.some((item) => item.courseId === id);
  const progress = calculateProgress(course, workspace.submissions, user.id);
  return (
    <>
      <Link href="/student" className="back-link">
        <ArrowLeft size={15} />
        Back to Marketplace
      </Link>
      <PageHeading
        eyebrow={course.subject}
        title={course.title}
        description={course.description}
        action={
          course.visibility === "personal" ? (
            <Link
              href={`/student/courses/${course.id}/edit`}
              className="button secondary"
            >
              <Pencil size={15} />
              Edit course
            </Link>
          ) : undefined
        }
      />
      <div className="detail-grid">
        <div>
          {!enrolled ? (
            <section className="panel join-panel">
              <Target size={36} strokeWidth={1.2} />
              <h2>Ready to explore this topic?</h2>
              <p className="muted">
                Enroll to complete activities, receive feedback, and save your
                progress.
              </p>
              <EnrollButton courseId={course.id} />
            </section>
          ) : (
            course.lessons.map((lesson, index) => (
              <section
                className="panel lesson-panel"
                id={lesson.id}
                key={lesson.id}
              >
                <p className="eyebrow">
                  LESSON {String(index + 1).padStart(2, "0")}
                </p>
                <h2>{lesson.title}</h2>
                {lesson.blocks.map((block) => {
                  const attempts =
                    block.type === "activity"
                      ? workspace.submissions
                          .filter(
                            (item) =>
                              item.courseId === course.id &&
                              item.courseVersion === course.version &&
                              item.activityId === block.activity.id,
                          )
                          .slice()
                          .sort((a, b) =>
                            b.createdAt.localeCompare(a.createdAt),
                          )
                      : [];
                  const latest = attempts[0];
                  return block.type === "text" ? (
                    <p className="prose-text" key={block.id}>
                      {block.body}
                    </p>
                  ) : block.type === "activity" &&
                    block.activity.type === "reflection" ? (
                    <ActivityForm
                      key={block.id}
                      courseId={course.id}
                      activity={block.activity}
                      latest={latest}
                      history={attempts}
                    />
                  ) : block.type === "activity" &&
                    block.activity.type === "quiz" ? (
                    <QuizForm
                      key={block.id}
                      courseId={course.id}
                      activity={toSafeActivity(block.activity)}
                      latest={latest}
                      history={attempts}
                    />
                  ) : (
                    <div key={block.id} className="activity-preview">
                      <p>
                        Renderer not yet available for:
                        {block.type === "activity"
                          ? block.activity.type
                          : block.type}
                      </p>
                    </div>
                  );
                })}
              </section>
            ))
          )}
        </div>
        <aside className="panel course-summary">
          <Badge tone="green">{course.lessons.length} lessons</Badge>
          <h3>What you will learn</h3>
          <ul>
            {course.goals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
          <hr />
          <h3>Learning progress</h3>
          <ProgressBar percent={progress.percent} />
          <p className="muted">
            {progress.done} / {progress.total} activities submitted
          </p>
          <p className="form-hint">
            Completion records activity submissions, not mastery.
          </p>
          <hr />
          <Link href="/student/progress" className="text-link">
            View learning records and teacher feedback →
          </Link>
        </aside>
      </div>
      {enrolled && (
        <StudentCourseDiscussion
          courseId={course.id}
          courseVersion={course.version}
        />
      )}
    </>
  );
}
