import { DeleteCourseButton } from "@/modules/platform/components/delete-course-button";
import { CourseOutline } from "@/shared/ui/course-outline";
import { Suspense } from "react";
import { subjectLabel } from "@/shared/ui/course-catalog";
import { courseLevel, lessonsAtLevel } from "@/shared/contracts";
import { CourseLevelNavigation } from "@/shared/ui/course-level-navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import {
  calculateProgress,
  getCurrentUser,
  canDeleteOwnedCourse,
  getStudentCourseContext,
} from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { toSafeActivity } from "@/shared/contracts";
import { Badge, PageHeading, ProgressBar } from "@/shared/ui/primitives";
import { StudentCourseDiscussion } from "@/modules/student/discussions/screens/course-discussion";
import { BlockComment } from "@/modules/student/annotations/components/block-comment";
import type { AnnotationContext } from "@/modules/student/annotations/components/my-annotations";
import { StudentCourseAnnotations } from "@/modules/student/annotations/screens/course-annotations";
import { ActivityForm } from "../../activities/components/activity-form";
import { LeaveCourseButton } from "../../activities/components/leave-course-button";
import { EnrollButton } from "../../activities/components/enroll-button";
import { QuizForm } from "../../activities/components/quiz-form";
import { LessonCompleteButton } from "../components/lesson-complete-button";

export async function StudentCourseDetail({
  id,
  level: rawLevel,
}: {
  id: string;
  level?: string;
}) {
  const user = await getCurrentUser();
  if (user.role !== "student") return <RoleGate expected="student" />;
  const context = await getStudentCourseContext(user, id);
  if (!context) notFound();
  const {
    course,
    enrolled,
    activeLevel,
    classManaged,
    submissions,
    lessonCompletions,
  } = context;
  const level = rawLevel ? courseLevel(rawLevel) : (activeLevel ?? "beginner");
  const canStudy = enrolled && activeLevel === level;
  const deletable =
    course.ownerId === user.id && (await canDeleteOwnedCourse(user, id));
  const lessons = lessonsAtLevel(course.lessons, level);
  const progress = calculateProgress(
    { ...course, lessons },
    submissions,
    user.id,
    level,
  );
  const completedLessonIds = new Set(
    lessonCompletions
      .filter(
        (item) =>
          item.courseId === course.id &&
          item.courseVersion === course.version &&
          item.studentId === user.id &&
          courseLevel(item.difficulty) === level,
      )
      .map((item) => item.lessonId),
  );
  const lessonsDone = lessons.filter((lesson) =>
    completedLessonIds.has(lesson.id),
  ).length;
  const lessonPercent = lessons.length
    ? Math.round((lessonsDone / lessons.length) * 100)
    : 0;
  const annotationContext: AnnotationContext = Object.fromEntries(
    lessons.flatMap((lesson) =>
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
        eyebrow={subjectLabel(course.subject, course.title)}
        title={course.title}
        description={course.description}
        action={
          course.visibility === "personal" ? (
            <div className="heading-actions">
              {deletable && (
                <DeleteCourseButton courseId={course.id} title={course.title} />
              )}
              <Link
                href={`/student/courses/${course.id}/edit`}
                className="button secondary"
              >
                <Pencil size={15} />
                Edit course
              </Link>
            </div>
          ) : enrolled && !classManaged && course.ownerId !== user.id ? (
            <LeaveCourseButton courseId={course.id} />
          ) : undefined
        }
      />
      {enrolled && classManaged && (
        <p className="form-hint">
          Class course · Enrollment is managed by your teacher.
        </p>
      )}
      {canStudy && (
        <p className="form-hint">
          Private note: ask your teacher about this exact part. Only you and
          your teacher can see it.
        </p>
      )}
      <CourseLevelNavigation value={level} href={`/student/courses/${id}`} />
      {!lessons.length && (
        <section className="panel mb-6">
          <p>No {level} materials have been generated yet.</p>
        </section>
      )}
      <div className="detail-grid">
        <div>
          {!canStudy ? (
            <section className="panel course-outline-panel">
              <CourseOutline
                title={course.title}
                description={course.description}
                level={level}
                lessons={lessons}
              />
              {!lessons.length ? (
                <p className="muted">
                  Materials for this difficulty are not available yet.
                </p>
              ) : classManaged && !enrolled ? (
                <p className="muted">
                  This course is managed by a class. Ask your teacher to add
                  you.
                </p>
              ) : (
                <EnrollButton
                  courseId={course.id}
                  level={level}
                  activeLevel={activeLevel}
                  version={course.version}
                />
              )}
            </section>
          ) : (
            lessons.map((lesson, index) => (
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
                    difficulty={level}
                    courseVersion={course.version}
                    lessonId={lesson.id}
                    completed={completedLessonIds.has(lesson.id)}
                  />
                </div>
                {lesson.blocks.map((block) => {
                  const attempts =
                    block.type === "activity"
                      ? submissions
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
                          difficulty={level}
                          activity={block.activity}
                          latest={latest}
                          history={attempts}
                        />
                      ) : block.type === "activity" &&
                        block.activity.type === "quiz" ? (
                        <QuizForm
                          courseId={course.id}
                          difficulty={level}
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
          <Badge tone="green">{lessons.length} lessons</Badge>
          <h3>What you will learn</h3>
          <ul>
            {course.goals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
          <hr />
          {canStudy ? (
            <>
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
                {lessonsDone} / {lessons.length} lessons completed
              </p>
              <hr />
              <Link href="/student/progress" className="text-link">
                View learning records and teacher feedback →
              </Link>
            </>
          ) : (
            <>
              <p className="form-hint">
                {activeLevel
                  ? `Currently enrolled: ${activeLevel}. Switch difficulty to start this learning route.`
                  : "Choose a difficulty and enroll to start learning."}
              </p>
            </>
          )}
        </aside>
      </div>
      {canStudy && (
        <Suspense
          fallback={
            <section className="panel mt-6" aria-busy="true">
              <p className="muted">Loading notes…</p>
            </section>
          }
        >
          <StudentCourseAnnotations
            courseId={course.id}
            courseVersion={course.version}
            context={annotationContext}
          />
        </Suspense>
      )}
      {canStudy && (
        <Suspense
          fallback={
            <section className="panel mt-6" aria-busy="true">
              <p className="muted">Loading course Q&amp;A…</p>
            </section>
          }
        >
          <StudentCourseDiscussion
            courseId={course.id}
            courseVersion={course.version}
          />
        </Suspense>
      )}
    </>
  );
}
