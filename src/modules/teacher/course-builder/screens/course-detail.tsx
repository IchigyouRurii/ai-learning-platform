import { courseLevel, lessonsAtLevel } from "@/shared/contracts";
import { CourseLevelNavigation } from "@/shared/ui/course-level-navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { getCourseDocumentForAuthor, getCurrentUser } from "@/modules/platform";
import { RoleGate } from "@/modules/platform/components/app-shell";
import { Badge, PageHeading } from "@/shared/ui/primitives";
import { LessonPages } from "@/shared/ui/lesson-pages";
import { TeacherCourseDiscussion } from "@/modules/teacher/discussions/screens/course-discussion";
import { PublishButton } from "../components/publish-button";

export async function TeacherCourseDetail({
  id,
  level: rawLevel,
}: {
  id: string;
  level?: string;
}) {
  const user = await getCurrentUser();
  if (user.role !== "teacher") return <RoleGate expected="teacher" />;
  const document = await getCourseDocumentForAuthor(user, id).catch(() => null);
  if (!document) notFound();
  const course = document.content;
  const level = courseLevel(rawLevel);
  const lessons = lessonsAtLevel(course.lessons, level);
  return (
    <>
      <Link href="/teacher/creations" className="back-link">
        <ArrowLeft size={15} />
        Back to My Creation
      </Link>
      <PageHeading
        eyebrow="COURSE PREVIEW"
        title={course.title}
        description={course.description}
        action={
          <div className="teacher-course-actions">
            <Badge tone={document.publishedVersion ? "green" : "amber"}>
              {document.publishedVersion
                ? `Published v${document.publishedVersion}`
                : "Unpublished draft"}
            </Badge>
            <div className="teacher-course-action-buttons">
              <Link
                href={`/teacher/courses/${id}/edit?level=${level}`}
                className="button secondary"
              >
                <Pencil size={15} />
                Edit course
              </Link>
            </div>
          </div>
        }
      />
      {document.moderationStatus === "withdrawn" && (
        <section className="panel mb-6" role="status">
          <Badge tone="amber">Withdrawn from learning</Badge>
          <p className="mt-2">{document.withdrawalReason}</p>
          <p className="form-hint">
            You can review and edit this course. Publishing a revision does not
            remove the administrator’s withdrawal.
          </p>
        </section>
      )}
      <CourseLevelNavigation value={level} href={`/teacher/courses/${id}`} />
      {!lessons.length && (
        <section className="panel mb-6">
          <p>No {level} materials have been generated yet.</p>
        </section>
      )}
      <div className="detail-grid">
        <div>
          {lessons.map((lesson, index) => (
            <section className="panel lesson-panel" key={lesson.id}>
              <p className="eyebrow">
                LESSON {String(index + 1).padStart(2, "0")}
              </p>
              <h2>{lesson.title}</h2>
              {lesson.blocks.map((block) =>
                block.type === "text" ? (
                  <LessonPages body={block.body} key={block.id} />
                ) : block.type === "activity" ? (
                  <div className="activity-preview" key={block.id}>
                    <Badge>
                      {block.activity.type === "quiz" ? "Quiz" : "Activity"}
                    </Badge>
                    <h3>{block.activity.title}</h3>
                    <p>{block.activity.prompt}</p>
                    <details>
                      <summary>View assessment criteria</summary>
                      <p className="muted">{block.activity.rubric}</p>
                    </details>
                    {block.activity.type === "quiz" && (
                      <ol className="author-quiz">
                        {block.activity.questions?.map((question) => (
                          <li key={question.id}>
                            <strong>{question.prompt}</strong>
                            <ul>
                              {question.options.map((option) => (
                                <li
                                  key={option.id}
                                  className={
                                    question.correctOptionIds.includes(
                                      option.id,
                                    )
                                      ? "correct-option"
                                      : undefined
                                  }
                                >
                                  {option.text}
                                  {question.correctOptionIds.includes(option.id)
                                    ? " ✓"
                                    : ""}
                                </li>
                              ))}
                            </ul>
                            <p className="muted">
                              Explanation: {question.explanation}
                            </p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ) : (
                  <p className="muted" key={block.id}>
                    Media: {block.type}(renderer not yet available)
                  </p>
                ),
              )}
            </section>
          ))}
        </div>
        <aside className="panel course-summary">
          <p className="eyebrow">COURSE NOTES</p>
          <h3>Learning goals</h3>
          <ul>
            {course.goals.map((goal, index) => (
              <li key={index}>{goal}</li>
            ))}
          </ul>
          {course.attachments?.length ? (
            <>
              <hr />
              <h3>Course materials</h3>
              <ul className="attachment-list">
                {course.attachments.map((attachment) => (
                  <li key={attachment.materialId}>
                    <a
                      href={`/api/materials/${attachment.materialId}`}
                      className="text-link"
                    >
                      {attachment.filename}
                    </a>
                    <small>
                      {(attachment.sizeBytes / 1024).toFixed(0)} KB
                    </small>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <hr />
          <p className="form-hint">
            Draft revision {document.draftRevision}
            {document.publishedVersion
              ? ` · Published version ${document.publishedVersion}`
              : ""}
          </p>
          {!document.publishedVersion ? (
            <>
              <p className="form-hint">
                Check content accuracy and activity suitability before
                publishing.
              </p>
              <PublishButton courseId={id} />
            </>
          ) : (
            <p className="muted">
              This course is available to students. Edit the draft and publish a
              new version when you are ready.
            </p>
          )}
        </aside>
      </div>
      {document.publishedVersion !== null && (
        <section id="course-discussions" className="scroll-mt-6">
          <TeacherCourseDiscussion courseId={id} />
        </section>
      )}
    </>
  );
}
