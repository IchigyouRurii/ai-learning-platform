import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Target } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  getWorkspace,
  isCourseManagedByClass,
  platformExtensions,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { toSafeActivity } from "@/shared/contracts";
import { Badge, PageHeading, ProgressBar } from "@/shared/ui/primitives";
import { StudentCourseDiscussion } from "@/modules/student/discussions/screens/course-discussion";
import { BlockComment } from "@/modules/student/annotations/components/block-comment";
import {
  MyAnnotations,
  type AnnotationContext,
} from "@/modules/student/annotations/components/my-annotations";
import { ActivityForm } from "../../activities/components/activity-form";
import { EnrollButton } from "../../activities/components/enroll-button";
import { QuizForm } from "../../activities/components/quiz-form";
import { LessonCompleteButton } from "../components/lesson-complete-button";

export async function StudentCourseDetail({ id }: { id: string }) {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const workspace = await getWorkspace(user);
  const course = workspace.courses.find((item) => item.id === id);
  if (!course) notFound();
  const enrolled = workspace.enrollments.some((item) => item.courseId === id);
  const classManaged = await isCourseManagedByClass(course.id);
  const progress = calculateProgress(course, workspace.submissions, user.id);
  const completedLessonIds = new Set(
    (workspace.lessonCompletions ?? [])
      .filter(
        (item) =>
          item.courseId === course.id &&
          item.courseVersion === course.version &&
          item.studentId === user.id,
      )
      .map((item) => item.lessonId),
  );
  const lessonsDone = course.lessons.filter((lesson) =>
    completedLessonIds.has(lesson.id),
  ).length;
  const lessonPercent = course.lessons.length
    ? Math.round((lessonsDone / course.lessons.length) * 100)
    : 0;
  const annotationResult = enrolled
    ? await platformExtensions.annotations.listMine(user, {
        courseId: course.id,
        courseVersion: course.version,
        limit: 100,
      })
    : null;
  const annotations = annotationResult?.ok ? annotationResult.data.items : [];
  const annotationContext: AnnotationContext = Object.fromEntries(
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
      {enrolled && (
        <p className="form-hint">
          Private note: ask your teacher about this exact part. Only you and
          your teacher can see it.
        </p>
      )}
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
              {classManaged ? (
                <p className="muted">
                  This course is managed by a class. Ask your teacher to add you
                  to the class.
                </p>
              ) : (
                <EnrollButton courseId={course.id} />
              )}
            </section>
          ) : (
            course.lessons.map((lesson, index) => (
              <section
                className="panel lesson-panel"
                id={lesson.id}
                key={lesson.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">
                      LESSON {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2>{lesson.title}</h2>
                  </div>
                  <LessonCompleteButton
                    courseId={course.id}
                    courseVersion={course.version}
                    lessonId={lesson.id}
                    completed={completedLessonIds.has(lesson.id)}
                  />
                </div>
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
                  return (
                    <div
                      key={block.id}
                      data-block-id={block.id}
                      className="grid gap-2"
                    >
                      {block.type === "text" ? (
                        <p className="prose-text">{block.body}</p>
                      ) : block.type === "activity" &&
                        block.activity.type === "reflection" ? (
                        <ActivityForm
                          courseId={course.id}
                          activity={block.activity}
                          latest={latest}
                          history={attempts}
                        />
                      ) : block.type === "activity" &&
                        block.activity.type === "quiz" ? (
                        <QuizForm
                          courseId={course.id}
                          activity={toSafeActivity(block.activity)}
                          latest={latest}
                          history={attempts}
                        />
                      ) : (
                        <div className="activity-preview">
                          <p>
                            Renderer not yet available for:
                            {block.type === "activity"
                              ? block.activity.type
                              : block.type}
                          </p>
                        </div>
                      )}
                      <BlockComment
                        courseId={course.id}
                        courseVersion={course.version}
                        lessonId={lesson.id}
                        blockId={block.id}
                      />
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
            Activity completion records submissions, not mastery.
          </p>
          <hr />
          <h3>Lesson completion</h3>
          <ProgressBar percent={lessonPercent} />
          <p className="muted">
            {lessonsDone} / {course.lessons.length} lessons completed
          </p>
          <hr />
          <Link href="/student/progress" className="text-link">
            View learning records and teacher feedback →
          </Link>
        </aside>
      </div>
      {enrolled && (
        <MyAnnotations
          courseId={course.id}
          annotations={annotations}
          context={annotationContext}
        />
      )}
      {enrolled && (
        <StudentCourseDiscussion
          courseId={course.id}
          courseVersion={course.version}
        />
      )}
    </>
  );
}
